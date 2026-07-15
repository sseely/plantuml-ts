/**
 * renderer-draw-sequence.ts — G1b/J1 write-set expansion (journaled,
 * mechanism C): the `SvekResult#drawU` draw-order sequence (cluster, then
 * leaf, then edge), extracted verbatim out of `renderer.ts` so it can be
 * shared with `layout-ink-shift.ts#computeInkShift` (the `SvekResult
 * #calculateDimension` ink-extent SHIFT half of the same upstream recipe
 * `renderer-ink-extent.ts#computeDocumentDims` already implements the DIMS
 * half of) without `layout.ts` importing `renderer.ts` directly (would
 * create an import-graph loop through `renderer.ts`'s own type-only
 * `layout.js` import — see decision-journal.md G1b/J1). No behavior change:
 * `renderer.ts#renderDescription` now imports these instead of defining
 * them locally.
 *
 * Upstream chain, doc comments preserved verbatim from their original
 * `renderer.ts` location (still accurate — the move is purely mechanical).
 */
import type { UGraphic } from '../../core/klimt/UGraphic.js';
import type { Theme } from '../../core/theme.js';
import type { DescriptionGeometry, DescriptionNodeGeo, DescriptionEdgeGeo } from './layout-helpers.js';
import type { UidPlan } from './renderer-uid.js';
import { buildCluster } from './renderer-cluster.js';
import { drawEntity } from './renderer-entity.js';
import { drawEdge } from './renderer-edge.js';

/**
 * I3b write-set expansion (journaled): splits `geo.nodes` into a containers
 * list and a leaves list, matching `SvekResult#drawU`'s TWO SEPARATE draw
 * phases via `GraphvizImageBuilder.buildImage:226-227` --
 * `printGroups(dotData.getRootGroup())` (every group, recursively, AND that
 * group's own direct leaf children -- `printGroup`: `openCluster(g);
 * printEntities(g.leafs()); printGroups(g); closeCluster();`, i.e. a group's
 * OWN leaves are registered before any of its NESTED subgroups' members)
 * runs to completion BEFORE `printEntities(getUnpackagedEntities())` (every
 * top-level entity with NO group parent) even starts. So every group-owned
 * leaf, at any depth, draws before ANY top-level ungrouped leaf, regardless
 * of their relative declaration order in the source -- this is a DOCUMENT
 * (draw/position) ordering concern only, entirely separate from uid VALUE
 * assignment (`renderer-uid.ts`, parse-time `creationIndex`).
 *
 * Containers themselves stay a simple pre-order walk (`Bibliotekon
 * #allCluster()`'s registration order = `openCluster` call order, which
 * happens strictly top-down: a parent's cluster is always registered before
 * any of its nested subgroups' clusters) — that part of the pre-I3b walk
 * was already correct and is unchanged here.
 */
export function collectByKind(nodes: readonly DescriptionNodeGeo[]): {
  containers: DescriptionNodeGeo[];
  leaves: DescriptionNodeGeo[];
} {
  const containers: DescriptionNodeGeo[] = [];
  const leaves: DescriptionNodeGeo[] = [];

  // "Is this a group entity for draw-order purposes" -- `children.length >
  // 0` is the unambiguous, always-true signal (only a container can have
  // children); `declaredAsGroup === true` ADDITIONALLY catches the
  // EXPLICITLY-braced-but-EMPTY case (`component X { }`), which has zero
  // children yet still went through `GraphvizImageBuilder`'s group-sibling
  // iteration upstream (java:416-418, muted+leaf-registered immediately,
  // but positioned among group siblings, never among true top-level/nested
  // leaves) -- see `DescriptionNodeGeo.declaredAsGroup`'s doc comment.
  // `declaredAsGroup` is optional/additive (real `parseDescription()` output
  // always sets it on every container; hand-built test geometries may omit
  // it on a non-empty one, which `children.length > 0` alone still catches
  // correctly).
  function isGroupLike(node: DescriptionNodeGeo): boolean {
    return node.children.length > 0 || node.declaredAsGroup === true;
  }

  // Nested level (`GraphvizImageBuilder#printGroup(g)`, java:425-436):
  // `openCluster(g); printEntities(g.leafs()); printGroups(g);
  // closeCluster();` -- `g`'s OWN true (non-group) leaf children draw
  // FIRST, then its group-type children (empty-declared OR real) in THEIR
  // OWN sibling order -- an empty declared group is muted+leaf-registered
  // immediately (java:416-418), a non-empty one recurses.
  function visitGroup(node: DescriptionNodeGeo): void {
    containers.push(node);
    for (const child of node.children) {
      if (!isGroupLike(child)) leaves.push(child);
    }
    for (const child of node.children) {
      if (!isGroupLike(child)) continue;
      if (child.children.length > 0) visitGroup(child);
      else leaves.push(child);
    }
    // Faithful 1:1 port of `GraphvizImageBuilder#printGroup`'s nested-level
    // leaf/subgroup split (cited above) -- CCN reflects that dispatch
    // shape, not incidental complexity.
    // #lizard forgives
  }

  // Root level (`GraphvizImageBuilder#buildImage:226-227`):
  // `printGroups(getRootGroup()); printEntities(getUnpackagedEntities());`
  // -- the OPPOSITE order from a nested level: ALL group-type top-level
  // nodes (empty-declared OR real) draw FIRST, in sibling order, then ALL
  // true top-level leaves draw LAST.
  for (const node of nodes) {
    if (!isGroupLike(node)) continue;
    if (node.children.length > 0) visitGroup(node);
    else leaves.push(node);
  }
  for (const node of nodes) {
    if (!isGroupLike(node)) leaves.push(node);
  }

  return { containers, leaves };
}

/** `SvekResult#drawU`'s first loop — every cluster, absolute position
 *  resolved internally by `Cluster#drawU` (see `renderer-cluster.ts`). */
export function drawClusters(
  ug: UGraphic, containers: readonly DescriptionNodeGeo[], theme: Theme, plan: UidPlan,
  respectHidden: boolean,
): void {
  for (const node of containers) {
    // G1 I-hideshow: `Cluster#drawU`'s own early return (svek/Cluster.java
    // :298-300) -- a hidden container draws NOTHING at all, not even its
    // border/title comment (component/mavuxi-16-jafi782's `a`). uid
    // assignment (`plan.nodeUid`, above) already ran unconditionally, so
    // skipping here never perturbs the `ent%04d` numbering sequence.
    // `respectHidden` is `false` ONLY for the LimitFinder ink-extent pass
    // (see `renderer.ts#renderDescription`'s doc comment on `draw`, and
    // `layout-ink-shift.ts#computeInkShift`) -- jar's own `LimitFinder
    // extends UGraphicNo`, whose `getParam()` is a hardcoded `UParamNull`
    // (`isHidden()` always `false`, klimt/UParamNull.java:56), so
    // `ug.apply(UHidden.HIDDEN)` has NO effect on that pass; the ink walk
    // measures a hidden entity's full extent even though the REAL draw
    // pass never paints it (jar-verified: component/ciboso-93-romi495's
    // canvas height of 169 reserves comp2's full box + edge even though
    // neither is drawn).
    if (respectHidden && node.hidden === true) continue;
    buildCluster(node, theme, plan.nodeUid.get(node.id)!).drawU(ug);
  }
}

/** `SvekResult#drawU`'s second loop — every leaf entity, translated to
 *  its absolute layout position by `renderer-entity.ts#drawEntity`. Text
 *  measurement is NOT threaded here — `ug` already carries the active
 *  measurer via `getStringBounder()` (see `renderer.ts`'s doc comment). */
export function drawEntities(
  ug: UGraphic,
  leaves: readonly DescriptionNodeGeo[],
  theme: Theme,
  plan: UidPlan,
  sprites: DescriptionGeometry['sprites'],
  respectHidden: boolean,
): void {
  for (const node of leaves) {
    // G1 I-hideshow: see `drawClusters`'s doc comment for the
    // `respectHidden`/LimitFinder split. `SvekResult#drawU`'s per-shape
    // `getParam().isHidden()` gate (klimt/drawing/AbstractUGraphic.java
    // :141) suppresses every rect/text a hidden leaf would otherwise draw
    // on the REAL pass -- net visible output is identical to skipping the
    // draw call outright (this port emits no XML-comment equivalent of
    // jar's `<!--entity X-->`, so there is nothing else to preserve).
    if (respectHidden && node.hidden === true) continue;
    drawEntity(ug, node, theme, plan.nodeUid.get(node.id)!, sprites);
  }
  // Faithful 1:1 port of `SvekResult#drawU`'s second loop signature --
  // PARAM count mirrors the real per-shape draw dependencies (ug, node
  // list, theme, uid plan, sprite registry, hide/show gate), all load-
  // bearing per this function's own doc comment above.
  // #lizard forgives
}

/**
 * `SvekResult#drawU`'s third loop — every edge, in `edges` order (already
 * source order — see `layout-geo-post.ts#buildEdgeGeos`).
 *
 * Per-edge try/catch (T17 write-set expansion, journaled — mirrors
 * `Cluster#drawU`'s own established "one broken shape never aborts the
 * whole diagram" precedent, `src/core/svek/Cluster.ts`). The original
 * driver of this catch — a cross-container endpoint clip
 * (`clipSplineStart`/`clipSplineEnd`) splicing a spline's point array
 * down to a count that is not `1 + 3n`, which `SvekEdge`'s
 * `buildDotPathFromSplinePoints` (`svek-edge-geometry.ts`, T13) rejects
 * with a hard throw — has since been fixed at its origin (follow-up F1):
 * the clip is now a faithful port of upstream `DotPath#simulateCompound`
 * (`spline-clip.ts`), which clips bezier-by-bezier and so preserves the
 * `1 + 3n` invariant, so no edge is dropped for that reason. Verified:
 * `berufi-69-dara369` (edge `__note_1 -> SRFRet`,
 * previously clipped to 3 points) and `lirebi-26-voka556` now render
 * every edge; the full description golden corpus drops zero. The catch
 * is retained as a general safety net — the same "never throws, never
 * aborts the diagram" contract the pre-T17 renderer gave via a graceful
 * polyline fallback (see `renderer.test.ts`'s "obsolete tests" note) — so
 * any residual malformed shape degrades one edge, not the whole diagram.
 *
 * G1b/J1 write-set expansion (journaled): signature narrowed from `geo:
 * DescriptionGeometry` to `edges: readonly DescriptionEdgeGeo[]` (the only
 * field this function ever read) so `layout-ink-shift.ts#computeInkShift`
 * can pass a RAW (pre-shift) edge array that has no other `DescriptionGeometry`
 * field populated yet — Interface Segregation, not a behavior change.
 */
export function drawEdges(
  ug: UGraphic, edges: readonly DescriptionEdgeGeo[], theme: Theme, plan: UidPlan, respectHidden: boolean,
): void {
  // Upstream `SvekResult#drawU` (SvekResult.java:93-101): ONE `Set<String>
  // ids` created per diagram draw, shared across every edge via
  // `SvekEdge#setSharedIds` before that edge's own `drawU` — see
  // `drawEdge`'s doc comment (renderer-edge.ts).
  const sharedIds = new Set<string>();
  edges.forEach((edge, i) => {
    // G1 I-hideshow: see `drawClusters`'s doc comment for the
    // `respectHidden`/LimitFinder split. `SvekEdge#isHidden()`
    // (svek/SvekEdge.java:1283-1284 -> `Link#isHidden()`) -- an edge
    // touching a hidden entity draws nothing on the REAL pass
    // (jar-verified: component/ciboso-93-romi495's `comp1--comp2` edge is
    // entirely absent once `comp2` is hidden, but still fully
    // ink-measured). uid assignment (`plan.edgeUid`, above) already ran
    // unconditionally.
    if (respectHidden && edge.hidden === true) return;
    try {
      drawEdge(ug, edge, theme, plan.edgeUid[i]!, plan.nodeUid, sharedIds);
    } catch (err) {
      console.error('renderDescription: edge draw failed', edge.id, err);
    }
  });
}

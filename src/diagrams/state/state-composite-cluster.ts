/**
 * Non-autonom `Cluster` composite pass building — split out of
 * ./state-composite-pass.ts (mission A4 Phase L iter 16, 500-line file-cap
 * compliance; pure move, only the CONC-region-leaf mechanism is new — see
 * its own doc below). Mirrors state-composite-concurrent.ts's existing
 * split (same file-cap rationale, same "coherent unit on its own" note).
 *
 * @see ~/git/plantuml/.../svek/ClusterDotString.java
 * @see ~/git/plantuml/.../svek/GroupMakerState.java#getImage
 */

import type { State } from './ast.js';
import type { FontSpec } from '../../core/measurer.js';
import type { DotInputNode, DotInputCluster, DotLayoutResult } from '../../core/graph-layout.js';
import { splitCreoleLines } from './state-sizing.js';
import { zaentId } from './state-composite-classify.js';
import { getEntityPosition, isInputPosition, isOutputPosition } from './state-entity-position.js';
import { concurrentRegionScopeId } from './state-parse-state.js';
import {
  type DiagramCtx,
  type PassAccumulator,
  type GeoSpec,
  ANCHOR_SIZE,
  nextClusterId,
  resolveMember,
  addLocalPseudoNodes,
  addScopeNotes,
  addLevelEdges,
  buildLevelTransitionGeos,
} from './state-composite-pass.js';

/** Title dims for a composite's cluster label (svek's title TABLE — matches
 *  class-dot-graph.ts's namespace-title measurement precedent). */
function measureClusterTitle(display: string, ctx: DiagramCtx): { width: number; height: number } {
  const font: FontSpec = { family: ctx.theme.fontFamily, size: ctx.theme.fontSize };
  const lines = splitCreoleLines(display);
  let width = 0;
  let height = 0;
  for (const line of lines) {
    const m = ctx.measurer.measure(line, font);
    if (m.width > width) width = m.width;
    height += m.height;
  }
  return { width, height };
}

/** `SvekResult.calculateDimension`'s `delta(15,15)` -- a CONCURRENT_STATE
 *  region's raw graph image (`GroupMakerState.getImage():116-117` returns
 *  it DIRECTLY, never wrapped by `InnerStateAutonom`) adds a flat 15px to
 *  both width and height when the region re-enters its container's own
 *  pass as a flattened leaf; drawn content shifts so its own top-left
 *  sits at (6,6) inside that padded box (`moveDelta(6-minX,6-minY)`).
 * @see ~/git/plantuml/.../svek/SvekResult.java:130-134
 */
const REGION_LEAF_MARGIN = 15;
const REGION_LEAF_OFFSET = 6;
/** `GroupMakerState.getImage()`'s degenerate-empty-group branch
 *  (`countChildren()==0 && groups().size()==0`, checked BEFORE the
 *  CONCURRENT_STATE branch) -- a region with ZERO content (no states, no
 *  notes) never runs the real svek pipeline; it gets `EntityImageState`'s
 *  own min-size placeholder instead (mechanisms.md row 26's "empty body"
 *  case). Not exercised by any fixture in the corpus yet -- guarded here
 *  so a future truly-empty region doesn't silently emit a padded 15x15px
 *  node instead of matching this branch.
 * @see ~/git/plantuml/.../svek/GroupMakerState.java:113-114
 */
const EMPTY_REGION_MIN_SIZE = 50;

/** Tight bounding box of a pass's DRAWN content (all node/edge extents,
 *  nodes already shifted so the leftmost/topmost point sits at 0 --
 *  `shiftToOrigin`, graph-layout.ts) -- upstream's `TextBlockUtils.getMinMax`
 *  equivalent, WITHOUT `runPass`/`layoutGraph`'s own generic per-graph
 *  canvas margin (`MARGIN = 12`, graph-layout.ts's `canvasSize`) baked into
 *  `result.width`/`result.height`. That generic margin has no upstream
 *  counterpart in `SvekResult.calculateDimension()`'s OWN `delta(15, 15)`
 *  computation (SvekResult.java:130-135), which pads the TIGHT drawn
 *  bbox directly -- reusing `result.width`/`height` as-is here would
 *  double-count a margin upstream never applies at this step (mission A4
 *  Phase L iter 16: jijuze-43-ceva131's region-leaf size drift, verified
 *  via oracle DOT: `EMPTY_REGION_MIN_SIZE`-guarded single-state region's
 *  raw content is exactly its one node's own width/height, not
 *  `result.width`/`height`). Not exported -- `graph-layout.ts`'s `MARGIN`
 *  constant stays a private engine-internal convention; this recomputes
 *  the tight bbox from the SAME node/edge data `canvasSize` already uses,
 *  just without adding the margin.
 * @see ~/git/plantuml/.../svek/SvekResult.java:130-135
 */
function tightContentDimension(result: DotLayoutResult): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const n of result.nodes) {
    width = Math.max(width, n.x + n.width);
    height = Math.max(height, n.y + n.height);
  }
  for (const e of result.edges) {
    if (e.labelX !== undefined && e.labelWidth !== undefined) {
      width = Math.max(width, e.labelX + e.labelWidth / 2);
    }
    for (const p of e.points) {
      width = Math.max(width, p.x);
      height = Math.max(height, p.y);
    }
  }
  return { width, height };
}

/**
 * Build the flattened leaf that re-enters the CALLING (cluster) pass in
 * place of one `--`-delimited concurrent region — mission A4 Phase L iter
 * 16 (jijuze-43-ceva131: a self-referencing composite correctly classified
 * 'cluster' was flattening its regions straight into the parent cluster
 * with no pass boundary at all, losing graph-count parity), REWRITTEN
 * iteration 19 to a pure LOOKUP. Every CONC region is unconditionally
 * autarkic regardless of the ENCLOSING composite's own autonom/cluster
 * classification (`GroupType.CONCURRENT_STATE` short-circuits
 * `isAutarkic()` true, mechanisms.md §3) — so a region's own dedicated svek
 * pass is now ALWAYS built at the region's OWN globally-ordered
 * firing-order turn (`ctx.classify.firingOrder`,
 * state-composite-classify.ts's doc), by `buildConcurrentRegionPass`
 * (./state-composite-concurrent.ts), regardless of whether the OWNER ends
 * up 'autonom' or 'cluster'. Building it AGAIN here (the iter-16 original)
 * double-fired the region's pass — once via firing order, once inline —
 * producing an extra, oracle-mismatched graph (jijuze-43-ceva131 regressed
 * graphs=3 vs oracle's 2 until this rewrite).
 * @see ~/git/plantuml/.../svek/GroupMakerState.java:116-117
 */
function buildConcurrentRegionLeaf(
  s: State,
  regionNumber: number,
  ctx: DiagramCtx,
): { node: DotInputNode; spec: GeoSpec } {
  const regionId = concurrentRegionScopeId(s.id, regionNumber);
  const resolved = ctx.resolvedRegions.get(regionId);
  if (resolved === undefined) {
    // Cannot occur given firingOrder's depth-descending guarantee -- a
    // region is strictly deeper than its owning composite, hence already
    // resolved earlier in the same `resolveAllAutonomPasses` loop (mirrors
    // `buildConcurrentAutonomSpec`'s identical guard,
    // state-composite-concurrent.ts).
    throw new Error(`concurrent region "${regionId}" resolved out of firing order`);
  }
  if (resolved.result.nodes.length === 0) {
    return {
      node: { id: regionId, width: EMPTY_REGION_MIN_SIZE, height: EMPTY_REGION_MIN_SIZE, shape: 'rounded' },
      spec: { kind: 'state', id: regionId, stateKind: 'normal', display: '' },
    };
  }
  const content = tightContentDimension(resolved.result);
  const width = content.width + REGION_LEAF_MARGIN;
  const height = content.height + REGION_LEAF_MARGIN;
  return {
    node: { id: regionId, width, height, shape: 'rect' },
    spec: {
      kind: 'autonom',
      id: regionId,
      display: '',
      offset: { x: REGION_LEAF_OFFSET, y: REGION_LEAF_OFFSET },
      width,
      height,
      localStates: resolved.specs,
      localPositions: resolved.result,
      localTransitions: buildLevelTransitionGeos(resolved.acc, resolved.result),
    },
  };
}

/** Resolve one composite as a non-autonom `Cluster`: recurse its own
 *  children into the SAME pass accumulator (nesting via `parentId`), give
 *  every `--`-delimited region ITS OWN pass (`buildConcurrentRegionLeaf`),
 *  add the zaent anchor when needed, add its own scope-local `[*]`
 *  anchors, add its own inner transitions as edges of the SAME pass. */
export function resolveClusterComposite(
  s: State,
  acc: PassAccumulator,
  ctx: DiagramCtx,
  parentClusterId: string | undefined,
): GeoSpec {
  const clusterId = nextClusterId();
  const title = measureClusterTitle(s.display, ctx);
  const cluster: DotInputCluster = {
    id: clusterId,
    nodeIds: [],
    label: s.display,
    labelWidth: title.width,
    labelHeight: title.height,
    ...(parentClusterId !== undefined ? { parentId: parentClusterId } : {}),
  };
  acc.clusters.push(cluster);

  const directMembers = s.children;
  const childSpecs = directMembers.map((c) => resolveMember(c, acc, ctx, clusterId));
  for (const c of directMembers) {
    if (ctx.classify.kindOf.get(c.id) !== 'cluster') cluster.nodeIds.push(c.id);
  }
  const regionSpecs = s.concurrentRegions.map((_region, i) => {
    const { node, spec } = buildConcurrentRegionLeaf(s, i + 1, ctx);
    acc.nodes.push(node);
    cluster.nodeIds.push(node.id);
    return spec;
  });
  const pseudoSpecs = addLocalPseudoNodes(s.id, s.transitions, acc);
  for (const p of pseudoSpecs) cluster.nodeIds.push(p.id);
  addScopeNotes(s.id, ctx, acc, cluster);
  if (ctx.classify.needsAnchor.has(s.id)) {
    const anchorId = zaentId(s.id);
    // The POINT NODE is strictly narrower than the port-block gate itself
    // (ClassifyResult.needsZaentPoint's doc, state-composite-classify.ts) --
    // a composite with real non-border content in its `ee` wrapper needs no
    // placeholder (bujuta-44-rovo666, diteme-18-favi840); `applyBorderPointRanks`
    // below still fires (self-guards to a no-op with no direct border-point
    // children) so `cluster.portAnchorId` staying a valid (if nodeless) id is
    // harmless -- state diagrams always take the WithLabel branch, which
    // never reads `portAnchorId` (see `portChainLines`'s `!labelOnEe` guard).
    if (ctx.classify.needsZaentPoint.has(s.id)) {
      acc.nodes.push({ id: anchorId, width: ANCHOR_SIZE, height: ANCHOR_SIZE, shape: 'point' });
      cluster.nodeIds.push(anchorId);
    }
    applyBorderPointRanks(directMembers, cluster, anchorId);
  }
  addLevelEdges(s.id, s.transitions, acc, ctx);

  return { kind: 'cluster', id: s.id, display: s.display, children: [...pseudoSpecs, ...childSpecs, ...regionSpecs] };
  // #lizard forgives -- faithful port of ClusterDotString's envelope
  // assembly; each block below is one independently-conditional layer
  // (§2 of mechanisms.md), not decision complexity to simplify.
}

/** Group a non-autonom composite's DIRECT border-point (entry/exit/pin)
 *  children into `cluster.portRanks` by input/output position — reuses the
 *  same rank-group DOT shape as genuine PORTIN/PORTOUT ports (needed so the
 *  DOT-parity comparator's brace-stack `{rank=...}` quirk zeroes out this
 *  cluster's member count on BOTH sides symmetrically — see
 *  graph-layout.types.ts's `portRanksLabelOnEe` doc), with the WithLabel/
 *  no-chain rendering (state diagrams never produce PORTIN/PORTOUT, so the
 *  NoLabel/chained hasPort() branch never applies here). No-op when `s` has
 *  no border-point direct children. */
function applyBorderPointRanks(
  directMembers: readonly State[],
  cluster: DotInputCluster,
  anchorId: string,
): void {
  const inputs = directMembers.filter((c) => isInputPosition(getEntityPosition(c))).map((c) => c.id);
  const outputs = directMembers.filter((c) => isOutputPosition(getEntityPosition(c))).map((c) => c.id);
  if (inputs.length === 0 && outputs.length === 0) return;
  cluster.portRanks = [
    ...(inputs.length > 0 ? [{ rank: 'source' as const, nodeIds: inputs }] : []),
    ...(outputs.length > 0 ? [{ rank: 'sink' as const, nodeIds: outputs }] : []),
  ];
  cluster.portAnchorId = anchorId;
  cluster.portRanksLabelOnEe = true;
}

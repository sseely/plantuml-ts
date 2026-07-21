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
  sortSpecsByCreationIndex,
} from './state-composite-pass.js';

/** Title dims for a composite's cluster label (svek's title TABLE — matches
 *  class-dot-graph.ts's namespace-title measurement precedent). `lineCount`
 *  (G5 C3) gates `CLUSTER_TITLE_TABLE_HEIGHT`/`CLUSTER_HEADER_HEIGHT`
 *  eligibility below — jar-verified ONLY for a single-line title. */
function measureClusterTitle(display: string, ctx: DiagramCtx): { width: number; height: number; lineCount: number } {
  const font: FontSpec = { family: ctx.theme.fontFamily, size: ctx.theme.fontSize };
  const lines = splitCreoleLines(display);
  let width = 0;
  let height = 0;
  for (const line of lines) {
    const m = ctx.measurer.measure(line, font);
    if (m.width > width) width = m.width;
    height += m.height;
  }
  return { width, height, lineCount: lines.length };
}

/**
 * G5 C3, mechanism 16 shape half — jar-calibrated constants for a genuine
 * `'cluster'`-classified composite's single-line title reservation, verified
 * against the REAL PlantUML jar (not derived from `ClusterHeader.java`'s own
 * `getTitleAndAttributeHeight() - 5` Java-internal value, which this port's
 * own text-height convention — `height = font.size` per line, `measureCluster
 * Title` above — does not reproduce bit-for-bit; ledger.md §C2's own "C3+
 * queue" sub-item 3, resolved here by DECOUPLING the graphviz layout-space
 * RESERVATION from this port's text-height convention entirely, since the
 * FIXEDSIZE table's only role is telling graphviz how much space to reserve
 * -- the visible title text is drawn separately, by `renderer-composite-
 * box.ts`, using its OWN measured line width).
 *
 * `CLUSTER_TITLE_TABLE_HEIGHT` (fed to `DotInputCluster.titleTableHeight`,
 * consumed by `graph-layout-build.ts#addClusters`'s `setHtmlAttr` seam) is
 * the value G5 C2's own 15-point marker sweep found reproduces jar's real
 * gap through graphviz-ts's `gap = HEIGHT + 16` relationship: `3 + 16 = 19`.
 *
 * `CLUSTER_HEADER_HEIGHT` (the real header-to-divider gap `renderer-
 * composite-box.ts`'s new cluster shape draws at) was re-confirmed this
 * iteration on the FULL corpus (not just the 18/19-fixture sample C2 hand-
 * picked): a disposable probe (`scripts/_tmp-c3-cluster-probe.ts`, deleted
 * before finishing) walked every cached `test-results/dot-cache/state`
 * fixture's own `in.svg`'s `<g class="cluster">` element and found 132/134
 * real single-line-title font-size-14 samples at EXACTLY 19.0000px (the 2
 * exceptions,
 * `sosoxe-55-demi451`/`teseci-80-sivi292`, are BOTH multi-line titles
 * (`state A as "line1\nline2"`, a literal creole line break) — correctly
 * excluded by the `lineCount === 1` gate below, not a counterexample).
 *
 * That same probe found the title's own VERTICAL BASELINE offset from the
 * cluster top is BIMODAL — 14.8889px for 98 samples, 15.8889px for 36 —
 * which splits EXACTLY along `ClusterDotString`'s own WithLabel/hasPort
 * branch (`portRanksLabelOnEe`, `applyBorderPointRanks` below): every
 * 15.8889-offset sample belongs to a fixture in the mission's own 20-fixture
 * `<<entrypoint>>`/`<<exitpoint>>` family (`bitaxo-18-tamo974`, `fukexa-85-
 * cuvi894`, `jucori-40-cevo136`, `kotagu-43-miza629`, `lulozu-10-bopu547`,
 * ...), whose title moves onto the `${id}ee` subgraph's own `label=`
 * (`DotInputCluster.portRanksLabelOnEe`'s own doc comment) — a DIFFERENT
 * jar code path with its own (verified-but-unimplemented-this-iteration)
 * baseline offset. `CLUSTER_TITLE_BASELINE_MARGIN` below is therefore
 * jar-verified ONLY for the plain (non-border-point) case; the eligibility
 * gate in `resolveClusterComposite` excludes `ctx.classify.needsAnchor`
 * composites entirely (deferred — ledger.md's own "entrypoint/exitpoint
 * family" C3+ queue item).
 */
const CLUSTER_TITLE_TABLE_HEIGHT = 3;
const CLUSTER_HEADER_HEIGHT = 19;
/** `node.y + CLUSTER_TITLE_BASELINE_MARGIN + textAscent(fontSize)` — jar-
 *  verified 14.8889 = 4 + 10.8889 (`textAscent(14)`) on both real fixtures
 *  this iteration hand-checked (`decede-10-buvu414`'s `E`, `bajelo-54-
 *  dixe684`'s `Track_FSM.Run`) AND the 98-sample corpus-wide probe above —
 *  distinct from the autonom shape's own `MARGIN = 5`
 *  (`renderer-composite-box.ts`), a DIFFERENT upstream code path
 *  (`ClusterHeader`, not `InnerStateAutonom`). */
const CLUSTER_TITLE_BASELINE_MARGIN = 4;

/** `SvekResult.calculateDimension`'s `delta(15,15)` -- a CONCURRENT_STATE
 *  region's raw graph image (`GroupMakerState.getImage():116-117` returns
 *  it DIRECTLY, never wrapped by `InnerStateAutonom`) adds a flat 15px to
 *  both width and height when the region re-enters its container's own
 *  pass as a flattened leaf; drawn content shifts so its own top-left
 *  sits at (6,6) inside that padded box (`moveDelta(6-minX,6-minY)`).
 *  Mission G4 S3: `im` in `InnerStateAutonom.calculateDimensionSlow`
 *  (`state-composite-autonom.ts#buildPlainAutonomSpec`'s own wrapped-
 *  child-pass dimension, a PLAIN autonom composite's child content) is the
 *  SAME `SvekResult` type as a concurrent region leaf's own `im` -- the
 *  SAME `delta(15,15)` applies there too, exported for that module's reuse
 *  (see its own doc comment).
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
 *  `result.width`/`height`).
 *
 *  Exported (mission G4 S3): `state-composite-autonom.ts
 *  #buildPlainAutonomSpec` has the SAME bug for a PLAIN autonom composite's
 *  wrapped-child-pass dimension (`InnerStateAutonom.calculateDimensionSlow`'s
 *  own `im.calculateDimension(...)`, the SAME `SvekResult#calculateDimension`
 *  this function reproduces) -- jar-verified `coteta-47-mare883`/`lonuti-97-
 *  voko521` (composite outer box off by a constant few px, unmasked once
 *  mechanism 6's own box-shape fix made `childCount` match so `compareSvg`
 *  could finally descend into the composite's own attributes). A trial fix
 *  using THIS function was diagnosed, verified to help those two fixtures,
 *  but ALSO verified to regress two already-pinned `size-backlog.json`
 *  entries past their own tighten-only allowance -- NOT landed this
 *  iteration (see that module's own doc comment for the full writeup).
 *  Exported so S4 can reuse it once combined with the still-unresolved
 *  child position-offset residual, rather than re-derived a second time.
 * @see ~/git/plantuml/.../svek/SvekResult.java:130-135
 */
export function tightContentDimension(result: DotLayoutResult): { width: number; height: number } {
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
  // #lizard forgives -- faithful port of GroupMakerState's region-leaf
  // dimension formula; a guard clause plus one straight-line construction.
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
  const directMembers = s.children;
  // G5 C3, mechanism 16 shape half: `applyBorderPointRanks`'s own real
  // eligibility test (below) -- NOT the broader `ctx.classify.needsAnchor`
  // flag, which ALSO fires for a composite with NO direct border-point
  // children at all whenever an EXTERNAL edge merely needs an anchor POINT
  // on its boundary (e.g. `state A { [*] --> Configuring }`, `Configuring`
  // declared OUTSIDE `A` -- `gojuja-90-pune699`'s own `A`, jar-verified:
  // its real oracle shape is the PLAIN cluster title/baseline-margin-4
  // case, NOT the WithLabel/`ee`-wrapped one, because `applyBorderPointRanks`
  // itself no-ops on an EMPTY `directMembers` list). Using `needsAnchor`
  // directly here excluded `A` from the title-table entirely, wrongly
  // falling back to the dashed-rect shape for a case this iteration DOES
  // cover -- caught by direct SVG diff inspection, not assumed.
  const hasBorderPointChildren = directMembers.some(
    (c) => isInputPosition(getEntityPosition(c)) || isOutputPosition(getEntityPosition(c)),
  );
  // Eligible for the jar-real HTML title table + render shape ONLY for a
  // single-line title at the default font-size (the ONLY case this
  // iteration jar-verified, `CLUSTER_HEADER_HEIGHT`'s own doc comment
  // above) that does NOT ALSO get `portRanksLabelOnEe` (a DIFFERENT jar
  // code path, its own -- verified but not this iteration's scope --
  // baseline offset; deferred, ledger.md's own entrypoint/exitpoint C3+
  // queue item) AND is NOT nested inside a separately-fired autonom/
  // concurrent-region pass (`ctx.insideAutonomPass`'s own doc comment,
  // state-composite-pass.ts -- jar-verified size-backlog regression on
  // `fotuje-06-fifa085`/`rovese-43-tadu368`, traced to the ALREADY-PARKED
  // `buildPlainAutonomSpec#Math.max` floor). Ineligible composites keep the
  // pre-C3 plain-text `label` + `boundingBox(children)` +
  // dashed-rect-fallback shape, byte-identical to before this iteration.
  const titleTableEligible =
    title.lineCount === 1 &&
    ctx.theme.fontSize === 14 &&
    !hasBorderPointChildren &&
    ctx.insideAutonomPass !== true;
  const cluster: DotInputCluster = {
    id: clusterId,
    nodeIds: [],
    label: s.display,
    labelWidth: title.width,
    labelHeight: title.height,
    ...(titleTableEligible
      ? { titleTableWidth: title.width, titleTableHeight: CLUSTER_TITLE_TABLE_HEIGHT }
      : {}),
    ...(parentClusterId !== undefined ? { parentId: parentClusterId } : {}),
  };
  acc.clusters.push(cluster);

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
  const pseudoSpecs = addLocalPseudoNodes(s.id, s.transitions, acc, ctx.pseudoCreationIndex);
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

  return {
    kind: 'cluster', id: s.id, display: s.display, children: sortSpecsByCreationIndex([...pseudoSpecs, ...childSpecs, ...regionSpecs]),
    clusterId,
    ...(titleTableEligible
      ? { titleWidth: title.width, clusterHeaderHeight: CLUSTER_HEADER_HEIGHT, titleBaselineMargin: CLUSTER_TITLE_BASELINE_MARGIN }
      : {}),
    ...(s.creationIndex !== undefined ? { creationIndex: s.creationIndex } : {}),
  };
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

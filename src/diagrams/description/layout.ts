/**
 * Unified layout engine for PlantUML descriptive diagrams
 * (component / use-case / deployment).
 *
 * Algorithm (single-pass, cluster-aware): walk the AST, classifying each
 * node as a graphviz cluster (container symbol with children) or a
 * DotInputNode (leaf, or empty container). Build one DotInputGraph and call
 * layoutGraph() once; map results back to DescriptionGeometry — leaf
 * positions from result.nodes, container bboxes as a bottom-up padded union
 * of children, edge points from result.edges (real graphviz splines),
 * cross-container endpoints clipped at the container bbox. No DOM/SVG/async.
 */

import type { DescriptionDiagramAST, DescriptiveNode } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import type {
  DotInputEdge,
  DotInputGraph,
  DotLayoutResult,
} from '../../core/graph-layout.js';
import { layoutGraph } from '../../core/graph-layout.js';
import type { USymbol } from '../../core/descriptive-keywords.js';
import {
  type DescriptionNodeGeo,
  isClusterNode,
  shiftGeo,
  buildNodeGeoIndex,
  type EdgeContainerEndpoints,
  measureTitleLabel,
  measureShadowAnchorDims,
  type DescriptionEdgeGeo,
  type DescriptionGeometry,
  degenerateSingleLeaf,
} from './layout-helpers.js';
import {
  type EdgeMapping,
  buildEdgeGeos,
  computeTotalDimensions,
} from './layout-geo-post.js';
import { computeInkShift } from './layout-ink-shift.js';
import type { PortClusterInfo, ClusterSpacing } from './frontier-cluster-bbox.js';
import type { ComponentStyle } from './leaf-sizing.js';
import { computeGraphSpacing } from './link-edge-attrs.js';
import type { SpriteDimsLookup } from '../../core/creole-atoms.js';
import { spriteDimsLookupFor } from '../../core/sprite-commands.js';
import { buildMagmaEdges, magmaGroups } from './magma.js';
import { effectiveRemovedIds, effectiveHiddenIds } from './element-grammar.js';
import {
  buildNamespaceGroups,
  findCollidingIds,
  dotKeyFor,
  scopedKey,
} from './namespace-groups.js';
import {
  computePortRanksByCluster,
  buildDotNodes,
  buildDotClusters,
  buildDotEdges,
  buildGeoTree,
  type PortClusterCtx,
} from './layout-dot-tree.js';

export type {
  DescriptionNodeGeo,
  DescriptionEdgeGeo,
  DescriptionGeometry,
} from './layout-helpers.js';

// ── Public output types ──

// ── Internal types ──

interface ContainerDesc {
  // "cluster0" etc — matches comparator's /^cluster\d+$/ (we re-prefix `cluster_` anyway).
  clusterId: string;
  astId: string;
  symbol: USymbol;
  display: string;
  /** G1 I5b: ALL stereotype tags, in source order. */
  stereotype?: readonly string[];
  directLeafAstIds: string[];
  parentAstId?: string;
}

export interface ClassifyCtx {
  leafIdSet: Set<string>;
  containers: ContainerDesc[];
  containerById: Map<string, ContainerDesc>;
  astNodeById: Map<string, DescriptiveNode>;
  counter: { n: number };
  /** `skinparam componentStyle` — gates the UML2 component corner icon. */
  componentStyle: ComponentStyle | undefined;
  /** Container-scoped identity (mission I1b) — bare ids that are TRUE
   *  cross-scope collisions across the WHOLE diagram
   *  (namespace-groups.ts#findCollidingIds), read by `dotKeyFor` to decide
   *  whether a node needs disambiguation. */
  collidingIds: ReadonlySet<string>;
  /** SI5b+E2r T7 seam (c): bridges `ast.sprites` (T4's `SpriteRegistry`) to
   *  T6's `SpriteDimsLookup` (seam (b), `sprite-commands.ts
   *  #spriteDimsLookupFor`) — consulted by `measureLeafNode` (D9) so a
   *  `<$sprite>` atom in a leaf's display text actually widens/heightens
   *  its DOT node size, per the batch-2 decision-journal's flagged gap. */
  sprites: SpriteDimsLookup | undefined;
  /** Every node's ALWAYS-fully-qualified path (ancestor chain + own id,
   *  regardless of collision) mapped to whatever canonical key
   *  `classifyAst` actually assigned it — lets `resolveEndpoint`
   *  (layout-helpers.ts) translate a namespace-qualified link reference
   *  (`command-table.ts#resolveEndpointNamespace`) back to the right DOT
   *  node id even when that node's bare id turned out not to need
   *  disambiguation. See namespace-groups.ts's `dotKeyFor` doc + the
   *  description-dot-100 decision journal (I1b). */
  qualifiedPathToDotKey: Map<string, string>;
}

export interface EdgeDotBuildResult {
  dotEdges: DotInputEdge[];
  dotEdgeToLinkIdx: Map<string, number>;
  edgeContainerEndpoints: Map<string, EdgeContainerEndpoints>;
  /** Cluster ids referenced directly by an edge (isThereALinkFromOrToGroup);
   *  each needs a shared group-anchor point node + cluster membership. */
  groupAnchorClusterIds: Set<string>;
}

/** `FontParam.ARROW(13, normal)` (klimt/font/FontParam.java:54) -- see
 *  `layoutDescription`'s `edgeFontSpec` construction for the full
 *  jar-verified derivation (G5/C0). */
const ARROW_LABEL_FONT_SIZE = 13;


// ── Phase 1: AST classification ──

function classifyAsCluster(
  node: DescriptiveNode,
  ctx: ClassifyCtx,
  removed: ReadonlySet<string>,
  key: string,
  ancestorIds: readonly string[],
  parentAstId?: string,
): void {
  const clusterId = `cluster${ctx.counter.n++}`;
  const childAncestors = [...ancestorIds, node.id];
  const directLeafAstIds = node.children
    .filter((c) => !isEffectiveCluster(c, removed))
    .map((c) => dotKeyFor(childAncestors, c.id, ctx.collidingIds));
  const desc: ContainerDesc = {
    clusterId, astId: key, symbol: node.symbol,
    display: node.display, directLeafAstIds,
  };
  if (parentAstId !== undefined) desc.parentAstId = parentAstId;
  if (node.stereotype !== undefined) desc.stereotype = node.stereotype;
  ctx.containers.push(desc);
  ctx.containerById.set(key, desc);
  classifyAst(node.children, ctx, removed, childAncestors, key);
  // #lizard forgives -- pre-existing (6 params): the cohesive AST-
  // classification context (node/ctx/removed/key/ancestorIds/parentAstId)
  // threaded from classifyAst's own recursive call, not new here
  // (mission G5/C1 500-line split -- pure move, full-file rescan surfaced
  // it, not introduced).
}

/** Unfiltered container count (declaration view) — the degenerate check
 *  (DotData.isDegeneratedWithFewEntities) counts groups BEFORE removal. */
function countRawContainers(nodes: readonly DescriptiveNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (isClusterNode(node)) n += 1 + countRawContainers(node.children);
  }
  return n;
}

/** Removal-aware cluster predicate: GraphvizImageBuilder's empty-group
 *  demotion (java:416-418) applies to the removal-FILTERED view — a group
 *  whose visible children are all removed becomes a LEAF (gezemu-34 oracle:
 *  `frame l3 { component D }` + `remove D` renders l3 as a rect). */
export function isEffectiveCluster(node: DescriptiveNode, removed: ReadonlySet<string>): boolean {
  return (
    isClusterNode(node) && node.children.some((c) => !removed.has(c.id))
  );
}

function classifyAst(
  nodes: readonly DescriptiveNode[],
  ctx: ClassifyCtx,
  removed: ReadonlySet<string>,
  ancestorIds: readonly string[] = [],
  parentAstId?: string,
): void {
  for (const node of nodes) {
    const key = dotKeyFor(ancestorIds, node.id, ctx.collidingIds);
    ctx.astNodeById.set(key, node);
    ctx.qualifiedPathToDotKey.set(scopedKey([...ancestorIds, node.id]), key);
    if (isEffectiveCluster(node, removed)) {
      classifyAsCluster(node, ctx, removed, key, ancestorIds, parentAstId);
    } else {
      ctx.leafIdSet.add(key);
    }
  }
}


// ── Public API helpers ──

// CommandRemoveRestore is a LAZY marker upstream (CucaDiagram.isRemoved at
// print time): magma chaining and the degenerate count run UNFILTERED; only
// classification (empty-group demotion on the filtered view) and the DOT
// emission drop removed entities (verified: cifaki-66 keeps the magma edge
// between the two surviving leaves of a 3-standalone chain; gezemu-34
// demotes an emptied frame to a leaf).
/** Builds the `PortClusterInfo` (frontier-cluster-bbox.ts) for every
 *  container that has port children. Two DIFFERENT title measurements feed
 *  it -- see `title-label-sizing.ts`'s doc comments for the full mechanism
 *  and why they must stay different: `titleWidth`/`titleHeight`
 *  (`measureTitleLabel`, jar-exact -- `ensureMinWidth`'s
 *  `getTitleAndAttributeWidth() + 10` floor, `Cluster.java:427-428`) vs
 *  `anchorWidth`/`anchorHeight` (`measureShadowAnchorDims`, a legacy
 *  compensating value the isolated shadow graph needs to reproduce jar's
 *  real cluster geometry -- G1b J3 found the jar-exact anchor dims REGRESS
 *  `computePortClusterBbox`'s result there, an 8px shadow-graph-only
 *  structural gap unrelated to this function). Kermor never builds a port
 *  anchor at all (`portAnchorId` stays unset, see `buildDotClusters`'s own
 *  comment) -- `manageEntryExitPoint`'s upstream call site is unconditional
 *  on kermor, but no kermor fixture in this port exercises a port cluster,
 *  so this is scoped to the non-kermor path pending real coverage. */
function buildPortClusterInfoByAstId(
  ctx: ClassifyCtx,
  portRanksByCluster: ReadonlyMap<string, { rank: 'source' | 'sink'; nodeIds: string[] }[]>,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  kermor: boolean,
): Map<string, PortClusterInfo> {
  const out = new Map<string, PortClusterInfo>();
  if (kermor) return out;
  for (const c of ctx.containers) {
    const ranks = portRanksByCluster.get(c.clusterId);
    if (ranks === undefined) continue;
    const title = measureTitleLabel(c.display, c.symbol, fontSpec, measurer);
    const anchor = measureShadowAnchorDims(c.display, fontSpec, measurer);
    out.set(c.astId, {
      ranks, anchorWidth: anchor.width, anchorHeight: anchor.height,
      titleWidth: title.width, titleHeight: title.height,
    });
  }
  return out;
}

function runLayout(
  ast: DescriptionDiagramAST,
  ctx: ClassifyCtx,
  fontSpec: FontSpec,
  edgeFontSpec: FontSpec,
  measurer: StringMeasurer,
  linetype: 'ortho' | 'polyline' | undefined,
  removed: ReadonlySet<string>,
  fixCircle: boolean,
): {
  result: DotLayoutResult; edgeDotBuild: EdgeDotBuildResult;
  portClusterInfoByAstId: Map<string, PortClusterInfo>; spacing: ClusterSpacing;
} {

  // Edges first: buildDotClusters/buildDotNodes need to know which clusters
  // require a group-anchor node — either a direct group-edge
  // (edgeDotBuild.groupAnchorClusterIds, P2/i5) or port children
  // (portRanksByCluster, ClusterDotString.entityPositionsExceptNormal).
  const edgeDotBuild = buildDotEdges(ast.links, ctx, edgeFontSpec, measurer, linetype);
  // applySingleStrategy: standalone leaves square-chain with invisible
  // links per group (magma.ts).
  edgeDotBuild.dotEdges.push(...buildMagmaEdges(magmaGroups(ctx),
    new Set(edgeDotBuild.dotEdges.flatMap((e) => [e.from, e.to]))));
  if (removed.size > 0) {
    edgeDotBuild.dotEdges = edgeDotBuild.dotEdges.filter(
      (e) => !removed.has(e.from) && !removed.has(e.to),
    );
  }
  const portRanksByCluster = computePortRanksByCluster(ctx);
  const portClusterIds = new Set(portRanksByCluster.keys());
  // ClusterDotStringKermor's own printRanks (svek/ClusterDotStringKermor
  // .java:231-245) has no hasPort()-chain-to-anchor branch at all -- under
  // kermor, port children NEVER need the shared anchor node/rank-chain
  // machinery (contrast ClusterDotString.printRanks, which does). Real
  // group-to-group edges (edgeDotBuild.groupAnchorClusterIds) still need an
  // anchor either way -- untouched by this exclusion, and unexercised by
  // any kermor fixture in this port (see decision-journal.md I2).
  const kermor = ast.kermor === true;
  const anchorClusterIds = kermor
    ? new Set(edgeDotBuild.groupAnchorClusterIds)
    : new Set([...edgeDotBuild.groupAnchorClusterIds, ...portClusterIds]);
  const dotClusters = buildDotClusters(ctx, anchorClusterIds, portRanksByCluster, kermor)
    .map((c) => ({ ...c, nodeIds: c.nodeIds.filter((id) => !removed.has(id)) }));
  const { nodeSep, rankSep } = computeGraphSpacing(ast.links, edgeFontSpec, measurer, kermor, ctx.sprites);
  const input: DotInputGraph = {
    nodes: buildDotNodes(
      ctx, fontSpec, measurer, anchorClusterIds, portClusterIds,
      edgeDotBuild.groupAnchorClusterIds, ast.links, fixCircle,
      ast.stereotypeVisibilityRules ?? [],
    ).filter((n) => !removed.has(n.id)),
    edges: edgeDotBuild.dotEdges,
    nodeSep, rankSep,
    // I9 (path/@d): description draws every arrowhead itself (SvekEdge /
    // extremity/*.ts), matching the Svek-DOT emitter's own universal
    // `arrowhead=none` — see `DotInputGraph.manualArrowheads`'s doc comment.
    manualArrowheads: true,
  };
  // DotStringFactory only emits rankdir=LR for skinparam Rankdir LEFT_TO_RIGHT
  // (`left to right direction`, CommandRankDir.java); TB emits no attribute.
  if (ast.rankdir === 'LR') input.rankDir = 'LR';
  if (dotClusters.length > 0) input.clusters = dotClusters;
  if (kermor) input.kermor = true;
  const portClusterInfoByAstId = buildPortClusterInfoByAstId(
    ctx, portRanksByCluster, fontSpec, measurer, kermor,
  );
  const spacing: ClusterSpacing = { nodeSep, rankSep, rankdir: ast.rankdir === 'LR' ? 'LR' : 'TB' };
  // #lizard forgives -- NLOC 47, CCN 9 pre-existing (mission G5/C1
  // 500-line split, pure move); 8 params after this iteration's own
  // `edgeFontSpec` addition -- a flat sequence of DOT-input-assembly
  // steps (edges, clusters, nodes, spacing) with no new branching.
  return { result: layoutGraph(input), edgeDotBuild, portClusterInfoByAstId, spacing };
}

function buildGeoAndEdges(
  ast: DescriptionDiagramAST,
  result: DotLayoutResult,
  edgeDotBuild: EdgeDotBuildResult,
  collidingIds: ReadonlySet<string>,
  removed: ReadonlySet<string>,
  theme: Theme,
  measurer: StringMeasurer,
  portClusterCtx: PortClusterCtx,
): { nodes: DescriptionNodeGeo[]; edges: DescriptionEdgeGeo[] } {
  // G1 I-hideshow: `hidden` is draw-time-only (never a DOT/geo-tree
  // membership filter, contrast `removed` above) -- computed here, once,
  // from the SAME final `ast.nodes` this function already threads through
  // `buildGeoTree`/`buildEdgeGeos`.
  const hidden = effectiveHiddenIds(ast.nodes, ast.hideShowRules ?? []);
  const stereotypeRules = ast.stereotypeVisibilityRules ?? [];
  const leafPosMap = new Map(result.nodes.map((n) => [n.id, n]));
  const rawNodes = buildGeoTree(
    ast.nodes, leafPosMap, collidingIds, removed, hidden, stereotypeRules, portClusterCtx,
  );
  const geoIndex = buildNodeGeoIndex(rawNodes);
  // G1b/J1 (mechanism C): build edges ONCE at (dx=0,dy=0) -- the RAW,
  // fully-resolved (spline-clipped, labeled) draw shape `computeInkShift`'s
  // ink walk needs (see that function's own doc comment for why translating
  // an already-clipped spline commutes with clipping a not-yet-shifted one).
  const rawMapping: EdgeMapping = {
    dotEdgeToLinkIdx: edgeDotBuild.dotEdgeToLinkIdx,
    edgeContainerEndpoints: edgeDotBuild.edgeContainerEndpoints,
    geoIndex,
    dx: 0, dy: 0,
  };
  const rawEdges = buildEdgeGeos(ast.links, result.edges, rawMapping, hidden);
  const { dx, dy } = computeInkShift(rawNodes, rawEdges, theme, measurer, ast.sprites);
  const nodes = rawNodes.map((n) => shiftGeo(n, dx, dy));
  const edges = (dx === 0 && dy === 0)
    ? rawEdges
    : buildEdgeGeos(ast.links, result.edges, { ...rawMapping, dx, dy }, hidden);
  // #lizard forgives -- pre-existing (8 params): the cohesive geo-tree +
  // edge-geometry assembly context threaded from layoutDescription's own
  // single call site -- mission G5/C1 500-line split (pure move), not
  // introduced here.
  return { nodes, edges };
}

// ── Public API ──

/** Lay out a descriptive diagram; pixel geometry for all nodes and edges
 *  (see the file-header algorithm summary above). */
export function layoutDescription(
  ast: DescriptionDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): DescriptionGeometry {
  if (ast.nodes.length === 0) {
    return {
      totalWidth: 0, totalHeight: 0, nodes: [], edges: [],
      ...(ast.seed !== undefined ? { seed: ast.seed } : {}),
      ...(ast.scale !== undefined ? { scale: ast.scale } : {}),
    };
  }
  const fontSpec: FontSpec = { family: theme.fontFamily, size: theme.fontSize };
  // `FontParam.ARROW(13, normal)` (klimt/font/FontParam.java:54) --
  // link-label default, distinct from `COMPONENT(14)`/`theme.fontSize`
  // (this port's node/title default). G5/C0 jar-verified gap:
  // `babafi-51-dixi026`'s `"use"` link label renders at jar size 13
  // (20.9625px), not the prior size-14 measurement (22.575px). Scoped to
  // ONLY the two edge-label-consuming calls inside runLayout
  // (buildDotEdges/computeGraphSpacing) -- `fontSpec` above is SHARED
  // with node/title measurement (buildDotNodes,
  // buildPortClusterInfoByAstId) and must stay at theme.fontSize; unlike
  // state/class, this engine has no separate per-role font construction
  // site to swap in place. No `skinparam ArrowFontSize` override path
  // exists yet (`core/skinparam.ts#ELEMENT_BUCKET_SNAMES` omits
  // `'arrow'`) -- bare DEFAULT only.
  const edgeFontSpec: FontSpec = { family: theme.fontFamily, size: ARROW_LABEL_FONT_SIZE };
  // Container-scoped identity (mission I1b): the set of TRUE cross-scope
  // colliding bare ids, computed from the ORIGINAL (un-grouped) tree once --
  // reused by both `classifyAst` (walks the namespace-grouped tree) and
  // `buildGeoTree` (walks the original tree) so the two independent walks
  // agree on which nodes need disambiguation. Phantom-group ids
  // (namespace-groups.ts) are always fully-qualified-unique synthetic
  // strings, so omitting them from this scan cannot introduce a false
  // collision. See namespace-groups.ts's `dotKeyFor` doc.
  const collidingIds = findCollidingIds(ast.nodes);
  const ctx: ClassifyCtx = {
    leafIdSet: new Set(), containers: [],
    containerById: new Map(), astNodeById: new Map(), counter: { n: 0 },
    componentStyle: theme.componentStyle,
    collidingIds, qualifiedPathToDotKey: new Map(),
    sprites: ast.sprites !== undefined ? spriteDimsLookupFor(ast.sprites) : undefined,
  };
  const removed = effectiveRemovedIds(ast.nodes, ast.links, ast.removeUnlinked === true);
  // Phantom `set separator`-derived package nesting (namespace-groups.ts) is
  // synthesized HERE, at layout time, mirroring upstream's own
  // `eventuallyBuildPhantomGroups` timing (called from `getTextBlock`,
  // net/atmp/CucaDiagram.java:465) — AFTER magma/single-strategy would have
  // already run on the un-grouped tree upstream (CucaDiagram.java:679,
  // DescriptionDiagram#checkFinalError). `magmaGroups` (magma.ts) below
  // still reads THIS grouped `ctx`, so it separately excludes any
  // `phantomGroup` container from standalone-chaining consideration — see
  // that file's doc and the description-dot-100 decision journal (I1).
  const groupedNodes = buildNamespaceGroups(ast.nodes, ast.namespaceSeparator);
  classifyAst(groupedNodes, ctx, removed);
  // Degenerate check counts UNFILTERED entities (DotData counts before the
  // removed filter) — use the raw cluster predicate, not the removal-aware
  // classification.
  const rawContainers = countRawContainers(ast.nodes);
  const degenerate = degenerateSingleLeaf(ast, rawContainers, fontSpec, measurer, theme.componentStyle);
  if (degenerate !== undefined) {
    return {
      ...degenerate,
      ...(ast.seed !== undefined ? { seed: ast.seed } : {}),
      ...(ast.scale !== undefined ? { scale: ast.scale } : {}),
    };
  }
  const { result, edgeDotBuild, portClusterInfoByAstId, spacing } = runLayout(
    ast, ctx, fontSpec, edgeFontSpec, measurer, theme.linetype ?? ast.linetype, removed,
    theme.fixCircleLabelOverlapping === true,
  );
  const { nodes, edges } = buildGeoAndEdges(
    ast, result, edgeDotBuild, collidingIds, removed, theme, measurer,
    { infoByAstId: portClusterInfoByAstId, spacing },
  );
  const { totalWidth, totalHeight } = computeTotalDimensions(nodes, edges);
  return {
    totalWidth, totalHeight, nodes, edges,
    ...(ast.seed !== undefined ? { seed: ast.seed } : {}),
    ...(ast.sprites !== undefined ? { sprites: ast.sprites } : {}),
    ...(ast.scale !== undefined ? { scale: ast.scale } : {}),
  };
  // #lizard forgives -- pre-existing (NLOC 50): the public entry point's
  // own flat pipeline sequence (classify, degenerate-check, layout,
  // geo-assembly, total-dims) -- mission G5/C1 500-line split (pure
  // move), not introduced here.
}

export type { USymbol };

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

import type { DescriptionDiagramAST, DescriptiveLink, DescriptiveNode } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import type {
  DotInputNode,
  DotInputEdge,
  DotInputCluster,
  DotInputGraph,
  DotLayoutResult,
} from '../../core/graph-layout.js';
import { layoutGraph } from '../../core/graph-layout.js';
import type { USymbol } from '../../core/descriptive-keywords.js';
import {
  type DescriptionNodeGeo,
  type Bbox,
  LAYOUT_MARGIN,
  EMPTY_CONTAINER_WIDTH,
  EMPTY_CONTAINER_HEIGHT,
  GROUP_ANCHOR_SIZE,
  isClusterNode,
  measureLeafNode,
  computeContainerBbox,
  shiftGeo,
  clipSplineStart,
  clipSplineEnd,
  buildNodeGeoIndex,
  type EdgeContainerEndpoints,
  resolveEndpoint,
  containerEndpointsInfo,
  groupAnchorNodeId,
  shapeForNode,
  isPortLabelWide,
  portTablePad,
  measureTitleLabel,
  type DescriptionEdgeGeo,
  type DescriptionGeometry,
  degenerateSingleLeaf,
} from './layout-helpers.js';
import { computeGraphSpacing, buildLinkEdgeAttributes } from './link-edge-attrs.js';
import { buildMagmaEdges, magmaGroups } from './magma.js';
import { effectiveRemovedIds } from './element-grammar.js';

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
  stereotype?: string;
  directLeafAstIds: string[];
  parentAstId?: string;
}

interface ClassifyCtx {
  leafIdSet: Set<string>;
  containers: ContainerDesc[];
  containerById: Map<string, ContainerDesc>;
  astNodeById: Map<string, DescriptiveNode>;
  counter: { n: number };
}

interface EdgeDotBuildResult {
  dotEdges: DotInputEdge[];
  dotEdgeToLinkIdx: Map<string, number>;
  edgeContainerEndpoints: Map<string, EdgeContainerEndpoints>;
  /** Cluster ids referenced directly by an edge (isThereALinkFromOrToGroup);
   *  each needs a shared group-anchor point node + cluster membership. */
  groupAnchorClusterIds: Set<string>;
}

interface EdgeMapping {
  dotEdgeToLinkIdx: Map<string, number>;
  edgeContainerEndpoints: Map<string, EdgeContainerEndpoints>;
  geoIndex: Map<string, DescriptionNodeGeo>;
  dx: number;
  dy: number;
}

type ResultEdge = DotLayoutResult['edges'][number];

// ── Phase 1: AST classification ──

function classifyAsCluster(
  node: DescriptiveNode,
  ctx: ClassifyCtx,
  removed: ReadonlySet<string>,
  parentAstId?: string,
): void {
  const clusterId = `cluster${ctx.counter.n++}`;
  const directLeafAstIds = node.children
    .filter((c) => !isEffectiveCluster(c, removed))
    .map((c) => c.id);
  const desc: ContainerDesc = {
    clusterId, astId: node.id, symbol: node.symbol,
    display: node.display, directLeafAstIds,
  };
  if (parentAstId !== undefined) desc.parentAstId = parentAstId;
  if (node.stereotype !== undefined) desc.stereotype = node.stereotype;
  ctx.containers.push(desc);
  ctx.containerById.set(node.id, desc);
  classifyAst(node.children, ctx, removed, node.id);
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
function isEffectiveCluster(node: DescriptiveNode, removed: ReadonlySet<string>): boolean {
  return (
    isClusterNode(node) && node.children.some((c) => !removed.has(c.id))
  );
}

function classifyAst(
  nodes: readonly DescriptiveNode[],
  ctx: ClassifyCtx,
  removed: ReadonlySet<string>,
  parentAstId?: string,
): void {
  for (const node of nodes) {
    ctx.astNodeById.set(node.id, node);
    if (isEffectiveCluster(node, removed)) {
      classifyAsCluster(node, ctx, removed, parentAstId);
    } else {
      ctx.leafIdSet.add(node.id);
    }
  }
}

// ── Phase 2: DotInputGraph construction ──

/** One entry per rank (source=portin, sink=portout) that a cluster's own
 *  direct port children populate, keyed by clusterId — feeds both the
 *  DotInputCluster.portRanks emitter field and the anchor-shape decision
 *  in buildDotNodes (ClusterDotString.entityPositionsExceptNormal /
 *  hasPort()). Description-diagram entities only ever carry
 *  EntityPosition NORMAL/PORTIN/PORTOUT (abel/Entity.java:327-338) — so
 *  "cluster has a port child" and Java's hasPort() coincide exactly here. */
function computePortRanksByCluster(
  ctx: ClassifyCtx,
): Map<string, { rank: 'source' | 'sink'; nodeIds: string[] }[]> {
  const result = new Map<string, { rank: 'source' | 'sink'; nodeIds: string[] }[]>();
  for (const c of ctx.containers) {
    const source: string[] = [];
    const sink: string[] = [];
    for (const id of c.directLeafAstIds) {
      const n = ctx.astNodeById.get(id);
      if (n?.symbol !== 'port') continue;
      (n.position === 'portout' ? sink : source).push(id);
    }
    const ranks: { rank: 'source' | 'sink'; nodeIds: string[] }[] = [];
    if (source.length > 0) ranks.push({ rank: 'source', nodeIds: source });
    if (sink.length > 0) ranks.push({ rank: 'sink', nodeIds: sink });
    if (ranks.length > 0) result.set(c.clusterId, ranks);
  }
  return result;
}

/** A port leaf's own DOT node: fixed RADIUS*2 square, `shape=plaintext`
 *  PORT="P" table when its label is wide (SvekNode
 *  .appendLabelHtmlSpecialForPort), plain small `shape=rect` otherwise;
 *  `isPort` always set (drives the `:P` edge-ref suffix regardless of
 *  which shape branch applies — Link.getEntityPort/usePortP). The real
 *  layout engine (unlike the emitter-only fields above) DOES read
 *  `attributes.rank` (graph-layout.ts addNodes) — portin/portout genuinely
 *  pin the port to its container's source/sink rank, matching
 *  EntityPosition.getInputs()/getOutputs(). */
function buildPortNode(
  id: string,
  node: DescriptiveNode,
  dims: { width: number; height: number },
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): DotInputNode {
  const dotNode: DotInputNode = {
    id, width: dims.width, height: dims.height, isPort: true,
    attributes: { rank: node.position === 'portout' ? 'sink' : 'source' },
  };
  if (isPortLabelWide(node, fontSpec, measurer)) {
    dotNode.shape = 'plaintext';
    dotNode.portPad = portTablePad(node, fontSpec, measurer);
  }
  return dotNode;
}

/** The shared anchor node for a cluster that needs one — either because an
 *  edge targets the group directly (`groupAnchorClusterIds`, P2/i5) or
 *  because it has port children (`portClusterIds`). ClusterDotString's
 *  hasPort() branch (lines 177-184) redeclares the SAME id with
 *  `shape=rect` + the cluster's own title HTML instead of `shape=point`
 *  whenever ports are present — net effect (later declaration wins)
 *  reproduced directly here as a single choice, since our emitter only
 *  ever emits one line per node id. */
function buildAnchorNode(
  clusterId: string,
  display: string,
  isPortCluster: boolean,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): DotInputNode {
  const anchor: DotInputNode = {
    id: groupAnchorNodeId(clusterId),
    width: GROUP_ANCHOR_SIZE,
    height: GROUP_ANCHOR_SIZE,
  };
  if (isPortCluster) {
    anchor.shape = 'rect';
    const title = measureTitleLabel(display, fontSpec, measurer);
    anchor.titleLabelWidth = title.width;
    anchor.titleLabelHeight = title.height;
  } else {
    anchor.shape = 'point';
  }
  return anchor;
}

function buildDotNodes(
  ctx: ClassifyCtx,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  anchorClusterIds: ReadonlySet<string>,
  portClusterIds: ReadonlySet<string>,
  links: readonly DescriptiveLink[],
): DotInputNode[] {
  const result: DotInputNode[] = [];
  for (const [id, node] of ctx.astNodeById) {
    if (!ctx.leafIdSet.has(id)) continue;
    const dims = measureLeafNode(node, fontSpec, measurer);
    if (node.symbol === 'port') {
      result.push(buildPortNode(id, node, dims, fontSpec, measurer));
      continue;
    }
    const dotNode: DotInputNode = { id, width: dims.width, height: dims.height };
    const shape = shapeForNode(node, links);
    if (shape !== undefined) dotNode.shape = shape;
    result.push(dotNode);
  }
  // Group-anchor nodes (ClusterDotString.java:149/177-184) — one per
  // cluster referenced directly by an edge and/or carrying port children,
  // shared across all edges/ranks that reference that cluster.
  for (const clusterId of anchorClusterIds) {
    const c = ctx.containers.find((cd) => cd.clusterId === clusterId);
    if (c === undefined) continue;
    result.push(
      buildAnchorNode(clusterId, c.display, portClusterIds.has(clusterId), fontSpec, measurer),
    );
  }
  return result;
}

function buildDotClusters(
  ctx: ClassifyCtx,
  anchorClusterIds: ReadonlySet<string>,
  portRanksByCluster: ReadonlyMap<string, { rank: 'source' | 'sink'; nodeIds: string[] }[]>,
): DotInputCluster[] {
  return ctx.containers.map((c) => {
    // The anchor is a direct member of its own cluster (not nested in any
    // child sub-cluster) — ClusterDotString.java:149 emits it at the
    // cluster's own level, before its `i`/`p1` nesting.
    const nodeIds = anchorClusterIds.has(c.clusterId)
      ? [...c.directLeafAstIds, groupAnchorNodeId(c.clusterId)]
      : c.directLeafAstIds;
    const cluster: DotInputCluster = { id: c.clusterId, nodeIds };
    if (c.display.length > 0) cluster.label = c.display;
    if (c.parentAstId !== undefined) {
      const parentDesc = ctx.containerById.get(c.parentAstId);
      if (parentDesc !== undefined) cluster.parentId = parentDesc.clusterId;
    }
    const portRanks = portRanksByCluster.get(c.clusterId);
    if (portRanks !== undefined) {
      cluster.portRanks = portRanks;
      cluster.portAnchorId = groupAnchorNodeId(c.clusterId);
    }
    return cluster;
  });
}

function buildDotEdges(
  links: readonly DescriptiveLink[],
  ctx: ClassifyCtx,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  linetype: 'ortho' | 'polyline' | undefined,
): EdgeDotBuildResult {
  const dotEdges: DotInputEdge[] = [];
  const dotEdgeToLinkIdx = new Map<string, number>();
  const edgeContainerEndpoints = new Map<string, EdgeContainerEndpoints>();
  const groupAnchorClusterIds = new Set<string>();
  const clusterIdByContainerAstId = new Map(
    ctx.containers.map((c) => [c.astId, c.clusterId]),
  );

  for (let i = 0; i < links.length; i++) {
    const link = links[i]!;
    const fromRes = resolveEndpoint(link.from, ctx.leafIdSet, ctx.astNodeById, clusterIdByContainerAstId);
    const toRes = resolveEndpoint(link.to, ctx.leafIdSet, ctx.astNodeById, clusterIdByContainerAstId);
    if (fromRes === undefined || toRes === undefined) continue;
    if (fromRes.dotNodeId === toRes.dotNodeId) continue;

    const dotId = `dot-edge-${i}`;
    dotEdges.push({
      id: dotId,
      from: fromRes.dotNodeId,
      to: toRes.dotNodeId,
      attributes: buildLinkEdgeAttributes(link, fontSpec, measurer, linetype),
    });
    dotEdgeToLinkIdx.set(dotId, i);

    const info = containerEndpointsInfo(fromRes, toRes);
    if (info !== undefined) edgeContainerEndpoints.set(dotId, info);
    if (fromRes.containerAstId !== undefined) {
      groupAnchorClusterIds.add(clusterIdByContainerAstId.get(fromRes.containerAstId)!);
    }
    if (toRes.containerAstId !== undefined) {
      groupAnchorClusterIds.add(clusterIdByContainerAstId.get(toRes.containerAstId)!);
    }
  }
  return { dotEdges, dotEdgeToLinkIdx, edgeContainerEndpoints, groupAnchorClusterIds };
}

// ── Phase 3: geo tree construction (bottom-up, containers padded around children) ──

function buildGeoNode(
  astNode: DescriptiveNode,
  leafPosMap: Map<string, { x: number; y: number; width: number; height: number }>,
): DescriptionNodeGeo {
  if (!isClusterNode(astNode)) {
    const pos = leafPosMap.get(astNode.id) ?? {
      x: 0, y: 0, width: EMPTY_CONTAINER_WIDTH, height: EMPTY_CONTAINER_HEIGHT,
    };
    const geo: DescriptionNodeGeo = {
      id: astNode.id, symbol: astNode.symbol, display: astNode.display,
      x: pos.x, y: pos.y, width: pos.width, height: pos.height, children: [],
    };
    if (astNode.stereotype !== undefined) geo.stereotype = astNode.stereotype;
    return geo;
  }
  const children = astNode.children.map((c) => buildGeoNode(c, leafPosMap));
  const bbox = computeContainerBbox(children);
  const geo: DescriptionNodeGeo = {
    id: astNode.id, symbol: astNode.symbol, display: astNode.display,
    ...bbox, children,
  };
  if (astNode.stereotype !== undefined) geo.stereotype = astNode.stereotype;
  return geo;
}

function buildGeoTree(
  astNodes: readonly DescriptiveNode[],
  leafPosMap: Map<string, { x: number; y: number; width: number; height: number }>,
): DescriptionNodeGeo[] {
  // Removed leaves (lazy CommandRemoveRestore markers) were never laid out.
  return astNodes
    .filter((n) => leafPosMap.has(n.id) || isClusterNode(n))
    .map((n) => buildGeoNode(n, leafPosMap));
}

// ── Phase 4: global coordinate shift ──

function scanNodeMin(g: DescriptionNodeGeo, minRef: { x: number; y: number }): void {
  if (g.x < minRef.x) minRef.x = g.x;
  if (g.y < minRef.y) minRef.y = g.y;
  for (const c of g.children) scanNodeMin(c, minRef);
}

function computeGlobalShift(
  nodes: readonly DescriptionNodeGeo[],
  edgePoints: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>,
): { dx: number; dy: number } {
  const min = { x: Infinity, y: Infinity };
  for (const n of nodes) scanNodeMin(n, min);
  for (const pts of edgePoints) {
    for (const p of pts) {
      if (p.x < min.x) min.x = p.x;
      if (p.y < min.y) min.y = p.y;
    }
  }
  if (!isFinite(min.x)) min.x = 0;
  if (!isFinite(min.y)) min.y = 0;
  return { dx: LAYOUT_MARGIN - min.x, dy: LAYOUT_MARGIN - min.y };
}

// ── Phase 5: edge geo construction ──

function clipEdgePoints(
  pts: Array<{ x: number; y: number }>,
  info: EdgeContainerEndpoints | undefined,
  geoIndex: Map<string, DescriptionNodeGeo>,
): Array<{ x: number; y: number }> {
  let result = pts;
  const fromId = info?.fromContainerAstId;
  if (fromId !== undefined) {
    const g = geoIndex.get(fromId);
    if (g !== undefined) {
      const b: Bbox = { x: g.x, y: g.y, width: g.width, height: g.height };
      result = clipSplineStart(result, b);
    }
  }
  const toId = info?.toContainerAstId;
  if (toId !== undefined) {
    const g = geoIndex.get(toId);
    if (g !== undefined) {
      const b: Bbox = { x: g.x, y: g.y, width: g.width, height: g.height };
      result = clipSplineEnd(result, b);
    }
  }
  return result;
}

function edgeLabelGeo(
  re: ResultEdge,
  pts: Array<{ x: number; y: number }>,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const mid = Math.floor(pts.length / 2);
  const x = re.labelX !== undefined ? re.labelX + dx : (pts[mid]?.x ?? 0);
  const y = re.labelY !== undefined ? re.labelY + dy : (pts[mid]?.y ?? 0);
  return { x, y };
}

function assembleEdgeGeo(
  linkIdx: number,
  link: DescriptiveLink,
  pts: Array<{ x: number; y: number }>,
): DescriptionEdgeGeo {
  const geo: DescriptionEdgeGeo = {
    id: `edge-${linkIdx}`, from: link.from, to: link.to,
    points: pts, dashed: link.style === 'dashed',
  };
  if (link.stereotype !== undefined) geo.stereotype = link.stereotype;
  if (link.arrowHead !== undefined) geo.arrowHead = link.arrowHead;
  return geo;
}

function addEdgeLabel(
  geo: DescriptionEdgeGeo,
  link: DescriptiveLink,
  re: ResultEdge,
  dx: number,
  dy: number,
): void {
  if (link.label === undefined) return;
  geo.label = { text: link.label, ...edgeLabelGeo(re, geo.points, dx, dy) };
}

function buildEdgeGeos(
  links: readonly DescriptiveLink[],
  resultEdges: ResultEdge[],
  m: EdgeMapping,
): DescriptionEdgeGeo[] {
  const byIdx = new Map<number, DescriptionEdgeGeo>();
  for (const re of resultEdges) {
    const linkIdx = m.dotEdgeToLinkIdx.get(re.id);
    if (linkIdx === undefined) continue;
    const link = links[linkIdx];
    if (link === undefined) continue;
    const clipped = clipEdgePoints(re.points, m.edgeContainerEndpoints.get(re.id), m.geoIndex);
    const pts = clipped.map((p) => ({ x: p.x + m.dx, y: p.y + m.dy }));
    const geo = assembleEdgeGeo(linkIdx, link, pts);
    addEdgeLabel(geo, link, re, m.dx, m.dy);
    byIdx.set(linkIdx, geo);
  }
  return [...byIdx.entries()].sort(([a], [b]) => a - b).map(([, g]) => g);
}

// ── Phase 6: total dimensions ──

function scanNodeDims(g: DescriptionNodeGeo, ref: { w: number; h: number }): void {
  const rw = g.x + g.width + LAYOUT_MARGIN;
  const rh = g.y + g.height + LAYOUT_MARGIN;
  if (rw > ref.w) ref.w = rw;
  if (rh > ref.h) ref.h = rh;
  for (const c of g.children) scanNodeDims(c, ref);
}

function computeTotalDimensions(
  nodes: readonly DescriptionNodeGeo[],
  edges: readonly DescriptionEdgeGeo[],
): { totalWidth: number; totalHeight: number } {
  const ref = { w: 0, h: 0 };
  for (const n of nodes) scanNodeDims(n, ref);
  for (const e of edges) {
    for (const p of e.points) {
      if (p.x + LAYOUT_MARGIN > ref.w) ref.w = p.x + LAYOUT_MARGIN;
      if (p.y + LAYOUT_MARGIN > ref.h) ref.h = p.y + LAYOUT_MARGIN;
    }
  }
  return { totalWidth: ref.w, totalHeight: ref.h };
}

// ── Public API helpers ──

// CommandRemoveRestore is a LAZY marker upstream (CucaDiagram.isRemoved at
// print time): magma chaining and the degenerate count run UNFILTERED; only
// classification (empty-group demotion on the filtered view) and the DOT
// emission drop removed entities (verified: cifaki-66 keeps the magma edge
// between the two surviving leaves of a 3-standalone chain; gezemu-34
// demotes an emptied frame to a leaf).
function runLayout(
  ast: DescriptionDiagramAST,
  ctx: ClassifyCtx,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  linetype: 'ortho' | 'polyline' | undefined,
  removed: ReadonlySet<string>,
): { result: DotLayoutResult; edgeDotBuild: EdgeDotBuildResult } {

  // Edges first: buildDotClusters/buildDotNodes need to know which clusters
  // require a group-anchor node — either a direct group-edge
  // (edgeDotBuild.groupAnchorClusterIds, P2/i5) or port children
  // (portRanksByCluster, ClusterDotString.entityPositionsExceptNormal).
  const edgeDotBuild = buildDotEdges(ast.links, ctx, fontSpec, measurer, linetype);
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
  const anchorClusterIds = new Set([...edgeDotBuild.groupAnchorClusterIds, ...portClusterIds]);
  const dotClusters = buildDotClusters(ctx, anchorClusterIds, portRanksByCluster)
    .map((c) => ({ ...c, nodeIds: c.nodeIds.filter((id) => !removed.has(id)) }));
  const { nodeSep, rankSep } = computeGraphSpacing(ast.links, fontSpec, measurer);
  const input: DotInputGraph = {
    nodes: buildDotNodes(ctx, fontSpec, measurer, anchorClusterIds, portClusterIds, ast.links)
      .filter((n) => !removed.has(n.id)),
    edges: edgeDotBuild.dotEdges,
    nodeSep, rankSep,
  };
  // DotStringFactory only emits rankdir=LR for skinparam Rankdir LEFT_TO_RIGHT
  // (`left to right direction`, CommandRankDir.java); TB emits no attribute.
  if (ast.rankdir === 'LR') input.rankDir = 'LR';
  if (dotClusters.length > 0) input.clusters = dotClusters;
  return { result: layoutGraph(input), edgeDotBuild };
}

function buildGeoAndEdges(
  ast: DescriptionDiagramAST,
  result: DotLayoutResult,
  edgeDotBuild: EdgeDotBuildResult,
): { nodes: DescriptionNodeGeo[]; edges: DescriptionEdgeGeo[] } {
  const leafPosMap = new Map(result.nodes.map((n) => [n.id, n]));
  const rawNodes = buildGeoTree(ast.nodes, leafPosMap);
  const { dx, dy } = computeGlobalShift(rawNodes, result.edges.map((e) => e.points));
  const nodes = rawNodes.map((n) => shiftGeo(n, dx, dy));
  const mapping: EdgeMapping = {
    dotEdgeToLinkIdx: edgeDotBuild.dotEdgeToLinkIdx,
    edgeContainerEndpoints: edgeDotBuild.edgeContainerEndpoints,
    geoIndex: buildNodeGeoIndex(rawNodes),
    dx, dy,
  };
  const edges = buildEdgeGeos(ast.links, result.edges, mapping);
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
    return { totalWidth: 0, totalHeight: 0, nodes: [], edges: [] };
  }
  const fontSpec: FontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const ctx: ClassifyCtx = {
    leafIdSet: new Set(), containers: [],
    containerById: new Map(), astNodeById: new Map(), counter: { n: 0 },
  };
  const removed = effectiveRemovedIds(ast.nodes, ast.links, ast.removeUnlinked === true);
  classifyAst(ast.nodes, ctx, removed);
  // Degenerate check counts UNFILTERED entities (DotData counts before the
  // removed filter) — use the raw cluster predicate, not the removal-aware
  // classification.
  const rawContainers = countRawContainers(ast.nodes);
  const degenerate = degenerateSingleLeaf(ast, rawContainers, fontSpec, measurer);
  if (degenerate !== undefined) return degenerate;
  const { result, edgeDotBuild } = runLayout(ast, ctx, fontSpec, measurer, theme.linetype ?? ast.linetype, removed);
  const { nodes, edges } = buildGeoAndEdges(ast, result, edgeDotBuild);
  const { totalWidth, totalHeight } = computeTotalDimensions(nodes, edges);
  return { totalWidth, totalHeight, nodes, edges };
}

export type { USymbol };

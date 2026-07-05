/**
 * Unified layout engine for PlantUML descriptive diagrams
 * (component / use-case / deployment).
 *
 * ## Algorithm — single-pass cluster-aware layout
 *
 * Walk the AST recursively. Classify each node:
 *   - Container symbol WITH children → graphviz cluster (DotInputCluster)
 *   - Everything else (leaf or empty container) → DotInputNode
 *
 * Build one DotInputGraph (nodes + clusters + edges) and call layoutGraph()
 * once. Map the results back to DescriptionGeometry:
 *   - Leaf node positions from result.nodes
 *   - Container bboxes computed bottom-up as padded union of direct children
 *   - Edge points from result.edges (real graphviz splines)
 *   - Cross-container edge endpoints clipped at the container bbox boundary
 *
 * No DOM, no SVG, no async.
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
  computeGraphSpacing,
  buildLinkEdgeAttributes,
  shiftGeo,
  clipSplineStart,
  clipSplineEnd,
  buildNodeGeoIndex,
  type EdgeContainerEndpoints,
  resolveEndpoint,
  containerEndpointsInfo,
  groupAnchorNodeId,
} from './layout-helpers.js';

export type { DescriptionNodeGeo } from './layout-helpers.js';

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

export interface DescriptionEdgeGeo {
  id: string;
  from: string;
  to: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
  stereotype?: string;
  dashed: boolean;
  arrowHead?: 'open' | 'filled' | 'none';
}

export interface DescriptionGeometry {
  totalWidth: number;
  totalHeight: number;
  nodes: DescriptionNodeGeo[];
  edges: DescriptionEdgeGeo[];
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ContainerDesc {
  clusterId: string; // "cluster0", "cluster1", ... (Svek's own naming
  // convention — matches the oracle comparator's `/^cluster\d+$/` cluster
  // detection; our real layout engine re-prefixes with `cluster_` regardless).
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
  /** Cluster ids (ContainerDesc.clusterId) referenced directly by at least
   *  one edge — Svek's `isThereALinkFromOrToGroup`. Each needs one shared
   *  group-anchor point node (buildDotNodes) and cluster membership
   *  (buildDotClusters). */
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

// ---------------------------------------------------------------------------
// Phase 1: AST classification
// ---------------------------------------------------------------------------

function classifyAsCluster(
  node: DescriptiveNode,
  ctx: ClassifyCtx,
  parentAstId?: string,
): void {
  const clusterId = `cluster${ctx.counter.n++}`;
  const directLeafAstIds = node.children
    .filter((c) => !isClusterNode(c))
    .map((c) => c.id);
  const desc: ContainerDesc = {
    clusterId, astId: node.id, symbol: node.symbol,
    display: node.display, directLeafAstIds,
  };
  if (parentAstId !== undefined) desc.parentAstId = parentAstId;
  if (node.stereotype !== undefined) desc.stereotype = node.stereotype;
  ctx.containers.push(desc);
  ctx.containerById.set(node.id, desc);
  classifyAst(node.children, ctx, node.id);
}

function classifyAst(
  nodes: readonly DescriptiveNode[],
  ctx: ClassifyCtx,
  parentAstId?: string,
): void {
  for (const node of nodes) {
    ctx.astNodeById.set(node.id, node);
    if (isClusterNode(node)) {
      classifyAsCluster(node, ctx, parentAstId);
    } else {
      ctx.leafIdSet.add(node.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 2: DotInputGraph construction
// ---------------------------------------------------------------------------

function buildDotNodes(
  ctx: ClassifyCtx,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  groupAnchorClusterIds: ReadonlySet<string>,
): DotInputNode[] {
  const result: DotInputNode[] = [];
  for (const [id, node] of ctx.astNodeById) {
    if (!ctx.leafIdSet.has(id)) continue;
    const dims = measureLeafNode(node, fontSpec, measurer);
    result.push({ id, width: dims.width, height: dims.height });
  }
  // Group-anchor point nodes (ClusterDotString.java:149) — one per cluster
  // referenced directly by an edge, shared across all such edges.
  for (const clusterId of groupAnchorClusterIds) {
    result.push({
      id: groupAnchorNodeId(clusterId),
      width: GROUP_ANCHOR_SIZE,
      height: GROUP_ANCHOR_SIZE,
      shape: 'point',
    });
  }
  return result;
}

function buildDotClusters(
  ctx: ClassifyCtx,
  groupAnchorClusterIds: ReadonlySet<string>,
): DotInputCluster[] {
  return ctx.containers.map((c) => {
    // The anchor is a direct member of its own cluster (not nested in any
    // child sub-cluster) — ClusterDotString.java:149 emits it at the
    // cluster's own level, before its `i`/`p1` nesting.
    const nodeIds = groupAnchorClusterIds.has(c.clusterId)
      ? [...c.directLeafAstIds, groupAnchorNodeId(c.clusterId)]
      : c.directLeafAstIds;
    const cluster: DotInputCluster = { id: c.clusterId, nodeIds };
    if (c.display.length > 0) cluster.label = c.display;
    if (c.parentAstId !== undefined) {
      const parentDesc = ctx.containerById.get(c.parentAstId);
      if (parentDesc !== undefined) cluster.parentId = parentDesc.clusterId;
    }
    return cluster;
  });
}

function buildDotEdges(
  links: readonly DescriptiveLink[],
  ctx: ClassifyCtx,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
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
      attributes: buildLinkEdgeAttributes(link, fontSpec, measurer),
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

// ---------------------------------------------------------------------------
// Phase 3: geo tree construction (bottom-up, containers padded around children)
// ---------------------------------------------------------------------------

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
  return astNodes.map((n) => buildGeoNode(n, leafPosMap));
}

// ---------------------------------------------------------------------------
// Phase 4: global coordinate shift
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Phase 5: edge geo construction
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Phase 6: total dimensions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Public API helpers
// ---------------------------------------------------------------------------

function runLayout(
  ast: DescriptionDiagramAST,
  ctx: ClassifyCtx,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): { result: DotLayoutResult; edgeDotBuild: EdgeDotBuildResult } {
  // Edges first: buildDotClusters/buildDotNodes need to know which clusters
  // require a group-anchor point (edgeDotBuild.groupAnchorClusterIds).
  const edgeDotBuild = buildDotEdges(ast.links, ctx, fontSpec, measurer);
  const dotClusters = buildDotClusters(ctx, edgeDotBuild.groupAnchorClusterIds);
  const { nodeSep, rankSep } = computeGraphSpacing(ast.links, fontSpec, measurer);
  const input: DotInputGraph = {
    nodes: buildDotNodes(ctx, fontSpec, measurer, edgeDotBuild.groupAnchorClusterIds),
    edges: edgeDotBuild.dotEdges,
    nodeSep, rankSep,
  };
  // Upstream DotStringFactory only emits rankdir=LR when skinparam Rankdir is
  // LEFT_TO_RIGHT (set by `left to right direction`); top-to-bottom is the
  // unset default and emits no rankdir attribute at all (CommandRankDir.java).
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lay out a descriptive diagram and return pixel geometry for all nodes and edges.
 *
 * Uses a single-pass cluster-aware layout: containers with children become
 * graphviz cluster subgraphs so dot routes cross-container edges as bezier
 * splines and contains cluster members within the cluster boundary — matching
 * upstream PlantUML's SvekEdge / DotPath model.
 */
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
  classifyAst(ast.nodes, ctx);
  const { result, edgeDotBuild } = runLayout(ast, ctx, fontSpec, measurer);
  const { nodes, edges } = buildGeoAndEdges(ast, result, edgeDotBuild);
  const { totalWidth, totalHeight } = computeTotalDimensions(nodes, edges);
  return { totalWidth, totalHeight, nodes, edges };
}

export type { USymbol };

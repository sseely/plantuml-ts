import type {
  DotInputGraph,
  DotInputNode,
  DotInputEdge,
  DotLayoutResult,
  DotWorkingGraph,
  DotNode,
  DotEdge,
} from './types.js';
import { removeAcyclic } from './acyclic.js';
import { assignRanks } from './rank.js';
import { class2 } from './class2.js';
import { minimizeCrossings } from './mincross.js';
import { assignCoordinates } from './position.js';
import { routeEdges } from './splines.js';
import { dot_clust } from './cluster.js';
import { compoundEdges } from './compound.js';
import { setAspect } from './aspect.js';
import { xlabelPositions } from '../label/index.js';

export type {
  DotInputGraph,
  DotInputNode,
  DotInputEdge,
  DotLayoutResult,
  DotWorkingGraph,
  DotNode,
  DotEdge,
};

function buildWorkingGraph(input: DotInputGraph): DotWorkingGraph {
  const nodeMap = new Map<string, DotNode>();
  for (const n of input.nodes) {
    const wn: DotNode = {
      id: n.id,
      width: n.width,
      height: n.height,
      rank: -1,
      order: -1,
      x: 0,
      y: 0,
      virtual: false,
    };
    if (n.xlabel !== undefined) {
      wn.xlabel = n.xlabel;
      if (n.xlabelWidth !== undefined) wn.xlabelWidth = n.xlabelWidth;
      if (n.xlabelHeight !== undefined) wn.xlabelHeight = n.xlabelHeight;
    }
    nodeMap.set(n.id, wn);
  }

  const edges: DotEdge[] = [];
  for (const [i, e] of input.edges.entries()) {
    const from = nodeMap.get(e.from);
    const to = nodeMap.get(e.to);
    if (from === undefined || to === undefined) continue;
    const edge: DotEdge = {
      id: e.id ?? `edge-${i}`,
      from,
      to,
      weight: e.attributes?.weight ?? 1,
      minLen: e.attributes?.minLen ?? 1,
      reversed: false,
      points: [],
    };
    const tpy = e.attributes?.tailportY;
    if (tpy !== undefined) edge.tailportY = tpy;
    const lbl = e.attributes?.label;
    if (lbl !== undefined) edge.label = lbl;
    const lw = e.attributes?.labelWidth;
    if (lw !== undefined) edge.labelWidth = lw;
    const lh = e.attributes?.labelHeight;
    if (lh !== undefined) edge.labelHeight = lh;
    edges.push(edge);
  }

  return {
    nodes: [...nodeMap.values()],
    edges,
    longEdges: [],
    rankDir: input.rankDir ?? 'TB',
    nodeSep: input.nodeSep ?? 36,
    rankSep: input.rankSep ?? 36,
    clusters: new Map(),
  };
}

/**
 * edgelabel_ranks — Graphviz rank.c:165 equivalent.
 *
 * When any edge carries a label, double all edge minLen values and halve
 * rankSep. This inserts an extra rank slot between every connected pair of
 * nodes, giving virtual label nodes room to participate in layout without
 * overlapping real nodes.
 */
function edgelabel_ranks(graph: DotWorkingGraph): void {
  const hasLabel = graph.edges.some(
    (e) => e.label !== undefined && e.label.length > 0,
  );
  if (!hasLabel) return;
  for (const edge of graph.edges) {
    edge.minLen *= 2;
  }
  graph.rankSep = Math.max(1, Math.floor((graph.rankSep + 1) / 2));
  graph.hasEdgeLabels = true;
}

function extractResult(
  graph: DotWorkingGraph,
  originalNodeIds: Set<string>,
  originalEdgeIds: Set<string>,
  xlabelMap: Map<string, { x: number; y: number }>,
): DotLayoutResult {
  const nodes = graph.nodes
    .filter((n) => !n.virtual && originalNodeIds.has(n.id))
    .map((n) => {
      const base = { id: n.id, x: n.x, y: n.y, width: n.width, height: n.height };
      const xl = xlabelMap.get(n.id);
      if (xl !== undefined) return { ...base, xlabelX: xl.x, xlabelY: xl.y };
      return base;
    });

  // Include both regular edges and long edges (which were split into virtual segments)
  const allEdges = [...graph.edges, ...graph.longEdges];
  const edges = allEdges
    .filter((e) => !e.from.virtual && !e.to.virtual && originalEdgeIds.has(e.id))
    .map((e) => {
      const entry: DotLayoutResult['edges'][number] = { id: e.id, points: e.points };
      if (e.labelNode !== undefined) {
        // The label node is asymmetric: lw = nodeSep (gap from edge line to
        // label text) and rw = labelWidth (the text itself). The label text
        // centre sits at node.x + nodeSep + labelWidth/2 — NOT at the geometric
        // centre of the whole bounding box (node.x + (nodeSep+labelWidth)/2),
        // which would land 18 px too far left.
        const labelWidth = e.labelWidth ?? 0;
        const labelHeight = e.labelHeight ?? 0;
        entry.labelX = e.labelNode.x + graph.nodeSep + labelWidth / 2;
        entry.labelY = e.labelNode.y + e.labelNode.height / 2;
        entry.labelWidth = labelWidth;
        entry.labelHeight = labelHeight;
      }
      if (e.spline === true) {
        entry.spline = true;
      }
      if (e.reversed === true) {
        entry.reversed = true;
      }
      return entry;
    });

  const margin = 12;
  let width = 0;
  let height = 0;
  for (const n of nodes) {
    width = Math.max(width, n.x + n.width + margin);
    height = Math.max(height, n.y + n.height + margin);
  }
  // Labels may extend beyond the rightmost node — include them in the canvas.
  for (const e of edges) {
    if (e.labelX !== undefined && e.labelWidth !== undefined) {
      width = Math.max(width, e.labelX + e.labelWidth / 2 + margin);
    }
  }
  // Include edge spline extents — back-edges in LR mode can curve below/above nodes.
  for (const e of edges) {
    for (const pt of e.points) {
      width = Math.max(width, pt.x + margin);
      height = Math.max(height, pt.y + margin);
    }
  }

  return { nodes, edges, width, height };
}

export function layout(input: DotInputGraph): DotLayoutResult {
  if (input.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const originalNodeIds = new Set(input.nodes.map((n) => n.id));
  const originalEdgeIds = new Set(input.edges.map((e) => e.id));

  const graph = buildWorkingGraph(input);
  removeAcyclic(graph);

  // Remove _r edges that are parallel to a surviving forward edge.
  // These scaffolding edges were added by layoutDot to give the engine
  // bidirectional rank information for undirected graphs.  Once acyclic
  // has run, any _r edge still parallel to its forward counterpart is
  // redundant: keeping it produces duplicate virtual nodes, inflated
  // parallel-edge counts, and double-routed paths in the output.
  {
    const forwardKeys = new Set<string>();
    for (const e of graph.edges) {
      if (!e.id.endsWith('_r')) {
        forwardKeys.add(`${e.from.id}→${e.to.id}`);
      }
    }
    graph.edges = graph.edges.filter(
      (e) => !e.id.endsWith('_r') || !forwardKeys.has(`${e.from.id}→${e.to.id}`),
    );
  }

  const clusterBounds = dot_clust(graph);
  graph.clusters = clusterBounds;
  compoundEdges(graph);

  edgelabel_ranks(graph);
  assignRanks(graph);
  class2(graph);
  minimizeCrossings(graph);
  assignCoordinates(graph);
  routeEdges(graph);

  if (input.aspect !== undefined) {
    setAspect(graph, input.aspect);
  }

  const xlabelResults = xlabelPositions(graph);
  const xlabelMap = new Map<string, { x: number; y: number }>();
  for (const r of xlabelResults) {
    xlabelMap.set(r.nodeId, { x: r.x, y: r.y });
  }

  return extractResult(graph, originalNodeIds, originalEdgeIds, xlabelMap);
}

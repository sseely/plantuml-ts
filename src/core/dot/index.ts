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
import { minimizeCrossings } from './mincross.js';
import { assignCoordinates } from './position.js';
import { routeEdges } from './splines.js';

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
    nodeMap.set(n.id, {
      id: n.id,
      width: n.width,
      height: n.height,
      rank: -1,
      order: -1,
      x: 0,
      y: 0,
      virtual: false,
    });
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
): DotLayoutResult {
  const nodes = graph.nodes
    .filter((n) => !n.virtual && originalNodeIds.has(n.id))
    .map((n) => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height }));

  // Include both regular edges and long edges (which were split into virtual segments)
  const allEdges = [...graph.edges, ...graph.longEdges];
  const edges = allEdges
    .filter((e) => !e.from.virtual && !e.to.virtual && originalEdgeIds.has(e.id))
    .map((e) => {
      const entry: DotLayoutResult['edges'][number] = { id: e.id, points: e.points };
      if (e.labelNode !== undefined) {
        // place_vnlabel (dotsplines.c:492): pos.x = ND_coord(n).x + labelWidth/2
        // The edge passes through the virtual node's geometric center; adding
        // half the label width shifts the text so its left edge aligns with the
        // line rather than straddling it.
        const labelWidth = e.labelWidth ?? 0;
        const labelHeight = e.labelHeight ?? 0;
        entry.labelX = e.labelNode.x + e.labelNode.width / 2 + labelWidth / 2;
        entry.labelY = e.labelNode.y + e.labelNode.height / 2;
        entry.labelWidth = labelWidth;
        entry.labelHeight = labelHeight;
      }
      if (e.spline === true) {
        entry.spline = true;
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
  edgelabel_ranks(graph);
  assignRanks(graph);
  minimizeCrossings(graph);
  assignCoordinates(graph);
  routeEdges(graph);

  return extractResult(graph, originalNodeIds, originalEdgeIds);
}

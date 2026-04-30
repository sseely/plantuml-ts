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
import { placeEdgeLabels } from './edgelabels.js';

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
    .map((e) => ({ id: e.id, points: e.points }));

  const margin = 12;
  let width = 0;
  let height = 0;
  for (const n of nodes) {
    width = Math.max(width, n.x + n.width + margin);
    height = Math.max(height, n.y + n.height + margin);
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
  assignRanks(graph);
  minimizeCrossings(graph);
  assignCoordinates(graph);
  routeEdges(graph);
  placeEdgeLabels(graph);

  return extractResult(graph, originalNodeIds, originalEdgeIds);
}

import type { DotWorkingGraph, DotEdge, DotNode } from './types.js';

const WHITE = 0;
const GRAY = 1;
const BLACK = 2;

function dfs(
  node: DotNode,
  edges: DotEdge[],
  state: Map<string, number>,
): void {
  state.set(node.id, GRAY);

  let i = 0;
  while (i < edges.length) {
    const edge = edges[i];
    if (edge === undefined) {
      i++;
      continue;
    }
    if (edge.from.id !== node.id) {
      i++;
      continue;
    }

    const targetState = state.get(edge.to.id) ?? WHITE;
    if (targetState === GRAY) {
      // Back-edge found — reverse it to break the cycle (graphviz reverse_edge).
      edge.reversed = true;
      const tmp = edge.from;
      edge.from = edge.to;
      edge.to = tmp;

      // merge_oneway: for synthetic _r edges (added by layoutDot for undirected
      // graphs) collapse back into the matching forward edge when they become
      // parallel after reversal.  _r edges are layout scaffolding — they must
      // not survive as duplicate parallel edges into the routing phase.
      // User-defined edges (no _r suffix) are intentional and must be kept even
      // when antiparallel to an existing edge (e.g. a state-machine with both
      // idle→running and running→idle).
      if (edge.id.endsWith('_r')) {
        let merged = false;
        for (let j = 0; j < edges.length; j++) {
          if (j === i) continue;
          const other = edges[j];
          if (
            other !== undefined &&
            other.from.id === edge.from.id &&
            other.to.id === edge.to.id
          ) {
            other.weight += edge.weight;
            edges.splice(i, 1);
            merged = true;
            break;
          }
        }
        if (!merged) i++;
      } else {
        i++;
      }
    } else {
      if (targetState === WHITE) {
        dfs(edge.to, edges, state);
      }
      i++;
    }
  }

  state.set(node.id, BLACK);
}

export function removeAcyclic(graph: DotWorkingGraph): void {
  const state = new Map<string, number>();

  for (const node of graph.nodes) {
    if ((state.get(node.id) ?? WHITE) === WHITE) {
      dfs(node, graph.edges, state);
    }
  }
}

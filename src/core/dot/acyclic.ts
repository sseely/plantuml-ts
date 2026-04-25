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
      edge.reversed = true;
      const tmp = edge.from;
      edge.from = edge.to;
      edge.to = tmp;
      // Do not advance i — the edge list may have shifted in the original
      // algorithm. Here we mutate in place and skip past this edge.
      i++;
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

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
      // Back-edge found — reverse it to break the cycle.
      // Mirrors graphviz acyclic.c reverse_edge():
      //   1. Mark the edge reversed.
      //   2. Swap from/to in-place.
      //   3. If an opposing edge already exists (the case where both A→B
      //      and B→A are present), merge by accumulating weight onto the
      //      existing opposing edge and removing this duplicate — matching
      //      graphviz's merge_oneway() path in reverse_edge().
      //      Otherwise, the in-place swap acts as virtual_edge().
      //
      // Note on loop counter: graphviz does i-- here because delete_fast_edge
      // removes the edge from the per-node out-list, causing list[i] to shift.
      // In our flat all-edges array the reversed edge stays at index i with
      // mutated from/to, so the next iteration's `edge.from.id !== node.id`
      // check skips it correctly — i++ is right for our representation.
      edge.reversed = true;
      const tmp = edge.from;
      edge.from = edge.to;
      edge.to = tmp;

      // merge_oneway path: find an existing edge going the same direction
      // as the now-reversed edge (i.e., from the new from to the new to).
      let merged = false;
      for (let j = 0; j < edges.length; j++) {
        if (j === i) continue;
        const other = edges[j];
        if (
          other !== undefined &&
          other.from.id === edge.from.id &&
          other.to.id === edge.to.id
        ) {
          // Accumulate weight into the existing edge; remove this duplicate.
          other.weight += edge.weight;
          edges.splice(i, 1);
          // Do not advance i — splice shifted everything left by 1, so
          // what was at i+1 is now at i.
          merged = true;
          break;
        }
      }

      if (!merged) {
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

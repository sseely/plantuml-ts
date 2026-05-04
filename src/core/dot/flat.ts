/**
 * flat.ts — flat-edge handling for dot crossing minimization.
 *
 * Port of graphviz/lib/dotgen/flat.c (AT&T / Eclipse Public License v2.0).
 * Flat edges connect nodes at the same rank. They impose ordering constraints
 * on node positions within a rank, but do not contribute to cross-rank
 * crossings.
 *
 * Public surface:
 *   FlatMatrix      — type alias for per-rank ordering constraints
 *   buildFlatAdj    — build per-rank flat-edge adjacency lists from edge list
 *   flat_breakcycles — DFS cycle detection/removal; returns a FlatMatrix
 *   flat_reorder    — topological post-order sort within each rank
 */

import type { DotNode, DotEdge } from './types.js';

// flatMatrix[rank].get(fromId)?.has(toId) === true means fromId must appear
// left of toId within the same rank.
export type FlatMatrix = Map<number, Map<string, Set<string>>>;

// ---------------------------------------------------------------------------
// buildFlatAdj
// ---------------------------------------------------------------------------

/**
 * Build per-rank flat-edge adjacency from edges where from.rank === to.rank.
 *
 * C: the flat adjacency structure populated by classify_edges() in mincross.c
 * that feeds flat_breakcycles / flat_reorder.
 */
export function buildFlatAdj(edges: DotEdge[]): Map<number, Map<string, string[]>> {
  const flatAdj = new Map<number, Map<string, string[]>>();
  for (const edge of edges) {
    if (edge.from.rank !== edge.to.rank) continue;
    if (edge.from.id === edge.to.id) continue; // self-loops carry no ordering information
    const rank = edge.from.rank;
    let rankMap = flatAdj.get(rank);
    if (rankMap === undefined) {
      rankMap = new Map();
      flatAdj.set(rank, rankMap);
    }
    const list = rankMap.get(edge.from.id);
    if (list !== undefined) {
      list.push(edge.to.id);
    } else {
      rankMap.set(edge.from.id, [edge.to.id]);
    }
  }
  return flatAdj;
}

// ---------------------------------------------------------------------------
// flat_breakcycles
// ---------------------------------------------------------------------------

/**
 * DFS cycle detection on flat edges within each rank.
 *
 * C: flat_breakcycles() mincross.c:1105-1131
 *
 * Returns a FlatMatrix: flatMatrix[rank].get(fromId)?.has(toId) == true means
 * fromId must be left of toId.
 *
 * When the DFS discovers a back-edge (a→b where b is on the current DFS stack),
 * it reverses that edge in the working adjacency so the resulting graph is a DAG.
 * All post-reversal edges are collected as ordering constraints.
 */
export function flat_breakcycles(
  layers: Map<number, DotNode[]>,
  flatAdj: Map<number, Map<string, string[]>>,
): FlatMatrix {
  const flatMatrix: FlatMatrix = new Map();

  for (const [rank, layer] of layers) {
    const adj = flatAdj.get(rank);
    if (adj === undefined || adj.size === 0) continue;

    const nodeSet = new Set(layer.map((n) => n.id));
    const visited = new Set<string>();
    const onStack = new Set<string>();
    // After cycle breaking, store directed edges as constraints
    const constraints = new Map<string, Set<string>>();
    for (const id of nodeSet) constraints.set(id, new Set());

    // Working copy of adjacency that we can mutate (reverse back-edges)
    const workAdj = new Map<string, string[]>();
    for (const [from, tos] of adj) {
      workAdj.set(from, [...tos]);
    }

    function dfsBreak(nodeId: string): void {
      visited.add(nodeId);
      onStack.add(nodeId);
      const neighbors = workAdj.get(nodeId) ?? [];
      for (let i = 0; i < neighbors.length; i++) {
        const toId = neighbors[i]!;
        if (!nodeSet.has(toId)) continue;
        if (onStack.has(toId)) {
          // Back-edge — reverse it: remove from→to, add to→from in workAdj
          neighbors.splice(i, 1);
          i--;
          const toNeighbors = workAdj.get(toId);
          if (toNeighbors !== undefined) {
            toNeighbors.push(nodeId);
          } else {
            workAdj.set(toId, [nodeId]);
          }
        } else if (!visited.has(toId)) {
          dfsBreak(toId);
        }
      }
      onStack.delete(nodeId);
    }

    for (const node of layer) {
      if (!visited.has(node.id)) {
        dfsBreak(node.id);
      }
    }

    // Populate constraints from the (possibly cycle-broken) workAdj
    for (const [fromId, tos] of workAdj) {
      if (!nodeSet.has(fromId)) continue;
      for (const toId of tos) {
        if (!nodeSet.has(toId)) continue;
        constraints.get(fromId)?.add(toId);
      }
    }

    flatMatrix.set(rank, constraints);
  }

  return flatMatrix;
}

// ---------------------------------------------------------------------------
// flat_reorder
// ---------------------------------------------------------------------------

/**
 * Topological post-order sort of nodes within a rank using flat edge constraints.
 *
 * C: flat_reorder() mincross.c:1339-1408
 *
 * For each rank that has flat-edge constraints, performs a DFS post-order
 * traversal and reverses the result to produce a topological order (sources
 * first). The layer is then rearranged in-place and `order` values are
 * reassigned.
 *
 * This is called after BFS seed passes and after each WMEDIAN sweep to
 * re-impose flat ordering constraints that the median sweep may have disturbed.
 */
export function flat_reorder(
  layers: Map<number, DotNode[]>,
  flatMatrix: FlatMatrix,
): void {
  for (const [rank, layer] of layers) {
    const maybeConstraints = flatMatrix.get(rank);
    if (maybeConstraints === undefined || maybeConstraints.size === 0) continue;
    // Capture as an explicit non-optional alias so the nested DFS closure
    // is not affected by TypeScript's control-flow widening.
    const rankConstraints: Map<string, Set<string>> = maybeConstraints;

    const nodeIds = layer.map((n) => n.id);
    const nodeSet = new Set(nodeIds);

    // Topological sort via DFS post-order
    const visited = new Set<string>();
    const postOrder: string[] = [];

    function dfsOrder(nodeId: string): void {
      visited.add(nodeId);
      const succs = rankConstraints.get(nodeId);
      if (succs !== undefined) {
        for (const toId of succs) {
          if (nodeSet.has(toId) && !visited.has(toId)) {
            dfsOrder(toId);
          }
        }
      }
      postOrder.push(nodeId);
    }

    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        dfsOrder(nodeId);
      }
    }

    // Reverse post-order gives topological order (roots first)
    postOrder.reverse();

    // Build id→node map
    const nodeById = new Map<string, DotNode>();
    for (const node of layer) nodeById.set(node.id, node);

    // Rearrange layer in topological order; nodes not in postOrder stay appended
    const seen = new Set<string>();
    const newOrder: DotNode[] = [];
    for (const id of postOrder) {
      const node = nodeById.get(id);
      if (node !== undefined) {
        newOrder.push(node);
        seen.add(id);
      }
    }
    for (const node of layer) {
      if (!seen.has(node.id)) newOrder.push(node);
    }

    // Update layer in-place and reassign order values
    for (let i = 0; i < layer.length; i++) {
      layer[i] = newOrder[i]!;
      layer[i]!.order = i;
    }
  }
}

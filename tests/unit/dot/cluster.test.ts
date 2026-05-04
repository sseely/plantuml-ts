import { describe, it, expect } from 'vitest';
import type { DotNode, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { dot_clust } from '../../../src/core/dot/cluster.js';

// dot_clust reads the optional clusterId field that T10 will add to DotNode.
// Extend DotNode locally so these tests compile without touching types.ts
// ahead of T10.
interface DotNodeWithCluster extends DotNode {
  clusterId?: string;
}

function makeNode(id: string, rank: number, clusterId?: string): DotNodeWithCluster {
  return {
    id,
    width: 80,
    height: 36,
    rank,
    order: 0,
    x: 0,
    y: 0,
    virtual: false,
    // Omit clusterId entirely when undefined to satisfy exactOptionalPropertyTypes.
    ...(clusterId !== undefined ? { clusterId } : {}),
  };
}

function makeGraph(nodes: DotNodeWithCluster[]): DotWorkingGraph {
  // DotNodeWithCluster extends DotNode, so assignable without a cast.
  const dotNodes: DotNode[] = nodes;
  return {
    nodes: dotNodes,
    edges: [],
    longEdges: [],
    rankDir: 'TB',
    nodeSep: 36,
    rankSep: 36,
  };
}

describe('dot_clust', () => {
  it('given a flat graph with no clusterId on any node, returns an empty map', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 1);
    const graph = makeGraph([a, b]);

    const result = dot_clust(graph);

    expect(result.size).toBe(0);
  });

  it('given nodes in two distinct clusters, returns correct minRank/maxRank for each', () => {
    const a = makeNode('A', 0, 'c1');
    const b = makeNode('B', 1, 'c1');
    const c = makeNode('C', 2, 'c2');
    const d = makeNode('D', 3, 'c2');
    const graph = makeGraph([a, b, c, d]);

    const result = dot_clust(graph);

    expect(result.size).toBe(2);
    expect(result.get('c1')).toEqual({ minRank: 0, maxRank: 1 });
    expect(result.get('c2')).toEqual({ minRank: 2, maxRank: 3 });
  });

  it('given a single-node cluster, minRank and maxRank are equal', () => {
    const a = makeNode('A', 2, 'solo');
    const graph = makeGraph([a]);

    const result = dot_clust(graph);

    expect(result.size).toBe(1);
    expect(result.get('solo')).toEqual({ minRank: 2, maxRank: 2 });
  });

  it('given mixed nodes where some have clusterId and some do not, only clusters are returned', () => {
    const a = makeNode('A', 0, 'c1');
    const b = makeNode('B', 1, 'c1');
    const c = makeNode('C', 2);
    const graph = makeGraph([a, b, c]);

    const result = dot_clust(graph);

    expect(result.size).toBe(1);
    expect(result.get('c1')).toEqual({ minRank: 0, maxRank: 1 });
    expect(result.has('c2')).toBe(false);
  });

  it('given a cluster with non-contiguous ranks, bounds span the full range', () => {
    const a = makeNode('A', 0, 'c1');
    const b = makeNode('B', 3, 'c1');
    const graph = makeGraph([a, b]);

    const result = dot_clust(graph);

    expect(result.get('c1')).toEqual({ minRank: 0, maxRank: 3 });
  });

  it('given nodes inserted in reverse rank order, minRank is updated when a lower rank is seen', () => {
    // Insert the high-rank node first so the minRank update branch
    // (n.rank < existing.minRank) is exercised on the second node.
    const b = makeNode('B', 5, 'c1');
    const a = makeNode('A', 1, 'c1');
    const graph = makeGraph([b, a]);

    const result = dot_clust(graph);

    expect(result.get('c1')).toEqual({ minRank: 1, maxRank: 5 });
  });
});

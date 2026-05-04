import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { compoundEdges } from '../../../src/core/dot/compound.js';

// T10 will add lhead/ltail to DotEdge and clusterId to DotNode in types.ts.
// Extend locally so these tests compile without modifying types.ts ahead of T10.
interface DotNodeWithCluster extends DotNode {
  clusterId?: string;
}

interface CompoundDotEdge extends DotEdge {
  lhead?: string;
  ltail?: string;
}

function makeNode(
  id: string,
  rank: number,
  virtual = false,
  clusterId?: string,
): DotNodeWithCluster {
  return {
    id,
    width: 80,
    height: 36,
    rank,
    order: 0,
    x: 0,
    y: 0,
    virtual,
    ...(clusterId !== undefined ? { clusterId } : {}),
  };
}

function makeEdge(
  id: string,
  from: DotNodeWithCluster,
  to: DotNodeWithCluster,
  lhead?: string,
  ltail?: string,
): CompoundDotEdge {
  return {
    id,
    from,
    to,
    weight: 1,
    minLen: 1,
    reversed: false,
    points: [],
    ...(lhead !== undefined ? { lhead } : {}),
    ...(ltail !== undefined ? { ltail } : {}),
  };
}

function makeGraph(
  nodes: DotNodeWithCluster[],
  edges: CompoundDotEdge[],
): DotWorkingGraph {
  const dotNodes: DotNode[] = nodes;
  const dotEdges: DotEdge[] = edges;
  return {
    nodes: dotNodes,
    edges: dotEdges,
    longEdges: [],
    rankDir: 'TB',
    nodeSep: 36,
    rankSep: 36,
  };
}

describe('compoundEdges', () => {
  it('given an edge with lhead naming a cluster, redirects edge.to to the virtual border node', () => {
    // inner node at rank 3 — the actual head inside the cluster
    const innerHead = makeNode('inner', 3, false, 'cluster_A');
    // virtual border node at rank 2, belongs to cluster_A
    const borderNode = makeNode('border', 2, true, 'cluster_A');
    // tail node outside any cluster
    const tail = makeNode('tail', 0);

    const e = makeEdge('e1', tail, innerHead, 'cluster_A');
    const graph = makeGraph([tail, innerHead, borderNode], [e]);

    compoundEdges(graph);

    expect(e.to).toBe(borderNode);
  });

  it('given an edge with ltail naming a cluster, redirects edge.from to the virtual border node', () => {
    const innerTail = makeNode('inner', 0, false, 'cluster_B');
    const borderNode = makeNode('border', 1, true, 'cluster_B');
    const head = makeNode('head', 3);

    const e = makeEdge('e1', innerTail, head, undefined, 'cluster_B');
    const graph = makeGraph([innerTail, borderNode, head], [e]);

    compoundEdges(graph);

    expect(e.from).toBe(borderNode);
  });

  it('given a graph with no compound edges, no edge endpoints are modified', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 1);
    const e = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [e]);

    compoundEdges(graph);

    expect(e.from).toBe(a);
    expect(e.to).toBe(b);
  });

  it('given an edge with lhead naming a cluster that has no virtual border node, edge is unchanged', () => {
    // Cluster exists (has a real node) but no virtual border node
    const innerHead = makeNode('inner', 2, false, 'cluster_C');
    const tail = makeNode('tail', 0);

    const e = makeEdge('e1', tail, innerHead, 'cluster_C');
    const graph = makeGraph([tail, innerHead], [e]);

    compoundEdges(graph);

    // No virtual border node exists — graceful no-op
    expect(e.to).toBe(innerHead);
  });

  it('given an edge with lhead naming a cluster that does not exist in the graph, edge is unchanged', () => {
    const tail = makeNode('tail', 0);
    const head = makeNode('head', 1);

    const e = makeEdge('e1', tail, head, 'cluster_nonexistent');
    const graph = makeGraph([tail, head], [e]);

    compoundEdges(graph);

    expect(e.to).toBe(head);
  });

  it('given an edge with both lhead and ltail, redirects both endpoints', () => {
    const innerTail = makeNode('it', 0, false, 'cluster_X');
    const borderTail = makeNode('bt', 1, true, 'cluster_X');
    const innerHead = makeNode('ih', 3, false, 'cluster_Y');
    const borderHead = makeNode('bh', 2, true, 'cluster_Y');

    const e = makeEdge('e1', innerTail, innerHead, 'cluster_Y', 'cluster_X');
    const graph = makeGraph(
      [innerTail, borderTail, innerHead, borderHead],
      [e],
    );

    compoundEdges(graph);

    expect(e.from).toBe(borderTail);
    expect(e.to).toBe(borderHead);
  });

  it('when multiple virtual border nodes exist for a cluster, picks the one with the lowest rank for lhead', () => {
    // Two virtual border nodes in cluster_A at different ranks
    const border1 = makeNode('b1', 1, true, 'cluster_A');
    const border2 = makeNode('b2', 2, true, 'cluster_A');
    const innerHead = makeNode('ih', 3, false, 'cluster_A');
    const tail = makeNode('tail', 0);

    const e = makeEdge('e1', tail, innerHead, 'cluster_A');
    const graph = makeGraph([tail, border1, border2, innerHead], [e]);

    compoundEdges(graph);

    // For lhead (head cluster), we want the border node closest to the tail
    // (lowest rank from the tail's perspective = entry point into the cluster).
    // The C algorithm traverses from the spline tail toward the head cluster and
    // finds the *first* crossing — i.e., the cluster boundary closest to the
    // edge's source. For TB graphs that means the node with the lowest rank.
    expect(e.to).toBe(border1);
  });

  it('when multiple virtual border nodes exist for a cluster, picks the one with the highest rank for ltail', () => {
    const innerTail = makeNode('it', 0, false, 'cluster_B');
    const border1 = makeNode('b1', 1, true, 'cluster_B');
    const border2 = makeNode('b2', 2, true, 'cluster_B');
    const head = makeNode('head', 4);

    const e = makeEdge('e1', innerTail, head, undefined, 'cluster_B');
    const graph = makeGraph([innerTail, border1, border2, head], [e]);

    compoundEdges(graph);

    // For ltail (tail cluster), we want the border node closest to the head
    // (highest rank = exit point from the cluster toward the head).
    expect(e.from).toBe(border2);
  });
});

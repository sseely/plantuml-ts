import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { decompose } from '../../../src/core/dot/decomp.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, ranktype?: DotNode['ranktype']): DotNode {
  const n: DotNode = {
    id,
    width: 80,
    height: 36,
    rank: -1,
    order: -1,
    x: 0,
    y: 0,
    virtual: false,
  };
  if (ranktype !== undefined) n.ranktype = ranktype;
  return n;
}

function makeEdge(id: string, from: DotNode, to: DotNode): DotEdge {
  return { id, from, to, weight: 1, minLen: 1, reversed: false, points: [] };
}

function makeGraph(nodes: DotNode[], edges: DotEdge[]): DotWorkingGraph {
  return {
    nodes,
    edges,
    longEdges: [],
    rankDir: 'TB',
    nodeSep: 36,
    rankSep: 36,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('decompose', () => {
  it('single fully-connected chain A→B→C returns one component with all 3 nodes', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', b, c);
    const graph = makeGraph([a, b, c], [e1, e2]);

    const components = decompose(graph);

    expect(components).toHaveLength(1);
    expect(components[0]!.nodes).toHaveLength(3);
    expect(components[0]!.edges).toHaveLength(2);
  });

  it('disconnected graph A→B and C→D returns two components each with 2 nodes and 1 edge', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', c, d);
    const graph = makeGraph([a, b, c, d], [e1, e2]);

    const components = decompose(graph);

    expect(components).toHaveLength(2);

    const sizes = components.map(comp => comp.nodes.length).sort();
    expect(sizes).toEqual([2, 2]);

    for (const comp of components) {
      expect(comp.edges).toHaveLength(1);
    }
  });

  it('each component contains the correct nodes (A→B separate from C→D)', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', c, d);
    const graph = makeGraph([a, b, c, d], [e1, e2]);

    const components = decompose(graph);

    const compWithA = components.find(comp => comp.nodes.includes(a));
    expect(compWithA).toBeDefined();
    expect(compWithA!.nodes).toContain(b);
    expect(compWithA!.nodes).not.toContain(c);
    expect(compWithA!.nodes).not.toContain(d);

    const compWithC = components.find(comp => comp.nodes.includes(c));
    expect(compWithC).toBeDefined();
    expect(compWithC!.nodes).toContain(d);
    expect(compWithC!.nodes).not.toContain(a);
    expect(compWithC!.nodes).not.toContain(b);
  });

  it('three separate isolated nodes returns three single-node components', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const graph = makeGraph([a, b, c], []);

    const components = decompose(graph);

    expect(components).toHaveLength(3);
    for (const comp of components) {
      expect(comp.nodes).toHaveLength(1);
      expect(comp.edges).toHaveLength(0);
    }
  });

  it('single isolated node returns one component with 1 node and 0 edges', () => {
    const a = makeNode('A');
    const graph = makeGraph([a], []);

    const components = decompose(graph);

    expect(components).toHaveLength(1);
    expect(components[0]!.nodes).toHaveLength(1);
    expect(components[0]!.edges).toHaveLength(0);
  });

  it('empty graph returns empty array', () => {
    const graph = makeGraph([], []);

    const components = decompose(graph);

    expect(components).toHaveLength(0);
  });

  it('node references in sub-graphs are the same objects as in the original graph', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const e1 = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [e1]);

    const components = decompose(graph);

    expect(components).toHaveLength(1);
    const compNodes = components[0]!.nodes;
    // Same object references — not copies
    expect(compNodes.some(n => n === a)).toBe(true);
    expect(compNodes.some(n => n === b)).toBe(true);
  });

  it('rank assigned on sub-graph node is visible on the original graph node (same reference)', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const e1 = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [e1]);

    const components = decompose(graph);
    const subNode = components[0]!.nodes.find(n => n.id === 'A')!;
    subNode.rank = 42;

    // Original graph's node 'a' is the same object
    expect(a.rank).toBe(42);
  });

  it('source rank constraint is intact in the sub-graph node', () => {
    const x = makeNode('X', 'source');
    const y = makeNode('Y');
    const e1 = makeEdge('e1', x, y);
    const graph = makeGraph([x, y], [e1]);

    const components = decompose(graph);

    expect(components).toHaveLength(1);
    const xInComp = components[0]!.nodes.find(n => n.id === 'X');
    expect(xInComp).toBeDefined();
    expect(xInComp!.ranktype).toBe('source');
  });

  it('min rank constraint is preserved in the component', () => {
    const m = makeNode('M', 'min');
    const n = makeNode('N');
    const e1 = makeEdge('e1', m, n);
    const graph = makeGraph([m, n], [e1]);

    const components = decompose(graph);

    const mInComp = components[0]!.nodes.find(node => node.id === 'M');
    expect(mInComp!.ranktype).toBe('min');
  });

  it('max rank constraint is preserved in the component', () => {
    const m = makeNode('M');
    const s = makeNode('S', 'max');
    const e1 = makeEdge('e1', m, s);
    const graph = makeGraph([m, s], [e1]);

    const components = decompose(graph);

    const sInComp = components[0]!.nodes.find(node => node.id === 'S');
    expect(sInComp!.ranktype).toBe('max');
  });

  it('returned sub-graphs inherit rankDir, nodeSep, rankSep from original', () => {
    const a = makeNode('A');
    const graph: DotWorkingGraph = {
      nodes: [a],
      edges: [],
      longEdges: [],
      rankDir: 'LR',
      nodeSep: 48,
      rankSep: 72,
    };

    const components = decompose(graph);

    expect(components[0]!.rankDir).toBe('LR');
    expect(components[0]!.nodeSep).toBe(48);
    expect(components[0]!.rankSep).toBe(72);
  });

  it('returned sub-graphs have empty longEdges array', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const e1 = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [e1]);

    const components = decompose(graph);

    for (const comp of components) {
      expect(comp.longEdges).toEqual([]);
    }
  });

  it('three-component graph with edges A→B, C→D, E→F→G returns 3 components', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const e = makeNode('E');
    const f = makeNode('F');
    const g = makeNode('G');

    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', c, d);
    const e3 = makeEdge('e3', e, f);
    const e4 = makeEdge('e4', f, g);

    const graph = makeGraph([a, b, c, d, e, f, g], [e1, e2, e3, e4]);

    const components = decompose(graph);

    expect(components).toHaveLength(3);

    const compEFG = components.find(comp => comp.nodes.includes(e));
    expect(compEFG).toBeDefined();
    expect(compEFG!.nodes).toHaveLength(3);
    expect(compEFG!.edges).toHaveLength(2);
  });

  it('undirected connectivity: C→A and B→A puts A, B, C in the same component', () => {
    // DFS traverses both directions of edges (both from and to endpoints)
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const e1 = makeEdge('e1', c, a);
    const e2 = makeEdge('e2', b, a);
    const graph = makeGraph([a, b, c], [e1, e2]);

    const components = decompose(graph);

    expect(components).toHaveLength(1);
    expect(components[0]!.nodes).toHaveLength(3);
  });

  it('virtual nodes are included when reachable but not used as seeds', () => {
    const a = makeNode('A');
    const vn: DotNode = {
      id: '__vn_e1_1',
      width: 36,
      height: 0,
      rank: -1,
      order: -1,
      x: 0,
      y: 0,
      virtual: true,
    };
    const b = makeNode('B');
    const e1 = makeEdge('e1', a, vn);
    const e2 = makeEdge('e2', vn, b);
    const graph = makeGraph([a, vn, b], [e1, e2]);

    const components = decompose(graph);

    // All three nodes (including virtual) are in one component
    expect(components).toHaveLength(1);
    expect(components[0]!.nodes).toHaveLength(3);
  });

  it('each component edge array contains only edges with both endpoints in that component', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', c, d);
    const graph = makeGraph([a, b, c, d], [e1, e2]);

    const components = decompose(graph);

    for (const comp of components) {
      const nodeSet = new Set(comp.nodes);
      for (const edge of comp.edges) {
        expect(nodeSet.has(edge.from)).toBe(true);
        expect(nodeSet.has(edge.to)).toBe(true);
      }
    }
  });

  it('does not modify the original graph nodes or edges arrays', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', c, d);
    const graph = makeGraph([a, b, c, d], [e1, e2]);
    const originalNodeCount = graph.nodes.length;
    const originalEdgeCount = graph.edges.length;

    decompose(graph);

    expect(graph.nodes).toHaveLength(originalNodeCount);
    expect(graph.edges).toHaveLength(originalEdgeCount);
  });
});

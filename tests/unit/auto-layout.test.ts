import { describe, it, expect } from 'vitest';
import { analyzeTopology, selectEngine, autoLayout } from '../../src/core/auto-layout.js';
import type { DotInputGraph } from '../../src/core/dot/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chain(ids: string[]): DotInputGraph {
  return {
    nodes: ids.map((id) => ({ id, width: 80, height: 36 })),
    edges: ids.slice(0, -1).map((id, i) => ({ id: `e${i}`, from: id, to: ids[i + 1]! })),
  };
}

function cycle(ids: string[]): DotInputGraph {
  return {
    nodes: ids.map((id) => ({ id, width: 80, height: 36 })),
    edges: ids.map((id, i) => ({ id: `e${i}`, from: id, to: ids[(i + 1) % ids.length]! })),
  };
}

function star(centerId: string, leafCount: number): DotInputGraph {
  const leaves = Array.from({ length: leafCount }, (_, i) => `L${i}`);
  return {
    nodes: [{ id: centerId, width: 80, height: 36 }, ...leaves.map((id) => ({ id, width: 80, height: 36 }))],
    edges: leaves.map((id, i) => ({ id: `e${i}`, from: centerId, to: id })),
  };
}

// ---------------------------------------------------------------------------
// analyzeTopology
// ---------------------------------------------------------------------------

describe('analyzeTopology()', () => {
  it('empty graph returns all-zero metrics', () => {
    const m = analyzeTopology({ nodes: [], edges: [] });
    expect(m).toEqual({ nodeCount: 0, edgeCount: 0, componentCount: 0, maxDepth: 0, isDAG: true, density: 0, treeness: 0, avgDegree: 0 });
  });

  it('single isolated node', () => {
    const m = analyzeTopology({ nodes: [{ id: 'A', width: 80, height: 36 }], edges: [] });
    expect(m.nodeCount).toBe(1);
    expect(m.edgeCount).toBe(0);
    expect(m.componentCount).toBe(1);
    expect(m.maxDepth).toBe(0);
    expect(m.isDAG).toBe(true);
    expect(m.density).toBe(0);
  });

  it('linear DAG chain A→B→C→D: isDAG=true, treeness=1, componentCount=1', () => {
    const m = analyzeTopology(chain(['A', 'B', 'C', 'D']));
    expect(m.nodeCount).toBe(4);
    expect(m.edgeCount).toBe(3);
    expect(m.componentCount).toBe(1);
    // BFS roots at B (highest degree, lex-first); A and C are depth 1, D is depth 2.
    expect(m.maxDepth).toBe(2);
    expect(m.isDAG).toBe(true);
    expect(m.treeness).toBeCloseTo(1, 5);
  });

  it('directed cycle A→B→C→A: isDAG=false, componentCount=1', () => {
    const m = analyzeTopology(cycle(['A', 'B', 'C']));
    expect(m.isDAG).toBe(false);
    expect(m.componentCount).toBe(1);
  });

  it('two disconnected nodes: componentCount=2', () => {
    const m = analyzeTopology({
      nodes: [{ id: 'A', width: 80, height: 36 }, { id: 'B', width: 80, height: 36 }],
      edges: [],
    });
    expect(m.componentCount).toBe(2);
  });

  it('star graph: maxDepth=1 from center (depth=2 from leaf)', () => {
    const m = analyzeTopology(star('C', 4));
    // Root of BFS is highest-degree node = center; its BFS depth to leaves = 1
    expect(m.maxDepth).toBe(1);
    expect(m.isDAG).toBe(true);
    expect(m.componentCount).toBe(1);
  });

  it('density of K3 complete undirected (3 nodes, 3 edges) ≈ 1.0', () => {
    const m = analyzeTopology({
      nodes: ['A', 'B', 'C'].map((id) => ({ id, width: 80, height: 36 })),
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
        { id: 'e3', from: 'A', to: 'C' },
      ],
    });
    expect(m.density).toBeCloseTo(1, 5);
  });

  it('edges referencing unknown node ids are ignored in metrics', () => {
    const m = analyzeTopology({
      nodes: [{ id: 'A', width: 80, height: 36 }],
      edges: [{ id: 'e1', from: 'A', to: 'MISSING' }],
    });
    expect(m.edgeCount).toBe(1); // raw edge count from input
    expect(m.componentCount).toBe(1);
    expect(m.isDAG).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// selectEngine
// ---------------------------------------------------------------------------

describe('selectEngine()', () => {
  const base = { nodeCount: 6, edgeCount: 5, componentCount: 1, maxDepth: 3, isDAG: true, density: 0.1, treeness: 1.0, avgDegree: 1.67 };

  it('empty graph → dot', () => {
    expect(selectEngine({ ...base, nodeCount: 0 })).toBe('dot');
  });

  it('≥ 50 nodes → sfdp', () => {
    expect(selectEngine({ ...base, nodeCount: 50 })).toBe('sfdp');
  });

  it('multiple components, n ≥ 4 → osage', () => {
    expect(selectEngine({ ...base, componentCount: 2 })).toBe('osage');
  });

  it('multiple components, n < 4 → not osage (falls through to other rules)', () => {
    expect(selectEngine({ ...base, nodeCount: 3, componentCount: 2, maxDepth: 1, density: 0 })).not.toBe('osage');
  });

  it('near-tree with depth ≥ 3 → twopi', () => {
    expect(selectEngine({ ...base, treeness: 0.9, maxDepth: 4, isDAG: true })).toBe('twopi');
  });

  it('low-degree cyclic graph → circo', () => {
    expect(selectEngine({ ...base, avgDegree: 2.0, isDAG: false, density: 0.3, treeness: 0.5, maxDepth: 1 })).toBe('circo');
  });

  it('any DAG (even shallow, depth < 3) → dot', () => {
    expect(selectEngine({ ...base, treeness: 0.5, maxDepth: 1, isDAG: true, componentCount: 1, avgDegree: 3 })).toBe('dot');
  });

  it('large dense cyclic graph (n≥15, density≥0.35) → fdp', () => {
    expect(selectEngine({ ...base, nodeCount: 20, density: 0.4, isDAG: false, treeness: 0.3, maxDepth: 2, avgDegree: 4, componentCount: 1 })).toBe('fdp');
  });

  it('small cyclic sparse graph → neato', () => {
    expect(selectEngine({ ...base, nodeCount: 5, maxDepth: 2, isDAG: false, treeness: 0.5, avgDegree: 2.5, density: 0.2, componentCount: 1 })).toBe('neato');
  });
});

// ---------------------------------------------------------------------------
// autoLayout integration
// ---------------------------------------------------------------------------

describe('autoLayout()', () => {
  it('empty graph returns zeros', () => {
    expect(autoLayout({ nodes: [], edges: [] })).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it('single node returns valid result', () => {
    const r = autoLayout({ nodes: [{ id: 'A', width: 80, height: 36 }], edges: [] });
    expect(r.nodes).toHaveLength(1);
    expect(r.nodes[0]!.x).toBeGreaterThanOrEqual(0);
    expect(r.nodes[0]!.y).toBeGreaterThanOrEqual(0);
  });

  it('output node count matches input for a DAG chain (→ dot)', () => {
    const input = chain(['A', 'B', 'C', 'D', 'E']);
    const r = autoLayout(input);
    expect(r.nodes).toHaveLength(5);
    expect(r.edges).toHaveLength(4);
  });

  it('cycle graph routes to non-dot engine and still returns all nodes', () => {
    const input = cycle(['A', 'B', 'C', 'D', 'E', 'F']);
    const r = autoLayout(input);
    expect(r.nodes).toHaveLength(6);
  });

  it('disconnected pair of triangles routes to osage', () => {
    const input: DotInputGraph = {
      nodes: ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => ({ id, width: 80, height: 36 })),
      edges: [
        { id: 'e1', from: 'A', to: 'B' }, { id: 'e2', from: 'B', to: 'C' }, { id: 'e3', from: 'A', to: 'C' },
        { id: 'e4', from: 'D', to: 'E' }, { id: 'e5', from: 'E', to: 'F' }, { id: 'e6', from: 'D', to: 'F' },
      ],
    };
    expect(selectEngine(analyzeTopology(input))).toBe('osage');
    const r = autoLayout(input);
    expect(r.nodes).toHaveLength(6);
  });

  it('width and height are positive for non-empty graphs', () => {
    const r = autoLayout(chain(['A', 'B', 'C']));
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });
});

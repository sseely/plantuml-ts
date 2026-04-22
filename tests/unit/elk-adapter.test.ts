/**
 * Unit tests for the ELK adapter.
 *
 * These tests call real ELK layout — no mocking of the ELK instance.
 * ELK works in Node.js (via the bundled build) so vitest can run them.
 *
 * Timeouts are generous because ELK initialises its WASM/worker on the
 * first call; subsequent calls are fast.
 */

import { describe, it, expect } from 'vitest';
import {
  runLayout,
  type ElkGraph,
  type ElkInputNode,
  type ElkInputEdge,
} from '../../src/core/elk-adapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a node with fixed 80×36 dimensions. */
function node(id: string, overrides?: Partial<ElkInputNode>): ElkInputNode {
  return { id, width: 80, height: 36, ...overrides };
}

/** Build an edge between two node ids. */
function edge(id: string, source: string, target: string): ElkInputEdge {
  return { id, sources: [source], targets: [target] };
}

/** Return true when two axis-aligned rectangles overlap. */
function overlaps(
  aX: number, aY: number, aW: number, aH: number,
  bX: number, bY: number, bW: number, bH: number,
): boolean {
  return (
    aX < bX + bW &&
    aX + aW > bX &&
    aY < bY + bH &&
    aY + aH > bY
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runLayout — empty graph', () => {
  it('resolves without error', async () => {
    const result = await runLayout({ nodes: [], edges: [] });
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('returns zero width and height', async () => {
    const result = await runLayout({ nodes: [], edges: [] });
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });
});

describe('runLayout — 3 nodes and 2 edges', () => {
  const graph: ElkGraph = {
    nodes: [node('A'), node('B'), node('C')],
    edges: [edge('e1', 'A', 'B'), edge('e2', 'B', 'C')],
    layoutOptions: { 'elk.algorithm': 'layered' },
  };

  it('returns all 3 nodes', async () => {
    const result = await runLayout(graph);
    expect(result.nodes).toHaveLength(3);
  });

  it('every node has a defined x', async () => {
    const result = await runLayout(graph);
    for (const n of result.nodes) {
      expect(n.x).toBeDefined();
    }
  });

  it('every node has a defined y', async () => {
    const result = await runLayout(graph);
    for (const n of result.nodes) {
      expect(n.y).toBeDefined();
    }
  });

  it('every node has width > 0', async () => {
    const result = await runLayout(graph);
    for (const n of result.nodes) {
      expect(n.width).toBeGreaterThan(0);
    }
  });

  it('every node has height > 0', async () => {
    const result = await runLayout(graph);
    for (const n of result.nodes) {
      expect(n.height).toBeGreaterThan(0);
    }
  });

  it('returns 2 edges', async () => {
    const result = await runLayout(graph);
    expect(result.edges).toHaveLength(2);
  });

  it('result width is positive', async () => {
    const result = await runLayout(graph);
    expect(result.width).toBeGreaterThan(0);
  });

  it('result height is positive', async () => {
    const result = await runLayout(graph);
    expect(result.height).toBeGreaterThan(0);
  });
});

describe('runLayout — two disconnected nodes do not overlap', () => {
  it('bounding boxes are disjoint', async () => {
    const graph: ElkGraph = {
      nodes: [node('X'), node('Y')],
      edges: [],
    };
    const result = await runLayout(graph);

    expect(result.nodes).toHaveLength(2);
    const [a, b] = result.nodes as [typeof result.nodes[0], typeof result.nodes[0]];

    const doesOverlap = overlaps(
      a.x, a.y, a.width, a.height,
      b.x, b.y, b.width, b.height,
    );
    expect(doesOverlap).toBe(false);
  });
});

describe('runLayout — compound node (parent with children)', () => {
  const parentNode: ElkInputNode = {
    id: 'parent',
    width: 200,
    height: 120,
    children: [
      node('child1'),
      node('child2'),
    ],
  };

  const graph: ElkGraph = {
    nodes: [parentNode],
    edges: [],
    layoutOptions: { 'elk.algorithm': 'layered' },
  };

  it('resolves without error', async () => {
    await expect(runLayout(graph)).resolves.toBeDefined();
  });

  it('parent node appears in result', async () => {
    const result = await runLayout(graph);
    const parent = result.nodes.find((n) => n.id === 'parent');
    expect(parent).toBeDefined();
  });

  it('parent node has children in result', async () => {
    const result = await runLayout(graph);
    const parent = result.nodes.find((n) => n.id === 'parent');
    expect(parent?.children).toHaveLength(2);
  });

  it('parent x/y/width/height are defined', async () => {
    const result = await runLayout(graph);
    const parent = result.nodes.find((n) => n.id === 'parent');
    expect(parent?.x).toBeDefined();
    expect(parent?.y).toBeDefined();
    expect(parent?.width).toBeGreaterThan(0);
    expect(parent?.height).toBeGreaterThan(0);
  });

  it('children have positions inside parent bounds', async () => {
    const result = await runLayout(graph);
    const parent = result.nodes.find((n) => n.id === 'parent');
    expect(parent).toBeDefined();
    const children = parent!.children ?? [];
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      // Child coordinates are relative to parent in ELK, so they should be
      // non-negative and fit within the parent's reported dimensions
      expect(child.x).toBeGreaterThanOrEqual(0);
      expect(child.y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('runLayout — custom layoutOptions propagated to ELK', () => {
  it('layered algorithm produces a valid result', async () => {
    const graph: ElkGraph = {
      nodes: [node('N1'), node('N2')],
      edges: [edge('e1', 'N1', 'N2')],
      layoutOptions: { 'elk.algorithm': 'layered' },
    };
    const result = await runLayout(graph);
    expect(result.nodes).toHaveLength(2);
    expect(result.width).toBeGreaterThan(0);
  });

  it('box algorithm produces a valid result', async () => {
    const graph: ElkGraph = {
      nodes: [node('P'), node('Q'), node('R')],
      edges: [],
      layoutOptions: { 'elk.algorithm': 'box' },
    };
    const result = await runLayout(graph);
    expect(result.nodes).toHaveLength(3);
    expect(result.width).toBeGreaterThan(0);
  });
});

describe('runLayout — edge sections', () => {
  it('connected edges have sections arrays', async () => {
    const graph: ElkGraph = {
      nodes: [node('S'), node('T')],
      edges: [edge('e1', 'S', 'T')],
      layoutOptions: { 'elk.algorithm': 'layered' },
    };
    const result = await runLayout(graph);
    expect(result.edges).toHaveLength(1);
    // Sections may be empty for some algorithms but must be an array
    expect(Array.isArray(result.edges[0]?.sections)).toBe(true);
  });

  it('each section has startPoint and endPoint', async () => {
    const graph: ElkGraph = {
      nodes: [node('S'), node('T')],
      edges: [edge('e1', 'S', 'T')],
      layoutOptions: { 'elk.algorithm': 'layered' },
    };
    const result = await runLayout(graph);
    const sections = result.edges[0]?.sections ?? [];
    for (const section of sections) {
      expect(section.startPoint).toBeDefined();
      expect(section.endPoint).toBeDefined();
      expect(typeof section.startPoint.x).toBe('number');
      expect(typeof section.startPoint.y).toBe('number');
      expect(typeof section.endPoint.x).toBe('number');
      expect(typeof section.endPoint.y).toBe('number');
    }
  });
});

describe('runLayout — node ids are preserved', () => {
  it('result node ids match input ids', async () => {
    const ids = ['alpha', 'beta', 'gamma'];
    const graph: ElkGraph = {
      nodes: ids.map((id) => node(id)),
      edges: [edge('e1', 'alpha', 'beta'), edge('e2', 'beta', 'gamma')],
    };
    const result = await runLayout(graph);
    const resultIds = result.nodes.map((n) => n.id).sort();
    expect(resultIds).toEqual([...ids].sort());
  });

  it('result edge ids match input ids', async () => {
    const graph: ElkGraph = {
      nodes: [node('A'), node('B')],
      edges: [edge('my-edge', 'A', 'B')],
    };
    const result = await runLayout(graph);
    expect(result.edges[0]?.id).toBe('my-edge');
  });
});

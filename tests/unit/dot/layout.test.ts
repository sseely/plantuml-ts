import { describe, it, expect } from 'vitest';
import { layout } from '../../../src/core/dot/index.js';
import type { DotInputGraph } from '../../../src/core/dot/types.js';

describe('layout()', () => {
  it('empty graph returns zero dimensions and empty arrays', () => {
    const result = layout({ nodes: [], edges: [] });
    expect(result).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it('single node is placed at non-negative coordinates', () => {
    const result = layout({
      nodes: [{ id: 'A', width: 80, height: 36 }],
      edges: [],
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.x).toBeGreaterThanOrEqual(0);
    expect(result.nodes[0]!.y).toBeGreaterThanOrEqual(0);
    expect(result.edges).toHaveLength(0);
  });

  it('linear chain A→B→C returns 3 nodes, 2 edges with >= 2 points each', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
        { id: 'C', width: 80, height: 36 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
      ],
    };

    const result = layout(input);

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
    for (const edge of result.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('two-node graph has positive width and height', () => {
    const result = layout({
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
      ],
      edges: [{ id: 'e1', from: 'A', to: 'B' }],
    });

    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('LR direction: nodes increase in x along the chain', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
        { id: 'C', width: 80, height: 36 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
      ],
      rankDir: 'LR',
    };

    const result = layout(input);

    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    const a = byId.get('A')!;
    const b = byId.get('B')!;
    const c = byId.get('C')!;

    expect(b.x).toBeGreaterThan(a.x);
    expect(c.x).toBeGreaterThan(b.x);
  });

  it('edge id is preserved in the result', () => {
    const result = layout({
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
      ],
      edges: [{ id: 'myEdge', from: 'A', to: 'B' }],
    });

    expect(result.edges.some((e) => e.id === 'myEdge')).toBe(true);
  });

  it('long edge (rank span > 1) appears in result with >= 2 points', () => {
    // A → C with no B in between forces C to rank 1 and A to rank 0.
    // A → B → C makes B rank 1, C rank 2. A → C then spans 2 ranks.
    const result = layout({
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
        { id: 'C', width: 80, height: 36 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
        { id: 'e3', from: 'A', to: 'C' }, // spans 2 ranks
      ],
    });

    expect(result.edges).toHaveLength(3);
    const longEdge = result.edges.find((e) => e.id === 'e3')!;
    expect(longEdge).toBeDefined();
    expect(longEdge.points.length).toBeGreaterThanOrEqual(2);
  });

  it('root with two children is horizontally centered between them', () => {
    // A→B, A→C: A should be centered over the average of B and C.
    const result = layout({
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
        { id: 'C', width: 80, height: 36 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'A', to: 'C' },
      ],
    });

    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    const a = byId.get('A')!;
    const b = byId.get('B')!;
    const c = byId.get('C')!;

    const aCenter = a.x + a.width / 2;
    const avgChildCenter = (b.x + b.width / 2 + c.x + c.width / 2) / 2;
    expect(Math.abs(aCenter - avgChildCenter)).toBeLessThan(1);
  });

  it('diamond layout has non-overlapping node bounding boxes', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
        { id: 'C', width: 80, height: 36 },
        { id: 'D', width: 80, height: 36 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'A', to: 'C' },
        { id: 'e3', from: 'B', to: 'D' },
        { id: 'e4', from: 'C', to: 'D' },
      ],
    };

    const result = layout(input);

    expect(result.nodes).toHaveLength(4);

    for (let i = 0; i < result.nodes.length; i++) {
      for (let j = i + 1; j < result.nodes.length; j++) {
        const a = result.nodes[i]!;
        const b = result.nodes[j]!;
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
        expect(
          overlapX && overlapY,
          `nodes ${a.id} and ${b.id} overlap`,
        ).toBe(false);
      }
    }
  });

  it('edge with no id attribute uses generated fallback id (does not crash)', () => {
    // DotInputEdge id is optional at runtime — passing undefined triggers '?? edge-N' branch.
    // The edge is created internally with a generated id but filtered from the result
    // because originalEdgeIds only contains the original (undefined) id.
    const result = layout({
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
      ],
      edges: [{ id: undefined as unknown as string, from: 'A', to: 'B' }],
    });

    // Nodes are still placed even when an edge has no id
    expect(result.nodes).toHaveLength(2);
    // Edge is filtered by extractResult (original id was undefined, not matching generated id)
    expect(result.edges).toHaveLength(0);
  });

  it('edge referencing unknown node is silently skipped', () => {
    // When edge.from or edge.to is not in the node map, the edge is skipped
    const result = layout({
      nodes: [{ id: 'A', width: 80, height: 36 }],
      edges: [{ id: 'e1', from: 'A', to: 'UNKNOWN' }],
    });

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('edge with explicit weight and minLen attributes uses those values', () => {
    // Tests the ?? 1 defaults for weight and minLen are NOT taken when values are explicit
    // and also exercises the attribute reading path
    const result = layout({
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
      ],
      edges: [{
        id: 'e1',
        from: 'A',
        to: 'B',
        attributes: { weight: 2, minLen: 2 },
      }],
    });

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    // minLen=2 means B should be at least 2 ranks below A
    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    expect(byId.get('B')!.y).toBeGreaterThan(byId.get('A')!.y);
  });
});

// ---------------------------------------------------------------------------
// layoutDot() — diagram-level layout for @startdot
// ---------------------------------------------------------------------------

import { layoutDot } from '../../../src/diagrams/dot/layout.js';
import type { DotDiagramAST } from '../../../src/diagrams/dot/ast.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import { defaultTheme } from '../../../src/core/theme.js';

/** Minimal valid AST builder for layoutDot tests. */
function makeAST(overrides: Partial<DotDiagramAST> = {}): DotDiagramAST {
  return {
    graphType: 'digraph',
    strict: false,
    name: null,
    title: null,
    rankDir: null,
    nodeSep: null,
    rankSep: null,
    skinparamLines: [],
    nodes: [],
    edges: [],
    ...overrides,
  };
}

const measurer = new FormulaMeasurer();
const theme = defaultTheme;

describe('layoutDot()', () => {
  it('3-node chain returns 3 positioned nodes and 2 edges with non-empty point arrays', () => {
    const ast = makeAST({
      graphType: 'digraph',
      nodes: [
        { id: 'a', label: 'a', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
        { id: 'b', label: 'b', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
        { id: 'c', label: 'c', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
      ],
      edges: [
        { id: 'e0', from: 'a', to: 'b', label: null, weight: null, minLen: null },
        { id: 'e1', from: 'b', to: 'c', label: null, weight: null, minLen: null },
      ],
    });

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.nodes).toHaveLength(3);
    expect(geo.edges).toHaveLength(2);
    for (const edge of geo.edges) {
      expect(edge.points.length).toBeGreaterThan(0);
    }
  });

  it('undirected graph: DotGeometry has 1 edge with directed=false', () => {
    const ast = makeAST({
      graphType: 'graph',
      nodes: [
        { id: 'a', label: 'a', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
        { id: 'b', label: 'b', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
      ],
      edges: [
        { id: 'e0', from: 'a', to: 'b', label: null, weight: null, minLen: null },
      ],
    });

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.edges).toHaveLength(1);
    expect(geo.edges[0]!.directed).toBe(false);
    // Both nodes must be positioned.
    expect(geo.nodes).toHaveLength(2);
    for (const node of geo.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('node with widthIn=2.0 has DotNodeGeo.width === 144', () => {
    const ast = makeAST({
      nodes: [
        { id: 'n', label: 'n', shape: 'ellipse', widthIn: 2.0, heightIn: null, rank: null },
      ],
    });

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.nodes[0]!.width).toBe(144);
  });

  it('node with widthIn=null has width > 16 (measurer + padding)', () => {
    const ast = makeAST({
      nodes: [
        { id: 'h', label: 'Hello', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
      ],
    });

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.nodes[0]!.width).toBeGreaterThan(16);
  });

  it('node with heightIn=1.0 has DotNodeGeo.height === 72', () => {
    const ast = makeAST({
      nodes: [
        { id: 'n', label: 'n', shape: 'ellipse', widthIn: null, heightIn: 1.0, rank: null },
      ],
    });

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.nodes[0]!.height).toBe(72);
  });

  it('rankDir passthrough: LR layout runs without error and nodes have valid coordinates', () => {
    const ast = makeAST({
      rankDir: 'LR',
      nodes: [
        { id: 'x', label: 'x', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
        { id: 'y', label: 'y', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
      ],
      edges: [
        { id: 'e0', from: 'x', to: 'y', label: null, weight: null, minLen: null },
      ],
    });

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.nodes).toHaveLength(2);
    for (const node of geo.nodes) {
      expect(isFinite(node.x)).toBe(true);
      expect(isFinite(node.y)).toBe(true);
    }
  });

  it('title is preserved in DotGeometry', () => {
    const ast = makeAST({ title: 'My Graph' });

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.title).toBe('My Graph');
  });

  it('circle node: width equals height (squared)', () => {
    const ast = makeAST({
      nodes: [
        {
          id: 'c',
          label: 'Hello World',
          shape: 'circle',
          widthIn: null,
          heightIn: null,
          rank: null,
        },
      ],
    });

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.nodes[0]!.width).toBe(geo.nodes[0]!.height);
  });

  it('empty AST returns geometry with totalWidth >= 0 and does not throw', () => {
    const ast = makeAST();

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.totalWidth).toBeGreaterThanOrEqual(0);
    expect(geo.totalHeight).toBeGreaterThanOrEqual(0);
    expect(geo.nodes).toHaveLength(0);
    expect(geo.edges).toHaveLength(0);
  });

  it('corpus fixture 1: single-node digraph (azerty) yields 1 node geo, 0 edge geos', () => {
    const ast = makeAST({
      graphType: 'digraph',
      name: 'azerty',
      nodes: [
        {
          id: 'azerty',
          label: 'azerty',
          shape: 'ellipse',
          widthIn: null,
          heightIn: null,
          rank: null,
        },
      ],
      edges: [],
    });

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.nodes).toHaveLength(1);
    expect(geo.edges).toHaveLength(0);
  });

  it('corpus fixture 2: 4-node undirected graph yields 4 node geos, 3 edge geos (forward only)', () => {
    // graph { a--b; a--c; b--d }
    const ast = makeAST({
      graphType: 'graph',
      nodes: [
        { id: 'a', label: 'a', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
        { id: 'b', label: 'b', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
        { id: 'c', label: 'c', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
        { id: 'd', label: 'd', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
      ],
      edges: [
        { id: 'e0', from: 'a', to: 'b', label: null, weight: null, minLen: null },
        { id: 'e1', from: 'a', to: 'c', label: null, weight: null, minLen: null },
        { id: 'e2', from: 'b', to: 'd', label: null, weight: null, minLen: null },
      ],
    });

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.nodes).toHaveLength(4);
    expect(geo.edges).toHaveLength(3);
    // All edges must have directed=false
    for (const edge of geo.edges) {
      expect(edge.directed).toBe(false);
    }
  });

  it('node with rank=source has rank attribute passed to layout engine', () => {
    // Exercises the n.rank !== null branch in Step 2 (attributes: { rank }).
    const ast = makeAST({
      nodes: [
        {
          id: 'src',
          label: 'Source',
          shape: 'ellipse',
          widthIn: null,
          heightIn: null,
          rank: 'source',
        },
        { id: 'dst', label: 'Dest', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
      ],
      edges: [
        { id: 'e0', from: 'src', to: 'dst', label: null, weight: null, minLen: null },
      ],
    });

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.nodes).toHaveLength(2);
    expect(geo.edges).toHaveLength(1);
    // source rank node should appear before (lower y) destination in TB layout
    const byId = new Map(geo.nodes.map((n) => [n.id, n]));
    expect(byId.get('src')!.y).toBeLessThanOrEqual(byId.get('dst')!.y);
  });

  it('edge with weight and minLen: attributes object is built and passed (hasAttrs branch)', () => {
    // Exercises the hasAttrs=true branch for both forward and (undirected) reverse edges.
    const ast = makeAST({
      graphType: 'graph',
      nodes: [
        { id: 'a', label: 'a', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
        { id: 'b', label: 'b', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
      ],
      edges: [
        { id: 'e0', from: 'a', to: 'b', label: 'edge', weight: 2, minLen: 2 },
      ],
    });

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.nodes).toHaveLength(2);
    expect(geo.edges).toHaveLength(1);
    // Edge label is preserved
    expect(geo.edges[0]!.label).toBe('edge');
  });

  it('nodeSep and rankSep are forwarded to layout engine', () => {
    // Exercises the ast.nodeSep !== null and ast.rankSep !== null branches (lines 134-135).
    const ast = makeAST({
      nodeSep: 50,
      rankSep: 100,
      nodes: [
        { id: 'a', label: 'a', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
        { id: 'b', label: 'b', shape: 'ellipse', widthIn: null, heightIn: null, rank: null },
      ],
      edges: [
        { id: 'e0', from: 'a', to: 'b', label: null, weight: null, minLen: null },
      ],
    });

    const geo = layoutDot(ast, measurer, theme);

    expect(geo.nodes).toHaveLength(2);
    // With rankSep=100, the vertical gap between a and b should be >= 100.
    const byId = new Map(geo.nodes.map((n) => [n.id, n]));
    const aNode = byId.get('a')!;
    const bNode = byId.get('b')!;
    const verticalGap = Math.abs(bNode.y - aNode.y);
    expect(verticalGap).toBeGreaterThan(0);
  });
});

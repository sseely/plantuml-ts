import { describe, expect, it } from 'vitest';
import { layoutActivity } from '../../../../src/diagrams/activity/layout/tile-layout.js';
import { FormulaMeasurer } from '../../../../src/core/measurer.js';
import type { ActivityDiagramAST } from '../../../../src/diagrams/activity/ast.js';
import type { Theme } from '../../../../src/core/theme.js';

const measurer = new FormulaMeasurer();
const theme = { fontSize: 13, fontFamily: 'Arial' } as unknown as Theme;

describe('layoutActivity — empty AST', () => {
  const ast: ActivityDiagramAST = { nodes: [], swimlanes: [] };
  const geo = layoutActivity(ast, theme, measurer);

  it('totalWidth === 0', () => {
    expect(geo.totalWidth).toBe(0);
  });

  it('totalHeight === 0', () => {
    expect(geo.totalHeight).toBe(0);
  });

  it('nodes is empty', () => {
    expect(geo.nodes).toHaveLength(0);
  });

  it('edges is empty', () => {
    expect(geo.edges).toHaveLength(0);
  });

  it('swimlanes is empty', () => {
    expect(geo.swimlanes).toHaveLength(0);
  });
});

describe('layoutActivity — single start node', () => {
  const ast: ActivityDiagramAST = {
    nodes: [{ kind: 'start' }],
    swimlanes: [],
  };
  const geo = layoutActivity(ast, theme, measurer);

  it('produces exactly 1 node', () => {
    expect(geo.nodes).toHaveLength(1);
  });

  it('node kind === start', () => {
    expect(geo.nodes[0]!.kind).toBe('start');
  });

  it('node has positive coordinates', () => {
    expect(geo.nodes[0]!.x).toBeGreaterThan(0);
    expect(geo.nodes[0]!.y).toBeGreaterThan(0);
  });

  it('totalWidth > 0', () => {
    expect(geo.totalWidth).toBeGreaterThan(0);
  });
});

describe('layoutActivity — start → action → stop', () => {
  const ast: ActivityDiagramAST = {
    nodes: [
      { kind: 'start' },
      { kind: 'action', label: 'Hello' },
      { kind: 'stop' },
    ],
    swimlanes: [],
  };
  const geo = layoutActivity(ast, theme, measurer);

  it('produces exactly 3 nodes', () => {
    expect(geo.nodes).toHaveLength(3);
  });

  it('produces exactly 2 edges', () => {
    expect(geo.edges).toHaveLength(2);
  });

  it('nodes have increasing y coordinates', () => {
    const ys = geo.nodes.map(n => n.y);
    expect(ys[1]).toBeGreaterThan(ys[0]!);
    expect(ys[2]).toBeGreaterThan(ys[1]!);
  });

  it('node kinds are start, action, stop', () => {
    expect(geo.nodes[0]!.kind).toBe('start');
    expect(geo.nodes[1]!.kind).toBe('action');
    expect(geo.nodes[2]!.kind).toBe('stop');
  });
});

describe('layoutActivity — if with two branches', () => {
  const ast: ActivityDiagramAST = {
    nodes: [
      {
        kind: 'if',
        condition: 'x > 0?',
        thenBranch: [{ kind: 'action', label: 'positive' }],
        elseBranch: [{ kind: 'action', label: 'negative' }],
        elseIfBranches: [],
      },
    ],
    swimlanes: [],
  };
  const geo = layoutActivity(ast, theme, measurer);

  it('produces at least 3 nodes (diamond + 2 branch actions)', () => {
    expect(geo.nodes.length).toBeGreaterThanOrEqual(3);
  });

  it('produces at least 2 edges', () => {
    expect(geo.edges.length).toBeGreaterThanOrEqual(2);
  });
});

describe('layoutActivity — while loop produces back-edge', () => {
  const ast: ActivityDiagramAST = {
    nodes: [
      {
        kind: 'while',
        condition: 'has items?',
        body: [{ kind: 'action', label: 'process item' }],
      },
    ],
    swimlanes: [],
  };
  const geo = layoutActivity(ast, theme, measurer);

  it('has at least one edge with >= 4 waypoints (back-edge)', () => {
    const backEdge = geo.edges.find(e => e.points.length >= 4);
    expect(backEdge).toBeDefined();
  });
});

describe('layoutActivity — existing renderer tests still work', () => {
  it('fork produces fork-bar and join-bar nodes', () => {
    const ast: ActivityDiagramAST = {
      nodes: [
        {
          kind: 'fork',
          branches: [
            [{ kind: 'action', label: 'branch A' }],
            [{ kind: 'action', label: 'branch B' }],
          ],
        },
      ],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const kinds = geo.nodes.map(n => n.kind);
    expect(kinds).toContain('fork-bar');
    expect(kinds).toContain('join-bar');
  });
});

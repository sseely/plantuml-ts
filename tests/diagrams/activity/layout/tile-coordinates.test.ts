import { describe, expect, it } from 'vitest';
import { assignCoordinates, LAYOUT_MARGIN } from '../../../../src/diagrams/activity/layout/tile-coordinates.js';
import { GtileAction } from '../../../../src/diagrams/activity/tiles/gtile-action.js';
import { GtileTopDown } from '../../../../src/diagrams/activity/tiles/gtile-top-down.js';
import { GtileDiamond } from '../../../../src/diagrams/activity/tiles/gtile-diamond.js';
import { GtileWhile } from '../../../../src/diagrams/activity/tiles/gtile-while.js';
import type { StringBounder } from '../../../../src/diagrams/activity/tiles/tile.js';
import type { ActivityDiagramAST } from '../../../../src/diagrams/activity/ast.js';
import type { Theme } from '../../../../src/core/theme.js';

const bounder: StringBounder = {
  getDimension: (_text: string, _size: number) => ({ width: 60, height: 16 }),
};

const theme = { fontSize: 13, fontFamily: 'Arial' } as unknown as Theme;

const emptyAst: ActivityDiagramAST = { nodes: [], swimlanes: [] };

const actionNode = { kind: 'action' as const, label: 'Hello', swimlane: 'default' };
const NODE_MARGIN_Y = 20;

describe('assignCoordinates — single GtileAction', () => {
  const tile = new GtileAction(actionNode, bounder, theme);
  const geo = assignCoordinates(tile, emptyAst, LAYOUT_MARGIN, LAYOUT_MARGIN, bounder, theme);

  it('produces exactly 1 node geo', () => {
    expect(geo.nodes).toHaveLength(1);
  });

  it('produces no edge geos', () => {
    expect(geo.edges).toHaveLength(0);
  });

  it('node geo kind === action', () => {
    expect(geo.nodes[0]!.kind).toBe('action');
  });

  it('node geo x === LAYOUT_MARGIN', () => {
    expect(geo.nodes[0]!.x).toBe(LAYOUT_MARGIN);
  });

  it('node geo y === LAYOUT_MARGIN', () => {
    expect(geo.nodes[0]!.y).toBe(LAYOUT_MARGIN);
  });

  it('totalWidth >= tile.width + 2 * LAYOUT_MARGIN', () => {
    expect(geo.totalWidth).toBeGreaterThanOrEqual(tile.width + 2 * LAYOUT_MARGIN);
  });

  it('totalHeight >= tile.height + 2 * LAYOUT_MARGIN', () => {
    expect(geo.totalHeight).toBeGreaterThanOrEqual(tile.height + 2 * LAYOUT_MARGIN);
  });

  it('no swimlanes for empty ast', () => {
    expect(geo.swimlanes).toHaveLength(0);
  });
});

describe('assignCoordinates — GtileTopDown with 2 GtileAction children', () => {
  const action0 = new GtileAction(actionNode, bounder, theme);
  const action1 = new GtileAction({ kind: 'action' as const, label: 'World', swimlane: 'default' }, bounder, theme);
  const tile = new GtileTopDown([action0, action1], bounder, theme);
  const geo = assignCoordinates(tile, emptyAst, LAYOUT_MARGIN, LAYOUT_MARGIN, bounder, theme);

  it('produces exactly 2 node geos', () => {
    expect(geo.nodes).toHaveLength(2);
  });

  it('produces exactly 1 edge geo', () => {
    expect(geo.edges).toHaveLength(1);
  });

  it('node[0].y === LAYOUT_MARGIN (first child at top)', () => {
    expect(geo.nodes[0]!.y).toBe(LAYOUT_MARGIN);
  });

  it('node[1].y === LAYOUT_MARGIN + action0.height + NODE_MARGIN_Y', () => {
    expect(geo.nodes[1]!.y).toBe(LAYOUT_MARGIN + action0.height + NODE_MARGIN_Y);
  });

  it('totalWidth >= tile.width + 2 * LAYOUT_MARGIN', () => {
    expect(geo.totalWidth).toBeGreaterThanOrEqual(tile.width + 2 * LAYOUT_MARGIN);
  });

  it('totalHeight >= tile.height + 2 * LAYOUT_MARGIN', () => {
    expect(geo.totalHeight).toBeGreaterThanOrEqual(tile.height + 2 * LAYOUT_MARGIN);
  });
});

describe('assignCoordinates — GtileWhile produces back-edge', () => {
  const header = new GtileDiamond('loop?', bounder, theme);
  const body = new GtileAction(actionNode, bounder, theme);
  const tile = new GtileWhile(header, body, undefined, undefined, bounder, theme);
  const geo = assignCoordinates(tile, emptyAst, LAYOUT_MARGIN, LAYOUT_MARGIN, bounder, theme);

  it('produces at least 2 nodes (diamond + action)', () => {
    expect(geo.nodes.length).toBeGreaterThanOrEqual(2);
  });

  it('produces exactly 2 edges (forward + back)', () => {
    expect(geo.edges).toHaveLength(2);
  });

  it('back-edge has >= 4 waypoints', () => {
    // forward edge has 2 points; back-edge has 4
    const backEdge = geo.edges.find(e => e.points.length >= 4);
    expect(backEdge).toBeDefined();
    expect(backEdge!.points.length).toBeGreaterThanOrEqual(4);
  });
});

describe('assignCoordinates — swimlane geometry', () => {
  const tile = new GtileAction(actionNode, bounder, theme);
  const ast: ActivityDiagramAST = { nodes: [], swimlanes: ['Lane A', 'Lane B'] };
  const geo = assignCoordinates(tile, ast, LAYOUT_MARGIN, LAYOUT_MARGIN, bounder, theme);

  it('emits 2 swimlane geos', () => {
    expect(geo.swimlanes).toHaveLength(2);
  });

  it('first swimlane name is Lane A', () => {
    expect(geo.swimlanes[0]!.name).toBe('Lane A');
  });

  it('second swimlane name is Lane B', () => {
    expect(geo.swimlanes[1]!.name).toBe('Lane B');
  });
});

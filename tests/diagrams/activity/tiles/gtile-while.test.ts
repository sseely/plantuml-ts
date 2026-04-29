import { describe, expect, it } from 'vitest';
import { GtileWhile } from '../../../../src/diagrams/activity/tiles/gtile-while.js';
import {
  EAST_HOOK,
  NORTH_HOOK,
  SOUTH_HOOK,
  WEST_HOOK,
} from '../../../../src/diagrams/activity/tiles/points.js';
import type { StringBounder, Tile } from '../../../../src/diagrams/activity/tiles/tile.js';
import type { Theme } from '../../../../src/core/theme.js';
import type { GPoint, HookName } from '../../../../src/diagrams/activity/tiles/points.js';

const BACK_EDGE_MARGIN = 20;
const NODE_MARGIN_Y = 20;

const bounder: StringBounder = {
  getDimension: (_text: string, _size: number) => ({ width: 0, height: 0 }),
};

const theme = { fontSize: 13, fontFamily: 'Arial' } as unknown as Theme;

function makeTile(width: number, height: number): Tile {
  return {
    kind: 'stub',
    width,
    height,
    getCoord: (): GPoint => ({ x: 0, y: 0 }),
  };
}

// GtileDiamond stub — only width/height matter for GtileWhile geometry
function makeDiamond(width: number, height: number) {
  return {
    kind: 'gtile-diamond' as const,
    label: '',
    width,
    height,
    getCoord: (_hook: HookName): GPoint => ({ x: 0, y: 0 }),
  };
}

describe('GtileWhile — geometry (header h=40, body h=80)', () => {
  const header = makeDiamond(60, 40);
  const body = makeTile(80, 80);
  const tile = new GtileWhile(header, body, undefined, undefined, bounder, theme);

  it('height === header.height + NODE_MARGIN_Y + body.height + NODE_MARGIN_Y', () => {
    expect(tile.height).toBe(40 + NODE_MARGIN_Y + 80 + NODE_MARGIN_Y);
  });

  it('height === 160', () => {
    expect(tile.height).toBe(160);
  });

  it('width === max(header.width, body.width) + BACK_EDGE_MARGIN', () => {
    const expectedContentWidth = Math.max(header.width, body.width);
    expect(tile.width).toBe(expectedContentWidth + BACK_EDGE_MARGIN);
  });

  it('bodyOffsetY === header.height + NODE_MARGIN_Y', () => {
    expect(tile.bodyOffsetY).toBe(40 + NODE_MARGIN_Y);
  });

  it('bodyOffsetY === 60', () => {
    expect(tile.bodyOffsetY).toBe(60);
  });

  it('headerOffsetY === 0', () => {
    expect(tile.headerOffsetY).toBe(0);
  });

  it('backEdgeRightX === width', () => {
    expect(tile.backEdgeRightX).toBe(tile.width);
  });

  it('children contains header and body', () => {
    expect(tile.children).toHaveLength(2);
    expect(tile.children[0]).toBe(header);
    expect(tile.children[1]).toBe(body);
  });
});

describe('GtileWhile — width: body wider than header', () => {
  const header = makeDiamond(40, 40);
  const body = makeTile(100, 80);
  const tile = new GtileWhile(header, body, undefined, undefined, bounder, theme);

  it('width driven by body.width', () => {
    expect(tile.width).toBe(100 + BACK_EDGE_MARGIN);
  });
});

describe('GtileWhile — width: header wider than body', () => {
  const header = makeDiamond(120, 40);
  const body = makeTile(60, 80);
  const tile = new GtileWhile(header, body, undefined, undefined, bounder, theme);

  it('width driven by header.width', () => {
    expect(tile.width).toBe(120 + BACK_EDGE_MARGIN);
  });
});

describe('GtileWhile — hooks', () => {
  const header = makeDiamond(60, 40);
  const body = makeTile(80, 80);
  const tile = new GtileWhile(header, body, undefined, undefined, bounder, theme);
  const cx = (tile.width - BACK_EDGE_MARGIN) / 2;

  it('NORTH_HOOK.y === 0', () => {
    expect(tile.getCoord(NORTH_HOOK).y).toBe(0);
  });

  it('NORTH_HOOK.x === content centre', () => {
    expect(tile.getCoord(NORTH_HOOK).x).toBe(cx);
  });

  it('SOUTH_HOOK.y === height', () => {
    expect(tile.getCoord(SOUTH_HOOK).y).toBe(tile.height);
  });

  it('SOUTH_HOOK.x === content centre', () => {
    expect(tile.getCoord(SOUTH_HOOK).x).toBe(cx);
  });

  it('EAST_HOOK.x === width', () => {
    expect(tile.getCoord(EAST_HOOK).x).toBe(tile.width);
  });

  it('WEST_HOOK.x === 0', () => {
    expect(tile.getCoord(WEST_HOOK).x).toBe(0);
  });
});

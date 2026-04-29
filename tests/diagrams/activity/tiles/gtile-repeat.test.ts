import { describe, expect, it } from 'vitest';
import { GtileRepeat } from '../../../../src/diagrams/activity/tiles/gtile-repeat.js';
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

function makeDiamond(width: number, height: number) {
  return {
    kind: 'gtile-diamond' as const,
    label: '',
    width,
    height,
    getCoord: (_hook: HookName): GPoint => ({ x: 0, y: 0 }),
  };
}

describe('GtileRepeat — no backward body (body h=60, condition h=40)', () => {
  const body = makeTile(80, 60);
  const condition = makeDiamond(60, 40);
  const tile = new GtileRepeat(body, condition, null, bounder, theme);

  it('height === 140', () => {
    // conditionOffsetY = 60+20 = 80; after condition: 80+40 = 120; height = 120+20 = 140
    expect(tile.height).toBe(140);
  });

  it('conditionOffsetY === body.height + NODE_MARGIN_Y', () => {
    expect(tile.conditionOffsetY).toBe(60 + NODE_MARGIN_Y);
  });

  it('conditionOffsetY === 80', () => {
    expect(tile.conditionOffsetY).toBe(80);
  });

  it('bodyOffsetY === 0', () => {
    expect(tile.bodyOffsetY).toBe(0);
  });

  it('backwardOffsetY === null', () => {
    expect(tile.backwardOffsetY).toBeNull();
  });

  it('backEdgeLeftX === 0', () => {
    expect(tile.backEdgeLeftX).toBe(0);
  });

  it('width === max(body.width, condition.width) + BACK_EDGE_MARGIN', () => {
    expect(tile.width).toBe(Math.max(body.width, condition.width) + BACK_EDGE_MARGIN);
  });

  it('children contains body and condition only', () => {
    expect(tile.children).toHaveLength(2);
    expect(tile.children[0]).toBe(body);
    expect(tile.children[1]).toBe(condition);
  });
});

describe('GtileRepeat — with backward body (body h=60, condition h=40, backward h=30)', () => {
  const body = makeTile(80, 60);
  const condition = makeDiamond(60, 40);
  const backward = makeTile(70, 30);
  const tile = new GtileRepeat(body, condition, backward, bounder, theme);

  it('height === 190', () => {
    // conditionOffsetY = 60+20 = 80
    // after condition: 80+40 = 120
    // backwardOffsetY = 120+20 = 140
    // after backward: 140+30 = 170
    // height = 170+20 = 190
    expect(tile.height).toBe(190);
  });

  it('backwardOffsetY is non-null', () => {
    expect(tile.backwardOffsetY).not.toBeNull();
  });

  it('backwardOffsetY === conditionOffsetY + condition.height + NODE_MARGIN_Y', () => {
    const expectedBackward = tile.conditionOffsetY + condition.height + NODE_MARGIN_Y;
    expect(tile.backwardOffsetY).toBe(expectedBackward);
  });

  it('backwardOffsetY === 140', () => {
    expect(tile.backwardOffsetY).toBe(140);
  });

  it('children contains body, condition, and backward', () => {
    expect(tile.children).toHaveLength(3);
    expect(tile.children[0]).toBe(body);
    expect(tile.children[1]).toBe(condition);
    expect(tile.children[2]).toBe(backward);
  });
});

describe('GtileRepeat — width: condition wider than body', () => {
  const body = makeTile(40, 60);
  const condition = makeDiamond(100, 40);
  const tile = new GtileRepeat(body, condition, null, bounder, theme);

  it('width driven by condition.width', () => {
    expect(tile.width).toBe(100 + BACK_EDGE_MARGIN);
  });
});

describe('GtileRepeat — hooks', () => {
  const body = makeTile(80, 60);
  const condition = makeDiamond(60, 40);
  const tile = new GtileRepeat(body, condition, null, bounder, theme);
  const cx = tile.width / 2;

  it('NORTH_HOOK.y === 0', () => {
    expect(tile.getCoord(NORTH_HOOK).y).toBe(0);
  });

  it('NORTH_HOOK.x === width / 2', () => {
    expect(tile.getCoord(NORTH_HOOK).x).toBe(cx);
  });

  it('SOUTH_HOOK.y === height', () => {
    expect(tile.getCoord(SOUTH_HOOK).y).toBe(tile.height);
  });

  it('SOUTH_HOOK.x === width / 2', () => {
    expect(tile.getCoord(SOUTH_HOOK).x).toBe(cx);
  });

  it('EAST_HOOK.x === width', () => {
    expect(tile.getCoord(EAST_HOOK).x).toBe(tile.width);
  });

  it('WEST_HOOK.x === 0', () => {
    expect(tile.getCoord(WEST_HOOK).x).toBe(0);
  });
});

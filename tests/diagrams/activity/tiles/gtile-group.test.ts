import { describe, expect, it } from 'vitest';
import { GtileGroup } from '../../../../src/diagrams/activity/tiles/gtile-group.js';
import {
  EAST_HOOK,
  NORTH_HOOK,
  SOUTH_HOOK,
  WEST_HOOK,
} from '../../../../src/diagrams/activity/tiles/points.js';
import type { StringBounder, Tile } from '../../../../src/diagrams/activity/tiles/tile.js';
import type { Theme } from '../../../../src/core/theme.js';
import type { GPoint } from '../../../../src/diagrams/activity/tiles/points.js';

const NODE_MARGIN_Y = 20;
const H_PAD = 12;

const bounder: StringBounder = {
  getDimension: (text: string, _size: number) => ({
    width: text.length * 7,
    height: 14,
  }),
};

const theme = { fontSize: 13, fontFamily: 'Arial' } as unknown as Theme;

function makeTile(width: number, height: number): Tile {
  return {
    width,
    height,
    getCoord: (): GPoint => ({ x: 0, y: 0 }),
  };
}

describe('GtileGroup — short title, body drives width', () => {
  // title = "Hi" => 2 chars * 7 = 14px wide; body = 100px wide
  // body + 2*H_PAD = 100 + 24 = 124; title + 2*H_PAD = 14 + 24 = 38
  const body = makeTile(100, 50);
  const tile = new GtileGroup('Hi', body, bounder, theme);

  it('width >= body.width + 2 * H_PAD', () => {
    expect(tile.width).toBeGreaterThanOrEqual(100 + 2 * H_PAD);
  });

  it('width === 124 (body-driven)', () => {
    expect(tile.width).toBe(124);
  });

  it('kind === gtile-group', () => {
    expect(tile.kind).toBe('gtile-group');
  });
});

describe('GtileGroup — long title drives width', () => {
  // title = "A very long group title here" => 28 chars * 7 = 196px
  // 196 + 24 = 220 vs body 100 + 24 = 124 → title wins
  const title = 'A very long group title here';
  const body = makeTile(100, 50);
  const tile = new GtileGroup(title, body, bounder, theme);
  const expectedTitleWidth = title.length * 7;

  it('width === titleWidth + 2 * H_PAD when title is wider', () => {
    expect(tile.width).toBe(expectedTitleWidth + 2 * H_PAD);
  });
});

describe('GtileGroup — bodyOffsetY', () => {
  const body = makeTile(100, 50);
  const tile = new GtileGroup('Title', body, bounder, theme);

  it('bodyOffsetY === titleHeight + NODE_MARGIN_Y', () => {
    expect(tile.bodyOffsetY).toBe(tile.titleHeight + NODE_MARGIN_Y);
  });

  it('titleHeight === measured height + 8 (= 14 + 8 = 22)', () => {
    expect(tile.titleHeight).toBe(14 + 8);
  });
});

describe('GtileGroup — total height', () => {
  const body = makeTile(100, 60);
  const tile = new GtileGroup('Grp', body, bounder, theme);

  it('height === bodyOffsetY + body.height + H_PAD', () => {
    expect(tile.height).toBe(tile.bodyOffsetY + body.height + H_PAD);
  });
});

describe('GtileGroup — children', () => {
  const body = makeTile(80, 40);
  const tile = new GtileGroup('G', body, bounder, theme);

  it('children contains only the body tile', () => {
    expect(tile.children).toHaveLength(1);
    expect(tile.children[0]).toBe(body);
  });
});

describe('GtileGroup — hooks', () => {
  const body = makeTile(100, 60);
  const tile = new GtileGroup('Test', body, bounder, theme);

  it('NORTH_HOOK.y === 0', () => {
    expect(tile.getCoord(NORTH_HOOK).y).toBe(0);
  });

  it('SOUTH_HOOK.y === height', () => {
    expect(tile.getCoord(SOUTH_HOOK).y).toBe(tile.height);
  });

  it('EAST_HOOK.x === width', () => {
    expect(tile.getCoord(EAST_HOOK).x).toBe(tile.width);
  });

  it('WEST_HOOK.x === 0', () => {
    expect(tile.getCoord(WEST_HOOK).x).toBe(0);
  });
});

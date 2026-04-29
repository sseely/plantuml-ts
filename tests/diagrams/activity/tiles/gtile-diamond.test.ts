import { describe, expect, it } from 'vitest';
import { GtileDiamond } from '../../../../src/diagrams/activity/tiles/gtile-diamond.js';
import {
  EAST_HOOK,
  NORTH_HOOK,
  SOUTH_HOOK,
  WEST_HOOK,
} from '../../../../src/diagrams/activity/tiles/points.js';
import type { StringBounder } from '../../../../src/diagrams/activity/tiles/tile.js';
import type { Theme } from '../../../../src/core/theme.js';

const DIAMOND_MIN = 20;

const bounder: StringBounder = {
  getDimension: (text: string, _size: number) => ({
    width: text.length * 7,
    height: 14,
  }),
};

const theme = { fontSize: 13, fontFamily: 'Arial' } as unknown as Theme;

describe('GtileDiamond — empty label', () => {
  const tile = new GtileDiamond('', bounder, theme);

  it('width === DIAMOND_MIN * 2', () => {
    expect(tile.width).toBe(DIAMOND_MIN * 2);
  });

  it('height === DIAMOND_MIN * 2', () => {
    expect(tile.height).toBe(DIAMOND_MIN * 2);
  });
});

describe('GtileDiamond — long label', () => {
  // 20 chars * 7 px = 140 px wide; halfW = 70 + 10 = 80 > DIAMOND_MIN(20)
  const tile = new GtileDiamond('A very long condition', bounder, theme);

  it('width > DIAMOND_MIN * 2', () => {
    expect(tile.width).toBeGreaterThan(DIAMOND_MIN * 2);
  });
});

describe('GtileDiamond — hooks', () => {
  const tile = new GtileDiamond('cond', bounder, theme);

  it('NORTH_HOOK → top vertex', () => {
    expect(tile.getCoord(NORTH_HOOK)).toEqual({ x: tile.width / 2, y: 0 });
  });

  it('SOUTH_HOOK → bottom vertex', () => {
    expect(tile.getCoord(SOUTH_HOOK)).toEqual({
      x: tile.width / 2,
      y: tile.height,
    });
  });

  it('EAST_HOOK → right vertex', () => {
    expect(tile.getCoord(EAST_HOOK)).toEqual({
      x: tile.width,
      y: tile.height / 2,
    });
  });

  it('WEST_HOOK → left vertex', () => {
    expect(tile.getCoord(WEST_HOOK)).toEqual({ x: 0, y: tile.height / 2 });
  });
});

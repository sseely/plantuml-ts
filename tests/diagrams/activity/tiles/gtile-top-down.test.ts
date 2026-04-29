import { describe, expect, it } from 'vitest';
import { GtileTopDown } from '../../../../src/diagrams/activity/tiles/gtile-top-down.js';
import {
  NORTH_HOOK,
  SOUTH_HOOK,
} from '../../../../src/diagrams/activity/tiles/points.js';
import type { StringBounder, Tile } from '../../../../src/diagrams/activity/tiles/tile.js';
import type { Theme } from '../../../../src/core/theme.js';

const bounder: StringBounder = {
  getDimension: (_text: string, _size: number) => ({ width: 0, height: 0 }),
};

const theme = { fontSize: 13, fontFamily: 'Arial' } as unknown as Theme;

function stubTile(width: number, height: number): Tile {
  return {
    kind: 'stub',
    width,
    height,
    getCoord: () => ({ x: 0, y: 0 }),
  };
}

describe('GtileTopDown — 0 children', () => {
  const tile = new GtileTopDown([], bounder, theme);

  it('width === 0', () => {
    expect(tile.width).toBe(0);
  });

  it('height === 0', () => {
    expect(tile.height).toBe(0);
  });

  it('childOffsets === []', () => {
    expect(tile.childOffsets).toEqual([]);
  });
});

describe('GtileTopDown — 1 child', () => {
  const child = stubTile(100, 50);
  const tile = new GtileTopDown([child], bounder, theme);

  it('width === 100', () => {
    expect(tile.width).toBe(100);
  });

  it('height === 50', () => {
    expect(tile.height).toBe(50);
  });

  it('childOffsets === [0]', () => {
    expect(tile.childOffsets).toEqual([0]);
  });
});

describe('GtileTopDown — 2 children', () => {
  // child0: w=100, h=50 → offset=0; after: y=70
  // child1: w=80,  h=30 → offset=70; after: y=120
  // height = 120 - 20 = 100
  const child0 = stubTile(100, 50);
  const child1 = stubTile(80, 30);
  const tile = new GtileTopDown([child0, child1], bounder, theme);

  it('width === 100 (max of 100, 80)', () => {
    expect(tile.width).toBe(100);
  });

  it('height === 100', () => {
    expect(tile.height).toBe(100);
  });

  it('childOffsets === [0, 70]', () => {
    expect(tile.childOffsets).toEqual([0, 70]);
  });
});

describe('GtileTopDown — hooks', () => {
  const child = stubTile(100, 50);
  const tile = new GtileTopDown([child], bounder, theme);

  it('NORTH_HOOK.y === 0', () => {
    expect(tile.getCoord(NORTH_HOOK).y).toBe(0);
  });

  it('SOUTH_HOOK.y === height', () => {
    expect(tile.getCoord(SOUTH_HOOK).y).toBe(tile.height);
  });
});

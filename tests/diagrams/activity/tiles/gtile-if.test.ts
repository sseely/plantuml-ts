import { describe, expect, it } from 'vitest';
import { GtileIf } from '../../../../src/diagrams/activity/tiles/gtile-if.js';
import {
  NORTH_HOOK,
  SOUTH_HOOK,
} from '../../../../src/diagrams/activity/tiles/points.js';
import type { StringBounder, Tile } from '../../../../src/diagrams/activity/tiles/tile.js';
import type { GtileDiamond } from '../../../../src/diagrams/activity/tiles/gtile-diamond.js';
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

function stubDiamond(width: number, height: number): GtileDiamond {
  return {
    width,
    height,
    getCoord: () => ({ x: 0, y: 0 }),
  } as unknown as GtileDiamond;
}

const diamond = stubDiamond(60, 40);
const branch0 = stubTile(80, 60);
const branch1 = stubTile(80, 60);
const branches = [
  { tile: branch0 },
  { tile: branch1 },
];

describe('GtileIf — 2 branches, no merge', () => {
  // branchTotalWidth = 80 + 40 + 80 = 200
  // width = max(60, 200) = 200
  // branchOffsetY = 40 + 20 = 60
  // height = 60 + 60 = 120
  const tile = new GtileIf(diamond, branches, null, bounder, theme);

  it('width === 200', () => {
    expect(tile.width).toBe(200);
  });

  it('height === 120', () => {
    expect(tile.height).toBe(120);
  });

  it('branchOffsets[0] === 0', () => {
    expect(tile.branchOffsets[0]).toBe(0);
  });

  it('branchOffsets[1] === 120', () => {
    expect(tile.branchOffsets[1]).toBe(120);
  });

  it('mergeOffsetY is null', () => {
    expect(tile.mergeOffsetY).toBeNull();
  });
});

describe('GtileIf — 2 branches, with merge diamond', () => {
  // mergeOffsetY = 120 + 20 = 140
  // height = 140 + 40 = 180
  const merge = stubDiamond(60, 40);
  const tile = new GtileIf(diamond, branches, merge, bounder, theme);

  it('mergeOffsetY is not null', () => {
    expect(tile.mergeOffsetY).not.toBeNull();
  });

  it('mergeOffsetY === 140', () => {
    expect(tile.mergeOffsetY).toBe(140);
  });

  it('height === 180 (larger than no-merge case)', () => {
    expect(tile.height).toBe(180);
  });
});

describe('GtileIf — hooks', () => {
  const tile = new GtileIf(diamond, branches, null, bounder, theme);

  it('NORTH_HOOK.y === 0', () => {
    expect(tile.getCoord(NORTH_HOOK).y).toBe(0);
  });

  it('SOUTH_HOOK.y === height', () => {
    expect(tile.getCoord(SOUTH_HOOK).y).toBe(tile.height);
  });
});

import { describe, expect, it } from 'vitest';
import { GtileFork } from '../../../../src/diagrams/activity/tiles/gtile-fork.js';
import {
  NORTH_HOOK,
  SOUTH_HOOK,
} from '../../../../src/diagrams/activity/tiles/points.js';
import type { StringBounder, Tile } from '../../../../src/diagrams/activity/tiles/tile.js';

// Constants mirroring the implementation
const NODE_MARGIN_X = 40;
const NODE_MARGIN_Y = 20;
const BAR_HEIGHT = 8;
const BAR_OVERHANG = 10;

const bounder: StringBounder = {
  getDimension: (_text: string, _size: number) => ({ width: 0, height: 0 }),
};

function stubTile(w: number, h: number): Tile {
  return {
    kind: 'stub',
    width: w,
    height: h,
    getCoord: () => ({ x: 0, y: 0 }),
  };
}

describe('GtileFork — geometry with 2 branches (w=80 each, h=60 and h=80)', () => {
  const b1 = stubTile(80, 60);
  const b2 = stubTile(80, 80);
  const tile = new GtileFork([b1, b2], bounder);

  it('width = 80 + 40 + 80 + 2*10 = 220', () => {
    // branchTotalWidth = 80 + 40 + 80 = 200; + 2 * BAR_OVERHANG(10) = 220
    expect(tile.width).toBe(220);
  });

  it('height = BAR_HEIGHT + NODE_MARGIN_Y + maxBranchH + NODE_MARGIN_Y + BAR_HEIGHT = 136', () => {
    // 8 + 20 + 80 + 20 + 8 = 136
    expect(tile.height).toBe(136);
  });

  it('barWidth === width', () => {
    expect(tile.barWidth).toBe(tile.width);
  });

  it('branchTopY = BAR_HEIGHT + NODE_MARGIN_Y = 28', () => {
    expect(tile.branchTopY).toBe(BAR_HEIGHT + NODE_MARGIN_Y);
  });

  it('branchOffsets[0] = BAR_OVERHANG = 10', () => {
    expect(tile.branchOffsets[0]).toBe(BAR_OVERHANG);
  });

  it('branchOffsets[1] = BAR_OVERHANG + 80 + NODE_MARGIN_X = 130', () => {
    expect(tile.branchOffsets[1]).toBe(BAR_OVERHANG + 80 + NODE_MARGIN_X);
  });

  it('NORTH_HOOK → y = 0', () => {
    expect(tile.getCoord(NORTH_HOOK).y).toBe(0);
  });

  it('SOUTH_HOOK → y = height', () => {
    expect(tile.getCoord(SOUTH_HOOK).y).toBe(tile.height);
  });

  it('NORTH_HOOK → x = width / 2', () => {
    expect(tile.getCoord(NORTH_HOOK).x).toBe(tile.width / 2);
  });

  it('SOUTH_HOOK → x = width / 2', () => {
    expect(tile.getCoord(SOUTH_HOOK).x).toBe(tile.width / 2);
  });

  it('children contains both branches', () => {
    expect(tile.children).toHaveLength(2);
    expect(tile.children[0]).toBe(b1);
    expect(tile.children[1]).toBe(b2);
  });

  it('kind === "gtile-fork"', () => {
    expect(tile.kind).toBe('gtile-fork');
  });
});

describe('GtileFork — single branch', () => {
  const b = stubTile(60, 50);
  const tile = new GtileFork([b], bounder);

  it('width = 60 + 2*10 = 80', () => {
    expect(tile.width).toBe(80);
  });

  it('height = 8 + 20 + 50 + 20 + 8 = 106', () => {
    expect(tile.height).toBe(106);
  });

  it('branchOffsets[0] = 10', () => {
    expect(tile.branchOffsets[0]).toBe(BAR_OVERHANG);
  });
});

describe('GtileFork — zero branches (empty fork)', () => {
  const tile = new GtileFork([], bounder);

  it('width = 0 + 2*10 = 20', () => {
    expect(tile.width).toBe(2 * BAR_OVERHANG);
  });

  it('height = BAR_HEIGHT + NODE_MARGIN_Y + 0 + NODE_MARGIN_Y + BAR_HEIGHT = 56', () => {
    // 8 + 20 + 0 + 20 + 8 = 56
    expect(tile.height).toBe(56);
  });

  it('branchOffsets is empty', () => {
    expect(tile.branchOffsets).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import { GtileSwitch } from '../../../../src/diagrams/activity/tiles/gtile-switch.js';
import {
  EAST_HOOK,
  NORTH_HOOK,
  SOUTH_HOOK,
  WEST_HOOK,
} from '../../../../src/diagrams/activity/tiles/points.js';
import type { StringBounder, Tile } from '../../../../src/diagrams/activity/tiles/tile.js';
import type { Theme } from '../../../../src/core/theme.js';
import type { GPoint, HookName } from '../../../../src/diagrams/activity/tiles/points.js';

const NODE_MARGIN_Y = 20;
const NODE_MARGIN_X = 40;

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

// GtileDiamond stub — only width/height matter for GtileSwitch geometry
function makeDiamond(width: number, height: number) {
  return {
    kind: 'gtile-diamond' as const,
    label: '',
    width,
    height,
    getCoord: (_hook: HookName): GPoint => ({ x: 0, y: 0 }),
  };
}

describe('GtileSwitch — 2 cases, no merge diamond', () => {
  const diamond = makeDiamond(60, 40);
  const case0 = makeTile(80, 100);
  const case1 = makeTile(80, 60);
  const tile = new GtileSwitch(
    diamond,
    [{ tile: case0 }, { tile: case1 }],
    null,
    bounder,
    theme,
  );

  it('width === case0.width + NODE_MARGIN_X + case1.width', () => {
    expect(tile.width).toBe(80 + NODE_MARGIN_X + 80);
  });

  it('width === 200', () => {
    expect(tile.width).toBe(200);
  });

  it('caseOffsets[0] === 0', () => {
    expect(tile.caseOffsets[0]).toBe(0);
  });

  it('caseOffsets[1] === 80 + NODE_MARGIN_X === 120', () => {
    expect(tile.caseOffsets[1]).toBe(80 + NODE_MARGIN_X);
  });

  it('caseOffsetY === diamond.height + NODE_MARGIN_Y', () => {
    expect(tile.caseOffsetY).toBe(40 + NODE_MARGIN_Y);
  });

  it('mergeOffsetY is null', () => {
    expect(tile.mergeOffsetY).toBeNull();
  });

  it('height === caseOffsetY + max(case heights)', () => {
    const maxH = Math.max(case0.height, case1.height);
    expect(tile.height).toBe(tile.caseOffsetY + maxH);
  });

  it('children has diamond and 2 case tiles', () => {
    expect(tile.children).toHaveLength(3);
    expect(tile.children[0]).toBe(diamond);
    expect(tile.children[1]).toBe(case0);
    expect(tile.children[2]).toBe(case1);
  });
});

describe('GtileSwitch — 2 cases with merge diamond', () => {
  const diamond = makeDiamond(60, 40);
  const case0 = makeTile(80, 100);
  const case1 = makeTile(80, 60);
  const merge = makeDiamond(60, 40);
  const tile = new GtileSwitch(
    diamond,
    [{ tile: case0 }, { tile: case1 }],
    merge,
    bounder,
    theme,
  );

  it('mergeOffsetY is non-null', () => {
    expect(tile.mergeOffsetY).not.toBeNull();
  });

  it('mergeOffsetY === caseOffsetY + maxCaseH + NODE_MARGIN_Y', () => {
    const maxH = Math.max(case0.height, case1.height);
    const baseH = tile.caseOffsetY + maxH;
    expect(tile.mergeOffsetY).toBe(baseH + NODE_MARGIN_Y);
  });

  it('height > no-merge height', () => {
    const noMergeHeight = tile.caseOffsetY + Math.max(case0.height, case1.height);
    expect(tile.height).toBeGreaterThan(noMergeHeight);
  });

  it('height === mergeOffsetY + merge.height', () => {
    expect(tile.height).toBe((tile.mergeOffsetY ?? 0) + merge.height);
  });

  it('children includes merge diamond', () => {
    expect(tile.children).toHaveLength(4);
    expect(tile.children[3]).toBe(merge);
  });
});

describe('GtileSwitch — hooks', () => {
  const diamond = makeDiamond(60, 40);
  const case0 = makeTile(80, 100);
  const case1 = makeTile(80, 60);
  const tile = new GtileSwitch(
    diamond,
    [{ tile: case0 }, { tile: case1 }],
    null,
    bounder,
    theme,
  );

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

describe('GtileSwitch — diamond wider than cases', () => {
  const diamond = makeDiamond(300, 40);
  const case0 = makeTile(80, 60);
  const tile = new GtileSwitch(
    diamond,
    [{ tile: case0 }],
    null,
    bounder,
    theme,
  );

  it('width driven by diamond.width when wider than cases', () => {
    expect(tile.width).toBe(300);
  });
});

import { describe, expect, it } from 'vitest';
import { GtilePartition } from '../../../../src/diagrams/activity/tiles/gtile-partition.js';
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

describe('GtilePartition — kind', () => {
  const body = makeTile(100, 50);
  const tile = new GtilePartition('Partition A', body, bounder, theme);

  it('kind === gtile-partition', () => {
    expect(tile.kind).toBe('gtile-partition');
  });
});

describe('GtilePartition — same geometry as GtileGroup', () => {
  const body = makeTile(100, 50);
  const tile = new GtilePartition('Hi', body, bounder, theme);

  it('width >= body.width + 2 * H_PAD', () => {
    expect(tile.width).toBeGreaterThanOrEqual(100 + 2 * H_PAD);
  });

  it('bodyOffsetY === titleHeight + NODE_MARGIN_Y', () => {
    expect(tile.bodyOffsetY).toBe(tile.titleHeight + NODE_MARGIN_Y);
  });

  it('height === bodyOffsetY + body.height + H_PAD', () => {
    expect(tile.height).toBe(tile.bodyOffsetY + body.height + H_PAD);
  });

  it('children contains only the body tile', () => {
    expect(tile.children).toHaveLength(1);
    expect(tile.children[0]).toBe(body);
  });
});

describe('GtilePartition — long title drives width', () => {
  const title = 'A very long partition title here';
  const body = makeTile(100, 50);
  const tile = new GtilePartition(title, body, bounder, theme);
  const expectedTitleWidth = title.length * 7;

  it('width === titleWidth + 2 * H_PAD when title is wider', () => {
    expect(tile.width).toBe(expectedTitleWidth + 2 * H_PAD);
  });
});

describe('GtilePartition — hooks', () => {
  const body = makeTile(100, 60);
  const tile = new GtilePartition('Zone', body, bounder, theme);

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

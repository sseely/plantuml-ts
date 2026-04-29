import { describe, expect, it } from 'vitest';
import { GtileLabel } from '../../../../src/diagrams/activity/tiles/gtile-label.js';
import { GtileSpot } from '../../../../src/diagrams/activity/tiles/gtile-spot.js';
import type { StringBounder } from '../../../../src/diagrams/activity/tiles/tile.js';
import type { Theme } from '../../../../src/core/theme.js';

const bounder: StringBounder = {
  getDimension: (text: string, _size: number) => ({
    width: text.length * 7,
    height: 14,
  }),
};

const theme = { fontSize: 13, fontFamily: 'Arial' } as unknown as Theme;

describe('GtileSpot — no name', () => {
  const tile = new GtileSpot({ kind: 'spot', name: '' }, bounder, theme);

  it('width === 16 (RADIUS * 2)', () => {
    expect(tile.width).toBe(16);
  });

  it('height === 16 (RADIUS * 2)', () => {
    expect(tile.height).toBe(16);
  });
});

describe('GtileSpot — long name', () => {
  // name has 10 chars; measured.width = 70; 70 + 8 = 78 > 16
  const node = { kind: 'spot' as const, name: 'mySpotXYZ', color: '#FF0000' };
  const tile = new GtileSpot(node, bounder, theme);

  it('width > 16 when name is long', () => {
    expect(tile.width).toBeGreaterThan(16);
  });

  it('tile.name matches input', () => {
    expect(tile.name).toBe('mySpotXYZ');
  });

  it('tile.color matches input', () => {
    expect(tile.color).toBe('#FF0000');
  });
});

describe('GtileLabel', () => {
  const node = { kind: 'label' as const, name: 'myLabel' };
  const tile = new GtileLabel(node, bounder, theme);
  // measured.width = 7 * 7 = 49; height = 14
  const expectedWidth = 7 * 7 + 16; // 65

  it('width >= measured.width + 16', () => {
    expect(tile.width).toBeGreaterThanOrEqual(expectedWidth);
  });

  it('width === measured.width + 16', () => {
    expect(tile.width).toBe(expectedWidth);
  });

  it('height === measured.height + 8', () => {
    expect(tile.height).toBe(14 + 8);
  });

  it('tile.name matches input', () => {
    expect(tile.name).toBe('myLabel');
  });
});

import { describe, it, expect } from 'vitest';
import {
  TileLeaf,
  TileComposite,
  NORTH_HOOK,
  SOUTH_HOOK,
  EAST_HOOK,
  WEST_HOOK,
  gpoint,
} from '../../../../src/diagrams/activity/tiles/index.js';
import type { GPoint, HookName, StringBounder, Tile } from '../../../../src/diagrams/activity/tiles/index.js';

// ---------------------------------------------------------------------------
// Concrete TileLeaf subclass for testing
// ---------------------------------------------------------------------------

class FixedLeaf extends TileLeaf {
  override readonly width = 100;
  override readonly height = 50;

  override getCoord(hook: HookName): GPoint {
    switch (hook) {
      case NORTH_HOOK:   return gpoint(this.width / 2, 0);
      case SOUTH_HOOK:   return gpoint(this.width / 2, this.height);
      case EAST_HOOK:    return gpoint(this.width, this.height / 2);
      case WEST_HOOK:    return gpoint(0, this.height / 2);
      default:           return gpoint(this.width / 2, this.height / 2);
    }
  }
}

// ---------------------------------------------------------------------------
// Concrete TileComposite subclass for testing
// ---------------------------------------------------------------------------

class SimpleTwoChildComposite extends TileComposite {
  override readonly children: readonly Tile[];

  constructor(a: Tile, b: Tile) {
    super();
    this.children = [a, b];
  }

  override get width(): number {
    return Math.max(...this.children.map(c => c.width));
  }

  override get height(): number {
    return this.children.reduce((sum, c) => sum + c.height, 0);
  }

  override getCoord(hook: HookName): GPoint {
    switch (hook) {
      case NORTH_HOOK: return gpoint(this.width / 2, 0);
      case SOUTH_HOOK: return gpoint(this.width / 2, this.height);
      default:         return gpoint(this.width / 2, this.height / 2);
    }
  }
}

// ---------------------------------------------------------------------------
// TileLeaf tests
// ---------------------------------------------------------------------------

describe('TileLeaf — FixedLeaf (100×50)', () => {
  const leaf = new FixedLeaf();

  it('NORTH_HOOK returns { x: 50, y: 0 }', () => {
    expect(leaf.getCoord(NORTH_HOOK)).toEqual({ x: 50, y: 0 });
  });

  it('SOUTH_HOOK returns { x: 50, y: 50 }', () => {
    expect(leaf.getCoord(SOUTH_HOOK)).toEqual({ x: 50, y: 50 });
  });

  it('EAST_HOOK returns { x: 100, y: 25 }', () => {
    expect(leaf.getCoord(EAST_HOOK)).toEqual({ x: 100, y: 25 });
  });

  it('WEST_HOOK returns { x: 0, y: 25 }', () => {
    expect(leaf.getCoord(WEST_HOOK)).toEqual({ x: 0, y: 25 });
  });

  it('exposes width and height', () => {
    expect(leaf.width).toBe(100);
    expect(leaf.height).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// TileComposite tests
// ---------------------------------------------------------------------------

describe('TileComposite — SimpleTwoChildComposite', () => {
  const leafA = new FixedLeaf();                            // 100×50
  const leafB = new FixedLeaf();                            // 100×50
  const composite = new SimpleTwoChildComposite(leafA, leafB);

  it('exposes children array containing both tiles', () => {
    expect(composite.children).toHaveLength(2);
    expect(composite.children[0]).toBe(leafA);
    expect(composite.children[1]).toBe(leafB);
  });

  it('width is max of child widths', () => {
    expect(composite.width).toBe(100);
  });

  it('height is sum of child heights', () => {
    expect(composite.height).toBe(100);
  });

  it('NORTH_HOOK returns top-centre of composite', () => {
    expect(composite.getCoord(NORTH_HOOK)).toEqual({ x: 50, y: 0 });
  });

  it('SOUTH_HOOK returns bottom-centre of composite', () => {
    expect(composite.getCoord(SOUTH_HOOK)).toEqual({ x: 50, y: 100 });
  });
});

// ---------------------------------------------------------------------------
// StringBounder structural compatibility test
// ---------------------------------------------------------------------------

describe('StringBounder interface', () => {
  it('is structurally satisfied by a simple stub', () => {
    // A plain object literal is a valid StringBounder if it has getDimension.
    const stub: StringBounder = {
      getDimension: (text: string, size: number) => ({
        width: text.length * 7,
        height: size,
      }),
    };

    expect(stub.getDimension('hello', 12)).toEqual({ width: 35, height: 12 });
    expect(stub.getDimension('', 10)).toEqual({ width: 0, height: 10 });
  });
});

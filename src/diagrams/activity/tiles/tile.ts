import type { GPoint, HookName } from './points.js';

// NOTE: StringBounder here uses getDimension(text, fontSizePt) for
// simplicity. This differs from src/core/measurer.ts StringMeasurer,
// which uses measure(text, FontSpec) where FontSpec carries family,
// size, weight, and style. If you need to bridge to FormulaMeasurer /
// CanvasMeasurer, wrap it: getDimension(t, sz) => measurer.measure(t,
// { family: 'sans-serif', size: sz }).
export interface StringBounder {
  getDimension(text: string, fontSizePt: number): { width: number; height: number };
}

export interface Tile {
  readonly kind: string;
  readonly width: number;
  readonly height: number;
  getCoord(hook: HookName): GPoint;
}

export abstract class TileLeaf implements Tile {
  abstract readonly kind: string;
  abstract readonly width: number;
  abstract readonly height: number;
  abstract getCoord(hook: HookName): GPoint;
}

export abstract class TileComposite implements Tile {
  abstract readonly kind: string;
  abstract readonly width: number;
  abstract readonly height: number;
  abstract getCoord(hook: HookName): GPoint;
  abstract readonly children: readonly Tile[];
}

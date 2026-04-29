/**
 * Base tile abstractions for the activity diagram tile layout system.
 */

import type { GPoint, HookName } from './points.js';

export interface StringBounder {
  getDimension(text: string, fontSizePt: number): { width: number; height: number };
}

export abstract class TileLeaf {
  abstract readonly kind: string;
  abstract readonly width: number;
  abstract readonly height: number;
  abstract getCoord(hook: HookName): GPoint;
}

import type { GPoint, HookName } from './points.js';
import {
  EAST_HOOK,
  NORTH_BORDER,
  NORTH_HOOK,
  SOUTH_BORDER,
  SOUTH_HOOK,
  WEST_HOOK,
} from './points.js';
import type { StringBounder } from './tile.js';
import { TileLeaf } from './tile.js';
import type { Theme } from '../../../core/theme.js';

const DIAMOND_MIN = 20;
const DIAMOND_LABEL_PAD = 10;

export class GtileDiamond extends TileLeaf {
  readonly kind = 'gtile-diamond' as const;
  readonly label: string;
  readonly width: number;
  readonly height: number;

  constructor(label: string, bounder: StringBounder, theme: Theme) {
    super();
    this.label = label;
    const measured = bounder.getDimension(label, theme.fontSize - 2);
    const halfW = Math.max(measured.width / 2 + DIAMOND_LABEL_PAD, DIAMOND_MIN);
    const halfH = Math.max(measured.height / 2 + 4, DIAMOND_MIN);
    this.width = halfW * 2;
    this.height = halfH * 2;
  }

  getCoord(hook: HookName): GPoint {
    switch (hook) {
      case NORTH_HOOK:
      case NORTH_BORDER:
        return { x: this.width / 2, y: 0 };
      case SOUTH_HOOK:
      case SOUTH_BORDER:
        return { x: this.width / 2, y: this.height };
      case EAST_HOOK:
        return { x: this.width, y: this.height / 2 };
      case WEST_HOOK:
        return { x: 0, y: this.height / 2 };
      /* c8 ignore next 3 */
      default: {
        const _exhaustive: never = hook;
        throw new Error(`Unknown hook: ${String(_exhaustive)}`);
      }
    }
  }
}

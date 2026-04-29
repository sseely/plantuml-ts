import type { GPoint, HookName } from './points.js';
import {
  EAST_HOOK,
  NORTH_BORDER,
  NORTH_HOOK,
  SOUTH_BORDER,
  SOUTH_HOOK,
  WEST_HOOK,
} from './points.js';
import type { StringBounder, Tile } from './tile.js';
import { TileComposite } from './tile.js';
import type { GtileDiamond } from './gtile-diamond.js';
import type { Theme } from '../../../core/theme.js';

const NODE_MARGIN_Y = 20;
const NODE_MARGIN_X = 40;

export class GtileSwitch extends TileComposite {
  readonly kind = 'gtile-switch' as const;
  readonly width: number;
  readonly height: number;
  readonly children: readonly Tile[];
  readonly caseOffsets: readonly number[];
  readonly diamondOffsetY = 0;
  readonly caseOffsetY: number;
  readonly mergeOffsetY: number | null;

  constructor(
    diamond: GtileDiamond,
    cases: Array<{ tile: Tile; label?: string }>,
    mergeDiamond: GtileDiamond | null,
    _bounder: StringBounder,
    _theme: Theme,
  ) {
    super();
    const caseTiles = cases.map(c => c.tile);
    const xOffsets: number[] = [];
    let x = 0;
    for (const c of caseTiles) {
      xOffsets.push(x);
      x += c.width + NODE_MARGIN_X;
    }
    this.caseOffsets = xOffsets;
    const caseTotalWidth = x - (caseTiles.length > 0 ? NODE_MARGIN_X : 0);
    this.width = Math.max(diamond.width, caseTotalWidth);
    const maxCaseH = Math.max(0, ...caseTiles.map(c => c.height));
    this.caseOffsetY = diamond.height + NODE_MARGIN_Y;
    const baseH = this.caseOffsetY + maxCaseH;
    if (mergeDiamond !== null) {
      this.mergeOffsetY = baseH + NODE_MARGIN_Y;
      this.height = this.mergeOffsetY + mergeDiamond.height;
    } else {
      this.mergeOffsetY = null;
      this.height = baseH;
    }
    this.children = mergeDiamond !== null
      ? [diamond, ...caseTiles, mergeDiamond]
      : [diamond, ...caseTiles];
  }

  getCoord(hook: HookName): GPoint {
    const cx = this.width / 2;
    switch (hook) {
      case NORTH_HOOK:
      case NORTH_BORDER:
        return { x: cx, y: 0 };
      case SOUTH_HOOK:
      case SOUTH_BORDER:
        return { x: cx, y: this.height };
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

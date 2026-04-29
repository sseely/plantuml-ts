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

export class GtileIf extends TileComposite {
  readonly kind = 'gtile-if' as const;
  readonly width: number;
  readonly height: number;
  readonly children: readonly Tile[];
  readonly branchOffsets: readonly number[];
  readonly diamondOffsetY = 0;
  readonly branchOffsetY: number;
  readonly mergeOffsetY: number | null;

  constructor(
    diamond: GtileDiamond,
    branches: Array<{ tile: Tile; label?: string }>,
    mergeDiamond: GtileDiamond | null,
    _bounder: StringBounder,
    _theme: Theme,
  ) {
    super();
    const branchTiles = branches.map(b => b.tile);

    const xOffsets: number[] = [];
    let x = 0;
    for (const b of branchTiles) {
      xOffsets.push(x);
      x += b.width + NODE_MARGIN_X;
    }
    this.branchOffsets = xOffsets;

    const branchTotalWidth =
      x - (branchTiles.length > 0 ? NODE_MARGIN_X : 0);

    this.width = Math.max(diamond.width, branchTotalWidth);

    const maxBranchH = Math.max(0, ...branchTiles.map(b => b.height));
    this.branchOffsetY = diamond.height + NODE_MARGIN_Y;
    const baseHeight = this.branchOffsetY + maxBranchH;

    if (mergeDiamond !== null) {
      this.mergeOffsetY = baseHeight + NODE_MARGIN_Y;
      this.height = this.mergeOffsetY + mergeDiamond.height;
    } else {
      this.mergeOffsetY = null;
      this.height = baseHeight;
    }

    this.children = mergeDiamond !== null
      ? [diamond, ...branchTiles, mergeDiamond]
      : [diamond, ...branchTiles];
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

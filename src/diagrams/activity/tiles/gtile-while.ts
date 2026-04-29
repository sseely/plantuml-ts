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
const BACK_EDGE_MARGIN = 20;

export class GtileWhile extends TileComposite {
  readonly kind = 'gtile-while' as const;
  readonly width: number;
  readonly height: number;
  readonly children: readonly Tile[];
  readonly headerOffsetY = 0;
  readonly bodyOffsetY: number;
  readonly backEdgeRightX: number;

  constructor(
    header: GtileDiamond,
    body: Tile,
    _exitLabel: string | undefined,
    _backLabel: string | undefined,
    _bounder: StringBounder,
    _theme: Theme,
  ) {
    super();
    this.bodyOffsetY = header.height + NODE_MARGIN_Y;
    const contentWidth = Math.max(header.width, body.width);
    this.width = contentWidth + BACK_EDGE_MARGIN;
    this.height = this.bodyOffsetY + body.height + NODE_MARGIN_Y;
    this.backEdgeRightX = this.width;
    this.children = [header, body];
  }

  getCoord(hook: HookName): GPoint {
    const cx = (this.width - BACK_EDGE_MARGIN) / 2;
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

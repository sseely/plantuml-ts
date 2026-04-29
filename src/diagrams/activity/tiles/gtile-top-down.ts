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
import type { Theme } from '../../../core/theme.js';

const NODE_MARGIN_Y = 20;

export class GtileTopDown extends TileComposite {
  readonly kind = 'gtile-top-down' as const;
  readonly width: number;
  readonly height: number;
  readonly children: readonly Tile[];
  readonly childOffsets: readonly number[];

  constructor(children: Tile[], _bounder: StringBounder, _theme: Theme) {
    super();
    this.children = children;
    if (children.length === 0) {
      this.width = 0;
      this.height = 0;
      this.childOffsets = [];
      return;
    }
    this.width = Math.max(...children.map(c => c.width));
    const offsets: number[] = [];
    let y = 0;
    for (const child of children) {
      offsets.push(y);
      y += child.height + NODE_MARGIN_Y;
    }
    this.childOffsets = offsets;
    this.height = y - NODE_MARGIN_Y;
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

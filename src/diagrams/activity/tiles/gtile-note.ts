import type { GPoint, HookName } from './points.js';
import {
  EAST_HOOK,
  NORTH_BORDER,
  NORTH_HOOK,
  SOUTH_BORDER,
  SOUTH_HOOK,
  WEST_HOOK,
} from './points.js';
import { TileLeaf } from './tile.js';
import type { StringBounder } from './tile.js';
import type { ActivityNote } from '../ast.js';
import type { Theme } from '../../../core/theme.js';

const NOTE_FOLD = 8;
const ACTION_H_PAD = 16;

export class GtileNote extends TileLeaf {
  readonly kind = 'gtile-note' as const;
  readonly width: number;
  readonly height: number;
  readonly text: string;
  readonly side: 'left' | 'right';

  constructor(node: ActivityNote, bounder: StringBounder, theme: Theme) {
    super();
    this.text = node.text;
    this.side = node.position;
    const measured = bounder.getDimension(node.text, theme.fontSize - 2);
    this.width = measured.width + 2 * ACTION_H_PAD + NOTE_FOLD;
    this.height = measured.height + NOTE_FOLD + 16;
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
      default: {
        const _exhaustive: never = hook;
        /* c8 ignore next */
        throw new Error(`Unknown hook: ${String(_exhaustive)}`);
      }
    }
  }
}

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
import type { ActivityAction } from '../ast.js';
import type { Theme } from '../../../core/theme.js';

const ACTION_HEIGHT = 36;
const ACTION_H_PAD = 16;
const V_PAD = 8;
const MIN_WIDTH = 120;

export class GtileAction extends TileLeaf {
  readonly kind = 'gtile-action' as const;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly color: string | undefined;

  constructor(node: ActivityAction, bounder: StringBounder, theme: Theme) {
    super();
    this.label = node.label;
    this.color = node.color;
    const lines = node.label.split('\n');
    const lineCount = lines.length;
    const maxWidth = Math.max(
      ...lines.map(l => bounder.getDimension(l, theme.fontSize).width),
    );
    const lineHeight =
      bounder.getDimension('M', theme.fontSize).height * 1.4;
    this.width = Math.max(maxWidth + 2 * ACTION_H_PAD, MIN_WIDTH);
    this.height = Math.max(lineHeight * lineCount + 2 * V_PAD, ACTION_HEIGHT);
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

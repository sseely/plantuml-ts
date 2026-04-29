import { TileLeaf } from './tile.js';
import {
  NORTH_HOOK,
  SOUTH_HOOK,
  EAST_HOOK,
  WEST_HOOK,
  type GPoint,
  type HookName,
} from './points.js';
import type { StringBounder } from './tile.js';
import type { ActivityAction } from '../ast.js';
import type { Theme } from '../../../core/theme.js';

// Suppress unused-import warnings: constants are used at call sites in tests
// and sibling modules; the imports here keep the import graph explicit.
void NORTH_HOOK; void SOUTH_HOOK; void EAST_HOOK; void WEST_HOOK;

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
      case 'NORTH':
      case 'NORTH_BORDER':
        return { x: this.width / 2, y: 0 };
      case 'SOUTH':
      case 'SOUTH_BORDER':
        return { x: this.width / 2, y: this.height };
      case 'EAST':
        return { x: this.width, y: this.height / 2 };
      case 'WEST':
        return { x: 0, y: this.height / 2 };
    }
  }
}

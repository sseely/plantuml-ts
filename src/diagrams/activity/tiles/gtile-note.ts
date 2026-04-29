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
import type { ActivityNote } from '../ast.js';
import type { Theme } from '../../../core/theme.js';

// Suppress unused-import warnings: constants are exported for use at call sites.
void NORTH_HOOK; void SOUTH_HOOK; void EAST_HOOK; void WEST_HOOK;

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

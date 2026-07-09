import type { UForeground } from './UForeground.js';
import type { Paint } from '../paint.js';

/**
 * Fore — the sole `UForeground` implementor, wrapping a paint value.
 * Paired with `Back` (see `Back.ts` / `UForeground.ts` for why this
 * wrapper exists at all — it has no upstream name to inherit).
 */
export class Fore implements UForeground {
  private readonly paint: Paint;

  constructor(paint: Paint) {
    this.paint = paint;
  }

  getColor(): Paint {
    return this.paint;
  }
}

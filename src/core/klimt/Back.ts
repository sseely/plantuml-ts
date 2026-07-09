import type { UBackground } from './UBackground.js';
import type { Paint } from '../paint.js';

/**
 * Back — the sole `UBackground` implementor, wrapping a paint value.
 * Upstream builds one via `HColor#bg()` (`color.bg()`); this port's
 * equivalent entry point is `new Back(paint)` directly, since `HColor`
 * is not ported (see `UBackground.ts` seam note).
 *
 * Upstream: klimt/color/HColor.java, package-private nested class
 * `Back implements UBackground` (upstream's real, documented name for
 * this role — not invented for this port).
 */
export class Back implements UBackground {
  private readonly paint: Paint;

  constructor(paint: Paint) {
    this.paint = paint;
  }

  getBackColor(): Paint {
    return this.paint;
  }
}

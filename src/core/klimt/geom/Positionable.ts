import type { Moveable } from './Moveable.js';
import type { XDimension2D } from './XDimension2D.js';
import type { XPoint2D } from './XPoint2D.js';

/**
 * Positionable — a fixed-size, movable, positioned rectangle:
 * `getSize()`/`getPosition()` plus (via `Moveable`) `moveDelta`.
 * `TextBlockUtils.asPositionable` wraps a `TextBlock` or bare
 * `XDimension2D` as one of these at a given anchor point.
 *
 * Upstream: klimt/geom/Positionable.java — `extends Moveable`, adds
 * `getSize()`/`getPosition()`. Ported in full (two methods plus the
 * inherited `moveDelta`).
 */
export interface Positionable extends Moveable {
  getSize(): XDimension2D;
  getPosition(): XPoint2D;
}

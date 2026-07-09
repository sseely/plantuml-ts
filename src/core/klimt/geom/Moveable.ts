/**
 * Moveable — anything that can be shifted by a relative (dx, dy) delta,
 * in place. `Positionable` extends this to add a fixed size/position pair.
 *
 * Upstream: klimt/geom/Moveable.java — a single-method interface.
 * Ported in full (one method).
 */
export interface Moveable {
  moveDelta(deltaX: number, deltaY: number): void;
}

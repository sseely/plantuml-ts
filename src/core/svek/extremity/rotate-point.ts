import type { Point2D } from '../../klimt/UTranslate.js';

/**
 * rotatePoint — the point transform upstream performs via
 * `XPoint2D#transform(XAffineTransform.getRotateInstance(theta))`
 * (klimt/geom/XAffineTransform.java#getRotateInstance): `x' = x*cos
 * (theta) - y*sin(theta)`, `y' = x*sin(theta) + y*cos(theta)`.
 *
 * Shared by every `svek/extremity/*` class in this directory that
 * upstream builds by constructing a shape at the local origin, then
 * calling `UPolygon#rotate(theta)` (klimt/shape/UPolygon.java) or
 * `XPoint2D#transform(...)` per point, then translating to the real
 * contact point. Neither `UPolygon.rotate()` nor `UPath.rotate()` is
 * ported in this codebase's klimt layer (see `UPolygon.ts`/`UPath.ts`
 * deferred-members notes — both require the unported `XAffineTransform`
 * class), so every extremity class here computes each already-rotated
 * point via this helper and builds its `UPolygon`/`UPath` from the final
 * coordinates directly, rather than calling a `.rotate()` mutator.
 * Mathematically identical to upstream's build-then-rotate-then-
 * translate sequence — just applied per-point instead of via a shared
 * shape mutator that does not exist on this port's shapes.
 *
 * NOT used by `ExtremityExtendsLike.ts`: that class's private static
 * `Point.rotate` upstream uses a DIFFERENT sign convention (`st =
 * -sin(theta)`, giving `y' = x*sin(theta) - y*cos(theta)` — see that
 * file's own doc comment) and is ported as its own local helper to
 * preserve upstream's exact (non-standard) formula bug-for-bug.
 */
export function rotatePoint(pt: Point2D, theta: number): Point2D {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return { x: pt.x * cos - pt.y * sin, y: pt.x * sin + pt.y * cos };
}

/** `rotatePoint` plus a translation — the common "rotate at origin, then
 *  place at the real contact point" composite every extremity performs. */
export function rotateAndTranslate(pt: Point2D, theta: number, origin: Point2D): Point2D {
  const r = rotatePoint(pt, theta);
  return { x: r.x + origin.x, y: r.y + origin.y };
}

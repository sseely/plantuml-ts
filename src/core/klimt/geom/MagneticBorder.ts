import type { UTranslate } from '../UTranslate.js';

/**
 * MagneticBorder — the "pull toward me" force a `TextBlock`'s border
 * exerts on a point near it (used by `USymbolFolder#asSmall`/`asBig` to
 * snap a link endpoint onto the folder's title-tab notch instead of the
 * plain rectangle edge).
 *
 * Upstream: klimt/geom/MagneticBorder.java — a single-method functional
 * interface, `getForceAt(StringBounder, XPoint2D): UTranslate`.
 *
 * Scope adaptation: the `StringBounder` param is dropped here — no
 * concrete `MagneticBorder` implementation in this port's current
 * write-set (T3) needs to re-measure text to compute its force (see
 * `MagneticBorderNone.ts`); a later task porting a border that does need
 * it (e.g. `USymbolFolder`'s anonymous implementation) can widen this
 * signature without breaking `MagneticBorderNone` or `TextBlock`'s
 * optional `getMagneticBorder()`.
 */
export interface MagneticBorder {
  getForceAt(position: { readonly x: number; readonly y: number }): UTranslate;
}

import type { UTranslate } from '../UTranslate.js';
import type { StringBounder } from '../font/StringBounder.js';

/**
 * MagneticBorder — the "pull toward me" force a `TextBlock`'s border
 * exerts on a point near it (used by `USymbolFolder#asSmall`/`asBig` to
 * snap a link endpoint onto the folder's title-tab notch instead of the
 * plain rectangle edge).
 *
 * Upstream: klimt/geom/MagneticBorder.java — a single-method functional
 * interface, `getForceAt(StringBounder, XPoint2D): UTranslate`.
 *
 * Widening (T3b, pre-approved by this file's own original doc comment —
 * "a later task porting a border that does need [`StringBounder`] can
 * widen this signature without breaking `MagneticBorderNone`"): the
 * `stringBounder` param is restored as an OPTIONAL trailing param.
 * `MagneticBorderNone` (T3) ignores it, unchanged; a future `MagneticBorder`
 * implementation that needs to re-measure text to compute its force
 * (e.g. `USymbolFolder`'s anonymous implementation, upstream) can now
 * read it without a second signature widening.
 */
export interface MagneticBorder {
  getForceAt(position: { readonly x: number; readonly y: number }, stringBounder?: StringBounder): UTranslate;
}

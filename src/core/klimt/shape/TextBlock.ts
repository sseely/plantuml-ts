import type { UShape } from '../UShape.js';
import type { UDrawable } from './UDrawable.js';
import type { XDimension2D } from '../geom/XDimension2D.js';
import type { StringBounder } from '../font/StringBounder.js';
import type { MagneticBorder } from '../geom/MagneticBorder.js';
import { MagneticBorderNone } from '../geom/MagneticBorderNone.js';

/**
 * TextBlock — a self-sizing, self-drawing rectangle of content. Every
 * `USymbol#asSmall`/`asBig` (decoration/symbol/USymbol.java) both takes
 * TextBlocks (name/label/stereotype) as input and returns one; this is
 * the seam type shared across the whole `USymbol*` family and
 * `EntityImageDescription` (svek/image/EntityImageDescription.java),
 * which calls `asSmall.drawU(ug)`, `asSmall.calculateDimension
 * (stringBounder)`, and — only when the symbol's shapeType is FOLDER —
 * `asSmall.getMagneticBorder()`.
 *
 * Upstream: klimt/shape/TextBlock.java — `interface TextBlock extends
 * UDrawable, UShape` with one abstract member (`calculateDimension`) and
 * four `default` members: `getMinMax` (throws
 * `UnsupportedOperationException` by default), `getInnerPosition`
 * (throws by default), `getMagneticBorder` (defaults to
 * `MagneticBorderNone`), `getBackcolor` (defaults to `null`).
 *
 * Scope reduction (T3 mission brief — "minimal TextBlock seam ... port
 * ONLY the minimal interface the symbols and EntityImageDescription
 * actually exercise"): `drawU` (via `UDrawable`) and `calculateDimension`
 * are REQUIRED members. `getMagneticBorder` IS exercised by
 * `EntityImageDescription#getMagneticBorder` (guarded on `shapeType ===
 * FOLDER`) and by `USymbolFolder`'s override (T5–T9), so it is ported —
 * OPTIONAL here (see below for why) with a default resolved by the
 * `textBlockMagneticBorder` helper. `getMinMax`/`getInnerPosition`/
 * `getBackcolor` have NO caller anywhere in `USymbol`, `SymbolContext`,
 * `USymbolRectangle`/`USymbolFolder`/`USymbolSimpleAbstract` (the
 * concrete subclasses read for base-sufficiency, D10), or
 * `EntityImageDescription` — dropped; add them, with their upstream
 * default bodies, the day a ported class needs to override one.
 *
 * TS-idiom deviation (reported): TS interfaces cannot carry a default
 * method BODY the way a Java 8+ `default` method can. Upstream's
 * `getMagneticBorder()` default (`return new MagneticBorderNone();`) is
 * represented here as an OPTIONAL member (`getMagneticBorder?()`) plus
 * the free function `textBlockMagneticBorder(tb)` below, which every
 * caller (in place of `tb.getMagneticBorder()`) must use instead of
 * calling the method directly — this reproduces the *default value*
 * semantics without TS interface default-method support.
 */
export interface TextBlock extends UDrawable, UShape {
  calculateDimension(stringBounder: StringBounder): XDimension2D;
  getMagneticBorder?(): MagneticBorder;
}

/**
 * Resolves `tb.getMagneticBorder()` with upstream's default
 * (`MagneticBorderNone`) applied when `tb` does not override it — the
 * call-site replacement for TS's lack of interface default methods (see
 * the module doc comment above). Callers mirroring
 * `EntityImageDescription#getMagneticBorder` should use this instead of
 * `tb.getMagneticBorder?.()` directly.
 */
export function textBlockMagneticBorder(tb: TextBlock): MagneticBorder {
  return tb.getMagneticBorder?.() ?? new MagneticBorderNone();
}

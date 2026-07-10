import type { MagneticBorder } from './MagneticBorder.js';
import { UTranslate } from '../UTranslate.js';

/**
 * MagneticBorderNone — the no-op `MagneticBorder`: exerts no force,
 * always returning `UTranslate.none()`. This is `TextBlock`'s default
 * `getMagneticBorder()` return value (see `TextBlock.ts`'s
 * `textBlockMagneticBorder` helper) for any `TextBlock` that does not
 * override it — matching every `USymbol` concrete subclass except
 * `USymbolFolder` (see `USymbolFolder.java`'s `getMagneticBorder`
 * override, ported in a later T5–T9 task).
 *
 * Upstream: klimt/geom/MagneticBorderNone.java. Ported in full (one
 * method, trivially small).
 */
export class MagneticBorderNone implements MagneticBorder {
  getForceAt(_position: { readonly x: number; readonly y: number }): UTranslate {
    return UTranslate.none();
  }
}

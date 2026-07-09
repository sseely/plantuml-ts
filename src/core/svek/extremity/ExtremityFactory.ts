import type { Point2D } from '../../klimt/UTranslate.js';
import type { Extremity } from './Extremity.js';
import type { Side } from './Side.js';

/**
 * ExtremityFactory — upstream: svek/extremity/ExtremityFactory.java.
 *
 * Ported: `createUDrawable(p0, angle, side)` only — the one factory
 * method `SvekEdge#getExtremitySimplier` calls (the `LinkStrategy
 * .SIMPLEST` path, which `Link.getLinkStrategy()` always selects — see
 * `Extremity.ts`'s doc comment). NOT ported: `createTBRDrawableLegacy
 * (p0, p1, p2, side)` — only reachable via `SvekEdge#getExtremity`/
 * `getExtremitySpecial`, both dead under `LinkStrategy.SIMPLEST`.
 *
 * Return-type tightening (reported): upstream's interface method
 * returns `UDrawable`, and `SvekEdge#getExtremitySimplier` immediately
 * casts the result to `Extremity` to read `getDecorationLength()`
 * (every real `ExtremityFactory*` implementation upstream — and every
 * one this port implements in this directory — always constructs and
 * returns an `Extremity` subclass). This port's interface returns
 * `Extremity` directly instead of `UDrawable` + a call-site cast, since
 * every implementation in this codebase satisfies it structurally and
 * it removes a needless runtime `instanceof` check in `SvekEdge.ts`.
 */
export interface ExtremityFactory {
  createUDrawable(p0: Point2D, angle: number, side: Side | null): Extremity;
}

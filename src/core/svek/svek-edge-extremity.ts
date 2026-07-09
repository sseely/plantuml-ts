import type { Point2D } from '../klimt/UTranslate.js';
import type { Paint } from '../paint.js';
import type { Extremity } from './extremity/Extremity.js';
import { buildExtremityFactory, isFillDecor, lookupDecors1, lookupDecors2 } from './extremity/link-decor.js';
import type { LinkDecorName } from './extremity/link-decor.js';

/**
 * svek-edge-extremity.ts — `SvekEdge#getExtremitySimplier`
 * (`LinkStrategy.SIMPLEST` — the only reachable strategy, see
 * `SvekEdge.ts`'s doc comment). Split out of `SvekEdge.ts` to keep that
 * file under this project's 500-line cap (reported split).
 *
 * Ported: the extremity-factory lookup + construction
 * (`extremityFactory.createUDrawable(center, angle, side)`, `side`
 * always `null` — see `ExtremityCrowfoot.ts`'s cut-line note) and the
 * dotPath-trim delta math (`new UTranslate(decorationLength, 0).rotate
 * (angle - Math.PI)`, ported as direct `cos`/`sin` since this port's
 * `UTranslate` has no `.rotate()` — see `rotate-point.ts`'s module doc
 * comment for the same deferral pattern).
 *
 * NOT ported: the `kal`/`translateForKal` parameter (see
 * `Extremity.ts`'s doc comment — Kal is not part of this port; every
 * call site behaves as `kal == null`, i.e. `translateForKal =
 * UTranslate.none()`, which is why it does not appear as a parameter
 * here at all rather than as an always-identity one) and the
 * `nodeContact`-driven `side` (`Side | null`, always `null` — see
 * `ExtremityCrowfoot.ts`'s doc comment).
 */
export interface PlacedExtremity {
  readonly drawable: Extremity;
  readonly isFill: boolean;
  readonly trim: Point2D;
}

function decorTrim(angle: number, decorationLength: number): Point2D {
  const theta = angle - Math.PI;
  return { x: decorationLength * Math.cos(theta), y: decorationLength * Math.sin(theta) };
}

function place(name: LinkDecorName, point: Point2D, angle: number, backgroundColor: Paint): PlacedExtremity {
  const factory = buildExtremityFactory(name, backgroundColor);
  const drawable = factory.createUDrawable(point, angle, null);
  return { drawable, isFill: isFillDecor(name), trim: decorTrim(angle, drawable.getDecorationLength()) };
}

/** Tail-side (near `points[0]` / `from`) — upstream's `head1`,
 *  resolved via `LinkDecor.lookupDecors1`. */
export function placeTailExtremity(
  token: string | undefined,
  point: Point2D,
  angle: number,
  backgroundColor: Paint,
): PlacedExtremity | undefined {
  const name = lookupDecors1(token);
  return name === undefined ? undefined : place(name, point, angle, backgroundColor);
}

/** Head-side (near the last point / `to`) — upstream's `head2`,
 *  resolved via `LinkDecor.lookupDecors2`. */
export function placeHeadExtremity(
  token: string | undefined,
  point: Point2D,
  angle: number,
  backgroundColor: Paint,
): PlacedExtremity | undefined {
  const name = lookupDecors2(token);
  return name === undefined ? undefined : place(name, point, angle, backgroundColor);
}

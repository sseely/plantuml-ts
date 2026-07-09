import type { UStroke } from './UStroke.js';
import type { UTranslate } from './UTranslate.js';
import type { Paint } from '../paint.js';

/**
 * UParam — the drawing state visible to a driver at the moment it draws
 * a shape: the current stroke, foreground ("color") and background
 * ("backcolor") paints, and the composed translate. `UGraphic#draw`
 * dispatches `(shape, param)` to the registered driver; drivers read
 * ALL state through `UParam` — there is no side channel (T2 interface
 * contract).
 *
 * Upstream: klimt/UParam.java — `getColor(): HColor`,
 * `getBackcolor(): HColor`, `getStroke(): UStroke`, `isHidden():
 * boolean`, `getPattern(): UPattern`.
 *
 * Scope reduction (T2 mission brief, explicit): `isHidden()` and
 * `getPattern()` are NOT ported — `UHidden.ts`/`UPattern.ts` are not in
 * this task's write-set, so no `UChange` can carry hidden/pattern state
 * to dispatch on in the first place (see `AbstractCommonUGraphic.ts`).
 * Re-add both together with their `UChange` types in a later task.
 *
 * Scope addition (T2 mission brief, explicit): `getTranslate()` is
 * promoted onto `UParam` even though upstream keeps translate on
 * `AbstractCommonUGraphic`/`UGraphic` only. T2's `UGraphic` interface
 * drops `getStringBounder`/`getColorMapper`/etc., so `UParam` is the
 * only channel a driver has into graphic state — translate has to ride
 * along with it.
 *
 * Adaptation seam (pre-decided): `getColor()`/`getBackcolor()` return
 * `Paint` (`src/core/paint.ts`) instead of upstream's `HColor`.
 */
export interface UParam {
  getStroke(): UStroke;
  getColor(): Paint;
  getBackcolor(): Paint;
  getTranslate(): UTranslate;
}

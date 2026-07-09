import type { UChange } from './UChange.js';
import type { UShape } from './UShape.js';
import type { UParam } from './UParam.js';
import type { UTranslate } from './UTranslate.js';

/**
 * UGraphic — the immutable drawing context renderers draw through.
 * `apply(change)` returns a NEW `UGraphic` with one piece of state
 * changed (translate, stroke, color, ...); the receiver is untouched.
 * `draw(shape)` dispatches `shape` to the driver registered for its
 * concrete class, passing the CURRENT `UParam` state.
 *
 * Upstream: klimt/drawing/UGraphic.java — `getStringBounder()`,
 * `getParam()`, `draw(SHAPE)`, `apply(UChange)`, `getColorMapper()`,
 * `startUrl`/`closeUrl`, `startGroup`/`closeGroup`, `flushUg()`,
 * `matchesProperty(String)`, `getDefaultBackground()`,
 * `writeToStream(...)`.
 *
 * Scope reduction (T2 mission brief, explicit — this task ports only
 * "apply, draw, getParam() (+ translate accessors as
 * AbstractCommonUGraphic exposes)"): every other upstream member above
 * depends on machinery this task does not port (`StringBounder`,
 * `ColorMapper`, `Url`, `UGroup`, stream output). `getTranslate()` is
 * added — it is upstream's own public accessor on
 * `AbstractCommonUGraphic`, just promoted onto the interface here so
 * T3+ can reach it without a concrete-type cast.
 */
export interface UGraphic {
  apply(change: UChange): UGraphic;
  draw(shape: UShape): void;
  getParam(): UParam;
  getTranslate(): UTranslate;
}

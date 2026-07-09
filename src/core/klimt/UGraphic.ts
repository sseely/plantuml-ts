import type { UChange } from './UChange.js';
import type { UShape } from './UShape.js';
import type { UParam } from './UParam.js';
import type { UTranslate } from './UTranslate.js';
import type { StringBounder } from './font/StringBounder.js';

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
 * depends on machinery this task does not port (`ColorMapper`, `Url`,
 * `UGroup`, stream output). `getTranslate()` is
 * added — it is upstream's own public accessor on
 * `AbstractCommonUGraphic`, just promoted onto the interface here so
 * T3+ can reach it without a concrete-type cast.
 *
 * `getStringBounder()` (write-set expansion, T6 — reported): every
 * `USymbol*#asSmall`/`asBig` anonymous `TextBlock#drawU(UGraphic ug)`
 * body opens with `final StringBounder stringBounder =
 * ug.getStringBounder();` before recomputing its own dimension (e.g.
 * `USymbolComponent1.java:84`) — T2 explicitly deferred this method
 * ("dropped constructor dependency", `AbstractCommonUGraphic.ts`'s own
 * doc comment) as future work for "whichever later task first needs
 * it" (see `HorizontalAlignment.ts`'s doc comment, which named this
 * exact gap). This task (`USymbolComponent1/2/Node/Artifact/File/
 * Frame`) is that task: every one of its six `drawU` bodies needs this
 * call for a faithful port (it is NOT test-only scaffolding — a real
 * caller's `drawU` must independently re-measure via whatever
 * `StringBounder` the CURRENT `ug` carries, since `drawU` and
 * `calculateDimension` are independent `TextBlock` entry points with
 * no guarantee the same bounder was used for both). Added here as a
 * pure addition (no existing member's signature changed); see
 * `AbstractCommonUGraphic.ts`'s and `u-graphic-svg.ts`'s own doc
 * comments for how the two concrete backends satisfy it without
 * breaking `tests/unit/core/klimt/model.test.ts`'s pre-existing
 * `TestUGraphic`.
 */
export interface UGraphic {
  apply(change: UChange): UGraphic;
  draw(shape: UShape): void;
  getParam(): UParam;
  getTranslate(): UTranslate;
  getStringBounder(): StringBounder;
}

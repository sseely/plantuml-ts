import type { UChange } from '../UChange.js';
import type { UShape } from '../UShape.js';
import type { UGraphic } from '../UGraphic.js';
import { UTranslate } from '../UTranslate.js';
import { UGraphicDelegator } from './UGraphicDelegator.js';
import { UHorizontalLine } from '../shape/UHorizontalLine.js';

/**
 * AbstractUGraphicHorizontalLine — a `UGraphicDelegator` that intercepts
 * `draw(shape)` for `UHorizontalLine` shapes only (`drawHline`, left
 * abstract for a subclass to implement its own clip/curve logic —
 * `UGraphicStencil` is the base seam; `USymbolDatabase`/`Queue`/`Node`'s
 * `MyUGraphicXxx` inner classes are the per-symbol curved-cap variants).
 * Every other shape passes straight through to the wrapped `ug`.
 *
 * Upstream: klimt/drawing/AbstractUGraphicHorizontalLine.java. Ported:
 * `copy` (abstract), `drawHline` (abstract), the constructor, `draw`.
 *
 * `apply` scope reduction (reported): upstream's `apply` has three
 * branches — `UTranslate` (compose into the running `translate` field),
 * `UClip` (translate the clip, delegate, then restore `translate`), and
 * an `else` (delegate, restore `translate`). No `UClip.ts` exists
 * anywhere in this port (`AbstractCommonUGraphic.ts`'s own doc comment:
 * "no `UClip` change is simply a change this port cannot yet
 * construct") — the `UClip` branch is therefore unreachable dead code
 * for every `UChange` this port's type system can produce. Dropped; the
 * `else` branch already covers everything `UClip` would have (delegate,
 * keep the same `translate`), so behavior for every constructible
 * `UChange` is identical to upstream.
 *
 * `getTranslate()` override (bug fix, diagnosed during this task's own
 * conformance run — mechanism: `UGraphicDelegator.getTranslate()`
 * delegates to `this.getUg().getTranslate()`, the WRAPPED backend's own
 * translate as of the last NON-translate `apply()`. But `apply(UTranslate)`
 * on THIS class deliberately does not forward the change down to
 * `getUg()` at all — it accumulates it in the private `translate` field
 * instead, replayed only at actual `draw()` time via
 * `getUg().apply(this.translate).draw(shape)`. Any caller that reads
 * `ug.getTranslate()` directly — e.g. a recording/test `TextBlock#drawU`,
 * or any code computing an absolute position without going through
 * `draw()` — saw a STALE value missing every `UTranslate` applied since
 * the wrap began, which every `USymbol*#asSmall` realigned in this same
 * task now does (`ug.apply(new UTranslate(margin...))` around a
 * `UGraphicStencil`-wrapped `ug`). Root cause confirmed by tracing
 * `symbols-box.test.ts`'s failing `label.translate()` assertions back to
 * this exact seam — not upstream's own `AbstractUGraphicHorizontalLine`
 * (which has no `getTranslate()` at all: `getTranslate()` is itself a
 * T2 port-specific addition to `UGraphic`, so this exact composition
 * gap has no upstream analog to compare against). Fixed at the origin:
 * `getTranslate()` now returns the wrapped `ug`'s own translate composed
 * with this layer's own accumulated delta, matching what `draw()`
 * already computes for real shapes.
 */
export abstract class AbstractUGraphicHorizontalLine extends UGraphicDelegator {
  private translate: UTranslate = UTranslate.none();

  protected constructor(ug: UGraphic) {
    super(ug);
  }

  protected abstract copy(ug: UGraphic): AbstractUGraphicHorizontalLine;

  protected abstract drawHline(ug: UGraphic, line: UHorizontalLine, translate: UTranslate): void;

  apply(change: UChange): UGraphic {
    const result = this.copy(this.getUg());
    if (change instanceof UTranslate) {
      result.translate = this.translate.compose(change);
      return result;
    }
    const applied = this.getUg().apply(change);
    const withApplied = this.copy(applied);
    withApplied.translate = this.translate;
    return withApplied;
  }

  draw(shape: UShape): void {
    if (shape instanceof UHorizontalLine) {
      this.drawHline(this.getUg(), shape, UTranslate.dy(this.translate.getDy()));
      return;
    }
    this.getUg().apply(this.translate).draw(shape);
  }

  getTranslate(): UTranslate {
    return this.getUg().getTranslate().compose(this.translate);
  }
}

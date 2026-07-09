import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import type { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { URectangle } from '../../klimt/shape/URectangle.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { TextBlockUtils } from '../../klimt/shape/TextBlockUtils.js';
import { UGraphicStencil } from '../../klimt/drawing/UGraphicStencil.js';
import { USymbolComponent2 } from './USymbolComponent2.js';

/**
 * Upstream: `USymbolComponent1#getMargin()`. Module-scope (TS-mechanics
 * note, applies to every `getMargin`/`drawXxx` helper across this
 * task's six files): none of these helpers read any per-instance
 * field, so hoisting them out of the class avoids the `this`-capturing
 * arrow-closure indirection an object-literal-returning method would
 * otherwise need (a `TextBlock`'s `drawU`/`calculateDimension` are
 * plain function properties, not bound to the enclosing class
 * instance) — a plain function is simpler and avoids that indirection
 * entirely. Behavior is unchanged; only where the code physically
 * lives moved.
 */
function getMargin(): Margin {
  return new Margin(10, 10, 10, 10);
}

function drawComponent1(ug: UGraphic, widthTotal: number, heightTotal: number, shadowing: number, roundCorner: number): void {
  const form = URectangle.build(widthTotal, heightTotal).rounded(roundCorner);
  form.setDeltaShadow(shadowing);
  ug.draw(form);

  const small = URectangle.build(10, 5);

  // UML 1 Component Notation
  ug.apply(new UTranslate(-5, 5)).draw(small);
  ug.apply(new UTranslate(-5, heightTotal - 10)).draw(small);
}

/**
 * USymbolComponent1 — the legacy "UML 1" component notation: a
 * rounded-corner box with two small tab rectangles overlapping its
 * left edge.
 *
 * Upstream: decoration/symbol/USymbolComponent1.java (112 ln).
 * Reachable via `skinparam componentStyle uml1`.
 *
 * `UGraphicStencil` seam (T3b realignment): upstream wraps `ug` in
 * `UGraphicStencil.create(ug, dimTotal)` before drawing — restored
 * below now that `UGraphicStencil` is ported (T3b). Output-neutral for
 * this task's conformance suite: neither `stereotype` nor `label` here
 * ever draws a `UHorizontalLine`, the only shape `UGraphicStencil`
 * intercepts.
 */
export class USymbolComponent1 extends USymbol {
  getSNames(): readonly SName[] {
    return ['component'];
  }

  asSmall(
    _name: TextBlock,
    label: TextBlock,
    stereotype: TextBlock,
    symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    function calculateDimension(stringBounder: StringBounder): XDimension2D {
      const dimLabel = label.calculateDimension(stringBounder);
      const dimStereo = stereotype.calculateDimension(stringBounder);
      return getMargin().addDimension(dimStereo.mergeTB(dimLabel));
    }

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const stringBounder = ug.getStringBounder();
        const dimTotal = calculateDimension(stringBounder);
        ug = UGraphicStencil.create(ug, dimTotal);
        ug = symbolContext.apply(ug);
        drawComponent1(ug, dimTotal.getWidth(), dimTotal.getHeight(), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
        const margin = getMargin();
        const tb = TextBlockUtils.mergeTB(stereotype, label, HorizontalAlignment.CENTER);
        tb.drawU(ug.apply(new UTranslate(margin.getX1(), margin.getY1())));
      },
    };
  }

  /**
   * Upstream: `return USymbols.COMPONENT2.asBig(...)`. The `USymbols`
   * registry (decoration/symbol/USymbols.java) is a later, separate
   * consolidation task (batch-3, `T10-usymbols-registry.md`) spanning
   * every `USymbol*` family — not built yet. Both `USymbolComponent1`
   * and `USymbolComponent2` are in THIS task's own write-set, so a
   * direct instantiation reproduces the identical delegation without
   * depending on the not-yet-existing registry.
   */
  asBig(
    title: TextBlock,
    labelAlignment: HorizontalAlignment,
    stereotype: TextBlock,
    width: number,
    height: number,
    symbolContext: SymbolContext,
    stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    // #lizard forgives -- 7 params mirrors USymbol#asBig's abstract
    // signature (decoration/symbol/USymbol.java) exactly; cannot be
    // reduced without breaking the interface contract every USymbol*
    // subclass implements.
    return new USymbolComponent2().asBig(title, labelAlignment, stereotype, width, height, symbolContext, stereoAlignment);
  }
}

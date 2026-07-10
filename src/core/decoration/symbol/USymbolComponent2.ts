import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { URectangle } from '../../klimt/shape/URectangle.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { TextBlockUtils } from '../../klimt/shape/TextBlockUtils.js';
import { UGraphicStencil } from '../../klimt/drawing/UGraphicStencil.js';

/** See `USymbolComponent1.ts`'s doc comment on `getMargin` for why the
 * drawing helpers in this file are module-scope plain functions rather
 * than private class methods. */
function getMargin(): Margin {
  return new Margin(10 + 5, 20 + 5, 15 + 5, 5 + 5);
}

function drawComponent2(ug: UGraphic, widthTotal: number, heightTotal: number, shadowing: number, roundCorner: number): void {
  const form = URectangle.build(widthTotal, heightTotal).rounded(roundCorner);
  form.setDeltaShadow(shadowing);

  const small = URectangle.build(15, 10);
  const tiny = URectangle.build(4, 2);

  ug.draw(form);

  // UML 2 Component Notation
  ug.apply(new UTranslate(widthTotal - 20, 5)).draw(small);
  ug.apply(new UTranslate(widthTotal - 22, 7)).draw(tiny);
  ug.apply(new UTranslate(widthTotal - 22, 11)).draw(tiny);
}

/**
 * USymbolComponent2 — the "UML 2" component notation: a rounded-corner
 * box with a small plug-icon rectangle (two tiny notch rectangles)
 * near its top-right corner.
 *
 * Upstream: decoration/symbol/USymbolComponent2.java (137 ln).
 * Reachable via `skinparam componentStyle uml2` (this port's default —
 * see `USymbols.COMPONENT2` in upstream's registry).
 *
 * `UGraphicStencil` seam (T3b realignment): see `USymbolComponent1.ts`'s
 * doc comment — restored below now that `UGraphicStencil` is ported.
 */
export class USymbolComponent2 extends USymbol {
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
        const dim = calculateDimension(ug.getStringBounder());
        ug = UGraphicStencil.create(ug, dim);
        ug = symbolContext.apply(ug);
        drawComponent2(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
        const margin = getMargin();

        const tb = TextBlockUtils.mergeTB(stereotype, label, HorizontalAlignment.CENTER);
        tb.drawU(ug.apply(new UTranslate(margin.getX1(), margin.getY1())));
      },
    };
  }

  asBig(
    title: TextBlock,
    _labelAlignment: HorizontalAlignment,
    stereotype: TextBlock,
    width: number,
    height: number,
    symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    function calculateDimension(_stringBounder: StringBounder): XDimension2D {
      return new XDimension2D(width, height);
    }

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const dim = calculateDimension(ug.getStringBounder());
        ug = symbolContext.apply(ug);
        drawComponent2(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
        const dimStereo = stereotype.calculateDimension(ug.getStringBounder());
        // Upstream: `(width - dimStereo.getWidth()) / 2` verbatim
        // (identical math) -- `getWidth()` hoisted to a const here (and
        // in every sibling file's `asBig`) purely to dodge a false-
        // positive NLOC/CCN misattribution in the vendored lizard
        // TypeScript tokenizer: an outer-paren-wrapped expression ending
        // in a method call desyncs its brace/function-stack tracking
        // and swallows the trailing `#lizard forgive` marker (confirmed
        // via isolated repro). TS/tooling workaround only.
        const dimStereoWidth = dimStereo.getWidth();
        const posStereo = (width - dimStereoWidth) / 2;
        stereotype.drawU(ug.apply(new UTranslate(posStereo, 13)));
        const dimTitle = title.calculateDimension(ug.getStringBounder());
        const dimTitleWidth = dimTitle.getWidth();
        const posTitle = (width - dimTitleWidth) / 2;
        title.drawU(ug.apply(new UTranslate(posTitle, 13 + dimStereo.getHeight())));
      },
      // #lizard forgives -- 7 params mirrors USymbol#asBig's abstract
      // signature (decoration/symbol/USymbol.java) exactly; cannot be
      // reduced without breaking the interface contract every USymbol*
      // subclass implements.
    };
  }
}

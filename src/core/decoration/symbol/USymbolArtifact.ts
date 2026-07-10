import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UPolygon } from '../../klimt/shape/UPolygon.js';
import { ULine } from '../../klimt/shape/ULine.js';
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
  return new Margin(10, 10 + 10, 10 + 3, 10);
}

function drawArtifact(ug: UGraphic, widthTotal: number, heightTotal: number, shadowing: number, roundCorner: number): void {
  const form = URectangle.build(widthTotal, heightTotal).rounded(roundCorner);
  form.setDeltaShadow(shadowing);

  ug.draw(form);

  const polygon = new UPolygon();
  polygon.addPoint(0, 0);
  const heightSymbol = 14;
  polygon.addPoint(0, heightSymbol);
  const widthSymbol = 12;
  polygon.addPoint(widthSymbol, heightSymbol);
  const cornersize = 6;
  polygon.addPoint(widthSymbol, cornersize);
  polygon.addPoint(widthSymbol - cornersize, 0);
  polygon.addPoint(0, 0);

  const xSymbol = widthTotal - widthSymbol - 5;
  const ySymbol = 5;

  ug.apply(new UTranslate(xSymbol, ySymbol)).draw(polygon);
  ug.apply(new UTranslate(xSymbol + widthSymbol - cornersize, ySymbol)).draw(ULine.vline(cornersize));
  ug.apply(new UTranslate(xSymbol + widthSymbol, ySymbol + cornersize)).draw(ULine.hline(-cornersize));
}

/**
 * USymbolArtifact — a rounded-corner rectangle with a "dog-ear" folded
 * page-corner icon (a small pentagon plus the two lines that mark its
 * fold) in the top-right area.
 *
 * Upstream: decoration/symbol/USymbolArtifact.java (147 ln).
 *
 * `UGraphicStencil` seam (T3b realignment): see `USymbolComponent1.ts`'s
 * doc comment — restored below now that `UGraphicStencil` is ported.
 */
export class USymbolArtifact extends USymbol {
  getSNames(): readonly SName[] {
    return ['artifact'];
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
        drawArtifact(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
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
        drawArtifact(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
        const dimStereo = stereotype.calculateDimension(ug.getStringBounder());
        // See `USymbolComponent2.ts`'s doc comment for why `getWidth()` is
        // hoisted to an intermediate const before the surrounding `(...)`.
        const dimStereoWidth = dimStereo.getWidth();
        const posStereo = (width - dimStereoWidth) / 2;
        stereotype.drawU(ug.apply(new UTranslate(posStereo, 2)));
        const dimTitle = title.calculateDimension(ug.getStringBounder());
        const dimTitleWidth = dimTitle.getWidth();
        const posTitle = (width - dimTitleWidth) / 2;
        title.drawU(ug.apply(new UTranslate(posTitle, 2 + dimStereo.getHeight())));
      },
      // #lizard forgives -- 7 params mirrors USymbol#asBig's abstract
      // signature (decoration/symbol/USymbol.java) exactly; cannot be
      // reduced without breaking the interface contract every USymbol*
      // subclass implements.
    };
  }
}

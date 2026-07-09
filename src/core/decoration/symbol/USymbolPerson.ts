import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UGraphicStencil } from '../../klimt/drawing/UGraphicStencil.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import type { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import type { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { URectangle } from '../../klimt/shape/URectangle.js';
import { UEllipse } from '../../klimt/shape/UEllipse.js';
import { TextBlockUtils } from '../../klimt/shape/TextBlockUtils.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';

/**
 * USymbolPerson — the `person` descriptive/deployment element: a
 * rounded-figure variant (head circle + a body rect rounded to the head
 * radius, so the top corners read as "shoulders").
 *
 * Upstream: decoration/symbol/USymbolPerson.java. Ported in full:
 * `getSNames`, `drawHeadAndBody`, `headSize`, `getMargin`, `asSmall`
 * (including the anonymous `TextBlock`'s `bodyDimension` helper), `asBig`
 * (throws, matching upstream's `UnsupportedOperationException`).
 *
 * Extends `USymbol` directly (not `USymbolSimpleAbstract`), matching
 * upstream — `USymbolPerson.java` implements `asSmall`/`asBig` itself
 * rather than going through the shared stereotype/icon/label
 * template-method layout `USymbolSimpleAbstract` provides (its
 * label+stereotype merge via `TextBlockUtils.mergeTB` rather than
 * drawing them as two separate blocks).
 */
export class USymbolPerson extends USymbol {
  getSNames(): readonly SName[] {
    return ['person'];
  }

  private drawHeadAndBody(ug: UGraphic, shadowing: number, dimBody: XDimension2D, headSize: number): void {
    const head = UEllipse.build(headSize, headSize);
    const body = URectangle.build(dimBody.getWidth(), dimBody.getHeight()).rounded(headSize);

    body.setDeltaShadow(shadowing);
    head.setDeltaShadow(shadowing);

    const posx = (dimBody.getWidth() - headSize) / 2;
    ug.apply(UTranslate.dx(posx)).draw(head);
    ug.apply(UTranslate.dy(headSize)).draw(body);
  }

  private headSize(dimBody: XDimension2D): number {
    const surface = dimBody.getWidth() * dimBody.getHeight();
    return Math.sqrt(surface) * 0.42;
  }

  private getMargin(): Margin {
    return new Margin(10, 10, 10, 10);
  }

  asSmall(
    _name: TextBlock,
    label: TextBlock,
    stereotype: TextBlock,
    symbolContext: SymbolContext,
    stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    const bodyDimension = (stringBounder: StringBounder): XDimension2D => {
      const dimLabel = label.calculateDimension(stringBounder);
      const dimStereo = stereotype.calculateDimension(stringBounder);
      return this.getMargin().addDimension(dimStereo.mergeTB(dimLabel));
    };
    const calculateDimension = (stringBounder: StringBounder): XDimension2D => {
      const body = bodyDimension(stringBounder);
      return body.delta(0, this.headSize(body));
    };

    return {
      calculateDimension,
      drawU: (ug: UGraphic): void => {
        const dimFull = calculateDimension(ug.getStringBounder());
        const dimBody = bodyDimension(ug.getStringBounder());
        ug = UGraphicStencil.create(ug, dimFull);
        ug = symbolContext.apply(ug);
        const headSize = this.headSize(dimBody);
        this.drawHeadAndBody(ug, symbolContext.getDeltaShadow(), dimBody, headSize);
        const tb = TextBlockUtils.mergeTB(stereotype, label, stereoAlignment);
        const margin = this.getMargin();
        tb.drawU(ug.apply(new UTranslate(margin.getX1(), margin.getY1() + headSize)));
      },
    };
  }

  asBig(
    _title: TextBlock,
    _labelAlignment: HorizontalAlignment,
    _stereotype: TextBlock,
    _width: number,
    _height: number,
    _symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    throw new Error('USymbolPerson.asBig: not supported (matches upstream UnsupportedOperationException)');
  }
}

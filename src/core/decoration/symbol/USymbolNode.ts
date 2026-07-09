import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UPolygon } from '../../klimt/shape/UPolygon.js';
import { ULine } from '../../klimt/shape/ULine.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { TextBlockUtils } from '../../klimt/shape/TextBlockUtils.js';
import { Back } from '../../klimt/Back.js';
import { AbstractUGraphicHorizontalLine } from '../../klimt/drawing/AbstractUGraphicHorizontalLine.js';
import type { UHorizontalLine } from '../../klimt/shape/UHorizontalLine.js';

/** See `USymbolComponent1.ts`'s doc comment on `getMargin` for why the
 * drawing helpers in this file are module-scope plain functions rather
 * than private class methods. */
function getMargin(): Margin {
  return new Margin(10 + 5, 20 + 5, 15 + 5, 5 + 5);
}

/**
 * `UEmpty` deferral (reported): upstream's `drawNode` ends with
 * `ug.apply(new UTranslate(0, height)).draw(new UEmpty(10, 10))`.
 * Verified (not assumed) this has zero rendered effect: upstream's own
 * `AbstractUGraphic#draw` special-cases `UEmpty` (`if (shape
 * instanceof UEmpty) return;` after only updating an internal min/max
 * bounds tracker via `drawEmpty` — no driver, no SVG output). `UEmpty`
 * is not ported at all; the call is simply omitted rather than porting
 * a shape class whose only observed behavior (upstream) is "touch two
 * numbers nobody reads back for this conformance surface."
 */
function drawNode(ug: UGraphic, width: number, height: number, shadowing: number): void {
  const shape = new UPolygon();
  shape.addPoint(0, 10);
  shape.addPoint(10, 0);
  shape.addPoint(width, 0);
  shape.addPoint(width, height - 10);
  shape.addPoint(width - 10, height);
  shape.addPoint(0, height);
  shape.addPoint(0, 10);

  shape.setDeltaShadow(shadowing);

  ug.draw(shape);

  ug.apply(new UTranslate(width - 10, 10)).draw(new ULine(10, -10));

  ug.apply(UTranslate.dy(10)).draw(ULine.hline(width - 10));
  ug.apply(new UTranslate(width - 10, 10)).draw(ULine.vline(height - 10));

  // See this function's own doc comment above (`UEmpty` deferral) for
  // why upstream's trailing `draw(new UEmpty(10, 10))` is omitted.
}

/**
 * USymbolNode — the 3D-box "node" notation: a hexagonal outline (a
 * front face plus a folded top/right edge) with the fold lines drawn
 * as separate `ULine`s over the polygon fill.
 *
 * Upstream: decoration/symbol/USymbolNode.java (200 ln).
 *
 * `MyUGraphicNode` (T3b realignment): upstream's `asSmall` wraps the
 * label/stereotype draw call in a private `MyUGraphicNode` (extends
 * `AbstractUGraphicHorizontalLine`) that extends the node's top/right
 * fold line THROUGH the label area whenever a Creole "--" separator
 * draws a `UHorizontalLine` there. Restored below now that
 * `AbstractUGraphicHorizontalLine`/`UHorizontalLine` are ported (T3b).
 * Output-neutral for this task's conformance suite: this element's
 * stereotype/label content never draws a `UHorizontalLine`.
 */
/**
 * MyUGraphicNode — see the module doc comment's `MyUGraphicNode` entry.
 *
 * Upstream: `USymbolNode.MyUGraphicNode` (Java inner class). Ported in
 * full: the constructor, `copy`, `drawHline`, `drawHlineInternal`.
 */
class MyUGraphicNode extends AbstractUGraphicHorizontalLine {
  private readonly endingX: number;

  constructor(ug: UGraphic, endingX: number) {
    super(ug);
    this.endingX = endingX;
  }

  protected copy(ug: UGraphic): AbstractUGraphicHorizontalLine {
    return new MyUGraphicNode(ug, this.endingX);
  }

  private drawHlineInternal(ug: UGraphic, line: UHorizontalLine): void {
    const styled = ug.apply(line.getStroke()).apply(new Back('none'));
    styled.draw(ULine.hline(this.endingX - 10));
    styled.apply(UTranslate.dx(this.endingX - 10)).draw(new ULine(10, -10));
  }

  protected drawHline(ug: UGraphic, line: UHorizontalLine, translate: UTranslate): void {
    const translated = ug.apply(translate);
    this.drawHlineInternal(translated, line);
    if (line.isDouble()) this.drawHlineInternal(translated.apply(UTranslate.dy(2)), line);
    line.drawTitleInternal(translated, 0, this.endingX - 10, 0, true);
  }
}

export class USymbolNode extends USymbol {
  getSNames(): readonly SName[] {
    return ['node'];
  }

  asSmall(
    _name: TextBlock,
    label: TextBlock,
    stereotype: TextBlock,
    symbolContext: SymbolContext,
    stereoAlignment: HorizontalAlignment,
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
        ug = symbolContext.apply(ug);
        drawNode(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow());
        const margin = getMargin();
        const tb = TextBlockUtils.mergeTB(stereotype, label, stereoAlignment);
        const ug2 = new MyUGraphicNode(ug, dim.getWidth());
        tb.drawU(ug2.apply(new UTranslate(margin.getX1(), margin.getY1())));
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
    stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    function calculateDimension(_stringBounder: StringBounder): XDimension2D {
      return new XDimension2D(width, height);
    }

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const dim = calculateDimension(ug.getStringBounder());
        ug = symbolContext.apply(ug);
        drawNode(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow());
        ug = ug.apply(new UTranslate(-4, 11));

        const dimStereo = stereotype.calculateDimension(ug.getStringBounder());
        // See `USymbolComponent2.ts`'s doc comment for why `getWidth()`
        // is hoisted to an intermediate const before the surrounding
        // `(...)` (a lizard-tokenizer workaround, not a math change).
        const dimStereoWidth = dimStereo.getWidth();
        const posStereoY = 2;
        const posStereoX =
          stereoAlignment === HorizontalAlignment.RIGHT ? width - dimStereoWidth - getMargin().getX1() : (width - dimStereoWidth) / 2;
        stereotype.drawU(ug.apply(new UTranslate(posStereoX, posStereoY)));
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

  suppHeightBecauseOfShape(): number {
    return 5;
  }

  suppWidthBecauseOfShape(): number {
    return 60;
  }
}

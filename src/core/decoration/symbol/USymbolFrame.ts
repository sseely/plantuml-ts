import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UPath } from '../../klimt/shape/UPath.js';
import { URectangle } from '../../klimt/shape/URectangle.js';
import { Back } from '../../klimt/Back.js';
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

function getYpos(dimTitle: XDimension2D): number {
  if (dimTitle.getWidth() === 0) return 12;
  return dimTitle.getHeight() + 3;
}

function drawFrame(ug: UGraphic, width: number, height: number, dimTitle: XDimension2D, shadowing: number, roundCorner: number): void {
  const rectangle = URectangle.build(width, height).rounded(roundCorner).ignoreForCompressionOnX().ignoreForCompressionOnY();
  rectangle.setDeltaShadow(shadowing);

  ug.draw(rectangle);

  let textWidth: number;
  let cornersize: number;
  if (dimTitle.getWidth() === 0) {
    textWidth = width / 3;
    cornersize = 7;
  } else {
    textWidth = dimTitle.getWidth() + 10;
    cornersize = 10;
  }
  const textHeight = getYpos(dimTitle);

  const line = UPath.none();
  line.moveTo(textWidth, 0);

  line.lineTo(textWidth, textHeight - cornersize);
  line.lineTo(textWidth - cornersize, textHeight);

  line.lineTo(0, textHeight);
  ug.apply(new Back('none')).draw(line);
  // #lizard forgives -- faithfully ports upstream's two-branch
  // tab-width computation (`USymbolFrame.java#drawFrame`) verbatim.
}

/**
 * USymbolFrame — a rounded rectangle with a UML "frame" name-tab: a
 * small pentagon-shaped tab notch cut into the top-left corner (drawn
 * as an open `UPath`, not filled) sized to fit either a default
 * 1/3-width tab (`asSmall`, no title yet known) or the real title's
 * measured width plus a small margin (`asBig`).
 *
 * Upstream: decoration/symbol/USymbolFrame.java (194 ln). Reachable as
 * `frame`/`group`/`partition` (each upstream's `USymbols` registry
 * constructs with a different `SName`, hence the constructor param
 * here rather than a hardcoded `getSNames()` return).
 *
 * `SpecialText` deviation (reported): upstream's `asBig` branches on
 * `widthFull - widthTitle < 25`: the `if` branch draws the title
 * directly (`title.drawU(ug.apply(new UTranslate(3, 1)))`); the `else`
 * branch wraps it in `new SpecialText(title)` — a
 * `UShapeIgnorableForCompression` used ONLY by the (unported)
 * `CompressionMode` subsystem to let a too-wide title symbolically
 * "occupy" only 1px during layout compression. Verified (not assumed):
 * `AbstractUGraphic#draw(SHAPE)` special-cases `SpecialText` BEFORE
 * ever reaching a driver — `((SpecialText) shape).getTitle().drawU(ug)`
 * — i.e. during any render that is NOT itself inside an active
 * compression pass (which this port does not implement — see
 * `UPath.ts`'s own `ignoreForCompression*` deferral note), `draw(new
 * SpecialText(title))` is observationally IDENTICAL to
 * `title.drawU(ug)` called at the same translate. Both branches
 * therefore draw the same pixels here; the width check only matters
 * once `CompressionMode` exists. Collapsed to the single `if` branch's
 * body rather than porting an unreachable-in-this-scope dead branch
 * that would require the whole compression subsystem to even type.
 *
 * `UGraphicStencil` seam (T3b realignment): see `USymbolComponent1.ts`'s
 * doc comment — restored below now that `UGraphicStencil` is ported.
 */
export class USymbolFrame extends USymbol {
  private readonly sname: SName;

  constructor(sname: SName) {
    super();
    this.sname = sname;
  }

  getSNames(): readonly SName[] {
    return [this.sname];
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
        drawFrame(ug, dim.getWidth(), dim.getHeight(), new XDimension2D(0, 0), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
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
        const stringBounder = ug.getStringBounder();
        const dim = calculateDimension(stringBounder);
        ug = symbolContext.apply(ug);
        const dimTitle = title.calculateDimension(stringBounder);
        const widthFull = dim.getWidth();
        drawFrame(ug, widthFull, dim.getHeight(), dimTitle, symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());

        // See the module doc comment above ("`SpecialText` deviation") —
        // both of upstream's branches draw identically outside an active
        // CompressionMode pass, which this port does not implement.
        title.drawU(ug.apply(new UTranslate(3, 1)));

        const dimStereo = stereotype.calculateDimension(stringBounder);
        const dimStereoWidth = dimStereo.getWidth();
        const posStereo = (width - dimStereoWidth) / 2;

        stereotype.drawU(ug.apply(new UTranslate(4 + posStereo, 2 + getYpos(dimTitle))));
      },
      // #lizard forgives -- 7 params mirrors USymbol#asBig's abstract
      // signature (decoration/symbol/USymbol.java) exactly; cannot be
      // reduced without breaking the interface contract every USymbol*
      // subclass implements.
    };
  }
}

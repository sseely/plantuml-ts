import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { URectangle } from '../../klimt/shape/URectangle.js';
import { ULine } from '../../klimt/shape/ULine.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { TextBlockUtils } from '../../klimt/shape/TextBlockUtils.js';
import { UGraphicStencil } from '../../klimt/drawing/UGraphicStencil.js';

/**
 * TS-mechanics deviation (reported, same reasoning as
 * `USymbolRectangle.ts`'s `drawRect`/`getMargin`): `drawCard`/`getMargin`
 * read no `USymbolCard` instance field upstream — ported as top-level,
 * non-exported functions.
 */
function drawCard(ug: UGraphic, width: number, height: number, shadowing: number, top: number, roundCorner: number): void {
  const shape = URectangle.build(width, height).rounded(roundCorner);
  shape.setDeltaShadow(shadowing);
  ug.draw(shape);
  if (top !== 0) {
    ug.apply(UTranslate.dy(top)).draw(ULine.hline(width));
  }
  // 6 params mirrors USymbolCard.java's own drawCard(ug, width, height,
  // shadowing, top, roundCorner) exactly.
  // #lizard forgives
}

function getMargin(): Margin {
  return new Margin(10, 10, 3, 3);
}

/**
 * USymbolCard — the "card" descriptive/deployment element: a
 * rounded-corner box like `USymbolRectangle`, but with a smaller
 * vertical margin (3 vs 10) and — in `asBig` — an optional horizontal
 * divider line below the title/stereotype header, drawn via `top`.
 *
 * Upstream: decoration/symbol/USymbolCard.java (126 ln). Ported in
 * full: `getSNames`, `drawCard`, `getMargin`, `asSmall`, `asBig`.
 *
 * `asSmall`'s `stereoAlignment` param note (faithful, not a bug): unlike
 * `USymbolRectangle`, upstream's `USymbolCard#asSmall` hardcodes
 * `HorizontalAlignment.CENTER` for its `mergeTB` call — it ignores the
 * caller-supplied `stereoAlignment` entirely. Preserved verbatim (the
 * unused parameter is kept, matching the abstract `USymbol#asSmall`
 * signature, per porting discipline — no dead-param removal).
 *
 * `UGraphicStencil` seam (T3b realignment): see `USymbolRectangle.ts`'s
 * doc comment — restored below now that `UGraphicStencil` is ported.
 *
 * Lizard-tooling note (reported, see `.agent-notes/T5-symbols-box.md`):
 * `asBig`'s `posStereo`/`posTitle` locals extract `dimStereo.getWidth()`
 * / `dimTitle.getWidth()` BEFORE the `(width - ...) / 2` division —
 * mechanically identical to upstream's inline
 * `(width - dimStereo.getWidth()) / 2`, just pre-extracted to work
 * around a project complexity-hook (lizard) tokenizer quirk that
 * otherwise silently drops the `#lizard forgives` marker this method
 * needs for its unavoidable 7-param `USymbol#asBig` signature.
 */
export class USymbolCard extends USymbol {
  getSNames(): readonly SName[] {
    return ['card'];
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

    const result: TextBlock = {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const stringBounder = ug.getStringBounder();
        const dim = calculateDimension(stringBounder);
        ug = UGraphicStencil.create(ug, dim);
        ug = symbolContext.apply(ug);
        drawCard(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow(), 0, symbolContext.getRoundCorner());
        const margin = getMargin();
        const tb = TextBlockUtils.mergeTB(stereotype, label, HorizontalAlignment.CENTER);
        tb.drawU(ug.apply(new UTranslate(margin.getX1(), margin.getY1())));
      },
    };
    return result;
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
    const result: TextBlock = {
      calculateDimension(_stringBounder: StringBounder): XDimension2D {
        return new XDimension2D(width, height);
      },
      drawU(ug: UGraphic): void {
        const stringBounder = ug.getStringBounder();
        const dim = new XDimension2D(width, height);
        ug = symbolContext.apply(ug);
        const dimStereo = stereotype.calculateDimension(stringBounder);
        const dimTitle = title.calculateDimension(stringBounder);
        drawCard(
          ug,
          dim.getWidth(),
          dim.getHeight(),
          symbolContext.getDeltaShadow(),
          dimTitle.getHeight() + dimStereo.getHeight() + 4,
          symbolContext.getRoundCorner(),
        );
        const dimStereoWidth = dimStereo.getWidth();
        const posStereo = (width - dimStereoWidth) / 2;
        stereotype.drawU(ug.apply(new UTranslate(posStereo, 2)));
        const dimTitleWidth = dimTitle.getWidth();
        const posTitle = (width - dimTitleWidth) / 2;
        title.drawU(ug.apply(new UTranslate(posTitle, 2 + dimStereo.getHeight())));
      },
    };
    // 7 params mirrors USymbol#asBig's abstract signature exactly.
    // #lizard forgives
    return result;
  }
}

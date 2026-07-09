import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { mergeTB } from './USymbolRectangle.js';

function getMargin(): Margin {
  return new Margin(10, 10, 10, 10);
}

/**
 * `asBig`'s stereotype/title placement math, extracted out of `drawU`'s
 * body (TS-mechanics note, reported, same reasoning as
 * `USymbolRectangle.ts`'s `computeStereoPos`/`computeTitlePos`): a
 * `drawU` body with its own `if`/`else` branching (on top of `asBig`'s
 * unavoidable 7-param signature) defeats this project's lizard-based
 * `#lizard forgives` marker for the OUTER `asBig` — see
 * `.agent-notes/T5-symbols-box.md`. Not a behavioral change: the math
 * is identical to upstream's inline branches.
 */
function computeStereoPos(
  stereoAlignment: HorizontalAlignment,
  width: number,
  dimStereo: XDimension2D,
): readonly [number, number] {
  if (stereoAlignment === HorizontalAlignment.RIGHT) {
    const dimStereoWidth = dimStereo.getWidth();
    return [width - dimStereoWidth - getMargin().getX1() / 2, getMargin().getY1() / 2];
  }
  const dimStereoWidth = dimStereo.getWidth();
  return [(width - dimStereoWidth) / 2, 2];
}

function computeTitlePos(labelAlignment: HorizontalAlignment, width: number, dimTitle: XDimension2D): number {
  if (labelAlignment === HorizontalAlignment.LEFT) return 3;
  const dimTitleWidth = dimTitle.getWidth();
  if (labelAlignment === HorizontalAlignment.RIGHT) return width - dimTitleWidth - 3;
  return (width - dimTitleWidth) / 2;
}

/**
 * USymbolLabel — the "label" descriptive/deployment element: draws NO
 * border/shape at all in `asSmall` — only the merged stereotype/label
 * `TextBlock` content, positioned by `symbolContext.apply(ug)`'s
 * stroke/color state even though nothing consumes it (no `ug.draw(...)`
 * call anywhere in `asSmall`).
 *
 * Upstream: decoration/symbol/USymbolLabel.java (95 ln). Ported in
 * full: `getSNames`, `getMargin`, `asSmall`, `asBig`.
 *
 * "Empty context" behavior (task requirement, verified against
 * upstream): `asSmall#drawU` calls `symbolContext.apply(ug)` (matching
 * every other `USymbol*`) purely for parity with the family's shared
 * shape — it never uses the returned `ug`'s stroke/color state for
 * anything, since no shape is ever drawn. Ported verbatim rather than
 * "simplified away" (porting discipline: preserve upstream's call
 * shape even when a call's result goes unused).
 *
 * `UGraphicStencil`/`ug.getStringBounder()` seams: identical reasoning
 * to `USymbolRectangle.ts` — see that file's doc comment.
 */
export class USymbolLabel extends USymbol {
  getSNames(): readonly SName[] {
    return ['label'];
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

    const result: TextBlock = {
      calculateDimension,
      drawU(ug: UGraphic): void {
        ug = symbolContext.apply(ug);
        const margin = getMargin();
        const tb = mergeTB(stereotype, label, stereoAlignment);
        tb.drawU(ug.apply(new UTranslate(margin.getX1(), margin.getY1())));
      },
    };
    return result;
  }

  asBig(
    title: TextBlock,
    labelAlignment: HorizontalAlignment,
    stereotype: TextBlock,
    width: number,
    height: number,
    symbolContext: SymbolContext,
    stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    const result: TextBlock = {
      calculateDimension(_stringBounder: StringBounder): XDimension2D {
        return new XDimension2D(width, height);
      },
      drawU(ug: UGraphic): void {
        ug = symbolContext.apply(ug);
        const stringBounder = ug.getStringBounder();
        const dimStereo = stereotype.calculateDimension(stringBounder);
        const [posStereoX, posStereoY] = computeStereoPos(stereoAlignment, width, dimStereo);
        stereotype.drawU(ug.apply(new UTranslate(posStereoX, posStereoY)));
        const dimTitle = title.calculateDimension(stringBounder);
        const posTitle = computeTitlePos(labelAlignment, width, dimTitle);
        title.drawU(ug.apply(new UTranslate(posTitle, 2 + dimStereo.getHeight())));
      },
    };
    // 7 params mirrors USymbol#asBig's abstract signature exactly.
    // #lizard forgives
    return result;
  }
}

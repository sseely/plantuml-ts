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
import { mergeTB } from './USymbolRectangle.js';

/** Upstream: `USymbolCollections#getDeltaCollection()` — the fixed 4px
 * offset the back rect is shifted by (down-right) relative to the front
 * rect, giving the "stacked cards" silhouette. */
function getDeltaCollection(): number {
  return 4;
}

/**
 * TS-mechanics deviation (reported, same reasoning as
 * `USymbolRectangle.ts`'s `drawRect`/`getMargin`): `drawCollections`/
 * `getMargin` read no `USymbolCollections` instance field upstream —
 * ported as top-level, non-exported functions.
 *
 * Draw-order note (task acceptance criterion 3, verified against real
 * jar output — `collections Foo` fragment, `test-results/dot-cache`-
 * style capture, provenance in the conformance test): the BACK rect
 * (offset by `(delta, delta)`, WITH the ambient `deltaShadow`) is drawn
 * FIRST — it therefore paints UNDER the front rect in SVG's document-
 * order-is-paint-order model. The FRONT rect (at the symbol's own
 * origin, delta-shadow explicitly cleared to `0` via
 * `small.setDeltaShadow(0)` — the SAME `URectangle` INSTANCE, mutated
 * and redrawn, matching upstream's `final URectangle small` reuse
 * exactly) is drawn SECOND, painting on top. Reversing this order would
 * put the shadow on the wrong (visible) rect and hide the "stacked
 * cards" peek-out effect — preserved bug-for-bug/order-for-order.
 */
function drawCollections(ug: UGraphic, width: number, height: number, shadowing: number, roundCorner: number): void {
  const delta = getDeltaCollection();
  const small = URectangle.build(width - delta, height - delta).rounded(roundCorner);
  small.setDeltaShadow(shadowing);
  ug.apply(new UTranslate(delta, delta)).draw(small);
  small.setDeltaShadow(0);
  ug.apply(UTranslate.dy(0)).draw(small);
  // 5 params mirrors USymbolCollections.java's own drawCollections(ug,
  // width, height, shadowing, roundCorner) exactly.
  // #lizard forgives
}

function getMargin(): Margin {
  return new Margin(10, 10, 10, 10);
}

/**
 * `asBig`'s stereotype/title placement math, extracted out of `drawU`'s
 * body — same reasoning as `USymbolRectangle.ts`'s `computeStereoPos`/
 * `computeTitlePos` (a lizard-tooling accommodation, not a behavioral
 * change; see `.agent-notes/T5-symbols-box.md`).
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

/**
 * USymbolCollections — the "collections" descriptive/deployment
 * element: two overlapping rounded rects (front + back, offset by 4px)
 * giving a "stack of cards" silhouette.
 *
 * Upstream: decoration/symbol/USymbolCollections.java (137 ln). Ported
 * in full: `getSNames`, `drawCollections`, `getMargin`,
 * `getDeltaCollection`, `asSmall`, `asBig`.
 *
 * `asSmall`'s label/stereotype translate note (faithful): the merged
 * `TextBlock` is drawn at `(margin.getX1() - delta/2, margin.getY1() -
 * delta/2)` — half the collection-delta LESS than
 * `USymbolRectangle`'s plain `(margin.getX1(), margin.getY1())` — so the
 * text visually centers between the two overlapping rects rather than
 * sitting flush with the front rect's corner. Ported verbatim.
 *
 * `UGraphicStencil`/`ug.getStringBounder()` seams: identical reasoning
 * to `USymbolRectangle.ts` — see that file's doc comment.
 */
export class USymbolCollections extends USymbol {
  getSNames(): readonly SName[] {
    return ['collections'];
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
        const stringBounder = ug.getStringBounder();
        const dim = calculateDimension(stringBounder);
        ug = symbolContext.apply(ug);
        drawCollections(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
        const margin = getMargin();
        const delta = getDeltaCollection();
        const tb = mergeTB(stereotype, label, stereoAlignment);
        tb.drawU(ug.apply(new UTranslate(margin.getX1() - delta / 2, margin.getY1() - delta / 2)));
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
    stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    const result: TextBlock = {
      calculateDimension(_stringBounder: StringBounder): XDimension2D {
        return new XDimension2D(width, height);
      },
      drawU(ug: UGraphic): void {
        const stringBounder = ug.getStringBounder();
        const dim = new XDimension2D(width, height);
        ug = symbolContext.apply(ug);
        drawCollections(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
        const dimStereo = stereotype.calculateDimension(stringBounder);
        const [posStereoX, posStereoY] = computeStereoPos(stereoAlignment, width, dimStereo);
        stereotype.drawU(ug.apply(new UTranslate(posStereoX, posStereoY)));
        const dimTitle = title.calculateDimension(stringBounder);
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

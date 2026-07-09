import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import type { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UPolygon } from '../../klimt/shape/UPolygon.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { mergeTB } from './USymbolRectangle.js';

/**
 * TS-mechanics deviation (reported, same reasoning as
 * `USymbolRectangle.ts`'s `drawRect`/`getMargin`): `drawAction`/
 * `getMargin`/`getHTitle` read no `USymbolAction` instance field
 * upstream — ported as top-level, non-exported functions.
 *
 * Faithful-bug note (reported, verified against real jar output — see
 * the class doc comment below): upstream's `drawAction` signature
 * carries `shadowing`/`roundCorner`/`diagonalCorner` params (matching
 * every other `USymbol*` `drawXxx` call shape) but its BODY never reads
 * any of them — the chevron polygon has no `setDeltaShadow` call and no
 * rounding/diagonal-corner logic at all. This is upstream's own
 * behavior (`USymbolAction.java:64-73`), not a simplification made
 * here: `symbolContext.getDeltaShadow()`/`getRoundCorner()`/
 * `getDiagonalCorner()` are still computed and passed at every call
 * site (matching upstream's call shape exactly), they are simply never
 * consulted by `drawAction`'s body — preserved bug-for-bug.
 */
function drawAction(ug: UGraphic, width: number, height: number, _shadowing: number, _roundCorner: number, _diagonalCorner: number): void {
  const shape = new UPolygon();
  shape.addPoint(0, 0);
  shape.addPoint(width - 10, 0);
  shape.addPoint(width, height / 2);
  shape.addPoint(width - 10, height);
  shape.addPoint(0, height);
  ug.draw(shape);
  // 6 params mirrors USymbolAction.java's own drawAction(ug, width,
  // height, shadowing, roundCorner, diagonalCorner) exactly — even
  // though the body never reads shadowing/roundCorner/diagonalCorner
  // (see the faithful-bug note above).
  // #lizard forgives
}

function getMargin(): Margin {
  return new Margin(10, 20, 10, 10);
}

function getHTitle(dimTitle: XDimension2D): number {
  if (dimTitle.getWidth() === 0) return 10;
  return dimTitle.getHeight();
}

/**
 * USymbolAction — the "action" descriptive/deployment element: a
 * pentagon/chevron shape (a rectangle with its right edge cut into a
 * point), reachable via the `action` keyword.
 *
 * Upstream: decoration/symbol/USymbolAction.java (144 ln). Ported in
 * full: the constructor, `getSNames`, `drawAction`, `getMargin`,
 * `getHTitle`, `asSmall`, `asBig`.
 *
 * `UGraphicStencil`/`ug.getStringBounder()` seams: identical reasoning
 * to `USymbolRectangle.ts` — see that file's doc comment.
 *
 * Lizard-tooling note (reported, see `.agent-notes/T5-symbols-box.md`):
 * `asBig`'s `posTitle`/`posStereo` locals pre-extract
 * `dimTitle.getWidth()`/`dimStereo.getWidth()` before the
 * `(width - ...) / 2` division — a mechanical, non-behavioral
 * complexity-hook (lizard) tokenizer workaround, not an upstream
 * deviation.
 */
export class USymbolAction extends USymbol {
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
        drawAction(
          ug,
          dim.getWidth(),
          dim.getHeight(),
          symbolContext.getDeltaShadow(),
          symbolContext.getRoundCorner(),
          symbolContext.getDiagonalCorner(),
        );
        const margin = getMargin();
        const tb = mergeTB(stereotype, label, stereoAlignment);
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
        const dimTitle = title.calculateDimension(stringBounder);
        drawAction(
          ug,
          dim.getWidth(),
          dim.getHeight(),
          symbolContext.getDeltaShadow(),
          symbolContext.getRoundCorner(),
          symbolContext.getDiagonalCorner(),
        );
        const dimTitleWidth = dimTitle.getWidth();
        const posTitle = (width - dimTitleWidth) / 2;
        title.drawU(ug.apply(new UTranslate(posTitle, 2)));
        const dimStereo = stereotype.calculateDimension(stringBounder);
        const dimStereoWidth = dimStereo.getWidth();
        const posStereo = (width - dimStereoWidth) / 2;
        stereotype.drawU(ug.apply(new UTranslate(4 + posStereo, 2 + getHTitle(dimTitle))));
      },
    };
    // 7 params mirrors USymbol#asBig's abstract signature exactly.
    // #lizard forgives
    return result;
  }
}

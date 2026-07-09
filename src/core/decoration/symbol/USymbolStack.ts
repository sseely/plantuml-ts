import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { URectangle } from '../../klimt/shape/URectangle.js';
import { UPath } from '../../klimt/shape/UPath.js';
import { Fore } from '../../klimt/Fore.js';
import { Back } from '../../klimt/Back.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { mergeTB } from './USymbolRectangle.js';

/**
 * Upstream: `USymbolStack#drawQueue`'s rounded-corner outline builder —
 * a `UPath` tracing the "queue/stack" silhouette (straight sides with a
 * cap cut inward by `border` at top and bottom, rounded where
 * `roundCorner > 0`). Extracted to its own top-level function (TS-
 * mechanics note, same reasoning as `USymbolRectangle.ts`'s
 * `drawRect`/`getMargin` — no `USymbolStack` instance field is read)
 * purely for the `roundCorner === 0` vs `roundCorner > 0` branch split
 * upstream's own `if`/`else` already makes; kept as a nested `if`
 * inside `drawQueue` below (matching upstream's own single-method
 * structure) since neither branch's own body needs isolating further.
 */
function buildOutlinePath(width: number, height: number, border: number, roundCorner: number): UPath {
  const path = UPath.none();
  if (roundCorner === 0) {
    path.moveTo(0, 0);
    path.lineTo(border, 0);
    path.lineTo(border, height);
    path.lineTo(width - border, height);
    path.lineTo(width - border, 0);
    path.lineTo(width, 0);
    return path;
  }
  const half = roundCorner / 2;
  path.moveTo(0, 0);
  path.lineTo(border - half, 0);
  path.arcTo({ x: border, y: half }, half, 0, 1);
  path.lineTo(border, height - half);
  path.arcTo({ x: border + half, y: height }, half, 0, 0);
  path.lineTo(width - border - half, height);
  path.arcTo({ x: width - border, y: height - half }, half, 0, 0);
  path.lineTo(width - border, half);
  path.arcTo({ x: width - border + half, y: 0 }, half, 0, 1);
  path.lineTo(width, 0);
  return path;
}

/**
 * TS-mechanics deviation (reported, same reasoning as
 * `USymbolRectangle.ts`'s `drawRect`/`getMargin`): `drawQueue`/
 * `getMargin` read no `USymbolStack` instance field upstream — ported
 * as top-level, non-exported functions.
 *
 * Draw-order/color-override note (verified against real jar output —
 * `stack Foo` fragment, provenance in the conformance test): the rect
 * (drawn FIRST, so it paints UNDER the path) has its FOREGROUND
 * (`Fore('none')`) overridden to invisible — `symbolContext`'s own
 * stroke color never appears on the rect's border, only its fill
 * (backColor, untouched). The path (drawn SECOND, on top) has its
 * BACKGROUND (`Back('none')`) overridden instead — it never fills,
 * only strokes, using `symbolContext`'s own foreground color
 * (untouched). This is upstream's exact `HColors.none()` /
 * `HColors.none().bg()` override pattern (`USymbolStack.java:65,88`) —
 * `HColors.none()` -> `new Fore('none')`, `HColors.none().bg()` ->
 * `new Back('none')` (the same `NONE_PAINT`/`Fore`/`Back` substitution
 * `SymbolContext.ts`'s own doc comment documents for `HColor`).
 */
function drawQueue(ug: UGraphic, width: number, height: number, shadowing: number, roundCorner: number): void {
  const border = 15;
  const rect = URectangle.build(width - 2 * border, height).rounded(roundCorner);
  ug.apply(new Fore('none')).apply(UTranslate.dx(border)).draw(rect);

  const path = buildOutlinePath(width, height, border, roundCorner);
  path.setDeltaShadow(shadowing);
  ug.apply(new Back('none')).draw(path);
  // 5 params mirrors USymbolStack.java's own drawQueue(ug, width,
  // height, shadowing, roundCorner) exactly.
  // #lizard forgives
}

function getMargin(): Margin {
  return new Margin(25, 25, 10, 10);
}

/**
 * USymbolStack — the "stack" descriptive/deployment element: a
 * queue/stack silhouette (straight or rounded end-caps cut `border`=15px
 * inward from each side), reachable via the `stack` keyword.
 *
 * Upstream: decoration/symbol/USymbolStack.java (148 ln). Ported in
 * full: `getSNames`, `drawQueue` (as `buildOutlinePath` + `drawQueue`
 * above — see their own doc comments), `getMargin`, `asSmall`, `asBig`.
 *
 * `asSmall`'s hardcoded `HorizontalAlignment.CENTER` (faithful, not a
 * bug): same as `USymbolCard`'s `asSmall` — upstream ignores the
 * caller-supplied `stereoAlignment` for the small form entirely.
 *
 * `UGraphicStencil`/`ug.getStringBounder()` seams: identical reasoning
 * to `USymbolRectangle.ts` — see that file's doc comment.
 */
export class USymbolStack extends USymbol {
  getSNames(): readonly SName[] {
    return ['stack'];
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
        ug = symbolContext.apply(ug);
        drawQueue(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
        const margin = getMargin();
        const tb = mergeTB(stereotype, label, HorizontalAlignment.CENTER);
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
        drawQueue(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
        const dimStereo = stereotype.calculateDimension(stringBounder);
        const dimStereoWidth = dimStereo.getWidth();
        const posStereo = (width - dimStereoWidth) / 2;
        stereotype.drawU(ug.apply(new UTranslate(posStereo, 13)));
        const dimTitle = title.calculateDimension(stringBounder);
        const dimTitleWidth = dimTitle.getWidth();
        const posTitle = (width - dimTitleWidth) / 2;
        title.drawU(ug.apply(new UTranslate(posTitle, 13 + dimStereo.getHeight())));
      },
    };
    // 7 params mirrors USymbol#asBig's abstract signature exactly.
    // #lizard forgives
    return result;
  }
}

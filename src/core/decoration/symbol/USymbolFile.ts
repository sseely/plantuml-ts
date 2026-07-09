import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UPolygon } from '../../klimt/shape/UPolygon.js';
import { UPath } from '../../klimt/shape/UPath.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { mergeTB } from './USymbolComponent1.js';

/** See `USymbolComponent1.ts`'s doc comment on `getMargin` for why the
 * drawing helpers in this file are module-scope plain functions rather
 * than private class methods. */
function getMargin(): Margin {
  return new Margin(10, 10, 10, 10);
}

function drawFile(ug: UGraphic, width: number, height: number, shadowing: number, roundCorner: number): void {
  const cornersize = 10;
  let out: UPolygon | UPath;
  if (roundCorner === 0) {
    const polygon = new UPolygon();
    polygon.addPoint(0, 0);
    polygon.addPoint(0, height);
    polygon.addPoint(width, height);
    polygon.addPoint(width, cornersize);
    polygon.addPoint(width - cornersize, 0);
    polygon.addPoint(0, 0);
    out = polygon;
  } else {
    const path = UPath.none();
    path.moveTo(0, roundCorner / 2);
    path.lineTo(0, height - roundCorner / 2);
    path.arcTo({ x: roundCorner / 2, y: height }, roundCorner / 2, 0, 0);
    path.lineTo(width - roundCorner / 2, height);
    path.arcTo({ x: width, y: height - roundCorner / 2 }, roundCorner / 2, 0, 0);
    path.lineTo(width, cornersize);
    path.lineTo(width - cornersize, 0);
    path.lineTo(roundCorner / 2, 0);
    path.arcTo({ x: 0, y: roundCorner / 2 }, roundCorner / 2, 0, 0);
    out = path;
  }

  out.setDeltaShadow(shadowing);
  ug.draw(out);

  const path = UPath.none();
  path.moveTo(width - cornersize, 0);
  if (roundCorner === 0) {
    path.lineTo(width - cornersize, cornersize);
  } else {
    path.lineTo(width - cornersize, cornersize - roundCorner / 2);
    path.arcTo({ x: width - cornersize + roundCorner / 2, y: cornersize }, roundCorner / 2, 0, 0);
  }
  path.lineTo(width, cornersize);
  ug.draw(path);
  // #lizard forgives -- NLOC exceeds the 30-line budget because this
  // faithfully ports BOTH of upstream's roundCorner branches (a plain
  // UPolygon outline vs. an arced UPath outline) plus the fold-line
  // UPath -- collapsing or sharing code between the two branches would
  // diverge from `USymbolFile.java#drawFile`'s own structure.
}

/**
 * USymbolFile — a "dog-ear" page outline: a rectangle whose top-right
 * corner is cut away and folded back in, drawn as a single closed
 * `UPolygon` (`roundCorner === 0`) or `UPath` (`roundCorner !== 0`,
 * arced corners) plus a second short `UPath` marking the fold line.
 *
 * Upstream: decoration/symbol/USymbolFile.java (168 ln).
 *
 * `stereotypeAlignement` field (bug-for-bug, preserved verbatim):
 * upstream declares a private field `stereotypeAlignement` (note the
 * misspelling — "Alignement", not "Alignment") hardcoded to
 * `HorizontalAlignment.CENTER` and NEVER reassigned, then `asBig`
 * branches on THIS FIELD rather than on its own `stereoAlignment`
 * PARAMETER (a different, correctly-spelled name) — so the `RIGHT`
 * branch is upstream-unreachable dead code. Ported exactly as written:
 * this task's own porting discipline requires preserving upstream
 * quirks that produce output (they are not silently "fixed" case by
 * case), even ones that look like bugs.
 *
 * `UGraphicStencil` deferral: see `USymbolComponent1.ts`'s doc comment
 * — identical reasoning applies here.
 */
export class USymbolFile extends USymbol {
  private static readonly STEREOTYPE_ALIGNEMENT: HorizontalAlignment = HorizontalAlignment.CENTER;

  getSNames(): readonly SName[] {
    return ['file'];
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
        ug = symbolContext.apply(ug);
        drawFile(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
        const margin = getMargin();
        const tb = mergeTB(stereotype, label, HorizontalAlignment.CENTER);
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
    // See the module doc comment above ("`stereotypeAlignement` field") —
    // upstream's own `asBig` reads THIS field, not its `stereoAlignment`
    // parameter, so this port does too.
    const stereotypeAlignement = USymbolFile.STEREOTYPE_ALIGNEMENT;

    function calculateDimension(_stringBounder: StringBounder): XDimension2D {
      return new XDimension2D(width, height);
    }

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const dim = calculateDimension(ug.getStringBounder());
        ug = symbolContext.apply(ug);
        drawFile(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
        const dimStereo = stereotype.calculateDimension(ug.getStringBounder());
        const dimStereoWidth = dimStereo.getWidth();
        let posStereoX: number;
        let posStereoY: number;
        /* v8 ignore start -- `stereotypeAlignement` (see the module doc
           comment above) is a hardcoded-CENTER field never reassigned to
           RIGHT; this branch is upstream-unreachable dead code, ported
           bug-for-bug (not testable through this class's public API by
           design -- exercising it would require a bug fix that changes
           observable behavior, which is out of scope for a faithful port). */
        if (stereotypeAlignement === HorizontalAlignment.RIGHT) {
          posStereoX = width - dimStereoWidth - getMargin().getX1() / 2;
          posStereoY = getMargin().getY1() / 2;
          /* v8 ignore stop */
        } else {
          posStereoX = (width - dimStereoWidth) / 2;
          posStereoY = 2;
        }
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
}

import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { URectangle } from '../../klimt/shape/URectangle.js';
import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';

/**
 * USymbolStorage — the "storage" descriptive/deployment element: a
 * heavily-rounded rectangle (`rounded(70)` — a fixed magic constant,
 * halved to `rx=ry=35` at SVG-serialization time by `URectangle`'s own
 * documented halving convention, T2).
 *
 * Upstream: decoration/symbol/USymbolStorage.java (120 ln). Ported:
 * `getSNames`, `drawStorage` (top-level function — see
 * `USymbolDatabase.ts`'s "TS-mechanics deviation" doc entry, identical
 * reasoning), `getMargin`, `asSmall`, `asBig`.
 *
 * Seams — `ug.getStringBounder()`, `TextBlockUtils.mergeTB`: identical
 * situation and reasoning to `USymbolDatabase.ts`'s doc comment — see
 * that file for the full write-up.
 *
 * Seam — `UGraphicStencil.create(ug, dim)` (reported, this class and
 * `USymbolProcess` only): upstream's `asSmall#drawU` opens with `ug =
 * UGraphicStencil.create(ug, dim);` before `symbolContext.apply(ug)`.
 * `UGraphicStencil` (klimt/drawing/UGraphicStencil.java) is a
 * `UHorizontalLine`-clipping wrapper with no port anywhere in this
 * codebase (same already-flagged gap as `USymbol.ts`'s
 * `USymbolSimpleAbstract` deferral). Degrades to a no-op passthrough
 * (`ug` used directly, unclipped) — no observable effect for content
 * that never draws a `UHorizontalLine` (this port draws none).
 */

const STORAGE_ROUNDED = 70;

function dxForAlignment(alignment: HorizontalAlignment, totalWidth: number, blockWidth: number): number {
  if (alignment === HorizontalAlignment.LEFT) return 0;
  if (alignment === HorizontalAlignment.RIGHT) return totalWidth - blockWidth;
  return (totalWidth - blockWidth) / 2;
}

/** See `USymbolDatabase.ts`'s `mergeTB` doc comment — identical seam
 * accommodation, duplicated per-file by design. */
export function mergeTB(top: TextBlock, bottom: TextBlock, alignment: HorizontalAlignment): TextBlock {
  return {
    calculateDimension(stringBounder: StringBounder): XDimension2D {
      return top.calculateDimension(stringBounder).mergeTB(bottom.calculateDimension(stringBounder));
    },
    drawU(ug: UGraphic): void {
      const stringBounder = ug.getStringBounder();
      const dimTotal = top.calculateDimension(stringBounder).mergeTB(bottom.calculateDimension(stringBounder));
      let y = 0;
      for (const block of [top, bottom]) {
        const dimBlock = block.calculateDimension(stringBounder);
        const dx = dxForAlignment(alignment, dimTotal.getWidth(), dimBlock.getWidth());
        block.drawU(ug.apply(new UTranslate(dx, y)));
        y += dimBlock.getHeight();
      }
    },
  };
}

/** Upstream: `USymbolStorage#drawStorage`. */
export function drawStorage(ug: UGraphic, width: number, height: number, shadowing: number): void {
  const shape = URectangle.build(width, height).rounded(STORAGE_ROUNDED);
  shape.setDeltaShadow(shadowing);
  ug.draw(shape);
}

/** Upstream: `USymbolStorage#getMargin`. */
export function getMargin(): Margin {
  return new Margin(10, 10, 10, 10);
}

export class USymbolStorage extends USymbol {
  getSNames(): readonly SName[] {
    return ['storage'];
  }

  asSmall(
    _name: TextBlock,
    label: TextBlock,
    stereotype: TextBlock,
    symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    const calculateDimension = (stringBounder: StringBounder): XDimension2D => {
      const dimLabel = label.calculateDimension(stringBounder);
      const dimStereo = stereotype.calculateDimension(stringBounder);
      return getMargin().addDimension(dimStereo.mergeTB(dimLabel));
    };

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const dim = calculateDimension(ug.getStringBounder());
        // Seam: UGraphicStencil.create(ug, dim) — see module doc comment.
        ug = symbolContext.apply(ug);
        drawStorage(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow());
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
    const calculateDimension = (_stringBounder: StringBounder): XDimension2D => new XDimension2D(width, height);

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const stringBounder = ug.getStringBounder();
        const dim = calculateDimension(stringBounder);
        ug = symbolContext.apply(ug);
        drawStorage(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow());

        const dimStereo = stereotype.calculateDimension(stringBounder);
        const posStereo = (width - dimStereo.getWidth()) / 2;
        stereotype.drawU(ug.apply(new UTranslate(posStereo, 5)));

        const dimTitle = title.calculateDimension(stringBounder);
        const posTitle = (width - dimTitle.getWidth()) / 2;
        title.drawU(ug.apply(new UTranslate(posTitle, 7 + dimStereo.getHeight())));
      },
    };
    // 7 params mirrors the abstract USymbol#asBig signature (T3,
    // USymbol.ts — out of this task's write-set); not reducible without
    // breaking the override contract.
  }
}

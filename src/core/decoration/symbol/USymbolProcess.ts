import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UPolygon } from '../../klimt/shape/UPolygon.js';
import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';

/**
 * USymbolProcess — the "process" descriptive/deployment element: a
 * 6-point chevron polygon (both ends notched 10px inward at half-height).
 * Upstream's own constructor takes an `SName` — `USymbols.java` currently
 * wires exactly one caller, `PROCESS = new USymbolProcess(SName.process)`
 * — so this class stays parameterized the same way rather than
 * hardcoding `'process'`.
 *
 * Reported divergence from this task's own mission-brief gloss: the
 * brief describes this family member as "rect with side-strips"; the
 * real `USymbolProcess.java` (verified, 144 ln) draws a 6-point chevron
 * `UPolygon` with no side-strip lines at all. Ported faithfully from the
 * actual upstream source (authoritative per this project's porting
 * discipline), not from the brief's descriptive gloss.
 *
 * Ported: the constructor, `getSNames`, `drawProcess` (top-level
 * function — see `USymbolDatabase.ts`'s "TS-mechanics deviation" doc
 * entry), `getMargin`, `getHTitle`, `asSmall`, `asBig`.
 *
 * Preserved upstream quirk (bug-for-bug, reported): `drawProcess`'s
 * `shadowing`/`roundCorner`/`diagonalCorner` params are accepted
 * (matching both `asSmall`'s and `asBig`'s call sites, which pass
 * `symbolContext.getDeltaShadow()`/`getRoundCorner()`/
 * `getDiagonalCorner()`) but NONE are read inside the function body —
 * not even `shape.setDeltaShadow(shadowing)` is called, unlike every
 * other symbol in this family. Preserved exactly per this project's
 * "preserve upstream behavior... including behavior that appears wrong"
 * policy — not an omission introduced by this port.
 *
 * Seams — `ug.getStringBounder()`, `TextBlockUtils.mergeTB`,
 * `UGraphicStencil.create` (asSmall only): identical situation and
 * reasoning to `USymbolDatabase.ts`'s and `USymbolStorage.ts`'s doc
 * comments.
 */

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

/** Upstream: `USymbolProcess#drawProcess` — see the module doc comment's
 * "preserved upstream quirk" entry for why `_shadowing`/`_roundCorner`/
 * `_diagonalCorner` are accepted but unused. */
export function drawProcess(
  ug: UGraphic,
  width: number,
  height: number,
  _shadowing: number,
  _roundCorner: number,
  _diagonalCorner: number,
): void {
  const shape = new UPolygon();
  shape.addPoint(0, 0);
  shape.addPoint(width - 10, 0);
  shape.addPoint(width, height / 2);
  shape.addPoint(width - 10, height);
  shape.addPoint(0, height);
  shape.addPoint(10, height / 2);
  ug.draw(shape);
}

/** Upstream: `USymbolProcess#getMargin`. */
export function getMargin(): Margin {
  return new Margin(20, 20, 10, 10);
}

/** Upstream: `USymbolProcess#getHTitle`. */
export function getHTitle(dimTitle: XDimension2D): number {
  if (dimTitle.getWidth() === 0) return 10;
  return dimTitle.getHeight();
}

export class USymbolProcess extends USymbol {
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
        drawProcess(
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
        const dimTitle = title.calculateDimension(stringBounder);
        drawProcess(
          ug,
          dim.getWidth(),
          dim.getHeight(),
          symbolContext.getDeltaShadow(),
          symbolContext.getRoundCorner(),
          symbolContext.getDiagonalCorner(),
        );
        const posTitle = (width - dimTitle.getWidth()) / 2;
        title.drawU(ug.apply(new UTranslate(posTitle, 2)));

        const dimStereo = stereotype.calculateDimension(stringBounder);
        const posStereo = (width - dimStereo.getWidth()) / 2;
        stereotype.drawU(ug.apply(new UTranslate(4 + posStereo, 2 + getHTitle(dimTitle))));
      },
    };
    // 7 params mirrors the abstract USymbol#asBig signature (T3,
    // USymbol.ts — out of this task's write-set); not reducible without
    // breaking the override contract.
  }
}

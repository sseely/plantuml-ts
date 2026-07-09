import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UPath } from '../../klimt/shape/UPath.js';
import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';

/**
 * USymbolHexagon — the "hexagon" descriptive/deployment element.
 *
 * Upstream: decoration/symbol/USymbolHexagon.java (147 ln). Ported:
 * `getSNames`, `asSmall` (label-only placement — see below), `drawRect`
 * (top-level function, named `drawRect` upstream despite drawing a
 * hexagon — preserved verbatim per porting discipline, not renamed for
 * clarity), `getMargin`, `asBig`.
 *
 * `asSmall` draws NO shape (reported, faithful): unlike Database/Queue/
 * Storage/Process, `USymbolHexagon#asSmall`'s `drawU` never calls
 * `drawRect` — it only positions the merged stereotype/label `TextBlock`
 * (`deltaX = dim.getWidth() / 4`, `marginY = 5`). The visible hexagon
 * OUTLINE for a leaf "hexagon" entity comes from a completely separate
 * code path — `EntityImageDescription#drawHexagon` (svek/image/
 * EntityImageDescription.java), which draws `SvekNode#getPolygon()`, a
 * shape computed by the SVEK/DOT layout layer, not by `USymbolHexagon`
 * at all — confirmed against real jar output (`hexagon "H1"` alone
 * yields a `<polygon>` whose point order/values do NOT match this file's
 * `drawRect` formula). `drawRect` (this file) is reachable only via
 * `asBig`, itself only reachable through `ClusterDecoration`
 * (svek/ClusterDecoration.java) for a "hexagon"-shaped CONTAINER (e.g.
 * `hexagon H1 { rectangle Inner }`) — verified against real jar output
 * for that exact construct (see this task's conformance test).
 *
 * Preserved upstream quirk (bug-for-bug, reported): `drawRect`'s
 * `roundCorner`/`diagonalCorner` params are accepted (matching
 * `asBig`'s call: `drawRect(ug, ..., symbolContext.getRoundCorner(), 0)`)
 * but NEVER READ inside the function body — `shape.setDeltaShadow
 * (shadowing)` IS called, but no corner rounding is ever applied to a
 * `UPath`-based hexagon outline. This is upstream's own dead-parameter
 * bug, not an omission introduced by this port — preserved per this
 * project's "preserve upstream behavior... including behavior that
 * appears wrong" policy.
 *
 * Seams — `ug.getStringBounder()`, `TextBlockUtils.mergeTB`: identical
 * situation and reasoning to `USymbolDatabase.ts`'s doc comment.
 */

const HEXAGON_MARGIN_Y = 5;

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

/** Upstream: `USymbolHexagon#drawRect` — see the module doc comment's
 * "preserved upstream quirk" entry for why `_roundCorner`/
 * `_diagonalCorner` are accepted but unused. */
export function drawRect(
  ug: UGraphic,
  width: number,
  height: number,
  shadowing: number,
  _roundCorner: number,
  _diagonalCorner: number,
): void {
  const shape = UPath.none();
  const dx = width / 8;
  shape.moveTo(0, height / 2);
  shape.lineTo(dx, 0);
  shape.lineTo(width - dx, 0);
  shape.lineTo(width, height / 2);
  shape.lineTo(width - dx, height);
  shape.lineTo(dx, height);
  shape.lineTo(0, height / 2);
  shape.closePath();

  shape.setDeltaShadow(shadowing);

  ug.draw(shape);
}

/** Upstream: `USymbolHexagon#getMargin`. */
export function getMargin(): Margin {
  return new Margin(10, 10, 10, 10);
}

export class USymbolHexagon extends USymbol {
  getSNames(): readonly SName[] {
    return ['hexagon'];
  }

  asSmall(
    _name: TextBlock,
    label: TextBlock,
    stereotype: TextBlock,
    _symbolContext: SymbolContext,
    stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    const calculateDimension = (stringBounder: StringBounder): XDimension2D => {
      const dimLabel = label.calculateDimension(stringBounder);
      const dimStereo = stereotype.calculateDimension(stringBounder);
      const full = dimStereo.mergeTB(dimLabel);
      return new XDimension2D(full.getWidth() * 2, full.getHeight() + 2 * HEXAGON_MARGIN_Y);
    };

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const dim = calculateDimension(ug.getStringBounder());
        const tb = mergeTB(stereotype, label, stereoAlignment);
        const deltaX = dim.getWidth() / 4;
        tb.drawU(ug.apply(new UTranslate(deltaX, HEXAGON_MARGIN_Y)));
      },
    };
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
    const calculateDimension = (_stringBounder: StringBounder): XDimension2D => new XDimension2D(width, height);

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const stringBounder = ug.getStringBounder();
        const dim = calculateDimension(stringBounder);
        ug = symbolContext.apply(ug);
        drawRect(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner(), 0);

        const dimStereo = stereotype.calculateDimension(stringBounder);
        let posStereoX: number;
        let posStereoY: number;
        if (stereoAlignment === HorizontalAlignment.RIGHT) {
          posStereoX = width - dimStereo.getWidth() - getMargin().getX1() / 2;
          posStereoY = getMargin().getY1() / 2;
        } else {
          posStereoX = (width - dimStereo.getWidth()) / 2;
          posStereoY = 2;
        }
        stereotype.drawU(ug.apply(new UTranslate(posStereoX, posStereoY)));

        const dimTitle = title.calculateDimension(stringBounder);
        let posTitle: number;
        if (labelAlignment === HorizontalAlignment.LEFT) posTitle = 3;
        else if (labelAlignment === HorizontalAlignment.RIGHT) posTitle = width - dimTitle.getWidth() - 3;
        else posTitle = (width - dimTitle.getWidth()) / 2;
        title.drawU(ug.apply(new UTranslate(posTitle, 2 + dimStereo.getHeight())));
      },
    };
    // 7 params mirrors the abstract USymbol#asBig signature (T3,
    // USymbol.ts — out of this task's write-set); not reducible without
    // breaking the override contract.
  }
}

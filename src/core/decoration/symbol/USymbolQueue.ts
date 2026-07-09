import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UPath } from '../../klimt/shape/UPath.js';
import { Back } from '../../klimt/Back.js';
import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';

/**
 * USymbolQueue — the "queue" descriptive/deployment element: a
 * horizontal cylinder (two cubic caps on the LEFT/RIGHT sides, straight
 * top/bottom) — a 90-degree rotation of the database cylinder's layout,
 * but a genuinely distinct coordinate formula (own `dx` inset constant),
 * not derived from `USymbolDatabase`.
 *
 * Upstream: decoration/symbol/USymbolQueue.java (186 ln). Ported:
 * `getSNames`, `drawQueue`/`getClosingPath` (top-level functions — see
 * `USymbolDatabase.ts`'s "TS-mechanics deviation" doc entry, identical
 * reasoning here), `getMargin`, `asSmall`, `asBig`. The `dx = 5` field is
 * the class's own inset constant (left/right cap depth) — ported as the
 * `QUEUE_DX` module constant.
 *
 * Reported source/jar version drift (this task's own finding, flagged
 * for human review): the `~/git/plantuml` checkout's
 * `USymbolQueue.java:86` reads `closing.cubicTo(width - dx * 2, height,
 * width - dx, height, width - dx, height);` — but the real
 * `plantuml-1.2026.7beta3.jar` (`java -jar ... -tsvg -pipe` on `queue
 * "Q1" as Q1`, see this task's test file for the exact fragment) draws
 * the closing cap's second cubic as `cubicTo(width - dx * 2, height / 2,
 * width - dx * 2, height, width - dx, height)` instead — a smooth mirror
 * of the FIRST cubic's `(0, height/2, height/2)` progression, matching
 * every one of the jar's own printed coordinates exactly (verified by
 * hand — see the test file's `QUEUE_GOLDEN` provenance comment). Ported
 * to match the JAR (the conformance oracle and what real users receive)
 * rather than the checked-out source text, which may be stale or
 * patched relative to the commit `beta3` was built from. Flagged here
 * for a human to reconcile the checkout against the jar's actual
 * `USymbolQueue.class` bytecode.
 *
 * Seams — `ug.getStringBounder()`, `TextBlockUtils.mergeTB`,
 * `MyUGraphicQueue`/`AbstractUGraphicHorizontalLine`/`Stencil`: identical
 * situation and reasoning to `USymbolDatabase.ts`'s doc comment (this
 * file's own `MyUGraphicQueue` additionally implements `Stencil` — the
 * same "no port, no driver, dropped" reasoning applies; a `UHorizontalLine`
 * inside a "queue" element's stereotype/label content would lose its
 * curved-cylinder clearance, the same acceptable gap as Database's). See
 * that file for the full write-up — not repeated here to avoid
 * duplicating a wall of prose across five near-identical seams.
 */

const QUEUE_DX = 5;

function dxForAlignment(alignment: HorizontalAlignment, totalWidth: number, blockWidth: number): number {
  if (alignment === HorizontalAlignment.LEFT) return 0;
  if (alignment === HorizontalAlignment.RIGHT) return totalWidth - blockWidth;
  return (totalWidth - blockWidth) / 2;
}

/** See `USymbolDatabase.ts`'s `mergeTB` doc comment — identical seam
 * accommodation, duplicated per-file by design (collision-risk
 * reasoning documented there). */
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

/** Upstream: `USymbolQueue#getClosingPath` — the small cubic "hump"
 * drawn `2*dx` inset from the right edge, back-colored `none`. See the
 * module doc comment's "reported source/jar version drift" entry: the
 * second `cubicTo` call below matches the real jar's output, not the
 * `~/git/plantuml` checkout's literal text. */
export function getClosingPath(width: number, height: number): UPath {
  const closing = UPath.none();
  closing.moveTo(width - QUEUE_DX, 0);
  closing.cubicTo(width - QUEUE_DX * 2, 0, width - QUEUE_DX * 2, height / 2, width - QUEUE_DX * 2, height / 2);
  closing.cubicTo(width - QUEUE_DX * 2, height / 2, width - QUEUE_DX * 2, height, width - QUEUE_DX, height);
  return closing;
}

/** Upstream: `USymbolQueue#drawQueue`. */
export function drawQueue(ug: UGraphic, width: number, height: number, shadowing: number): void {
  const shape = UPath.none();
  shape.setDeltaShadow(shadowing);

  shape.moveTo(QUEUE_DX, 0);
  shape.lineTo(width - QUEUE_DX, 0);
  shape.cubicTo(width, 0, width, height / 2, width, height / 2);
  shape.cubicTo(width, height / 2, width, height, width - QUEUE_DX, height);
  shape.lineTo(QUEUE_DX, height);

  shape.cubicTo(0, height, 0, height / 2, 0, height / 2);
  shape.cubicTo(0, height / 2, 0, 0, QUEUE_DX, 0);

  ug.draw(shape);

  const closing = getClosingPath(width, height);
  ug.apply(new Back('none')).draw(closing);
}

/** Upstream: `USymbolQueue#getMargin`. */
export function getMargin(): Margin {
  return new Margin(5, 15, 5, 5);
}

export class USymbolQueue extends USymbol {
  getSNames(): readonly SName[] {
    return ['queue'];
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
        ug = symbolContext.apply(ug);
        drawQueue(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow());
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
        drawQueue(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow());

        const dimStereo = stereotype.calculateDimension(stringBounder);
        const posStereo = (width - dimStereo.getWidth()) / 2;
        stereotype.drawU(ug.apply(new UTranslate(posStereo, 2)));

        const dimTitle = title.calculateDimension(stringBounder);
        const posTitle = (width - dimTitle.getWidth()) / 2;
        title.drawU(ug.apply(new UTranslate(posTitle, 2 + dimStereo.getHeight())));
      },
    };
    // 7 params mirrors the abstract USymbol#asBig signature (T3,
    // USymbol.ts — out of this task's write-set); not reducible without
    // breaking the override contract.
  }
}

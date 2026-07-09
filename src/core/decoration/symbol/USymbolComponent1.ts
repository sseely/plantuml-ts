import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import type { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { URectangle } from '../../klimt/shape/URectangle.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { USymbolComponent2 } from './USymbolComponent2.js';

/**
 * mergeTB — a scoped, task-local port of `TextBlockUtils.mergeTB(b1, b2,
 * horizontalAlignment)` (klimt/shape/TextBlockUtils.java +
 * klimt/shape/TextBlockVertical.java), the vertical-stack combinator
 * every `USymbol*#asSmall`/`asBig` in upstream uses to merge a
 * stereotype `TextBlock` above a label `TextBlock`.
 *
 * Write-set note (T6, reported): `TextBlockUtils`/`TextBlockVertical`
 * are NOT part of T3's landed base (`USymbol`/`SymbolContext`/the
 * `TextBlock` seam) — they are a separate upstream utility every single
 * `USymbol*` subclass across the WHOLE family (T5–T9, verified via
 * `grep -l TextBlockUtils decoration/symbol/*.java` — every family
 * hits this) depends on identically. Per `symbols-common.md`'s explicit
 * instruction ("if [the base] is genuinely missing something a symbol
 * needs, ASK (write-set expansion) rather than adding side channels"),
 * this is flagged for the orchestrator: a follow-up task should promote
 * this into a real, shared `src/core/klimt/shape/TextBlockUtils.ts`
 * once all of T5–T9 land (each family task will otherwise need this
 * same local port — duplicating it per-file is the safe, zero-
 * collision choice for THIS task, since a shared new file could race
 * against a sibling family task creating the same file independently).
 * Exported so `USymbolComponent2`/`USymbolNode`/`USymbolArtifact`/
 * `USymbolFile`/`USymbolFrame` (this task's OWN write-set) reuse this
 * one definition rather than each re-duplicating it.
 *
 * Scope reduction vs. upstream `TextBlockVertical` (reported):
 * - Only the 2-`TextBlock` arity is ported (`mergeTB(b1, b2, align)`) —
 *   every call site in this task's six classes uses exactly this
 *   arity; upstream's N-ary `List<TextBlock>` constructor has no
 *   2-argument-only caller here.
 * - The `EMPTY_TEXT_BLOCK` reference-identity fast path
 *   (`if (b1 == EMPTY_TEXT_BLOCK) return b2; ...`) is dropped: it is a
 *   pure allocation optimization (merging with a (0,0)-dimension block
 *   produces byte-identical drawn output either way — verified by hand
 *   against real jar SVG fragments for this task's own conformance
 *   tests), not an observable-output difference.
 * - The per-block background-color band (`block.getBackcolor()` →
 *   fills a `URectangle` before drawing) is dropped: `TextBlock`
 *   (this port's seam, T3) has no `getBackcolor()` member at all (T3's
 *   own scope reduction — "NO caller anywhere" at the time), so no
 *   caller in this task's write-set can ever pass a colored block here.
 * - `TextBlockMemoized`'s dimension cache is dropped: pure performance
 *   optimization (repeated calls recompute instead of caching),
 *   invisible in rendered output.
 * - `getPorts`/`getInnerPosition` are dropped: neither is part of this
 *   port's `TextBlock` seam (T3), and no caller in this task's classes
 *   invokes either.
 */
export function mergeTB(b1: TextBlock, b2: TextBlock, horizontalAlignment: HorizontalAlignment): TextBlock {
  function calculateDimension(stringBounder: StringBounder): XDimension2D {
    return b1.calculateDimension(stringBounder).mergeTB(b2.calculateDimension(stringBounder));
  }

  function horizontalOffset(totalWidth: number, blockWidth: number): number {
    if (horizontalAlignment === HorizontalAlignment.LEFT) return 0;
    if (horizontalAlignment === HorizontalAlignment.CENTER) return (totalWidth - blockWidth) / 2;
    if (horizontalAlignment === HorizontalAlignment.RIGHT) return totalWidth - blockWidth;
    /* v8 ignore next 2 -- HorizontalAlignment's as-const union has exactly
       three members; this branch mirrors upstream's `else throw` for a
       fourth case that cannot occur through this port's type system. */
    throw new Error(`mergeTB: unsupported HorizontalAlignment ${String(horizontalAlignment)}`);
  }

  return {
    calculateDimension,
    drawU(ug: UGraphic): void {
      const stringBounder = ug.getStringBounder();
      const dimtotal = calculateDimension(stringBounder);
      let y = 0;
      for (const block of [b1, b2]) {
        const dimb = block.calculateDimension(stringBounder);
        const dx = horizontalOffset(dimtotal.getWidth(), dimb.getWidth());
        block.drawU(ug.apply(new UTranslate(dx, y)));
        y += dimb.getHeight();
      }
    },
  };
}

/**
 * Upstream: `USymbolComponent1#getMargin()`. Module-scope (TS-mechanics
 * note, applies to every `getMargin`/`drawXxx` helper across this
 * task's six files): none of these helpers read any per-instance
 * field, so hoisting them out of the class avoids the `this`-capturing
 * arrow-closure indirection an object-literal-returning method would
 * otherwise need (a `TextBlock`'s `drawU`/`calculateDimension` are
 * plain function properties, not bound to the enclosing class
 * instance) — a plain function is simpler and avoids that indirection
 * entirely. Behavior is unchanged; only where the code physically
 * lives moved.
 */
function getMargin(): Margin {
  return new Margin(10, 10, 10, 10);
}

function drawComponent1(ug: UGraphic, widthTotal: number, heightTotal: number, shadowing: number, roundCorner: number): void {
  const form = URectangle.build(widthTotal, heightTotal).rounded(roundCorner);
  form.setDeltaShadow(shadowing);
  ug.draw(form);

  const small = URectangle.build(10, 5);

  // UML 1 Component Notation
  ug.apply(new UTranslate(-5, 5)).draw(small);
  ug.apply(new UTranslate(-5, heightTotal - 10)).draw(small);
}

/**
 * USymbolComponent1 — the legacy "UML 1" component notation: a
 * rounded-corner box with two small tab rectangles overlapping its
 * left edge.
 *
 * Upstream: decoration/symbol/USymbolComponent1.java (112 ln).
 * Reachable via `skinparam componentStyle uml1`.
 *
 * `UGraphicStencil` deferral (reported, applies to every `asSmall` in
 * this task's six classes except `USymbolNode`'s): upstream wraps `ug`
 * in `UGraphicStencil.create(ug, dimTotal)` before drawing. Verified
 * (not assumed): `UGraphicStencil extends AbstractUGraphicHorizontalLine`,
 * whose only behavioral difference from the plain `ug` it wraps is
 * intercepting `draw(UHorizontalLine)` calls (`AbstractUGraphicHorizontalLine
 * .java`'s `draw` special-cases `instanceof UHorizontalLine`, else
 * passes through unchanged). No `UHorizontalLine` shape class exists in
 * this port and nothing in this task's `label`/`stereotype` `TextBlock`
 * parameters can ever construct one (`grep -rl UHorizontalLine src/`
 * returns nothing) — so the wrap is presently a no-op pass-through.
 * Not ported; revisit if/when Creole horizontal-line (note-separator)
 * rendering lands.
 */
export class USymbolComponent1 extends USymbol {
  getSNames(): readonly SName[] {
    return ['component'];
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
        const stringBounder = ug.getStringBounder();
        const dimTotal = calculateDimension(stringBounder);
        ug = symbolContext.apply(ug);
        drawComponent1(ug, dimTotal.getWidth(), dimTotal.getHeight(), symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
        const margin = getMargin();
        const tb = mergeTB(stereotype, label, HorizontalAlignment.CENTER);
        tb.drawU(ug.apply(new UTranslate(margin.getX1(), margin.getY1())));
      },
    };
  }

  /**
   * Upstream: `return USymbols.COMPONENT2.asBig(...)`. The `USymbols`
   * registry (decoration/symbol/USymbols.java) is a later, separate
   * consolidation task (batch-3, `T10-usymbols-registry.md`) spanning
   * every `USymbol*` family — not built yet. Both `USymbolComponent1`
   * and `USymbolComponent2` are in THIS task's own write-set, so a
   * direct instantiation reproduces the identical delegation without
   * depending on the not-yet-existing registry.
   */
  asBig(
    title: TextBlock,
    labelAlignment: HorizontalAlignment,
    stereotype: TextBlock,
    width: number,
    height: number,
    symbolContext: SymbolContext,
    stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    // #lizard forgives -- 7 params mirrors USymbol#asBig's abstract
    // signature (decoration/symbol/USymbol.java) exactly; cannot be
    // reduced without breaking the interface contract every USymbol*
    // subclass implements.
    return new USymbolComponent2().asBig(title, labelAlignment, stereotype, width, height, symbolContext, stereoAlignment);
  }
}

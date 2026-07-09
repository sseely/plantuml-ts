import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import type { SymbolContext } from './SymbolContext.js';

/**
 * SName — a descriptive/deployment element's style-selector name (e.g.
 * "database", "folder", "actor"). `USymbol#getSNames()` returns the set
 * of style selectors a concrete symbol answers to.
 *
 * Upstream: style/SName.java — a ~100-member enum covering every
 * diagram type's style selectors, not just descriptive/deployment ones.
 *
 * Scope reduction (T3 mission brief — this task ports only the USymbol/
 * SymbolContext/TextBlock base, not the concrete `USymbol*` family, T5–
 * T9): porting the full enum here would be speculative — no code in this
 * task's write-set constructs an `SName` value. This alias keeps
 * `getSNames()`'s SHAPE upstream-faithful (`readonly SName[]`) without
 * inventing members nothing here needs yet; it also matches this
 * codebase's own existing convention of representing SNames as plain
 * lowercase strings (see `ELEMENT_BUCKET_SNAMES` in `skinparam.ts` and
 * `usymbol-shapes.ts`'s `usymbol` keyword strings) rather than a real
 * enum. A later task porting the concrete `USymbol*` family may widen
 * this to an as-const object of the actual upstream member names it
 * needs, without changing any signature that merely holds an `SName`.
 */
export type SName = string;

/**
 * USymbol — the abstract base every descriptive/deployment element
 * shape (`USymbolRectangle`, `USymbolFolder`, `USymbolHexagon`, …, T5–T9)
 * extends. `EntityImageDescription` (svek/image/EntityImageDescription
 * .java) is the sole consumer read for this task's base-sufficiency
 * check (D10): it calls `symbol.getSNames()`, `symbol.asSmall(name,
 * desc, stereo, ctx, stereotypeAlignment)`, and `instanceof
 * USymbolActorBusiness` (a concrete-subclass check, not part of this
 * base).
 *
 * Upstream: decoration/symbol/USymbol.java. Ported: `getSNames`,
 * `asSmall`, `asBig`, the nested `Margin` class (exported here as a
 * top-level `Margin` — see its own doc comment for why),
 * `suppHeightBecauseOfShape`/`suppWidthBecauseOfShape` (both default to
 * `0`, overridden by `USymbolHexagon`/others in T5–T9).
 *
 * Base-sufficiency check (D10, this task): read `USymbolRectangle.java`,
 * `USymbolFolder.java`, `USymbolInterface.java`,
 * `USymbolActorBusiness.java`, and `USymbolSimpleAbstract.java` — every
 * one implements only `getSNames`/`asSmall`/`asBig` (directly, or via
 * `USymbolSimpleAbstract`'s template-method `getDrawing` hook). This
 * base's abstract surface is sufficient for all of them.
 *
 * `USymbolSimpleAbstract` is deliberately NOT ported in this task
 * (reported): its `asSmall` body calls `UGraphicStencil.create(ug,
 * dimLabel)` — a whole clip/stencil subsystem (klimt/drawing/
 * UGraphicStencil.java) with no port in this codebase and no other
 * caller anywhere in this task's write-set. Porting it here would drag
 * in an unrelated subsystem for a class this task's own acceptance
 * criteria never exercises. This base class fully supports layering
 * `USymbolSimpleAbstract` on top of it later — deferred to whichever
 * T5–T9 task first ports an Actor/Interface/Person-family symbol.
 */
export abstract class USymbol {
  abstract getSNames(): readonly SName[];

  abstract asSmall(
    name: TextBlock,
    label: TextBlock,
    stereotype: TextBlock,
    symbolContext: SymbolContext,
    stereoAlignment: HorizontalAlignment,
  ): TextBlock;

  abstract asBig(
    label: TextBlock,
    labelAlignment: HorizontalAlignment,
    stereotype: TextBlock,
    width: number,
    height: number,
    symbolContext: SymbolContext,
    stereoAlignment: HorizontalAlignment,
  ): TextBlock;

  suppHeightBecauseOfShape(): number {
    return 0;
  }

  suppWidthBecauseOfShape(): number {
    return 0;
  }
}

/**
 * Margin — the (x1, x2, y1, y2) padding a `USymbol`'s `asSmall`/`asBig`
 * `TextBlock` wraps its inner content in (e.g. `USymbolRectangle
 * .getMargin()`: `new Margin(10, 10, 10, 10)`).
 *
 * Upstream: `USymbol.Margin` — `static class Margin` nested inside
 * `USymbol.java`, package-private. TS has no direct analog of a
 * non-static-outer nested class carrying its own instance state; ported
 * here as a top-level class (name path `USymbol/Margin` preserved in
 * spirit via this module's co-location) rather than invented namespace
 * nesting that no upstream caller needs.
 *
 * Ported: the constructor, `getWidth`/`getHeight`, `addDimension`,
 * `getX1`/`getY1`. `getX2`/`getY2` are NOT on upstream's `Margin` either
 * (only `getX1`/`getY1` are public upstream) — not an omission.
 */
export class Margin {
  private readonly x1: number;
  private readonly x2: number;
  private readonly y1: number;
  private readonly y2: number;

  constructor(x1: number, x2: number, y1: number, y2: number) {
    this.x1 = x1;
    this.x2 = x2;
    this.y1 = y1;
    this.y2 = y2;
  }

  getWidth(): number {
    return this.x1 + this.x2;
  }

  getHeight(): number {
    return this.y1 + this.y2;
  }

  addDimension(dim: XDimension2D): XDimension2D {
    return new XDimension2D(dim.getWidth() + this.x1 + this.x2, dim.getHeight() + this.y1 + this.y2);
  }

  getX1(): number {
    return this.x1;
  }

  getY1(): number {
    return this.y1;
  }
}

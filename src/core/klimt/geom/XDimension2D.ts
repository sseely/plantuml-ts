import type { UTranslate } from '../UTranslate.js';

/**
 * XDimension2D — an immutable, non-negative (width, height) pair.
 * `TextBlock#calculateDimension` (klimt/shape/TextBlock.java) returns one
 * of these; the `merge*` methods stack/lay-out several dimensions the
 * way a `USymbol`'s `asSmall`/`asBig` `TextBlock` composes its
 * stereotype/label/icon sub-blocks (see `USymbolRectangle.java`,
 * `USymbolSimpleAbstract.java`).
 *
 * Upstream: klimt/geom/XDimension2D.java. Ported: the constructor (incl.
 * its `width < 0` / `height < 0` / `NaN` guards), `getWidth`/`getHeight`,
 * `delta` (both arities), `withWidth`, `applyTranslate`, `mergeTB` (both
 * arities), `mergeLR`, `atLeast`, the static `mergeLayoutT12B3`, and the
 * static `max`.
 *
 * NOT ported: `fromDimension(java.awt.Dimension)` — `java.awt.Dimension`
 * has no TS analog and no caller in this port; upstream itself guards it
 * behind `// ::comment when __HAXE__` (already conditionally excluded on
 * at least one other upstream target).
 */
export class XDimension2D {
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number) {
    if (width < 0) throw new Error(`XDimension2D: width=${width}`);
    if (height < 0) throw new Error(`XDimension2D: height=${height}`);
    if (Number.isNaN(width) || Number.isNaN(height)) {
      throw new Error(`XDimension2D: width=${width} height=${height}`);
    }
    this.width = width;
    this.height = height;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  delta(deltaWidth: number, deltaHeight: number = deltaWidth): XDimension2D {
    if (deltaWidth === 0 && deltaHeight === 0) return this;
    return new XDimension2D(this.getWidth() + deltaWidth, this.getHeight() + deltaHeight);
  }

  withWidth(newWidth: number): XDimension2D {
    return new XDimension2D(newWidth, this.height);
  }

  applyTranslate(translate: UTranslate): XDimension2D {
    return new XDimension2D(this.width + translate.getDx(), this.height + translate.getDy());
  }

  /** Stacks `this` above `bottom` (2-arg upstream overload). */
  mergeTB(bottom: XDimension2D): XDimension2D;
  /** Stacks `this`, `b`, `c` top-to-bottom (3-arg upstream overload). */
  mergeTB(b: XDimension2D, c: XDimension2D): XDimension2D;
  mergeTB(b: XDimension2D, c?: XDimension2D): XDimension2D {
    if (c === undefined) {
      return new XDimension2D(Math.max(this.getWidth(), b.getWidth()), this.getHeight() + b.getHeight());
    }
    const width = Math.max(this.getWidth(), b.getWidth(), c.getWidth());
    const height = this.getHeight() + b.getHeight() + c.getHeight();
    return new XDimension2D(width, height);
  }

  mergeLR(right: XDimension2D): XDimension2D {
    const height = Math.max(this.getHeight(), right.getHeight());
    const width = this.getWidth() + right.getWidth();
    return new XDimension2D(width, height);
  }

  atLeast(minWidth: number, minHeight: number): XDimension2D {
    let h = this.getHeight();
    let w = this.getWidth();
    if (w > minWidth && h > minHeight) return this;
    if (h < minHeight) h = minHeight;
    if (w < minWidth) w = minWidth;
    return new XDimension2D(w, h);
  }

  /** Stacks three dimensions top-to-bottom: `top1`/`top2` side by side in
   * width, `bottom` below both — the layout `USymbolSimpleAbstract` uses
   * for stereotype/icon/label. */
  static mergeLayoutT12B3(top1: XDimension2D, top2: XDimension2D, bottom: XDimension2D): XDimension2D {
    const width = Math.max(top1.getWidth(), top2.getWidth(), bottom.getWidth());
    const height = top1.getHeight() + top2.getHeight() + bottom.getHeight();
    return new XDimension2D(width, height);
  }

  static max(dim1: XDimension2D, dim2: XDimension2D): XDimension2D {
    return dim1.atLeast(dim2.getWidth(), dim2.getHeight());
  }

  toString(): string {
    return `[${this.width},${this.height}]`;
  }
}

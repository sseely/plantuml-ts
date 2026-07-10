import type { UShape } from '../UShape.js';
import type { XDimension2D } from '../geom/XDimension2D.js';

/**
 * UEmpty — an invisible width x height placeholder shape, drawn purely to
 * pad a compositing consumer's bounding-box tracker (e.g.
 * `TextBlockMarged#drawU`'s leading `ug.draw(UEmpty.create(dim))`, several
 * `USymbol*#drawXxx`'s trailing pad-the-bbox call).
 *
 * Upstream: klimt/shape/UEmpty.java. Ported in full: the constructor
 * (incl. its `width === 0` guard), `create`, `getWidth`/`getHeight`.
 */
export class UEmpty implements UShape {
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number) {
    if (width === 0) throw new Error('UEmpty: width=0');
    this.width = width;
    this.height = height;
  }

  static create(dim: XDimension2D): UEmpty {
    return new UEmpty(dim.getWidth(), dim.getHeight());
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }
}

import type { TextBlock } from '../klimt/shape/TextBlock.js';
import type { UGraphic } from '../klimt/UGraphic.js';
import { UTranslate } from '../klimt/UTranslate.js';
import { Back } from '../klimt/Back.js';
import { Fore } from '../klimt/Fore.js';
import { UEllipse } from '../klimt/shape/UEllipse.js';
import type { StringBounder } from '../klimt/font/StringBounder.js';
import { XDimension2D } from '../klimt/geom/XDimension2D.js';
import type { Paint } from '../paint.js';

/**
 * CircleInterface2 — the small lollipop circle drawn for `interface`/
 * `circle`/`()` entities (`USymbolInterface`'s `getDrawing`).
 *
 * Upstream: svek/CircleInterface2.java. Ported in full: the constructor,
 * `drawU`, `calculateDimension`. Constants preserved exactly
 * (`margin=1`, `radius=8`).
 *
 * Paint seam (same substitution as `SymbolContext.ts`'s own doc
 * comment): upstream's `backgroundColor`/`foregroundColor` fields are
 * `HColor` (nullable); this port carries `Paint | null` at the same
 * positions. `null` applies the SVG `'none'` paint keyword via `Back`/
 * `Fore`, matching `HColors.none()`'s convention elsewhere in this port.
 */
export class CircleInterface2 implements TextBlock {
  private readonly margin = 1;
  private readonly radius = 8;

  private readonly backgroundColor: Paint | null;
  private readonly foregroundColor: Paint | null;
  private readonly deltaShadow: number;

  constructor(backgroundColor: Paint | null, foregroundColor: Paint | null, deltaShadow: number) {
    this.backgroundColor = backgroundColor;
    this.foregroundColor = foregroundColor;
    this.deltaShadow = deltaShadow;
  }

  drawU(ug: UGraphic): void {
    let x = 0;
    let y = 0;
    x += this.margin;
    y += this.margin;
    ug = ug.apply(new Back(this.backgroundColor ?? 'none')).apply(new Fore(this.foregroundColor ?? 'none'));
    const circle = UEllipse.build(this.radius * 2, this.radius * 2);
    circle.setDeltaShadow(this.deltaShadow);
    ug.apply(new UTranslate(x, y)).draw(circle);
  }

  calculateDimension(_stringBounder: StringBounder): XDimension2D {
    return new XDimension2D(this.radius * 2 + 2 * this.margin, this.radius * 2 + 2 * this.margin);
  }
}

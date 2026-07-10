import type { TextBlock } from '../klimt/shape/TextBlock.js';
import type { UGraphic } from '../klimt/UGraphic.js';
import { UTranslate } from '../klimt/UTranslate.js';
import { UEllipse } from '../klimt/shape/UEllipse.js';
import { ULine } from '../klimt/shape/ULine.js';
import type { StringBounder } from '../klimt/font/StringBounder.js';
import { XDimension2D } from '../klimt/geom/XDimension2D.js';
import type { SymbolContext } from '../decoration/symbol/SymbolContext.js';

/**
 * EntityDomain — the UML robustness-diagram "entity" icon: a circle with
 * a short horizontal underline.
 *
 * Upstream: svek/EntityDomain.java. Ported in full: the constructor,
 * `drawU`, `calculateDimension`. Constants preserved exactly
 * (`margin=4`, `radius=12`, `suppY=2` — T9 acceptance criterion 3).
 */
export class EntityDomain implements TextBlock {
  private readonly margin = 4;
  private readonly radius = 12;
  private readonly suppY = 2;

  private readonly symbolContext: SymbolContext;

  constructor(symbolContext: SymbolContext) {
    this.symbolContext = symbolContext;
  }

  drawU(ug: UGraphic): void {
    let x = 0;
    let y = 0;
    x += this.margin;
    y += this.margin;
    ug = this.symbolContext.apply(ug);
    const circle = UEllipse.build(this.radius * 2, this.radius * 2);
    circle.setDeltaShadow(this.symbolContext.getDeltaShadow());
    ug.apply(new UTranslate(x, y)).draw(circle);
    ug.apply(new UTranslate(x, y + 2 * this.radius + this.suppY)).draw(ULine.hline(2 * this.radius));
  }

  calculateDimension(_stringBounder: StringBounder): XDimension2D {
    return new XDimension2D(this.radius * 2 + 2 * this.margin, this.radius * 2 + 2 * this.margin);
  }
}

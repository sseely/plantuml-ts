import type { TextBlock } from '../klimt/shape/TextBlock.js';
import type { UGraphic } from '../klimt/UGraphic.js';
import { UTranslate } from '../klimt/UTranslate.js';
import { UStroke } from '../klimt/UStroke.js';
import { Back } from '../klimt/Back.js';
import { UEllipse } from '../klimt/shape/UEllipse.js';
import { UPolygon } from '../klimt/shape/UPolygon.js';
import type { StringBounder } from '../klimt/font/StringBounder.js';
import { XDimension2D } from '../klimt/geom/XDimension2D.js';
import type { SymbolContext } from '../decoration/symbol/SymbolContext.js';

/**
 * Control — the UML robustness-diagram "control" icon: a circle with a
 * small arrowhead-like wing polygon anchored on its right edge.
 *
 * Upstream: svek/Control.java. Ported in full: the constructor, `drawU`,
 * `calculateDimension`. Constants preserved exactly (`margin=4`,
 * `radius=12`, `xWing=6`, `yAperture=5`, `xContact=4` — T9 acceptance
 * criterion 3).
 *
 * Paint seam (T9 context note, journaled): upstream's `drawU` calls
 * `symbolContext.getForeColor().bg()` — converting the `Fashion`'s
 * foreground `HColor` into a background-fill change so the wing polygon
 * fills with the FOREGROUND color rather than the ambient background.
 * This port's `SymbolContext.getForeColor()` returns `Paint | null` (see
 * `SymbolContext.ts`'s own "Paint seam" doc comment), which has no
 * `.bg()` method — adapted here as `new Back(symbolContext.getForeColor()
 * ?? 'none')`, matching `Back.ts`'s documented `NONE_PAINT` substitute
 * for a null/absent color. No behavioral difference for any
 * constructible `SymbolContext`.
 */
export class Control implements TextBlock {
  private readonly margin = 4;
  private readonly radius = 12;

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
    ug = ug.apply(UStroke.simple());

    ug = ug.apply(new Back(this.symbolContext.getForeColor() ?? 'none'));
    const polygon = new UPolygon();
    polygon.addPoint(0, 0);
    const xWing = 6;
    const yAperture = 5;
    polygon.addPoint(xWing, -yAperture);
    const xContact = 4;
    polygon.addPoint(xContact, 0);
    polygon.addPoint(xWing, yAperture);
    polygon.addPoint(0, 0);

    ug.apply(new UTranslate(x + this.radius - xContact, y)).draw(polygon);
  }

  calculateDimension(_stringBounder: StringBounder): XDimension2D {
    return new XDimension2D(this.radius * 2 + 2 * this.margin, this.radius * 2 + 2 * this.margin);
  }
}

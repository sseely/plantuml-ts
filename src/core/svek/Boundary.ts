import type { TextBlock } from '../klimt/shape/TextBlock.js';
import type { UGraphic } from '../klimt/UGraphic.js';
import { UTranslate } from '../klimt/UTranslate.js';
import { Back } from '../klimt/Back.js';
import { UEllipse } from '../klimt/shape/UEllipse.js';
import { UPath } from '../klimt/shape/UPath.js';
import type { StringBounder } from '../klimt/font/StringBounder.js';
import { XDimension2D } from '../klimt/geom/XDimension2D.js';
import type { SymbolContext } from '../decoration/symbol/SymbolContext.js';

/**
 * Boundary — the UML robustness-diagram "boundary" icon: a circle with a
 * short horizontal tick connecting it to a vertical bar on its left.
 *
 * Upstream: svek/Boundary.java. Ported in full: the constructor,
 * `drawU`, `calculateDimension`. Constants preserved exactly
 * (`margin=4`, `radius=12`, `left=17` — T9 acceptance criterion 3).
 *
 * `path1` (preserved dead code, reported): upstream declares and mutates
 * a local `path1` (`moveTo(0,0)`/`lineTo(0,radius*2)`/`setDeltaShadow`)
 * that is never drawn — dead code in Boundary.java itself, predating
 * this port. Per this project's porting discipline ("preserve upstream
 * behavior... do not refactor while porting"), it is kept verbatim
 * (prefixed `_path1` to satisfy this project's `varsIgnorePattern: '^_'`
 * eslint convention for intentionally-unused bindings) rather than
 * silently dropped.
 */
export class Boundary implements TextBlock {
  private readonly margin = 4;
  private readonly radius = 12;
  private readonly left = 17;

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

    const _path1 = UPath.none();
    _path1.moveTo(0, 0);
    _path1.lineTo(0, this.radius * 2);
    _path1.setDeltaShadow(this.symbolContext.getDeltaShadow());

    const path = UPath.none();
    path.moveTo(0, 0);
    path.lineTo(0, this.radius * 2);
    path.moveTo(0, this.radius);
    path.lineTo(this.left, this.radius);
    path.setDeltaShadow(this.symbolContext.getDeltaShadow());
    ug.apply(new UTranslate(x, y)).apply(new Back('none')).draw(path);

    ug.apply(new UTranslate(x + this.left, y)).draw(circle);
  }

  calculateDimension(_stringBounder: StringBounder): XDimension2D {
    return new XDimension2D(this.radius * 2 + this.left + 2 * this.margin, this.radius * 2 + 2 * this.margin);
  }
}

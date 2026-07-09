import type { TextBlock } from './TextBlock.js';
import type { UGraphic } from '../UGraphic.js';
import { UTranslate } from '../UTranslate.js';
import type { StringBounder } from '../font/StringBounder.js';
import { XDimension2D } from '../geom/XDimension2D.js';
import type { UEllipse } from './UEllipse.js';
import { Footprint } from '../../svek/image/Footprint.js';
import type { ContainingEllipse } from '../../svek/image/ContainingEllipse.js';
import { TextBlockMemoized } from './TextBlockMemoized.js';

const ALPHA_MIN = 0.2;
const ALPHA_MAX = 0.8;
const ELLIPSE_PADDING = 6;

/**
 * TextBlockInEllipse — draws a `TextBlock` centered inside the smallest
 * ellipse that contains it (padded 6px), the usecase-diagram "actor in
 * an oval" / "usecase" shape. The ellipse's aspect ratio is derived from
 * the wrapped text's own measured aspect ratio, clamped to [0.2, 0.8].
 *
 * Upstream: klimt/shape/TextBlockInEllipse.java. Ported in full: the
 * constructor (alpha derivation + `Footprint`/`ContainingEllipse`
 * construction), `getUEllipse`, `drawU`, `calculateDimensionSlow`,
 * `setDeltaShadow`.
 */
export class TextBlockInEllipse extends TextBlockMemoized {
  private readonly text: TextBlock;
  private readonly ellipse: ContainingEllipse;

  constructor(text: TextBlock, stringBounder: StringBounder) {
    super();
    this.text = text;
    const textDim = text.calculateDimension(stringBounder);
    let alpha = textDim.getHeight() / textDim.getWidth();
    if (alpha < ALPHA_MIN) alpha = ALPHA_MIN;
    else if (alpha > ALPHA_MAX) alpha = ALPHA_MAX;
    const footprint = new Footprint(stringBounder);
    this.ellipse = footprint.getEllipse(text, alpha);
  }

  getUEllipse(): UEllipse {
    return this.ellipse.asUEllipse().bigger(ELLIPSE_PADDING);
  }

  drawU(ug: UGraphic): void {
    const sh = this.getUEllipse();
    const center = this.ellipse.getCenter();
    const dx = sh.getWidth() / 2 - center.getX();
    const dy = sh.getHeight() / 2 - center.getY();
    ug.draw(sh);
    this.text.drawU(ug.apply(new UTranslate(dx, dy - 2)));
  }

  protected calculateDimensionSlow(_stringBounder: StringBounder): XDimension2D {
    const dim = this.getUEllipse().getDimension();
    return new XDimension2D(dim.width, dim.height);
  }

  setDeltaShadow(deltaShadow: number): void {
    this.ellipse.setDeltaShadow(deltaShadow);
  }
}

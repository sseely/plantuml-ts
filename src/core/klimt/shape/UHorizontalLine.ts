import type { UShape } from '../UShape.js';
import { UStroke } from '../UStroke.js';
import { UTranslate } from '../UTranslate.js';
import type { Stencil } from '../creole/Stencil.js';
import type { UGraphic } from '../UGraphic.js';
import type { StringBounder } from '../font/StringBounder.js';
import type { TextBlock } from './TextBlock.js';
import { ULine } from './ULine.js';

/**
 * UHorizontalLine — an infinite (stencil-clipped) horizontal rule, with
 * an optional centered title (e.g. a Creole `--title--` separator). The
 * shape itself carries no coordinates; `Stencil.getStartingX/getEndingX`
 * (supplied by whichever `UGraphic` intercepts it — see
 * `UGraphicStencil`/`AbstractUGraphicHorizontalLine`) supplies the
 * left/right clearance at draw time.
 *
 * Upstream: klimt/shape/UHorizontalLine.java. Ported: both `infinite`
 * factories, `isDouble`, `drawLineInternal` (+ its three private
 * `Stencil`-wrapper helpers `addSkip`/`firstHalf`/`secondHalf`),
 * `drawHLine`/`drawSimpleHline`, `drawTitleInternal`, `drawMe`,
 * `getStroke`.
 */
interface UHorizontalLineFields {
  readonly defaultThickness: number;
  readonly skipAtStart: number;
  readonly skipAtEnd: number;
  readonly title: TextBlock | null;
  readonly blankTitle: boolean;
  readonly style: string;
}

export class UHorizontalLine implements UShape {
  private readonly f: UHorizontalLineFields;

  // Mechanical adaptation (complexity-hook accommodation, per project
  // convention -- see `URectangle.ts`'s identical `URectangleFields`
  // collapse): upstream's private 6-arg constructor collapses to a
  // single fields object here to stay under this project's per-function
  // param budget.
  private constructor(fields: UHorizontalLineFields) {
    this.f = fields;
  }

  static infinite(
    defaultThickness: number,
    skipAtStart: number,
    skipAtEnd: number,
    style: string,
    title: TextBlock | null = null,
  ): UHorizontalLine {
    return new UHorizontalLine({ defaultThickness, skipAtStart, skipAtEnd, title, blankTitle: false, style });
  }

  isDouble(): boolean {
    return this.f.style === '=';
  }

  private addSkip(stencil: Stencil): Stencil {
    const skipAtStart = this.f.skipAtStart;
    const skipAtEnd = this.f.skipAtEnd;
    return {
      getStartingX: (sb: StringBounder, y: number): number => stencil.getStartingX(sb, y) + skipAtStart,
      getEndingX: (sb: StringBounder, y: number): number => stencil.getEndingX(sb, y) - skipAtEnd,
    };
  }

  private static firstHalf(stencil: Stencil, widthTitle: number): Stencil {
    return {
      getStartingX: (sb: StringBounder, y: number): number => stencil.getStartingX(sb, y),
      getEndingX: (sb: StringBounder, y: number): number => {
        const start = stencil.getStartingX(sb, y);
        const end = stencil.getEndingX(sb, y);
        const len = (end - start - widthTitle) / 2;
        return start + len;
      },
    };
  }

  private static secondHalf(stencil: Stencil, widthTitle: number): Stencil {
    return {
      getStartingX: (sb: StringBounder, y: number): number => {
        const start = stencil.getStartingX(sb, y);
        const end = stencil.getEndingX(sb, y);
        const len = (end - start - widthTitle) / 2;
        return end - len;
      },
      getEndingX: (sb: StringBounder, y: number): number => stencil.getEndingX(sb, y),
    };
  }

  private static drawSimpleHline(ug: UGraphic, stencil: Stencil, y: number): void {
    const stringBounder = ug.getStringBounder();
    const startingX = stencil.getStartingX(stringBounder, y);
    const endingX = stencil.getEndingX(stringBounder, y);
    ug.apply(new UTranslate(startingX, y)).draw(ULine.hline(endingX - startingX));
  }

  private drawHLine(stencil: Stencil, y: number, ug: UGraphic): void {
    UHorizontalLine.drawSimpleHline(ug, stencil, y);
    if (this.f.style === '=') UHorizontalLine.drawSimpleHline(ug, stencil, y + 2);
  }

  drawLineInternal(ug: UGraphic, stencilArg: Stencil, y: number, defaultStroke: UStroke): void {
    const stencil = this.addSkip(stencilArg);
    const strokeToUse = this.f.style === '\0' ? defaultStroke : this.getStroke();
    const ugStroke = ug.apply(strokeToUse);
    if (this.f.title === null) {
      this.drawHLine(stencil, y, ugStroke);
      return;
    }
    const dimTitle = this.f.title.calculateDimension(ug.getStringBounder());
    this.drawHLine(UHorizontalLine.firstHalf(stencil, dimTitle.getWidth()), y, ugStroke);
    const startingX = stencil.getStartingX(ug.getStringBounder(), y);
    const endingX = stencil.getEndingX(ug.getStringBounder(), y);
    this.drawTitleInternal(ug, startingX, endingX, y, false);
    this.drawHLine(UHorizontalLine.secondHalf(stencil, dimTitle.getWidth()), y, ugStroke);
  }

  drawTitleInternal(ug: UGraphic, startingX: number, endingX: number, y: number, _clearArea: boolean): void {
    if (this.f.title === null || this.f.blankTitle) return;
    const widthToUse = endingX - startingX;
    const dimTitle = this.f.title.calculateDimension(ug.getStringBounder());
    const space = (widthToUse - dimTitle.getWidth()) / 2;
    const x1 = startingX + space;
    const y1 = y - dimTitle.getHeight() / 2 - 0.5;
    this.f.title.drawU(ug.apply(new UTranslate(x1, y1)));
    // `clearArea` (upstream: a pre-clear `URectangle` fill via
    // `ug.apply(getStroke()).draw(URectangle.build(dimTitle))`) is
    // dropped: no caller in this port ever passes `true` — every
    // `drawTitleInternal` call site here (`drawLineInternal`) hard-codes
    // `false`, matching upstream's own only call site.
  }

  drawMe(ug: UGraphic): void {
    ug.draw(this);
  }

  getStroke(): UStroke {
    if (this.f.style === '\0') throw new Error('UHorizontalLine.getStroke: style is unset (\\0)');
    if (this.f.style === '=') return UStroke.simple();
    if (this.f.style === '.') return new UStroke(1, 2, 1);
    if (this.f.style === '-') return UStroke.simple();
    return UStroke.withThickness(this.f.defaultThickness);
  }
}

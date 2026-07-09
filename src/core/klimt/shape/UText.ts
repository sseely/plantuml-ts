import type { UShape } from '../UShape.js';

/**
 * FontStyle — the seven style flags a `FontConfiguration` can carry.
 *
 * Upstream: klimt/font/FontStyle.java (a Java `enum`: PLAIN, ITALIC,
 * BOLD, UNDERLINE, STRIKE, WAVE, BACKCOLOR). Ported as an as-const
 * string-union object per project convention (no `const enum`). Only
 * the enum's identity/name is ported here — `starters(isCreolePure)`
 * belongs to the creole markup parser, out of scope for a shape.
 */
export const FontStyle = {
  PLAIN: 'PLAIN',
  ITALIC: 'ITALIC',
  BOLD: 'BOLD',
  UNDERLINE: 'UNDERLINE',
  STRIKE: 'STRIKE',
  WAVE: 'WAVE',
  BACKCOLOR: 'BACKCOLOR',
} as const;
export type FontStyle = (typeof FontStyle)[keyof typeof FontStyle];

/**
 * FontConfiguration — the minimal font-rendering surface
 * `DriverTextSvg.java` actually reads off `UText#getFontConfiguration`:
 * family, size, style flags, and (foreground) color.
 *
 * Upstream: klimt/font/FontConfiguration.java is a much larger class
 * (underline stroke object, extended/back color, `UFontFace`
 * weight/style, attribute map, `containsStyle`, `getFont(): UFont`
 * with its own `getFamily`/`getSize`/`getSize2D`/`createTextLayout`
 * surface, ...) — full class deferred, out of scope for a shape task.
 * `DriverTextSvg.draw` additionally reads
 * `getUnderlineStroke().getThickness()`, `getExtendedColor()`, and
 * `getFontFace().getCssWeight()`/`isItalic()` for the underline/strike/
 * backcolor/bold-weight rendering decisions; those are DRIVER-side
 * concerns layered on top of the style flags and will be ported
 * alongside `DriverTextSvg` itself (the SVG-driver task), not here.
 *
 * `color` is `null` to mean upstream's `HColor#isTransparent()`
 * (`DriverTextSvg` skips drawing entirely in that case) — `HColor`
 * itself is not ported; a resolved SVG-ready color string stands in,
 * matching the `Paint`-instead-of-`HColor` adaptation already made in
 * `UParam.ts` (T2).
 */
export interface FontConfiguration {
  readonly family: string;
  readonly size: number;
  readonly color: string | null;
  readonly styles: ReadonlySet<FontStyle>;
}

// Upstream constants from jaws/Jaws.java — UText's constructor replaces
// these two creole line-break markers with their visible glyphs before
// storing the text. Ported as local literals (the full Jaws class is a
// creole-preprocessor subsystem, out of scope for a shape).
const BLOCK_E1_NEWLINE = '';
const BLOCK_E1_BREAKLINE = '';

function normalizeText(text: string): string {
  return text.split(BLOCK_E1_NEWLINE).join('↵').split(BLOCK_E1_BREAKLINE).join('⏎');
}

/**
 * UText — a string plus its font configuration and orientation, the
 * shape `DriverTextSvg.java` serializes to an SVG `<text>` element.
 *
 * Upstream: klimt/shape/UText.java. Ported: `build`, `withOrientation`,
 * the plain accessors, and `toString`, plus the Jaws newline-marker
 * substitution upstream's constructor performs (see `normalizeText`
 * above).
 *
 * Deferred (out of D3' scope, reported):
 * - `getDescent(stringBounder)` / `calculateDimension(stringBounder)` /
 *   `createTextLayout()` — all three require `StringBounder` (text
 *   measurement) or AWT's `TextLayout`; measurement is a separate
 *   subsystem from shape data, not ported here.
 */
export class UText implements UShape {
  private readonly text: string;
  private readonly font: FontConfiguration;
  private readonly orientation: number;

  private constructor(text: string, font: FontConfiguration, orientation: number) {
    this.text = normalizeText(text);
    this.font = font;
    this.orientation = orientation;
  }

  static build(text: string, font: FontConfiguration): UText {
    return new UText(text, font, 0);
  }

  withOrientation(orientation: number): UText {
    return new UText(this.text, this.font, orientation);
  }

  getText(): string {
    return this.text;
  }

  getFontConfiguration(): FontConfiguration {
    return this.font;
  }

  getOrientation(): number {
    return this.orientation;
  }

  toString(): string {
    return `UText[${this.text}]`;
  }
}

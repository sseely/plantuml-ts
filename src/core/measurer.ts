/**
 * String measurement implementations for plantuml-js.
 *
 * All layout engines receive a StringMeasurer via dependency injection so that
 * text dimension calculation can be swapped between environments (browser,
 * Node/test, fixed-width). Nothing in this file imports from other plantuml-js
 * modules — it is a leaf dependency.
 */

export interface FontSpec {
  family: string;
  size: number;
  weight?: 'normal' | 'bold';
  style?: 'normal' | 'italic';
}

export interface StringMeasurer {
  measure(text: string, font: FontSpec): { width: number; height: number };
}

// ---------------------------------------------------------------------------
// Per-glyph width table
// ---------------------------------------------------------------------------
//
// Ported from StringBounderFixed.java (PlantUML upstream).
// WIDTH[i] is the raw pixel advance width at 12px reference size for the
// character with code point (i + 32). Covers chars 32–127 (space through ~).
// Scale to actual size with factor = fontSize / 12.0.
//
// Characters outside 32–127 fall back to 13 px at 12px reference.

const WIDTH: readonly number[] = [
  3.3, 3.3, 4.3, 6.7, 6.7, 10.7, 8.0, 2.3, 4.0, 4.0, 4.7, 7.0, 3.3, 4.0, 3.3, 3.3,
  6.7, 6.7, 6.7, 6.7, 6.7, 6.7, 6.7, 6.7, 6.7, 6.7, 3.3, 3.3, 7.0, 7.0, 7.0, 6.7,
  12.2, 8.0, 8.0, 8.7, 8.7, 8.0, 7.3, 9.3, 8.7, 3.3, 6.0, 8.0, 6.7, 10.0, 8.7, 9.3,
  8.0, 9.3, 8.7, 8.0, 7.3, 8.7, 8.0, 11.3, 8.0, 8.0, 7.3, 3.3, 3.3, 3.3, 5.6, 6.7,
  4.0, 6.7, 6.7, 6.0, 6.7, 6.7, 3.3, 6.7, 6.7, 2.7, 2.7, 6.0, 2.7, 10.0, 6.7, 6.7,
  6.7, 6.7, 4.0, 6.0, 3.3, 6.7, 6.0, 8.7, 6.0, 6.0, 6.0, 4.0, 3.1, 4.0, 7.0, 6.0,
];

/**
 * Returns the per-glyph advance width in pixels for a single character.
 *
 * Uses the 96-entry WIDTH table from StringBounderFixed.java (PlantUML).
 * Values are raw px at a 12px reference size, scaled by fontSize / 12.0.
 * Covers chars 32–127 (space through ~). Characters outside that range
 * fall back to 13 * (fontSize / 12.0). The fontName parameter is accepted
 * for API compatibility but is unused — there is a single table for all
 * font families.
 */
export function glyphWidth(char: string, _fontName: string, fontSize: number): number {
  const code = char.charCodeAt(0);
  const factor = fontSize / 12.0;
  if (code >= 32 && code <= 127) {
    return WIDTH[code - 32]! * factor;
  }
  return 13 * factor;
}

// ---------------------------------------------------------------------------
// FormulaMeasurer
// ---------------------------------------------------------------------------

/**
 * Approximates text dimensions using per-glyph width lookup tables.
 *
 * width  = sum of glyphWidth(ch, font.family, font.size) for each character
 * height = font.size  (matches StringBounderFixed.java calculateDimensionInternal)
 *
 * Covers printable ASCII U+0020–U+007E via the upstream WIDTH table.
 * Characters outside that range fall back to 13 * (size / 12.0). Bold and
 * italic variants use the same advance widths as regular — stroke weight does
 * not meaningfully alter character advance width at typical diagram font sizes.
 *
 * Safe in every environment (Node, jsdom, browser). No DOM access.
 */
export class FormulaMeasurer implements StringMeasurer {
  measure(text: string, font: FontSpec): { width: number; height: number } {
    let width = 0;
    for (const ch of text) {
      width += glyphWidth(ch, font.family, font.size);
    }
    return {
      width,
      height: font.size,
    };
  }
}

// ---------------------------------------------------------------------------
// CanvasMeasurer
// ---------------------------------------------------------------------------

/**
 * Measures text using CanvasRenderingContext2D.measureText when available.
 *
 * Falls back to FormulaMeasurer if:
 *  - document is not defined (pure Node environment)
 *  - canvas element creation fails
 *  - getContext('2d') returns null (jsdom default)
 *  - measureText returns 0 (jsdom canvas stub)
 *
 * The canvas element is created lazily on the first call and reused.
 *
 * An optional context factory may be supplied (used in tests to inject a
 * mock context without modifying DOM access).
 */
export class CanvasMeasurer implements StringMeasurer {
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly fallback = new FormulaMeasurer();
  private readonly contextFactory: (() => CanvasRenderingContext2D | null) | undefined;

  constructor(contextFactory?: () => CanvasRenderingContext2D | null) {
    this.contextFactory = contextFactory;
  }

  private getContext(): CanvasRenderingContext2D | null {
    if (this.ctx !== null) {
      return this.ctx;
    }
    if (this.contextFactory !== undefined) {
      this.ctx = this.contextFactory();
      return this.ctx;
    }
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx !== null) {
        this.ctx = ctx;
        return ctx;
      }
    } catch {
      // document undefined or canvas creation failed — fall through
    }
    return null;
  }

  private buildFontString(font: FontSpec): string {
    const style = font.style ?? 'normal';
    const weight = font.weight ?? 'normal';
    return `${style} ${weight} ${font.size}px ${font.family}`;
  }

  measure(text: string, font: FontSpec): { width: number; height: number } {
    const ctx = this.getContext();

    if (ctx === null) {
      return this.fallback.measure(text, font);
    }

    try {
      ctx.font = this.buildFontString(font);
      const metrics = ctx.measureText(text);
      // jsdom's canvas stub returns 0 for measureText — treat as fallback
      if (metrics.width === 0 && text.length > 0) {
        return this.fallback.measure(text, font);
      }
      return {
        width: metrics.width,
        height: font.size,
      };
    } catch {
      return this.fallback.measure(text, font);
    }
  }
}

// ---------------------------------------------------------------------------
// FixedMeasurer
// ---------------------------------------------------------------------------

/**
 * Every character has the same fixed width; line height is constant.
 *
 * Designed for deterministic testing where exact pixel values matter. Font
 * properties are intentionally ignored.
 */
export class FixedMeasurer implements StringMeasurer {
  constructor(
    private readonly charWidth: number,
    private readonly lineHeight: number,
  ) {}

  measure(text: string, _font: FontSpec): { width: number; height: number } {
    return {
      width: text.length * this.charWidth,
      height: this.lineHeight,
    };
  }
}

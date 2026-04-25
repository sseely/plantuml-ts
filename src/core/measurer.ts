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
// Per-glyph width tables
// ---------------------------------------------------------------------------
//
// Widths are expressed as a fraction of fontSize (em units) for each
// printable ASCII character U+0020–U+007E.
//
// Source: standard font metrics for Arial/Helvetica and DejaVu Sans at 14px,
// normalised to em fractions (divide measured px by fontSize).

/** Arial / Helvetica per-glyph em-fraction widths for printable ASCII. */
const ARIAL_WIDTHS: Readonly<Record<string, number>> = {
  ' ': 0.278,
  '!': 0.278,
  '"': 0.355,
  '#': 0.556,
  '$': 0.556,
  '%': 0.889,
  '&': 0.667,
  "'": 0.191,
  '(': 0.333,
  ')': 0.333,
  '*': 0.389,
  '+': 0.584,
  ',': 0.278,
  '-': 0.333,
  '.': 0.278,
  '/': 0.278,
  '0': 0.556,
  '1': 0.556,
  '2': 0.556,
  '3': 0.556,
  '4': 0.556,
  '5': 0.556,
  '6': 0.556,
  '7': 0.556,
  '8': 0.556,
  '9': 0.556,
  ':': 0.278,
  ';': 0.278,
  '<': 0.584,
  '=': 0.584,
  '>': 0.584,
  '?': 0.556,
  '@': 1.015,
  'A': 0.667,
  'B': 0.667,
  'C': 0.722,
  'D': 0.722,
  'E': 0.667,
  'F': 0.611,
  'G': 0.778,
  'H': 0.722,
  'I': 0.278,
  'J': 0.500,
  'K': 0.667,
  'L': 0.556,
  'M': 0.833,
  'N': 0.722,
  'O': 0.778,
  'P': 0.667,
  'Q': 0.778,
  'R': 0.722,
  'S': 0.667,
  'T': 0.611,
  'U': 0.722,
  'V': 0.667,
  'W': 0.944,
  'X': 0.667,
  'Y': 0.667,
  'Z': 0.611,
  '[': 0.278,
  '\\': 0.278,
  ']': 0.278,
  '^': 0.469,
  '_': 0.556,
  '`': 0.333,
  'a': 0.556,
  'b': 0.556,
  'c': 0.500,
  'd': 0.556,
  'e': 0.556,
  'f': 0.278,
  'g': 0.556,
  'h': 0.556,
  'i': 0.222,
  'j': 0.222,
  'k': 0.500,
  'l': 0.222,
  'm': 0.833,
  'n': 0.556,
  'o': 0.556,
  'p': 0.556,
  'q': 0.556,
  'r': 0.333,
  's': 0.500,
  't': 0.278,
  'u': 0.556,
  'v': 0.500,
  'w': 0.722,
  'x': 0.500,
  'y': 0.500,
  'z': 0.500,
  '{': 0.334,
  '|': 0.260,
  '}': 0.334,
  '~': 0.584,
} as const;

/**
 * DejaVu Sans per-glyph em-fraction widths for printable ASCII.
 *
 * DejaVu Sans is slightly wider than Arial overall; values sourced from
 * DejaVu Sans 2.37 font metrics at 14px reference size.
 */
const DEJAVU_SANS_WIDTHS: Readonly<Record<string, number>> = {
  ' ': 0.318,
  '!': 0.355,
  '"': 0.450,
  '#': 0.636,
  '$': 0.636,
  '%': 1.022,
  '&': 0.752,
  "'": 0.259,
  '(': 0.386,
  ')': 0.386,
  '*': 0.444,
  '+': 0.666,
  ',': 0.318,
  '-': 0.381,
  '.': 0.318,
  '/': 0.355,
  '0': 0.636,
  '1': 0.636,
  '2': 0.636,
  '3': 0.636,
  '4': 0.636,
  '5': 0.636,
  '6': 0.636,
  '7': 0.636,
  '8': 0.636,
  '9': 0.636,
  ':': 0.354,
  ';': 0.354,
  '<': 0.666,
  '=': 0.666,
  '>': 0.666,
  '?': 0.574,
  '@': 1.091,
  'A': 0.682,
  'B': 0.682,
  'C': 0.693,
  'D': 0.749,
  'E': 0.625,
  'F': 0.583,
  'G': 0.769,
  'H': 0.755,
  'I': 0.296,
  'J': 0.423,
  'K': 0.694,
  'L': 0.583,
  'M': 0.869,
  'N': 0.757,
  'O': 0.806,
  'P': 0.649,
  'Q': 0.806,
  'R': 0.705,
  'S': 0.629,
  'T': 0.611,
  'U': 0.748,
  'V': 0.668,
  'W': 0.978,
  'X': 0.660,
  'Y': 0.635,
  'Z': 0.641,
  '[': 0.318,
  '\\': 0.355,
  ']': 0.318,
  '^': 0.636,
  '_': 0.636,
  '`': 0.381,
  'a': 0.593,
  'b': 0.645,
  'c': 0.548,
  'd': 0.645,
  'e': 0.597,
  'f': 0.358,
  'g': 0.645,
  'h': 0.647,
  'i': 0.272,
  'j': 0.272,
  'k': 0.605,
  'l': 0.272,
  'm': 0.959,
  'n': 0.647,
  'o': 0.626,
  'p': 0.645,
  'q': 0.645,
  'r': 0.398,
  's': 0.532,
  't': 0.398,
  'u': 0.647,
  'v': 0.580,
  'w': 0.838,
  'x': 0.587,
  'y': 0.580,
  'z': 0.534,
  '{': 0.381,
  '|': 0.299,
  '}': 0.381,
  '~': 0.666,
} as const;

/** Fallback em-fraction for any glyph not found in a width table. */
const FALLBACK_EM = 0.55;

/**
 * Normalises a font family string to a lookup key.
 * Strips leading/trailing whitespace and lowercases for comparison.
 */
function normaliseFontFamily(family: string): string {
  return family.trim().toLowerCase();
}

/**
 * Returns the per-glyph advance width in pixels for a single character.
 *
 * Selects the DejaVu Sans table when `fontName` (case-insensitive) is
 * "dejavu sans" or starts with "dejavu"; falls back to the Arial/Helvetica
 * table for all other font names. For glyphs not present in either table
 * the fallback of `fontSize × 0.55` is returned.
 */
export function glyphWidth(char: string, fontName: string, fontSize: number): number {
  const key = normaliseFontFamily(fontName);
  const table =
    key === 'dejavu sans' || key.startsWith('dejavu')
      ? DEJAVU_SANS_WIDTHS
      : ARIAL_WIDTHS;
  const em = Object.prototype.hasOwnProperty.call(table, char)
    ? (table[char] as number)
    : FALLBACK_EM;
  return fontSize * em;
}

// ---------------------------------------------------------------------------
// FormulaMeasurer
// ---------------------------------------------------------------------------

/**
 * Approximates text dimensions using per-glyph width lookup tables.
 *
 * width  = sum of glyphWidth(ch, font.family, font.size) for each character
 * height = size × 1.2
 *
 * Covers printable ASCII U+0020–U+007E for Arial/Helvetica and DejaVu Sans.
 * Any unmapped glyph falls back to `fontSize × 0.55`. Bold and italic
 * variants use the same advance widths as regular — stroke weight does not
 * meaningfully alter character advance width at typical diagram font sizes.
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
      height: font.size * 1.2,
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
        height: font.size * 1.2,
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

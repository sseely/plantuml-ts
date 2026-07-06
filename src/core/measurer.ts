/**
 * String measurement implementations for plantuml-ts.
 *
 * All layout engines receive a StringMeasurer via dependency injection so that
 * text dimension calculation can be swapped between environments (browser,
 * Node/test, fixed-width). Nothing in this file imports from other plantuml-ts
 * modules — it is a leaf dependency.
 */

import { SANS_SERIF_BLOCKS } from './measurer-width-table.data.js';

export interface FontSpec {
  family: string;
  size: number;
  weight?: 'normal' | 'bold';
  style?: 'normal' | 'italic';
}

export interface StringMeasurer {
  measure(text: string, font: FontSpec): { width: number; height: number };
  getDescent(font: FontSpec, text: string): number;
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

  getDescent(font: FontSpec, _text: string): number {
    return font.size / 4.5;
  }
}

// ---------------------------------------------------------------------------
// WidthTableMeasurer — deterministic, oracle-faithful (ADR-001)
// ---------------------------------------------------------------------------
//
// Faithful port of PlantUML's StringBounderFromWidthTable + UnicodeBlock,
// backed by the UnicodeFontWidthSansSerif.SANS_SERIF table
// (measurer-width-table.data.ts). This is the measurer PlantUML uses under
// FileFormat.SVG_DETERMINISTIC — running the oracle in that mode and measuring
// here through this class makes both sides size text IDENTICALLY, so DOT node
// width/height become assertable rather than tolerant. See
// planning/adr/ADR-001-text-measurement.md.

/** PlantUML's reference em for the SANS_SERIF table (widths are tenths of it). */
const WIDTH_TABLE_REFERENCE_SIZE = 16.0;

/** Port of UnicodeBlock: one Unicode block's per-codepoint widths (tenths of
 *  the 16pt em). Uniform when the raw block is length 1, direct when length
 *  256, else RLE (count,value) pairs — decoded on construction, exactly as
 *  UnicodeBlock does. */
class UnicodeBlock {
  private readonly data: readonly number[];

  constructor(raw: readonly number[]) {
    this.data =
      raw.length !== 1 && raw.length < 256 ? UnicodeBlock.decodeRle(raw) : raw;
  }

  private static decodeRle(raw: readonly number[]): number[] {
    const result: number[] = [];
    for (let i = 0; i + 1 < raw.length; i += 2) {
      const count = raw[i]! & 0xff;
      const value = raw[i + 1]!;
      for (let j = 0; j < count; j++) result.push(value);
    }
    return result;
  }

  /** getWidth(char): uniform blocks return their single value; otherwise the
   *  low byte indexes the 256-entry table. Result in points. */
  width(cp: number): number {
    if (this.data.length === 1) return (this.data[0]! & 0xff) / 10.0;
    return (this.data[cp & 0xff]! & 0xff) / 10.0;
  }
}

/**
 * Deterministic width-table measurer — the plantuml-ts analog of graphviz-ts's
 * EstimateTextMeasurer. Reproduces StringBounderFromWidthTable.calculateDimension:
 *
 *   width  = Σ charWidth(cp) × (size / 16),   charWidth via the SANS_SERIF table
 *   height = size
 *
 * Font-agnostic (upstream ignores the family in this mode and always uses the
 * one SANS_SERIF table). Codepoints ≥ 0xFFFF measure at 16 tenths; codepoints in
 * a block beyond the table (index ≥ 255) at 13 tenths — matching
 * StringBounderFromWidthTable.getCharWidth exactly.
 */
export class WidthTableMeasurer implements StringMeasurer {
  private readonly blocks: (UnicodeBlock | undefined)[];

  constructor(private readonly table: readonly (readonly number[])[] = SANS_SERIF_BLOCKS) {
    this.blocks = new Array<UnicodeBlock | undefined>(table.length);
  }

  private block(index: number): UnicodeBlock {
    const cached = this.blocks[index];
    if (cached !== undefined) return cached;
    const created = new UnicodeBlock(this.table[index]!);
    this.blocks[index] = created;
    return created;
  }

  /** getCharWidth(cp): tenths-of-em width for one codepoint, in points. */
  private charWidth(cp: number): number {
    if (cp >= 0xffff) return 16 / 10.0;
    const blockIndex = (cp >> 8) & 0xff;
    if (blockIndex >= this.table.length) return 13 / 10.0;
    return this.block(blockIndex).width(cp);
  }

  measure(text: string, font: FontSpec): { width: number; height: number } {
    const factor = font.size / WIDTH_TABLE_REFERENCE_SIZE;
    let width = 0;
    for (const ch of text) {
      width += this.charWidth(ch.codePointAt(0)!);
    }
    return { width: width * factor, height: font.size };
  }

  getDescent(font: FontSpec, _text: string): number {
    return font.size / 4.5;
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
 *
 * Results are cached in an 8192-entry LRU (insertion-order eviction) map,
 * keyed by font-string + text. Ported from StringBounderTeaVM.java.
 * The fallback (FormulaMeasurer) path is NOT cached.
 */
export class CanvasMeasurer implements StringMeasurer {
  private static readonly MAX_CACHE_SIZE = 8192;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly fallback = new FormulaMeasurer();
  private readonly contextFactory: (() => CanvasRenderingContext2D | null) | undefined;
  private readonly measureCache = new Map<string, { width: number; height: number }>();

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

  private buildCacheKey(font: FontSpec, text: string): string {
    return `${this.buildFontString(font)}|${text}`;
  }

  private evictIfNeeded(): void {
    if (this.measureCache.size >= CanvasMeasurer.MAX_CACHE_SIZE) {
      const oldest = this.measureCache.keys().next().value;
      if (oldest !== undefined) this.measureCache.delete(oldest);
    }
  }

  measure(text: string, font: FontSpec): { width: number; height: number } {
    const ctx = this.getContext();

    if (ctx === null) {
      return this.fallback.measure(text, font);
    }

    const cacheKey = this.buildCacheKey(font, text);
    const cached = this.measureCache.get(cacheKey);
    if (cached !== undefined) return cached;

    try {
      ctx.font = this.buildFontString(font);
      const metrics = ctx.measureText(text);
      // jsdom's canvas stub returns 0 for measureText — treat as fallback
      if (metrics.width === 0 && text.length > 0) {
        return this.fallback.measure(text, font);
      }
      const result = { width: metrics.width, height: font.size };
      this.evictIfNeeded();
      this.measureCache.set(cacheKey, result);
      return result;
    } catch {
      return this.fallback.measure(text, font);
    }
  }

  getDescent(font: FontSpec, _text: string): number {
    return font.size / 4.5;
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

  getDescent(_font: FontSpec, _text: string): number {
    return this.lineHeight / 4.5;
  }
}

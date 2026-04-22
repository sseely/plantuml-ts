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
// FormulaMeasurer
// ---------------------------------------------------------------------------

/**
 * Approximates text dimensions using a simple linear formula.
 *
 * width  = text.length × size × 0.55
 * height = size × 1.2
 *
 * Safe in every environment (Node, jsdom, browser). No DOM access.
 */
export class FormulaMeasurer implements StringMeasurer {
  measure(text: string, font: FontSpec): { width: number; height: number } {
    return {
      width: text.length * font.size * 0.55,
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

import { describe, it, expect, beforeEach } from 'vitest';
import {
  defaultTheme,
  darkTheme,
  resolveTheme,
} from '../../src/core/theme.js';
import type { Theme } from '../../src/core/theme.js';
import {
  FormulaMeasurer,
  CanvasMeasurer,
  FixedMeasurer,
} from '../../src/core/measurer.js';
import type { FontSpec } from '../../src/core/measurer.js';

// ---------------------------------------------------------------------------
// Theme tests
// ---------------------------------------------------------------------------

describe('defaultTheme', () => {
  it('has correct fontFamily', () => {
    expect(defaultTheme.fontFamily).toBe('Arial, sans-serif');
  });

  it('has correct fontSize', () => {
    expect(defaultTheme.fontSize).toBe(14);
  });

  it('has correct background color', () => {
    expect(defaultTheme.colors.background).toBe('#FFFFFF');
  });

  it('has correct border color', () => {
    expect(defaultTheme.colors.border).toBe('#181818');
  });

  it('has correct text color', () => {
    expect(defaultTheme.colors.text).toBe('#181818');
  });

  it('has correct arrow color', () => {
    expect(defaultTheme.colors.arrow).toBe('#181818');
  });

  it('has correct note color', () => {
    expect(defaultTheme.colors.note).toBe('#FEFECE');
  });

  it('has correct noteBackground color', () => {
    expect(defaultTheme.colors.noteBackground).toBe('#FEFECE');
  });

  it('has correct lifeline color', () => {
    expect(defaultTheme.colors.lifeline).toBe('#181818');
  });

  it('has correct activation color', () => {
    expect(defaultTheme.colors.activation).toBe('#DDDDDD');
  });

  it('has correct frame color', () => {
    expect(defaultTheme.colors.frame).toBe('#999999');
  });

  it('has correct divider color', () => {
    expect(defaultTheme.colors.divider).toBe('#999999');
  });

  it('has correct error color', () => {
    expect(defaultTheme.colors.error).toBe('#CC0000');
  });

  it('has correct participantPadding', () => {
    expect(defaultTheme.sequence.participantPadding).toBe(10);
  });

  it('has correct participantMinWidth', () => {
    expect(defaultTheme.sequence.participantMinWidth).toBe(80);
  });

  it('has correct messageSpacing', () => {
    expect(defaultTheme.sequence.messageSpacing).toBe(20);
  });

  it('has correct activationWidth', () => {
    expect(defaultTheme.sequence.activationWidth).toBe(10);
  });

  it('has correct noteMargin', () => {
    expect(defaultTheme.sequence.noteMargin).toBe(5);
  });

  it('has correct frameHeaderHeight', () => {
    expect(defaultTheme.sequence.frameHeaderHeight).toBe(20);
  });

  it('has correct lifelineExtension', () => {
    expect(defaultTheme.sequence.lifelineExtension).toBe(20);
  });
});

describe('darkTheme', () => {
  it('has a different background than defaultTheme', () => {
    expect(darkTheme.colors.background).not.toBe(defaultTheme.colors.background);
    expect(darkTheme.colors.background).toBe('#1E1E1E');
  });

  it('has correct border color', () => {
    expect(darkTheme.colors.border).toBe('#CCCCCC');
  });

  it('has correct text color', () => {
    expect(darkTheme.colors.text).toBe('#CCCCCC');
  });

  it('has correct arrow color', () => {
    expect(darkTheme.colors.arrow).toBe('#CCCCCC');
  });

  it('has correct note color', () => {
    expect(darkTheme.colors.note).toBe('#3C3C3C');
  });

  it('has correct noteBackground color', () => {
    expect(darkTheme.colors.noteBackground).toBe('#2D2D2D');
  });

  it('has correct lifeline color', () => {
    expect(darkTheme.colors.lifeline).toBe('#888888');
  });

  it('has correct activation color', () => {
    expect(darkTheme.colors.activation).toBe('#444444');
  });

  it('has correct frame color', () => {
    expect(darkTheme.colors.frame).toBe('#666666');
  });

  it('has correct divider color', () => {
    expect(darkTheme.colors.divider).toBe('#555555');
  });

  it('inherits same sequence values as defaultTheme', () => {
    expect(darkTheme.sequence).toEqual(defaultTheme.sequence);
  });

  it('inherits same fontFamily as defaultTheme', () => {
    expect(darkTheme.fontFamily).toBe(defaultTheme.fontFamily);
  });

  it('inherits same fontSize as defaultTheme', () => {
    expect(darkTheme.fontSize).toBe(defaultTheme.fontSize);
  });
});

describe('resolveTheme', () => {
  it('returns defaultTheme for "default" string', () => {
    expect(resolveTheme('default')).toEqual(defaultTheme);
  });

  it('returns darkTheme for "dark" string', () => {
    expect(resolveTheme('dark')).toEqual(darkTheme);
  });

  it('returns defaultTheme for "sketchy" string (Phase 1 alias)', () => {
    expect(resolveTheme('sketchy')).toEqual(defaultTheme);
  });

  it('returns defaultTheme for "monochrome" string (Phase 1 alias)', () => {
    expect(resolveTheme('monochrome')).toEqual(defaultTheme);
  });

  it('returns defaultTheme when called with no argument', () => {
    expect(resolveTheme()).toEqual(defaultTheme);
  });

  it('returns defaultTheme when called with undefined', () => {
    expect(resolveTheme(undefined)).toEqual(defaultTheme);
  });

  it('merges partial colors override into defaultTheme', () => {
    const result = resolveTheme({ colors: { background: '#000000' } } as Partial<Theme>);
    expect(result.colors.background).toBe('#000000');
    expect(result.colors.border).toBe(defaultTheme.colors.border);
    expect(result.colors.text).toBe(defaultTheme.colors.text);
  });

  it('merges partial fontSize override into defaultTheme', () => {
    const result = resolveTheme({ fontSize: 18 });
    expect(result.fontSize).toBe(18);
    expect(result.fontFamily).toBe(defaultTheme.fontFamily);
  });

  it('merges partial sequence override into defaultTheme', () => {
    const result = resolveTheme({ sequence: { messageSpacing: 30 } } as Partial<Theme>);
    expect(result.sequence.messageSpacing).toBe(30);
    expect(result.sequence.participantPadding).toBe(defaultTheme.sequence.participantPadding);
  });

  it('does not mutate defaultTheme when merging overrides', () => {
    resolveTheme({ colors: { background: '#FF0000' } } as Partial<Theme>);
    expect(defaultTheme.colors.background).toBe('#FFFFFF');
  });

  it('merges fontFamily override', () => {
    const result = resolveTheme({ fontFamily: 'Courier New' });
    expect(result.fontFamily).toBe('Courier New');
  });
});

// ---------------------------------------------------------------------------
// FormulaMeasurer tests
// ---------------------------------------------------------------------------

describe('FormulaMeasurer', () => {
  const measurer = new FormulaMeasurer();
  const baseFont: FontSpec = { family: 'Arial', size: 14 };

  it('returns positive width for non-empty text', () => {
    const { width } = measurer.measure('Hello', baseFont);
    expect(width).toBeGreaterThan(0);
  });

  it('returns positive height for any text', () => {
    const { height } = measurer.measure('Hello', baseFont);
    expect(height).toBeGreaterThan(0);
  });

  it('computes width as text.length * size * 0.55', () => {
    const text = 'Hello';
    const font: FontSpec = { family: 'Arial', size: 14 };
    const { width } = measurer.measure(text, font);
    expect(width).toBeCloseTo(text.length * 14 * 0.55, 5);
  });

  it('computes height as size * 1.2', () => {
    const font: FontSpec = { family: 'Arial', size: 14 };
    const { height } = measurer.measure('any text', font);
    expect(height).toBeCloseTo(14 * 1.2, 5);
  });

  it('returns zero width for empty string', () => {
    const { width } = measurer.measure('', baseFont);
    expect(width).toBe(0);
  });

  it('scales width with font size', () => {
    const small = measurer.measure('A', { family: 'Arial', size: 10 });
    const large = measurer.measure('A', { family: 'Arial', size: 20 });
    expect(large.width).toBeGreaterThan(small.width);
  });

  it('scales height with font size', () => {
    const small = measurer.measure('A', { family: 'Arial', size: 10 });
    const large = measurer.measure('A', { family: 'Arial', size: 20 });
    expect(large.height).toBeGreaterThan(small.height);
  });

  it('width scales linearly with text length', () => {
    const one = measurer.measure('A', baseFont);
    const five = measurer.measure('AAAAA', baseFont);
    expect(five.width).toBeCloseTo(one.width * 5, 5);
  });

  it('ignores font weight for width calculation', () => {
    const normal = measurer.measure('Hello', { ...baseFont, weight: 'normal' });
    const bold = measurer.measure('Hello', { ...baseFont, weight: 'bold' });
    expect(normal.width).toBe(bold.width);
  });

  it('ignores font style for width calculation', () => {
    const normal = measurer.measure('Hello', { ...baseFont, style: 'normal' });
    const italic = measurer.measure('Hello', { ...baseFont, style: 'italic' });
    expect(normal.width).toBe(italic.width);
  });
});

// ---------------------------------------------------------------------------
// FixedMeasurer tests
// ---------------------------------------------------------------------------

describe('FixedMeasurer', () => {
  const charWidth = 8;
  const lineHeight = 16;
  const measurer = new FixedMeasurer(charWidth, lineHeight);
  const font: FontSpec = { family: 'Arial', size: 14 };

  it('returns width = charCount * charWidth', () => {
    const { width } = measurer.measure('Hi', font);
    expect(width).toBe(2 * charWidth);
  });

  it('returns height = lineHeight', () => {
    const { height } = measurer.measure('Hi', font);
    expect(height).toBe(lineHeight);
  });

  it('returns zero width for empty string', () => {
    const { width } = measurer.measure('', font);
    expect(width).toBe(0);
  });

  it('ignores font family', () => {
    const courier = measurer.measure('AB', { family: 'Courier', size: 12 });
    const arial = measurer.measure('AB', { family: 'Arial', size: 14 });
    expect(courier.width).toBe(arial.width);
  });

  it('ignores font size', () => {
    const small = measurer.measure('AB', { family: 'Arial', size: 10 });
    const large = measurer.measure('AB', { family: 'Arial', size: 24 });
    expect(small.width).toBe(large.width);
    expect(small.height).toBe(large.height);
  });

  it('scales width with text length', () => {
    const one = measurer.measure('A', font);
    const ten = measurer.measure('AAAAAAAAAA', font);
    expect(ten.width).toBe(one.width * 10);
  });

  it('different instances with different charWidth produce different results', () => {
    const narrow = new FixedMeasurer(4, 16);
    const wide = new FixedMeasurer(12, 16);
    expect(wide.measure('Hello', font).width).toBeGreaterThan(
      narrow.measure('Hello', font).width,
    );
  });
});

// ---------------------------------------------------------------------------
// CanvasMeasurer tests
// ---------------------------------------------------------------------------

/**
 * Build a minimal mock CanvasRenderingContext2D that reports a fixed width
 * per character so tests are deterministic.
 */
function makeMockCtx(charWidth: number): CanvasRenderingContext2D {
  return {
    font: '',
    measureText: (text: string) => ({ width: text.length * charWidth } as TextMetrics),
  } as unknown as CanvasRenderingContext2D;
}

describe('CanvasMeasurer — jsdom fallback (no canvas support)', () => {
  let measurer: CanvasMeasurer;
  const font: FontSpec = { family: 'Arial', size: 14 };

  beforeEach(() => {
    measurer = new CanvasMeasurer();
  });

  it('returns positive width for non-empty text (falls back to formula)', () => {
    const { width } = measurer.measure('Hello', font);
    expect(width).toBeGreaterThan(0);
  });

  it('returns positive height for any text (falls back to formula)', () => {
    const { height } = measurer.measure('Hello', font);
    expect(height).toBeGreaterThan(0);
  });

  it('returns zero width for empty string (falls back to formula)', () => {
    const { width } = measurer.measure('', font);
    expect(width).toBe(0);
  });

  it('longer text has greater or equal width than shorter text', () => {
    const short = measurer.measure('Hi', font);
    const long = measurer.measure('Hello, World!', font);
    expect(long.width).toBeGreaterThanOrEqual(short.width);
  });

  it('does not throw for any font spec combination', () => {
    const boldItalic: FontSpec = {
      family: 'Helvetica',
      size: 16,
      weight: 'bold',
      style: 'italic',
    };
    expect(() => measurer.measure('Test', boldItalic)).not.toThrow();
  });
});

describe('CanvasMeasurer — with injected mock context', () => {
  const font: FontSpec = { family: 'Arial', size: 14 };

  it('uses canvas measureText width when context is available', () => {
    const charWidth = 10;
    const ctx = makeMockCtx(charWidth);
    const measurer = new CanvasMeasurer(() => ctx);
    const { width } = measurer.measure('Hello', font);
    // 5 chars × 10 px = 50
    expect(width).toBe(50);
  });

  it('returns height = font.size * 1.2 when using canvas path', () => {
    const ctx = makeMockCtx(10);
    const measurer = new CanvasMeasurer(() => ctx);
    const { height } = measurer.measure('Hello', font);
    expect(height).toBeCloseTo(font.size * 1.2, 5);
  });

  it('returns zero width for empty string via canvas path', () => {
    const ctx = makeMockCtx(10);
    const measurer = new CanvasMeasurer(() => ctx);
    const { width } = measurer.measure('', font);
    expect(width).toBe(0);
  });

  it('reuses cached context on second call', () => {
    let callCount = 0;
    const ctx = makeMockCtx(8);
    const factory = () => {
      callCount++;
      return ctx;
    };
    const measurer = new CanvasMeasurer(factory);
    measurer.measure('A', font);
    measurer.measure('B', font);
    // Factory called only once; second call uses cached ctx
    expect(callCount).toBe(1);
  });

  it('sets ctx.font before calling measureText', () => {
    const fontStrings: string[] = [];
    const mockCtx = {
      get font() { return fontStrings[fontStrings.length - 1] ?? ''; },
      set font(val: string) { fontStrings.push(val); },
      measureText: (text: string) => ({ width: text.length * 7 } as TextMetrics),
    } as unknown as CanvasRenderingContext2D;
    const measurer = new CanvasMeasurer(() => mockCtx);
    measurer.measure('Hi', { family: 'Courier', size: 12, weight: 'bold', style: 'italic' });
    expect(fontStrings[0]).toBe('italic bold 12px Courier');
  });

  it('falls back to formula when measureText returns 0 for non-empty text', () => {
    const zeroCtx = {
      font: '',
      measureText: (_text: string) => ({ width: 0 } as TextMetrics),
    } as unknown as CanvasRenderingContext2D;
    const measurer = new CanvasMeasurer(() => zeroCtx);
    const font14: FontSpec = { family: 'Arial', size: 14 };
    const { width } = measurer.measure('Hello', font14);
    // Falls back to formula: 5 * 14 * 0.55 = 38.5
    expect(width).toBeCloseTo(5 * 14 * 0.55, 5);
  });

  it('falls back to formula when context factory returns null', () => {
    const measurer = new CanvasMeasurer(() => null);
    const { width } = measurer.measure('Hello', font);
    expect(width).toBeCloseTo(5 * 14 * 0.55, 5);
  });

  it('falls back to formula when measureText throws', () => {
    const throwingCtx = {
      font: '',
      measureText: () => { throw new Error('canvas error'); },
    } as unknown as CanvasRenderingContext2D;
    const measurer = new CanvasMeasurer(() => throwingCtx);
    expect(() => measurer.measure('Hello', font)).not.toThrow();
    const { width } = measurer.measure('Hello', font);
    expect(width).toBeGreaterThan(0);
  });
});

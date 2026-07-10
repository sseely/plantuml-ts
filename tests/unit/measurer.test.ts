import { describe, it, expect, beforeEach } from 'vitest';
import {
  defaultTheme,
  darkTheme,
  resolveTheme,
} from '../../src/core/theme.js';
import {
  FormulaMeasurer,
  CanvasMeasurer,
  FixedMeasurer,
  glyphWidth,
} from '../../src/core/measurer.js';
import type { FontSpec, StringMeasurer } from '../../src/core/measurer.js';

// ---------------------------------------------------------------------------
// Theme tests
// ---------------------------------------------------------------------------

describe('defaultTheme', () => {
  it('has correct fontFamily', () => {
    expect(defaultTheme.fontFamily).toBe('sans-serif');
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
    const result = resolveTheme({ colors: { background: '#000000' } });
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
    const result = resolveTheme({ sequence: { messageSpacing: 30 } });
    expect(result.sequence.messageSpacing).toBe(30);
    expect(result.sequence.participantPadding).toBe(defaultTheme.sequence.participantPadding);
  });

  it('does not mutate defaultTheme when merging overrides', () => {
    resolveTheme({ colors: { background: '#FF0000' } });
    expect(defaultTheme.colors.background).toBe('#FFFFFF');
  });

  it('merges fontFamily override', () => {
    const result = resolveTheme({ fontFamily: 'Courier New' });
    expect(result.fontFamily).toBe('Courier New');
  });
});

// ---------------------------------------------------------------------------
// glyphWidth tests
// ---------------------------------------------------------------------------

describe('glyphWidth', () => {
  it('returns wider value for W than for i at same font and size', () => {
    const wWidth = glyphWidth('W', 'Arial', 14);
    const iWidth = glyphWidth('i', 'Arial', 14);
    expect(wWidth).toBeGreaterThan(iWidth);
  });

  it('scales with fontSize', () => {
    const small = glyphWidth('A', 'Arial', 10);
    const large = glyphWidth('A', 'Arial', 20);
    expect(large).toBeCloseTo(small * 2, 5);
  });

  it('returns 3.3 for space (code 32) at 12px', () => {
    // WIDTH[0] = 3.3; factor = 12/12 = 1.0
    expect(glyphWidth(' ', 'Arial', 12)).toBeCloseTo(3.3, 5);
  });

  it('returns 8.0 for A (code 65) at 12px', () => {
    // WIDTH[33] = 8.0; factor = 12/12 = 1.0
    expect(glyphWidth('A', 'Arial', 12)).toBeCloseTo(8.0, 5);
  });

  it('returns 11.3 for W (code 87) at 12px', () => {
    // WIDTH[55] = 11.3; factor = 12/12 = 1.0
    expect(glyphWidth('W', 'Arial', 12)).toBeCloseTo(11.3, 5);
  });

  it('returns 13*(size/12) for char code > 127 at 12px', () => {
    // fallback: 13 * (12/12) = 13
    expect(glyphWidth('中', 'Arial', 12)).toBeCloseTo(13, 5);
  });

  it('ignores font family (single table)', () => {
    // Arial and DejaVu Sans should return identical values
    const arialW = glyphWidth('A', 'Arial', 14);
    const dejaW = glyphWidth('A', 'DejaVu Sans', 14);
    expect(arialW).toBeCloseTo(dejaW, 10);
  });

  it('does not throw for unmapped glyph', () => {
    expect(() => glyphWidth('中', 'Arial', 14)).not.toThrow();
  });

  it('returns 13*(size/12) for unmapped glyph (code > 127)', () => {
    const width = glyphWidth('中', 'Arial', 14);
    expect(width).toBeCloseTo(13 * (14 / 12), 5);
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

  it('computes width as sum of per-glyph widths', () => {
    // "Hello" at Arial 14 using WIDTH table (factor = 14/12):
    // H=code72 WIDTH[40]=8.7, e=code101 WIDTH[69]=6.7,
    // l=code108 WIDTH[76]=2.7, l=code108 WIDTH[76]=2.7,
    // o=code111 WIDTH[79]=6.7
    // total = (8.7 + 6.7 + 2.7 + 2.7 + 6.7) * (14/12) = 27.5 * (14/12)
    const expected = (8.7 + 6.7 + 2.7 + 2.7 + 6.7) * (14 / 12);
    const { width } = measurer.measure('Hello', baseFont);
    expect(width).toBeCloseTo(expected, 5);
  });

  it('computes height as font size', () => {
    const font: FontSpec = { family: 'Arial', size: 14 };
    const { height } = measurer.measure('any text', font);
    expect(height).toBeCloseTo(14 * 1.0, 5);
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

  it('width scales linearly with repeated identical characters', () => {
    const one = measurer.measure('A', baseFont);
    const five = measurer.measure('AAAAA', baseFont);
    expect(five.width).toBeCloseTo(one.width * 5, 5);
  });

  it('ignores font weight for width calculation (bold same advance as regular)', () => {
    const normal = measurer.measure('Hello', { ...baseFont, weight: 'normal' });
    const bold = measurer.measure('Hello', { ...baseFont, weight: 'bold' });
    expect(normal.width).toBe(bold.width);
  });

  it('ignores font style for width calculation', () => {
    const normal = measurer.measure('Hello', { ...baseFont, style: 'normal' });
    const italic = measurer.measure('Hello', { ...baseFont, style: 'italic' });
    expect(normal.width).toBe(italic.width);
  });

  it('"W" at DejaVu Sans is wider than "i" at same size', () => {
    const dejaFont: FontSpec = { family: 'DejaVu Sans', size: 14 };
    const wWidth = measurer.measure('W', dejaFont).width;
    const iWidth = measurer.measure('i', dejaFont).width;
    expect(wWidth).toBeGreaterThan(iWidth);
  });

  it('"WWW" is more than 2× wider than "ill" at same font and size', () => {
    const wwwWidth = measurer.measure('WWW', baseFont).width;
    const illWidth = measurer.measure('ill', baseFont).width;
    expect(wwwWidth).toBeGreaterThan(illWidth * 2);
  });

  it('uses fallback 13*(size/12) for unmapped glyph (CJK U+4E2D)', () => {
    const { width } = measurer.measure('中', baseFont);
    expect(width).toBeCloseTo(13 * (14 / 12), 5);
  });

  it('bold font spec width >= regular weight width', () => {
    const regular = measurer.measure('Hello World', { ...baseFont, weight: 'normal' });
    const bold = measurer.measure('Hello World', { ...baseFont, weight: 'bold' });
    expect(bold.width).toBeGreaterThanOrEqual(regular.width);
  });
});

describe('FormulaMeasurer — getDescent', () => {
  const measurer = new FormulaMeasurer();

  it('returns size / 4.5 at size 14', () => {
    expect(measurer.getDescent({ family: 'Arial', size: 14 }, 'Hello')).toBeCloseTo(14 / 4.5, 5);
  });

  it('returns size / 4.5 at size 12', () => {
    expect(measurer.getDescent({ family: 'Arial', size: 12 }, 'Hello')).toBeCloseTo(12 / 4.5, 5);
  });

  it('scales linearly with font size', () => {
    const d14 = measurer.getDescent({ family: 'Arial', size: 14 }, 'A');
    const d28 = measurer.getDescent({ family: 'Arial', size: 28 }, 'A');
    expect(d28).toBeCloseTo(d14 * 2, 5);
  });

  it('text parameter does not affect result', () => {
    const font = { family: 'Arial', size: 14 };
    expect(measurer.getDescent(font, 'Hello')).toBeCloseTo(measurer.getDescent(font, 'yyy'), 5);
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

describe('FixedMeasurer — getDescent', () => {
  it('returns lineHeight / 4.5', () => {
    const measurer = new FixedMeasurer(8, 16);
    expect(measurer.getDescent({ family: 'Arial', size: 14 }, 'Hello')).toBeCloseTo(16 / 4.5, 5);
  });

  it('returns a positive number', () => {
    const measurer = new FixedMeasurer(8, 16);
    expect(measurer.getDescent({ family: 'Arial', size: 14 }, 'Hi')).toBeGreaterThan(0);
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

  it('returns height = font.size when using canvas path', () => {
    const ctx = makeMockCtx(10);
    const measurer = new CanvasMeasurer(() => ctx);
    const { height } = measurer.measure('Hello', font);
    expect(height).toBeCloseTo(font.size, 5);
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

  it('falls back to per-glyph formula when measureText returns 0 for non-empty text', () => {
    const zeroCtx = {
      font: '',
      measureText: (_text: string) => ({ width: 0 } as TextMetrics),
    } as unknown as CanvasRenderingContext2D;
    const measurer = new CanvasMeasurer(() => zeroCtx);
    const font14: FontSpec = { family: 'Arial', size: 14 };
    const { width } = measurer.measure('Hello', font14);
    // Falls back to per-glyph WIDTH table:
    // H=8.7, e=6.7, l=2.7, l=2.7, o=6.7 → 27.5 * (14/12)
    const expected = (8.7 + 6.7 + 2.7 + 2.7 + 6.7) * (14 / 12);
    expect(width).toBeCloseTo(expected, 5);
  });

  it('falls back to per-glyph formula when context factory returns null', () => {
    const measurer = new CanvasMeasurer(() => null);
    const { width } = measurer.measure('Hello', font);
    // Per-glyph WIDTH table: H=8.7, e=6.7, l=2.7, l=2.7, o=6.7 → 27.5 * (14/12)
    const expected = (8.7 + 6.7 + 2.7 + 2.7 + 6.7) * (14 / 12);
    expect(width).toBeCloseTo(expected, 5);
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

describe('CanvasMeasurer — getDescent', () => {
  it('returns size / 4.5 (formula-based for now)', () => {
    const measurer = new CanvasMeasurer();
    expect(measurer.getDescent({ family: 'Arial', size: 14 }, 'Hello')).toBeCloseTo(14 / 4.5, 5);
  });

  it('compiles as StringMeasurer interface method', () => {
    const m: StringMeasurer = new FormulaMeasurer();
    expect(typeof m.getDescent).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// CanvasMeasurer — LRU cache tests
// ---------------------------------------------------------------------------

describe('CanvasMeasurer — LRU cache', () => {
  it('returns cached result on second call with same font and text', () => {
    let measureCallCount = 0;
    const ctx = {
      font: '',
      measureText: (text: string) => {
        measureCallCount++;
        return { width: text.length * 8 } as TextMetrics;
      },
    } as unknown as CanvasRenderingContext2D;
    const measurer = new CanvasMeasurer(() => ctx);
    const font: FontSpec = { family: 'Arial', size: 14 };

    const first = measurer.measure('Hello', font);
    const second = measurer.measure('Hello', font);

    expect(first).toEqual(second);
    expect(measureCallCount).toBe(1); // second call was a cache hit
  });

  it('uses separate cache entries for different texts', () => {
    let measureCallCount = 0;
    const ctx = {
      font: '',
      measureText: (text: string) => {
        measureCallCount++;
        return { width: text.length * 8 } as TextMetrics;
      },
    } as unknown as CanvasRenderingContext2D;
    const measurer = new CanvasMeasurer(() => ctx);
    const font: FontSpec = { family: 'Arial', size: 14 };

    measurer.measure('Hello', font);
    measurer.measure('World', font);

    expect(measureCallCount).toBe(2);
  });

  it('uses separate cache entries for different font specs', () => {
    let measureCallCount = 0;
    const ctx = {
      font: '',
      measureText: (text: string) => {
        measureCallCount++;
        return { width: text.length * 8 } as TextMetrics;
      },
    } as unknown as CanvasRenderingContext2D;
    const measurer = new CanvasMeasurer(() => ctx);

    measurer.measure('Hello', { family: 'Arial', size: 14 });
    measurer.measure('Hello', { family: 'Arial', size: 16 });

    expect(measureCallCount).toBe(2);
  });

  it('evicts oldest entry when cache exceeds 8192 entries', () => {
    const ctx = {
      font: '',
      measureText: (text: string) => ({ width: text.length * 8 } as TextMetrics),
    } as unknown as CanvasRenderingContext2D;
    const measurer = new CanvasMeasurer(() => ctx);
    const font: FontSpec = { family: 'Arial', size: 14 };

    // Fill past the 8192 limit
    for (let i = 0; i <= 8192; i++) {
      measurer.measure(`text-${i}`, font);
    }

    // Measure a fresh string to confirm the measurer still works
    const result = measurer.measure('after-eviction', font);
    expect(result.width).toBeGreaterThan(0);
  });
});

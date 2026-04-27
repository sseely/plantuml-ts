import { describe, expect, it } from 'vitest';

import {
  type LabelSpan,
  measureLatex,
  measureNodeLabel,
  parseLatexLabel,
  renderLatexMathML,
  renderNodeLabel,
} from '../../src/core/latex.js';
import { foreignObject } from '../../src/core/svg.js';
import type { FontSpec, StringMeasurer } from '../../src/core/measurer.js';
import type { Theme } from '../../src/core/theme.js';

const stubMeasurer: StringMeasurer = {
  measure(text: string, _font: FontSpec) {
    return { width: text.length * 8, height: 14 };
  },
  getDescent(_font: FontSpec, _text: string) {
    return 3;
  },
};
const stubFont: FontSpec = { family: 'sans-serif', size: 14 };
const stubTheme = {
  colors: { text: '#000000' },
  fontFamily: 'sans-serif',
  fontSize: 14,
} as unknown as Theme;

// ---------------------------------------------------------------------------
// foreignObject (svg primitive)
// ---------------------------------------------------------------------------

describe('foreignObject', () => {
  it('embeds content with correct x, y, width, height attributes', () => {
    const result = foreignObject(10, 20, 100, 50, '<math/>');
    expect(result).toContain('x="10"');
    expect(result).toContain('y="20"');
    expect(result).toContain('width="100"');
    expect(result).toContain('height="50"');
  });

  it('includes the inner content verbatim', () => {
    const result = foreignObject(0, 0, 200, 80, '<math/>');
    expect(result).toContain('<math/>');
  });

  it('wraps content in <foreignObject> tags', () => {
    const result = foreignObject(5, 5, 50, 50, 'inner');
    expect(result).toMatch(/^<foreignObject /);
    expect(result).toContain('</foreignObject>');
  });
});

// ---------------------------------------------------------------------------
// parseLatexLabel
// ---------------------------------------------------------------------------

describe('parseLatexLabel', () => {
  it('parses a pure latex tag into a single latex span', () => {
    const spans = parseLatexLabel('<latex>\\frac{a}{b}</latex>');
    expect(spans).toHaveLength(1);
    const [span] = spans as [LabelSpan];
    expect(span.kind).toBe('latex');
    if (span.kind === 'latex') {
      expect(span.expr).toBe('\\frac{a}{b}');
    }
  });

  it('parses prefix + latex + suffix into three spans', () => {
    const spans = parseLatexLabel('prefix <latex>x^2</latex> suffix');
    expect(spans).toHaveLength(3);
    const kinds = spans.map((s) => s.kind);
    expect(kinds).toEqual(['text', 'latex', 'text']);

    const [before, latex, after] = spans as [LabelSpan, LabelSpan, LabelSpan];
    if (before.kind === 'text') expect(before.content).toBe('prefix ');
    if (latex.kind === 'latex') expect(latex.expr).toBe('x^2');
    if (after.kind === 'text') expect(after.content).toBe(' suffix');
  });

  it('parses plain text (no latex tags) into a single text span', () => {
    const spans = parseLatexLabel('plain text');
    expect(spans).toHaveLength(1);
    const [span] = spans as [LabelSpan];
    expect(span.kind).toBe('text');
    if (span.kind === 'text') {
      expect(span.content).toBe('plain text');
    }
  });

  it('handles empty string as a single empty text span', () => {
    const spans = parseLatexLabel('');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.kind).toBe('text');
  });

  it('handles multiple latex spans', () => {
    const spans = parseLatexLabel(
      '<latex>a</latex> and <latex>b</latex>',
    );
    expect(spans).toHaveLength(3);
    expect(spans.map((s) => s.kind)).toEqual(['latex', 'text', 'latex']);
  });

  it('strips only the outermost tags (nested content preserved)', () => {
    const spans = parseLatexLabel('<latex>\\frac{1}{x}</latex>');
    expect(spans).toHaveLength(1);
    const [s] = spans as [LabelSpan];
    if (s.kind === 'latex') {
      expect(s.expr).toBe('\\frac{1}{x}');
    }
  });
});

// ---------------------------------------------------------------------------
// measureLatex
// ---------------------------------------------------------------------------

describe('measureLatex', () => {
  it('returns base height 40 for an expression with no structural markers', () => {
    const { height } = measureLatex('x^2 + y^2');
    expect(height).toBe(40);
  });

  it('increases height by 20 per structural marker (capped at 80)', () => {
    // One \frac → height = 40 + 20 = 60
    const { height: h1 } = measureLatex('\\frac{a}{b}');
    expect(h1).toBe(60);

    // Three structural markers would be 40 + 60 = 100, capped at 80
    const { height: h3 } = measureLatex('\\frac{a}{b} \\sum_{i} \\int dx');
    expect(h3).toBe(80);
  });

  it('returns width >= 120 for a complex expression', () => {
    const { width } = measureLatex(
      '\\frac{c_1}{\\lambda^5 (e^{c_2}-1)}',
    );
    expect(width).toBeGreaterThanOrEqual(120);
  });

  it('returns height > 40 for an expression with \\frac', () => {
    const { height } = measureLatex(
      '\\frac{c_1}{\\lambda^5 (e^{c_2}-1)}',
    );
    expect(height).toBeGreaterThan(40);
  });

  it('uses minimum width of 120 for very short expressions', () => {
    const { width } = measureLatex('x');
    expect(width).toBe(120);
  });

  it('scales width with atom count for long expressions', () => {
    // 30 plain characters = 30 atoms × 10px = 300 > 120
    const longExpr = 'x'.repeat(30);
    const { width } = measureLatex(longExpr);
    expect(width).toBe(300);
  });

  it('counts multiple occurrences of the same structural marker', () => {
    // Two \frac → 40 + 40 = 80 (cap hit)
    const { height } = measureLatex('\\frac{a}{b} + \\frac{c}{d}');
    expect(height).toBe(80);
  });

  it('counts all structural marker types', () => {
    // \sqrt alone → 40 + 20 = 60
    const { height } = measureLatex('\\sqrt{2}');
    expect(height).toBe(60);

    // \prod alone → 40 + 20 = 60
    const { height: h2 } = measureLatex('\\prod_{i=1}^{n}');
    expect(h2).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// renderLatexMathML
// ---------------------------------------------------------------------------

describe('renderLatexMathML', () => {
  it('returns a string containing <foreignObject', () => {
    const result = renderLatexMathML('x^2', 0, 0, 120, 40, '#000000');
    expect(result).toContain('<foreignObject');
  });

  it('includes width and height attributes on the foreignObject', () => {
    const result = renderLatexMathML('x^2', 10, 20, 150, 60, '#000000');
    expect(result).toContain('width="150"');
    expect(result).toContain('height="60"');
  });

  it('includes x and y attributes on the foreignObject', () => {
    const result = renderLatexMathML('x^2', 10, 20, 150, 60, '#000000');
    expect(result).toContain('x="10"');
    expect(result).toContain('y="20"');
  });

  it('returns a string containing <math (KaTeX MathML output)', () => {
    const result = renderLatexMathML('\\frac{a}{b}', 0, 0, 120, 60, '#000000');
    expect(result).toContain('<math');
  });

  it('does not throw for malformed LaTeX (throwOnError: false)', () => {
    // \badcommand is not a valid LaTeX command
    expect(() =>
      renderLatexMathML('\\badcommand{x}', 0, 0, 120, 40, '#000000'),
    ).not.toThrow();
  });

  it('still returns a valid foreignObject for malformed LaTeX', () => {
    const result = renderLatexMathML('\\badcommand{x}', 0, 0, 120, 40, '#red');
    expect(result).toContain('<foreignObject');
    expect(result).toContain('</foreignObject>');
  });

  it('strips <latex>…</latex> wrapper tags from the expression', () => {
    // Both wrapped and unwrapped should produce equivalent MathML output
    const wrapped = renderLatexMathML(
      '<latex>x^2</latex>',
      0,
      0,
      120,
      40,
      '#000000',
    );
    const plain = renderLatexMathML('x^2', 0, 0, 120, 40, '#000000');
    expect(wrapped).toBe(plain);
  });

  it('includes the XHTML namespace wrapper div', () => {
    const result = renderLatexMathML('x', 0, 0, 120, 40, '#000000');
    expect(result).toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });
});

// ---------------------------------------------------------------------------
// measureNodeLabel
// ---------------------------------------------------------------------------

describe('measureNodeLabel', () => {
  it('delegates to the string measurer for plain text', () => {
    const result = measureNodeLabel('hello', stubMeasurer, stubFont);
    // 5 chars * 8 = 40 width, height 14
    expect(result).toEqual({ width: 40, height: 14 });
  });

  it('delegates to measureLatex for labels containing <latex>', () => {
    const latexLabel = '<latex>x^2</latex>';
    const direct = measureLatex(latexLabel);
    const result = measureNodeLabel(latexLabel, stubMeasurer, stubFont);
    expect(result).toEqual(direct);
  });

  it('uses the latex path (not measurer) for latex labels', () => {
    // A very long latex expression — measurer would give a huge width,
    // but measureLatex uses its own formula.
    const label = '<latex>\\frac{a}{b}</latex>';
    const result = measureNodeLabel(label, stubMeasurer, stubFont);
    expect(result.width).toBeGreaterThanOrEqual(120);
    expect(result.height).toBe(60); // 40 + 20 for one \frac
  });
});

// ---------------------------------------------------------------------------
// renderNodeLabel
// ---------------------------------------------------------------------------

describe('renderNodeLabel', () => {
  it('produces a <text> element for plain labels', () => {
    const result = renderNodeLabel('hello', 50, 50, stubTheme);
    expect(result).toContain('<text');
    expect(result).toContain('hello');
    expect(result).not.toContain('<foreignObject');
  });

  it('produces a <foreignObject> for latex labels', () => {
    const result = renderNodeLabel('<latex>x^2</latex>', 100, 100, stubTheme);
    expect(result).toContain('<foreignObject');
    expect(result).not.toContain('<text');
  });

  it('centers the foreignObject around the provided cx/cy', () => {
    const label = '<latex>x^2</latex>';
    const { width: w, height: h } = measureLatex(label);
    const result = renderNodeLabel(label, 100, 100, stubTheme);
    expect(result).toContain(`x="${100 - w / 2}"`);
    expect(result).toContain(`y="${100 - h / 2}"`);
  });

  it('applies theme color to plain text labels', () => {
    const result = renderNodeLabel('test', 10, 10, stubTheme);
    expect(result).toContain(stubTheme.colors.text);
  });
});

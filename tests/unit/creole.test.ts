import { describe, it, expect } from 'vitest';
import {
  parseCreole,
  spansToTspan,
  creoleToSvg,
} from '../../src/core/creole.js';
import type { CreoleSpan } from '../../src/core/creole.js';

// ---------------------------------------------------------------------------
// parseCreole — unit tests for span extraction
// ---------------------------------------------------------------------------

describe('parseCreole', () => {
  it('returns a single plain span for text with no markup', () => {
    const spans = parseCreole('hello world');
    expect(spans).toHaveLength(1);
    expect(spans[0]).toEqual<CreoleSpan>({
      text: 'hello world',
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
    });
  });

  it('returns empty array for empty string', () => {
    expect(parseCreole('')).toEqual([]);
  });

  it('parses **bold** markup', () => {
    const spans = parseCreole('**bold**');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.bold).toBe(true);
    expect(spans[0]?.text).toBe('bold');
  });

  it('parses //italic// markup', () => {
    const spans = parseCreole('//italic//');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.italic).toBe(true);
    expect(spans[0]?.text).toBe('italic');
  });

  it('parses __underline__ markup', () => {
    const spans = parseCreole('__under__');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.underline).toBe(true);
    expect(spans[0]?.text).toBe('under');
  });

  it('parses --strikethrough-- markup', () => {
    const spans = parseCreole('--strike--');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.strikethrough).toBe(true);
    expect(spans[0]?.text).toBe('strike');
  });

  it('parses mixed markup into multiple spans', () => {
    const spans = parseCreole('**bold** and //italic//');
    expect(spans).toHaveLength(3);
    expect(spans[0]?.bold).toBe(true);
    expect(spans[0]?.text).toBe('bold');
    expect(spans[1]?.bold).toBe(false);
    expect(spans[1]?.italic).toBe(false);
    expect(spans[1]?.text).toBe(' and ');
    expect(spans[2]?.italic).toBe(true);
    expect(spans[2]?.text).toBe('italic');
  });

  it('parses <color:X>text</color> markup', () => {
    const spans = parseCreole('<color:red>colored</color>');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.color).toBe('red');
    expect(spans[0]?.text).toBe('colored');
  });

  it('parses <color:#ff0000> hex color', () => {
    const spans = parseCreole('<color:#ff0000>hex</color>');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.color).toBe('#ff0000');
    expect(spans[0]?.text).toBe('hex');
  });

  it('parses <b>bold</b> HTML alias', () => {
    const spans = parseCreole('<b>bold</b>');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.bold).toBe(true);
    expect(spans[0]?.text).toBe('bold');
  });

  it('parses <i>italic</i> HTML alias', () => {
    const spans = parseCreole('<i>italic</i>');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.italic).toBe(true);
    expect(spans[0]?.text).toBe('italic');
  });

  it('parses <u>underline</u> HTML alias', () => {
    const spans = parseCreole('<u>under</u>');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.underline).toBe(true);
    expect(spans[0]?.text).toBe('under');
  });

  it('parses <s>strikethrough</s> HTML alias', () => {
    const spans = parseCreole('<s>struck</s>');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.strikethrough).toBe(true);
    expect(spans[0]?.text).toBe('struck');
  });

  it('treats unclosed ** markup as literal text', () => {
    const spans = parseCreole('**unclosed');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.bold).toBe(false);
    expect(spans[0]?.text).toBe('**unclosed');
  });

  it('treats unclosed // markup as literal text', () => {
    const spans = parseCreole('//unclosed');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.italic).toBe(false);
    expect(spans[0]?.text).toBe('//unclosed');
  });

  it('treats unclosed __ markup as literal text', () => {
    const spans = parseCreole('__unclosed');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.underline).toBe(false);
    expect(spans[0]?.text).toBe('__unclosed');
  });

  it('treats unclosed -- markup as literal text', () => {
    const spans = parseCreole('--unclosed');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.strikethrough).toBe(false);
    expect(spans[0]?.text).toBe('--unclosed');
  });

  it('parses nested markup: bold inside italic', () => {
    const spans = parseCreole('//**bold-italic**//');
    // The inner **…** produces a bold+italic span
    const boldItalic = spans.find(s => s.bold && s.italic);
    expect(boldItalic).toBeDefined();
    expect(boldItalic?.text).toBe('bold-italic');
  });

  it('parses leading and trailing plain text around styled span', () => {
    const spans = parseCreole('before **bold** after');
    expect(spans).toHaveLength(3);
    expect(spans[0]?.text).toBe('before ');
    expect(spans[1]?.bold).toBe(true);
    expect(spans[2]?.text).toBe(' after');
  });

  it('does not emit zero-length spans', () => {
    const spans = parseCreole('**bold**');
    expect(spans.every(s => s.text.length > 0)).toBe(true);
  });

  // ---- Orphan close tags treated as literal text ----

  it('emits orphan </color> as literal text', () => {
    const spans = parseCreole('text</color>more');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.text).toBe('text</color>more');
  });

  it('emits orphan </b> as literal text', () => {
    const spans = parseCreole('text</b>more');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.text).toBe('text</b>more');
  });

  it('emits orphan </i> as literal text', () => {
    const spans = parseCreole('text</i>more');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.text).toBe('text</i>more');
  });

  it('emits orphan </u> as literal text', () => {
    const spans = parseCreole('text</u>more');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.text).toBe('text</u>more');
  });

  it('emits orphan </s> as literal text', () => {
    const spans = parseCreole('text</s>more');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.text).toBe('text</s>more');
  });

  // ---- Unclosed HTML open tags treated as literal text ----

  it('treats unclosed <b> as literal text', () => {
    const spans = parseCreole('<b>unclosed');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.bold).toBe(false);
    expect(spans[0]?.text).toBe('<b>unclosed');
  });

  it('treats unclosed <i> as literal text', () => {
    const spans = parseCreole('<i>unclosed');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.italic).toBe(false);
    expect(spans[0]?.text).toBe('<i>unclosed');
  });

  it('treats unclosed <u> as literal text', () => {
    const spans = parseCreole('<u>unclosed');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.underline).toBe(false);
    expect(spans[0]?.text).toBe('<u>unclosed');
  });

  it('treats unclosed <s> as literal text', () => {
    const spans = parseCreole('<s>unclosed');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.strikethrough).toBe(false);
    expect(spans[0]?.text).toBe('<s>unclosed');
  });

  it('treats unclosed <color:X> as literal text', () => {
    const spans = parseCreole('<color:red>unclosed');
    expect(spans).toHaveLength(1);
    expect(spans[0]?.color).toBeUndefined();
    expect(spans[0]?.text).toBe('<color:red>unclosed');
  });
});

// ---------------------------------------------------------------------------
// spansToTspan — unit tests for SVG serialisation
// ---------------------------------------------------------------------------

describe('spansToTspan', () => {
  const plain: CreoleSpan = {
    text: 'hello',
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  };

  it('wraps plain text in a tspan with no style attributes', () => {
    expect(spansToTspan([plain])).toBe('<tspan>hello</tspan>');
  });

  it('adds font-weight="bold" for bold span', () => {
    const span: CreoleSpan = { ...plain, bold: true };
    expect(spansToTspan([span])).toContain('font-weight="bold"');
  });

  it('adds font-style="italic" for italic span', () => {
    const span: CreoleSpan = { ...plain, italic: true };
    expect(spansToTspan([span])).toContain('font-style="italic"');
  });

  it('adds text-decoration="underline" for underline span', () => {
    const span: CreoleSpan = { ...plain, underline: true };
    expect(spansToTspan([span])).toContain('text-decoration="underline"');
  });

  it('adds text-decoration="line-through" for strikethrough span', () => {
    const span: CreoleSpan = { ...plain, strikethrough: true };
    expect(spansToTspan([span])).toContain('text-decoration="line-through"');
  });

  it('adds fill attribute for colored span', () => {
    const span: CreoleSpan = { ...plain, color: 'red' };
    expect(spansToTspan([span])).toContain('fill="red"');
  });

  it('combines bold and italic on the same tspan', () => {
    const span: CreoleSpan = { ...plain, bold: true, italic: true };
    const result = spansToTspan([span]);
    expect(result).toContain('font-weight="bold"');
    expect(result).toContain('font-style="italic"');
  });

  it('combines underline and strikethrough as "underline line-through"', () => {
    const span: CreoleSpan = { ...plain, underline: true, strikethrough: true };
    const result = spansToTspan([span]);
    expect(result).toContain('text-decoration="underline line-through"');
  });

  it('renders multiple spans concatenated', () => {
    const bold: CreoleSpan = { ...plain, bold: true, text: 'bold' };
    const result = spansToTspan([bold, plain]);
    expect(result).toContain('<tspan font-weight="bold">bold</tspan>');
    expect(result).toContain('<tspan>hello</tspan>');
  });

  it('applies style.fill to plain tspan when no color override', () => {
    const result = spansToTspan([plain], { fill: 'blue' });
    expect(result).toContain('fill="blue"');
  });

  it('span color overrides style.fill', () => {
    const span: CreoleSpan = { ...plain, color: 'green' };
    const result = spansToTspan([span], { fill: 'blue' });
    expect(result).toContain('fill="green"');
    expect(result).not.toContain('fill="blue"');
  });

  it('returns empty string for empty spans array', () => {
    expect(spansToTspan([])).toBe('');
  });
});

// ---------------------------------------------------------------------------
// creoleToSvg — integration / pipeline tests
// ---------------------------------------------------------------------------

describe('creoleToSvg', () => {
  it('renders plain text unchanged', () => {
    expect(creoleToSvg('hello world')).toBe('<tspan>hello world</tspan>');
  });

  it('renders **bold** as font-weight bold tspan', () => {
    const result = creoleToSvg('**bold**');
    expect(result).toContain('font-weight="bold"');
    expect(result).toContain('>bold<');
  });

  it('renders //italic//', () => {
    const result = creoleToSvg('//italic//');
    expect(result).toContain('font-style="italic"');
  });

  it('renders --strike--', () => {
    const result = creoleToSvg('--strike--');
    expect(result).toContain('text-decoration="line-through"');
  });

  it('renders __under__', () => {
    const result = creoleToSvg('__under__');
    expect(result).toContain('text-decoration="underline"');
  });

  it('renders mixed markup in one string (three tspan elements)', () => {
    const result = creoleToSvg('**bold** and //italic//');
    const tspanCount = (result.match(/<tspan/g) ?? []).length;
    expect(tspanCount).toBe(3);
    expect(result).toContain('font-weight="bold"');
    expect(result).toContain('font-style="italic"');
  });

  it('renders <color:red>colored</color>', () => {
    const result = creoleToSvg('<color:red>colored</color>');
    expect(result).toContain('fill="red"');
    expect(result).toContain('>colored<');
  });

  it('passes style.fill through to plain spans', () => {
    const result = creoleToSvg('text', { fill: '#333' });
    expect(result).toContain('fill="#333"');
  });

  it('renders empty string as empty string', () => {
    expect(creoleToSvg('')).toBe('');
  });
});

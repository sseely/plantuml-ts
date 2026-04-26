import { describe, it, expect } from 'vitest';
import {
  parseCreole,
  parseCreoleTokens,
  measureTable,
  tableTokenToSvg,
  spansToTspan,
  creoleToSvg,
} from '../../src/core/creole.js';
import type { CreoleSpan, TableToken } from '../../src/core/creole.js';

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

// ---------------------------------------------------------------------------
// parseCreoleTokens — table parsing
// ---------------------------------------------------------------------------

describe('parseCreoleTokens', () => {
  it('produces a 2×2 TableToken with no header cells for |A|B|\\n|C|D|', () => {
    const tokens = parseCreoleTokens('|A|B|\n|C|D|');
    expect(tokens).toHaveLength(1);
    const tok = tokens[0];
    expect(tok?.kind).toBe('table');
    if (tok?.kind !== 'table') return;
    expect(tok.rows).toHaveLength(2);
    expect(tok.rows[0]).toEqual([
      { header: false, content: 'A' },
      { header: false, content: 'B' },
    ]);
    expect(tok.rows[1]).toEqual([
      { header: false, content: 'C' },
      { header: false, content: 'D' },
    ]);
  });

  it('marks header cells when |= prefix is used', () => {
    const tokens = parseCreoleTokens('|= H1 |= H2 |\n| C1 | C2 |');
    expect(tokens).toHaveLength(1);
    const tok = tokens[0];
    expect(tok?.kind).toBe('table');
    if (tok?.kind !== 'table') return;
    expect(tok.rows).toHaveLength(2);
    // Row 0 — headers
    expect(tok.rows[0]?.[0]).toEqual({ header: true, content: 'H1' });
    expect(tok.rows[0]?.[1]).toEqual({ header: true, content: 'H2' });
    // Row 1 — data
    expect(tok.rows[1]?.[0]).toEqual({ header: false, content: 'C1' });
    expect(tok.rows[1]?.[1]).toEqual({ header: false, content: 'C2' });
  });

  it('accepts missing trailing pipe (lenient)', () => {
    const tokens = parseCreoleTokens('|A|B');
    expect(tokens).toHaveLength(1);
    const tok = tokens[0];
    expect(tok?.kind).toBe('table');
    if (tok?.kind !== 'table') return;
    expect(tok.rows[0]).toEqual([
      { header: false, content: 'A' },
      { header: false, content: 'B' },
    ]);
  });

  it('trims whitespace from cell content', () => {
    const tokens = parseCreoleTokens('|  hello  |  world  |');
    const tok = tokens[0];
    expect(tok?.kind).toBe('table');
    if (tok?.kind !== 'table') return;
    expect(tok.rows[0]?.[0]?.content).toBe('hello');
    expect(tok.rows[0]?.[1]?.content).toBe('world');
  });

  it('groups consecutive table lines into one TableToken', () => {
    const tokens = parseCreoleTokens('|A|\n|B|\n|C|');
    expect(tokens).toHaveLength(1);
    const tok = tokens[0];
    expect(tok?.kind).toBe('table');
    if (tok?.kind !== 'table') return;
    expect(tok.rows).toHaveLength(3);
  });

  it('breaks the table when a non-table line appears between table lines', () => {
    const tokens = parseCreoleTokens('|A|\ntext\n|B|');
    expect(tokens).toHaveLength(3);
    expect(tokens[0]?.kind).toBe('table');
    expect(tokens[1]?.kind).toBe('spans');
    expect(tokens[2]?.kind).toBe('table');
  });

  it('emits spans token for non-table lines', () => {
    const tokens = parseCreoleTokens('hello **world**');
    expect(tokens).toHaveLength(1);
    const tok = tokens[0];
    expect(tok?.kind).toBe('spans');
    if (tok?.kind !== 'spans') return;
    expect(tok.spans).toHaveLength(2);
    expect(tok.spans[0]?.text).toBe('hello ');
    expect(tok.spans[1]?.bold).toBe(true);
    expect(tok.spans[1]?.text).toBe('world');
  });

  it('handles a mix of text lines and a table block', () => {
    const tokens = parseCreoleTokens('title\n|A|B|\n|C|D|\nfooter');
    expect(tokens).toHaveLength(3);
    expect(tokens[0]?.kind).toBe('spans');
    expect(tokens[1]?.kind).toBe('table');
    expect(tokens[2]?.kind).toBe('spans');
  });
});

// ---------------------------------------------------------------------------
// measureTable — dimension calculation
// ---------------------------------------------------------------------------

describe('measureTable', () => {
  const twoByTwo: TableToken = {
    kind: 'table',
    rows: [
      [{ header: false, content: 'A' }, { header: false, content: 'B' }],
      [{ header: false, content: 'C' }, { header: false, content: 'D' }],
    ],
  };

  it('returns correct rowHeight = fontSize + 2×cellPadding', () => {
    const { rowHeight } = measureTable(twoByTwo, 14);
    // fontSize 14 + 2 × 4 = 22
    expect(rowHeight).toBe(22);
  });

  it('returns height = rows × rowHeight + (rows+1) border strokes', () => {
    const { height, rowHeight } = measureTable(twoByTwo, 14);
    // 2 rows × 22 + 3 borders = 47
    expect(height).toBe(2 * rowHeight + 3);
  });

  it('returns width = sum of colWidths + (cols+1) borders', () => {
    const { width, colWidths } = measureTable(twoByTwo, 14);
    const colSum = colWidths.reduce((s, w) => s + w, 0);
    // 2 cols → 3 borders
    expect(width).toBe(colSum + 3);
  });

  it('uses the widest cell to determine column width', () => {
    const table: TableToken = {
      kind: 'table',
      rows: [
        [{ header: false, content: 'short' }, { header: false, content: 'x' }],
        [{ header: false, content: 'a' }, { header: false, content: 'very long content' }],
      ],
    };
    const { colWidths } = measureTable(table, 14);
    // col0: max('short'=5, 'a'=1) → 5 chars; col1: max('x'=1, 'very long content'=17) → 17
    // charWidth = 14 × 0.6 = 8.4
    const charWidth = 14 * 0.6;
    const cellPadding = 4;
    expect(colWidths[0]).toBeCloseTo(5 * charWidth + cellPadding * 2);
    expect(colWidths[1]).toBeCloseTo(17 * charWidth + cellPadding * 2);
  });

  it('handles ragged rows (fewer cells than max columns) gracefully', () => {
    // Row 0 has 2 cells, row 1 has 1 cell — col1 width should be based on row 0 only
    const table: TableToken = {
      kind: 'table',
      rows: [
        [{ header: false, content: 'AB' }, { header: false, content: 'CD' }],
        [{ header: false, content: 'X' }],
      ],
    };
    const { colWidths } = measureTable(table, 14);
    expect(colWidths).toHaveLength(2);
    // col1 width is determined by 'CD' (2 chars) from row 0 only
    const charWidth = 14 * 0.6;
    const cellPadding = 4;
    expect(colWidths[1]).toBeCloseTo(2 * charWidth + cellPadding * 2);
  });

  it('uses default fontSize of 14 when not specified', () => {
    const { rowHeight } = measureTable(twoByTwo);
    // default fontSize = 14, rowHeight = 14 + 2*4 = 22
    expect(rowHeight).toBe(22);
  });
});

// ---------------------------------------------------------------------------
// tableTokenToSvg — SVG output
// ---------------------------------------------------------------------------

describe('tableTokenToSvg', () => {
  const twoByTwo: TableToken = {
    kind: 'table',
    rows: [
      [{ header: false, content: 'A' }, { header: false, content: 'B' }],
      [{ header: false, content: 'C' }, { header: false, content: 'D' }],
    ],
  };

  it('emits a <rect> for each cell', () => {
    const svg = tableTokenToSvg(twoByTwo, 0, 0, 14);
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    expect(rectCount).toBe(4); // 2×2 = 4 cells
  });

  it('emits a <text> for each cell', () => {
    const svg = tableTokenToSvg(twoByTwo, 0, 0, 14);
    const textCount = (svg.match(/<text/g) ?? []).length;
    expect(textCount).toBe(4);
  });

  it('does not use font-weight="bold" for data cells', () => {
    const svg = tableTokenToSvg(twoByTwo, 0, 0, 14);
    expect(svg).not.toContain('font-weight="bold"');
  });

  it('uses font-weight="bold" for header cells', () => {
    const table: TableToken = {
      kind: 'table',
      rows: [
        [{ header: true, content: 'H1' }, { header: true, content: 'H2' }],
        [{ header: false, content: 'C1' }, { header: false, content: 'C2' }],
      ],
    };
    const svg = tableTokenToSvg(table, 0, 0, 14);
    const boldCount = (svg.match(/font-weight="bold"/g) ?? []).length;
    // 2 header cells → 2 bold attributes
    expect(boldCount).toBe(2);
  });

  it('positions the table at the given (x, y) offset', () => {
    const svg = tableTokenToSvg(twoByTwo, 10, 20, 14);
    // First rect should be offset from x=10, y=20 by 1px border
    expect(svg).toContain('x="11"');
    expect(svg).toContain('y="21"');
  });

  it('each rect has stroke="#000000" stroke-width="1"', () => {
    const svg = tableTokenToSvg(twoByTwo, 0, 0, 14);
    expect(svg).toContain('stroke="#000000"');
    expect(svg).toContain('stroke-width="1"');
  });

  it('uses text-anchor="middle" for centered text', () => {
    const svg = tableTokenToSvg(twoByTwo, 0, 0, 14);
    expect(svg).toContain('text-anchor="middle"');
  });

  it('uses dominant-baseline="central" for vertical centering', () => {
    const svg = tableTokenToSvg(twoByTwo, 0, 0, 14);
    expect(svg).toContain('dominant-baseline="central"');
  });

  it('renders ragged rows: missing cells produce empty text but still emit rects', () => {
    // Row 1 has only 1 cell; the second column slot should still be rendered
    // (col count is determined by the widest row)
    const table: TableToken = {
      kind: 'table',
      rows: [
        [{ header: false, content: 'A' }, { header: false, content: 'B' }],
        [{ header: false, content: 'C' }],
      ],
    };
    const svg = tableTokenToSvg(table, 0, 0, 14);
    // 2 cols × 2 rows = 4 rects total
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    expect(rectCount).toBe(4);
  });

  it('uses default fontSize when not specified', () => {
    const svg = tableTokenToSvg(twoByTwo, 0, 0);
    // Should still produce valid SVG with rects and texts
    expect(svg).toContain('<rect');
    expect(svg).toContain('<text');
  });
});

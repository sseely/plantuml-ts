/**
 * Creole markup parser for PlantUML labels.
 *
 * Converts a subset of Creole wiki markup and HTML inline tags into a sequence
 * of styled span descriptors that can be serialised as SVG <tspan> elements.
 *
 * Supported markup:
 *   **text**          — bold
 *   //text//          — italic
 *   __text__          — underline
 *   --text--          — strikethrough
 *   <color:X>text</color>  — text colour
 *   <b>text</b>       — bold (HTML alias)
 *   <i>text</i>       — italic (HTML alias)
 *   <u>text</u>       — underline (HTML alias)
 *   <s>text</s>       — strikethrough (HTML alias)
 *
 * Markup may be nested. Unclosed markup is treated as literal text.
 *
 * Table syntax (Creole):
 *   |= Header 1 |= Header 2 |
 *   | Cell 1    | Cell 2    |
 *   |= prefix marks a header cell; trailing | is optional.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CreoleSpan {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color?: string;
}

/** A single cell in a Creole table. */
export interface TableCell {
  header: boolean;
  content: string;
}

/** A parsed Creole table — one or more consecutive `|…|` lines. */
export interface TableToken {
  kind: 'table';
  rows: Array<Array<TableCell>>;
}

/**
 * A token in the multi-line Creole token stream.
 *
 * - `spans` — a single inline line parsed into styled spans
 * - `table` — a block of consecutive table rows
 */
export type CreoleToken =
  | { kind: 'spans'; spans: CreoleSpan[] }
  | TableToken;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** The formatting state that is active at a given point during parsing. */
interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color?: string;
}

const EMPTY_STATE: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
};

/**
 * A token produced by the lexer.
 *
 * Symmetric Creole delimiters (**, //, __, --) use a single token kind for
 * both open and close; the parser uses the same kind when searching for the
 * closing delimiter. Asymmetric HTML-style tags have separate open/close
 * kinds.
 */
type Token =
  | { kind: 'text'; value: string }
  | { kind: 'bold' }
  | { kind: 'italic' }
  | { kind: 'underline' }
  | { kind: 'strike' }
  | { kind: 'open-color'; color: string }
  | { kind: 'close-color' }
  | { kind: 'open-b' }
  | { kind: 'close-b' }
  | { kind: 'open-i' }
  | { kind: 'close-i' }
  | { kind: 'open-u' }
  | { kind: 'close-u' }
  | { kind: 'open-s' }
  | { kind: 'close-s' };

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

/**
 * Tokenise the input string into a flat list of tokens.
 *
 * The lexer uses a single left-to-right scan, trying each pattern at the
 * current position.
 */
function tokenise(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < input.length) {
    // ---- Creole double-char delimiters (symmetric: same token for open/close)

    if (input.startsWith('**', pos)) {
      tokens.push({ kind: 'bold' });
      pos += 2;
      continue;
    }

    if (input.startsWith('//', pos)) {
      tokens.push({ kind: 'italic' });
      pos += 2;
      continue;
    }

    if (input.startsWith('__', pos)) {
      tokens.push({ kind: 'underline' });
      pos += 2;
      continue;
    }

    if (input.startsWith('--', pos)) {
      tokens.push({ kind: 'strike' });
      pos += 2;
      continue;
    }

    // ---- HTML-style tags (check close before open to avoid prefix collision)

    if (input.startsWith('</color>', pos)) {
      tokens.push({ kind: 'close-color' });
      pos += 8;
      continue;
    }

    if (input.startsWith('<color:', pos)) {
      const end = input.indexOf('>', pos);
      if (end !== -1) {
        const color = input.slice(pos + 7, end);
        tokens.push({ kind: 'open-color', color });
        pos = end + 1;
        continue;
      }
    }

    if (input.startsWith('</b>', pos)) {
      tokens.push({ kind: 'close-b' });
      pos += 4;
      continue;
    }

    if (input.startsWith('<b>', pos)) {
      tokens.push({ kind: 'open-b' });
      pos += 3;
      continue;
    }

    if (input.startsWith('</i>', pos)) {
      tokens.push({ kind: 'close-i' });
      pos += 4;
      continue;
    }

    if (input.startsWith('<i>', pos)) {
      tokens.push({ kind: 'open-i' });
      pos += 3;
      continue;
    }

    if (input.startsWith('</u>', pos)) {
      tokens.push({ kind: 'close-u' });
      pos += 4;
      continue;
    }

    if (input.startsWith('<u>', pos)) {
      tokens.push({ kind: 'open-u' });
      pos += 3;
      continue;
    }

    if (input.startsWith('</s>', pos)) {
      tokens.push({ kind: 'close-s' });
      pos += 4;
      continue;
    }

    if (input.startsWith('<s>', pos)) {
      tokens.push({ kind: 'open-s' });
      pos += 3;
      continue;
    }

    // ---- Plain text character (coalesce with previous text token)

    const last = tokens.at(-1);
    if (last?.kind === 'text') {
      last.value += input[pos];
    } else {
      tokens.push({ kind: 'text', value: input[pos] ?? '' });
    }
    pos += 1;
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Span merging
// ---------------------------------------------------------------------------

/** Two spans are mergeable when they share identical formatting state. */
function sameFormat(a: CreoleSpan, b: CreoleSpan): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strikethrough === b.strikethrough &&
    a.color === b.color
  );
}

/**
 * Collapse adjacent spans that have identical formatting into a single span.
 *
 * This is needed because unclosed delimiters are emitted as literal text
 * tokens, which would otherwise produce two consecutive plain spans (one for
 * the delimiter chars, one for the following text).
 */
function mergeSpans(spans: CreoleSpan[]): CreoleSpan[] {
  const result: CreoleSpan[] = [];
  for (const span of spans) {
    const last = result.at(-1);
    if (last !== undefined && sameFormat(last, span)) {
      last.text += span.text;
    } else {
      result.push({ ...span });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse the token stream into spans using a "paired-delimiter" strategy.
 *
 * Each toggle token (e.g. `bold`) is tentative: it becomes a real format
 * boundary only when a matching close token is found later in the stream. If
 * no matching close exists, the delimiter characters are emitted as literal
 * text.
 */
function parseTokens(tokens: Token[], state: FormatState): CreoleSpan[] {
  const spans: CreoleSpan[] = [];
  let i = 0;

  const flush = (text: string): void => {
    if (text.length === 0) return;
    const span: CreoleSpan = { ...state, text };
    if (state.color === undefined) {
      delete span.color;
    }
    spans.push(span);
  };

  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === undefined) break;

    switch (tok.kind) {
      case 'text': {
        flush(tok.value);
        i++;
        break;
      }

      // ---- Symmetric Creole delimiters ----

      case 'bold': {
        const closeIdx = findClose(tokens, i + 1, 'bold');
        if (closeIdx === -1) {
          flush('**');
          i++;
        } else {
          spans.push(...parseTokens(tokens.slice(i + 1, closeIdx), { ...state, bold: true }));
          i = closeIdx + 1;
        }
        break;
      }

      case 'italic': {
        const closeIdx = findClose(tokens, i + 1, 'italic');
        if (closeIdx === -1) {
          flush('//');
          i++;
        } else {
          spans.push(...parseTokens(tokens.slice(i + 1, closeIdx), { ...state, italic: true }));
          i = closeIdx + 1;
        }
        break;
      }

      case 'underline': {
        const closeIdx = findClose(tokens, i + 1, 'underline');
        if (closeIdx === -1) {
          flush('__');
          i++;
        } else {
          spans.push(...parseTokens(tokens.slice(i + 1, closeIdx), { ...state, underline: true }));
          i = closeIdx + 1;
        }
        break;
      }

      case 'strike': {
        const closeIdx = findClose(tokens, i + 1, 'strike');
        if (closeIdx === -1) {
          flush('--');
          i++;
        } else {
          spans.push(...parseTokens(tokens.slice(i + 1, closeIdx), { ...state, strikethrough: true }));
          i = closeIdx + 1;
        }
        break;
      }

      // ---- HTML-style tags (asymmetric open/close) ----

      case 'open-color': {
        const closeIdx = findClose(tokens, i + 1, 'close-color');
        if (closeIdx === -1) {
          flush(`<color:${tok.color}>`);
          i++;
        } else {
          spans.push(...parseTokens(tokens.slice(i + 1, closeIdx), { ...state, color: tok.color }));
          i = closeIdx + 1;
        }
        break;
      }

      case 'close-color': {
        // Orphan close tag — emit literally
        flush('</color>');
        i++;
        break;
      }

      case 'open-b': {
        const closeIdx = findClose(tokens, i + 1, 'close-b');
        if (closeIdx === -1) {
          flush('<b>');
          i++;
        } else {
          spans.push(...parseTokens(tokens.slice(i + 1, closeIdx), { ...state, bold: true }));
          i = closeIdx + 1;
        }
        break;
      }

      case 'close-b': {
        flush('</b>');
        i++;
        break;
      }

      case 'open-i': {
        const closeIdx = findClose(tokens, i + 1, 'close-i');
        if (closeIdx === -1) {
          flush('<i>');
          i++;
        } else {
          spans.push(...parseTokens(tokens.slice(i + 1, closeIdx), { ...state, italic: true }));
          i = closeIdx + 1;
        }
        break;
      }

      case 'close-i': {
        flush('</i>');
        i++;
        break;
      }

      case 'open-u': {
        const closeIdx = findClose(tokens, i + 1, 'close-u');
        if (closeIdx === -1) {
          flush('<u>');
          i++;
        } else {
          spans.push(...parseTokens(tokens.slice(i + 1, closeIdx), { ...state, underline: true }));
          i = closeIdx + 1;
        }
        break;
      }

      case 'close-u': {
        flush('</u>');
        i++;
        break;
      }

      case 'open-s': {
        const closeIdx = findClose(tokens, i + 1, 'close-s');
        if (closeIdx === -1) {
          flush('<s>');
          i++;
        } else {
          spans.push(...parseTokens(tokens.slice(i + 1, closeIdx), { ...state, strikethrough: true }));
          i = closeIdx + 1;
        }
        break;
      }

      case 'close-s': {
        flush('</s>');
        i++;
        break;
      }

      default: {
        // Exhaustive check — TypeScript will error if a new Token kind is added
        // without handling it here.
        const _exhaustive: never = tok;
        void _exhaustive;
        i++;
      }
    }
  }

  return spans;
}

/**
 * Scan forward from `start` looking for the first token whose kind matches
 * `closeKind`.
 */
function findClose(tokens: Token[], start: number, closeKind: Token['kind']): number {
  for (let j = start; j < tokens.length; j++) {
    if (tokens[j]?.kind === closeKind) return j;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Table row parser
// ---------------------------------------------------------------------------

/**
 * Parse a single `|cell|cell|` line into an array of TableCell objects.
 *
 * Rules:
 * - Split on `|` delimiter.
 * - First element before the leading `|` is discarded (empty).
 * - Trailing `|` is optional — a trailing empty segment is discarded.
 * - `|= content` marks a header cell; `| content` is a data cell.
 * - Cell content is trimmed of leading/trailing whitespace.
 */
function parseTableRow(line: string): TableCell[] {
  // Remove optional leading whitespace before the first `|`
  const trimmed = line.trimStart();
  // Split on `|`; first segment (before leading `|`) is always empty — drop it
  const segments = trimmed.split('|');
  segments.shift(); // drop empty segment before leading `|`

  // Drop trailing empty segment if trailing `|` was present
  if (segments.length > 0 && segments[segments.length - 1]?.trim() === '') {
    segments.pop();
  }

  const cells: TableCell[] = [];
  for (const seg of segments) {
    if (seg.startsWith('=')) {
      cells.push({ header: true, content: seg.slice(1).trim() });
    } else {
      cells.push({ header: false, content: seg.trim() });
    }
  }
  return cells;
}

/**
 * Returns true if `line` is a Creole table row (starts with `|` after
 * optional leading whitespace).
 */
function isTableLine(line: string): boolean {
  return /^\s*\|/.test(line);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a Creole-marked string into a flat array of styled spans.
 *
 * The result has no zero-length spans. Adjacent spans with identical
 * formatting are merged. Unclosed markup is emitted as literal text including
 * the delimiter characters.
 */
export function parseCreole(input: string): CreoleSpan[] {
  if (input.length === 0) return [];
  const tokens = tokenise(input);
  const raw = parseTokens(tokens, { ...EMPTY_STATE });
  return mergeSpans(raw);
}

/**
 * Parse a multi-line Creole string into a sequence of `CreoleToken` values.
 *
 * Consecutive lines starting with `|` are grouped into a single `TableToken`.
 * All other lines are parsed as inline Creole markup and emitted as
 * `{ kind: 'spans', spans: CreoleSpan[] }` tokens.
 */
export function parseCreoleTokens(input: string): CreoleToken[] {
  const lines = input.split('\n');
  const result: CreoleToken[] = [];
  let tableRows: Array<Array<TableCell>> = [];

  const flushTable = (): void => {
    if (tableRows.length > 0) {
      result.push({ kind: 'table', rows: tableRows });
      tableRows = [];
    }
  };

  for (const line of lines) {
    if (isTableLine(line)) {
      tableRows.push(parseTableRow(line));
    } else {
      flushTable();
      result.push({ kind: 'spans', spans: parseCreole(line) });
    }
  }

  flushTable();
  return result;
}

// ---------------------------------------------------------------------------
// Table measurement
// ---------------------------------------------------------------------------

/** Padding applied to each side of a cell (pixels). */
const CELL_PADDING = 4;

/** Default line height used when no fontSize is provided. */
const DEFAULT_LINE_HEIGHT = 14;

/** Approximate character width as a fraction of fontSize. */
const CHAR_WIDTH_RATIO = 0.6;

/** Width of the 1px border strokes between / around cells (pixels). */
const BORDER_STROKE = 1;

/**
 * Measure the pixel dimensions of a `TableToken`.
 *
 * Column widths are determined by the widest cell content in each column
 * across all rows.  Row height is uniform: lineHeight + 2 × cellPadding.
 *
 * @param token - The table token to measure.
 * @param fontSize - Font size in px (defaults to DEFAULT_LINE_HEIGHT).
 * @returns `{ width, height, colWidths, rowHeight }` — the last two are
 *   exposed for use by the SVG renderer.
 */
export function measureTable(
  token: TableToken,
  fontSize: number = DEFAULT_LINE_HEIGHT,
): { width: number; height: number; colWidths: number[]; rowHeight: number } {
  const charWidth = fontSize * CHAR_WIDTH_RATIO;
  const rowHeight = fontSize + CELL_PADDING * 2;

  // Determine number of columns (max across all rows)
  let numCols = 0;
  for (const row of token.rows) {
    if (row.length > numCols) numCols = row.length;
  }

  // Compute per-column max content width
  const colWidths: number[] = Array.from({ length: numCols }, () => 0);
  for (const row of token.rows) {
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell === undefined) continue;
      const contentPx = cell.content.length * charWidth;
      const colW = colWidths[c];
      if (colW !== undefined && contentPx > colW) {
        colWidths[c] = contentPx;
      }
    }
  }

  // Add horizontal padding to each column
  const paddedColWidths = colWidths.map(w => w + CELL_PADDING * 2);

  // Total width: sum of column widths + (cols+1) border strokes
  const totalWidth = paddedColWidths.reduce((sum, w) => sum + w, 0) + (numCols + 1) * BORDER_STROKE;

  // Total height: rows × rowHeight + (rows+1) border strokes
  const totalHeight = token.rows.length * rowHeight + (token.rows.length + 1) * BORDER_STROKE;

  return {
    width: totalWidth,
    height: totalHeight,
    colWidths: paddedColWidths,
    rowHeight,
  };
}

// ---------------------------------------------------------------------------
// Table SVG renderer
// ---------------------------------------------------------------------------

/**
 * Render a `TableToken` as an SVG string.
 *
 * Each cell is rendered as a `<rect>` border + `<text>` element.
 * Header cells use `font-weight="bold"`.  Text is centered horizontally and
 * vertically within the cell.
 *
 * @param token - The table token to render.
 * @param x - Left edge of the table in the containing coordinate system.
 * @param y - Top edge of the table.
 * @param fontSize - Font size in px (defaults to DEFAULT_LINE_HEIGHT).
 * @returns An SVG string (no wrapper element — caller provides context).
 */
export function tableTokenToSvg(
  token: TableToken,
  x: number,
  y: number,
  fontSize: number = DEFAULT_LINE_HEIGHT,
): string {
  const { colWidths, rowHeight } = measureTable(token, fontSize);
  const parts: string[] = [];

  let rowY = y + BORDER_STROKE;
  for (const row of token.rows) {
    let cellX = x + BORDER_STROKE;
    for (let c = 0; c < colWidths.length; c++) {
      const colW = colWidths[c] ?? 0;
      const cell = row[c];
      const content = cell?.content ?? '';
      const isHeader = cell?.header ?? false;

      // Cell border rect
      parts.push(
        `<rect x="${cellX}" y="${rowY}" width="${colW}" height="${rowHeight}" ` +
        `fill="none" stroke="#000000" stroke-width="1"/>`,
      );

      // Cell text — centered horizontally and vertically
      const textX = cellX + colW / 2;
      const textY = rowY + rowHeight / 2;
      const weightAttr = isHeader ? ' font-weight="bold"' : '';
      parts.push(
        `<text x="${textX}" y="${textY}" font-size="${fontSize}"` +
        `${weightAttr} text-anchor="middle" dominant-baseline="central">` +
        `<tspan>${content}</tspan>` +
        `</text>`,
      );

      cellX += colW + BORDER_STROKE;
    }
    rowY += rowHeight + BORDER_STROKE;
  }

  return parts.join('');
}

// ---------------------------------------------------------------------------
// SVG span serialisation
// ---------------------------------------------------------------------------

/**
 * Build the attributes string for a single tspan element.
 */
function buildAttrs(span: CreoleSpan, inheritFill?: string): string {
  const parts: string[] = [];

  const fill = span.color ?? inheritFill;
  if (fill !== undefined) parts.push(`fill="${fill}"`);
  if (span.bold) parts.push('font-weight="bold"');
  if (span.italic) parts.push('font-style="italic"');

  // underline and strikethrough both map to text-decoration; combine if both
  if (span.underline && span.strikethrough) {
    parts.push('text-decoration="underline line-through"');
  } else if (span.underline) {
    parts.push('text-decoration="underline"');
  } else if (span.strikethrough) {
    parts.push('text-decoration="line-through"');
  }

  return parts.join(' ');
}

/**
 * Serialise an array of spans to a string of concatenated SVG `<tspan>`
 * elements.
 *
 * `style.fill` is the inherited text colour; it is applied to spans that do
 * not carry their own colour override.
 */
export function spansToTspan(
  spans: CreoleSpan[],
  style?: { fill?: string },
): string {
  if (spans.length === 0) return '';

  return spans
    .map(span => {
      const attrs = buildAttrs(span, style?.fill);
      return attrs.length > 0
        ? `<tspan ${attrs}>${span.text}</tspan>`
        : `<tspan>${span.text}</tspan>`;
    })
    .join('');
}

/**
 * Convenience function: parse and serialise in one step.
 */
export function creoleToSvg(
  input: string,
  style?: { fill?: string },
): string {
  return spansToTspan(parseCreole(input), style);
}

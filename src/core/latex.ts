/**
 * LaTeX label parsing, sizing, and rendering utilities.
 *
 * Labels in PlantUML can embed LaTeX math expressions inside
 * `<latex>…</latex>` tags.  These helpers parse such labels into spans,
 * compute heuristic bounding boxes, and render expressions to SVG
 * `<foreignObject>` containing KaTeX MathML.
 */

import katex from 'katex';
import { foreignObject, text } from './svg.js';
import type { StringMeasurer, FontSpec } from './measurer.js';
import type { Theme } from './theme.js';

// ---------------------------------------------------------------------------
// measureNodeLabel / renderNodeLabel — shared helpers for all diagram types
// ---------------------------------------------------------------------------

/**
 * Measure the bounding box of a node label, routing to the LaTeX heuristic
 * when the label contains a `<latex>` tag, and to the string measurer
 * otherwise.
 */
export function measureNodeLabel(
  label: string,
  measurer: StringMeasurer,
  fontSpec: FontSpec,
): { width: number; height: number } {
  if (label.includes('<latex>')) {
    return measureLatex(label);
  }
  return measurer.measure(label, fontSpec);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Convert `$...$` inline math delimiters inside a LaTeX expression to KaTeX
 * inline-mode format.
 *
 * JLaTeXMath (the Java renderer) accepts `$x^2$` inside display content.
 * KaTeX does not recognise `$` as a delimiter, so we split on unescaped `$`
 * pairs and wrap text segments with `\text{…}`.
 *
 * Example: `set $x = \sqrt{y}$ and $i = 1$`
 *       →  `\text{set }x = \sqrt{y}\text{ and }i = 1`
 */
function preprocessDollarDelimiters(expr: string): string {
  if (!expr.includes('$')) return expr;
  const segments = expr.split('$');
  const parts: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] ?? '';
    if (i % 2 === 0) {
      if (seg.length > 0) parts.push(`\\text{${seg}}`);
    } else {
      parts.push(seg);
    }
  }
  return parts.join('');
}

/** Sum bounding boxes across a parsed label span array. */
function measureMixedLabel(spans: LabelSpan[]): { width: number; height: number } {
  let totalWidth = 0;
  let maxHeight = 0;
  for (const span of spans) {
    if (span.kind === 'latex') {
      const { width: w, height: h } = measureLatex(span.expr);
      totalWidth += w;
      maxHeight = Math.max(maxHeight, h);
    } else {
      // Approximate text width: 8px per character, min 20px.
      totalWidth += Math.max(20, span.content.length * 8);
      maxHeight = Math.max(maxHeight, 24);
    }
  }
  return { width: Math.max(120, totalWidth), height: Math.max(40, maxHeight) };
}

/**
 * Render a node label as an SVG element, routing to KaTeX `<foreignObject>`
 * when the label contains a `<latex>` tag, and to a plain `<text>` element
 * otherwise.
 *
 * Mixed labels (text interleaved with `<latex>` spans) are rendered as a
 * foreignObject `<div>` combining plain `<span>` elements and inline KaTeX.
 *
 * @param label  - Raw label string (may contain `<latex>…</latex>`).
 * @param cx     - Horizontal centre of the label.
 * @param cy     - Vertical centre of the label.
 * @param theme  - Theme for font and colour values.
 */
export function renderNodeLabel(
  label: string,
  cx: number,
  cy: number,
  theme: Theme,
): string {
  if (!label.includes('<latex>')) {
    return text(cx, cy, label, {
      textAnchor: 'middle',
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fill: theme.colors.text,
    });
  }

  const spans = parseLatexLabel(label);
  const { width: w, height: h } = measureMixedLabel(spans);
  const x = cx - w / 2;
  const y = cy - h / 2;

  if (spans.length === 1 && spans[0]!.kind === 'latex') {
    // Pure LaTeX — use display-mode foreignObject.
    const onlySpan = spans[0] as { kind: 'latex'; expr: string };
    const processed = preprocessDollarDelimiters(onlySpan.expr);
    return renderLatexMathML(processed, x, y, w, h, theme.colors.text);
  }

  // Mixed text + LaTeX — inline flexbox div with KaTeX in inline mode.
  const htmlParts = spans.map((span) => {
    if (span.kind === 'text') {
      return `<span>${escapeHtml(span.content)}</span>`;
    }
    const processed = preprocessDollarDelimiters(span.expr);
    return katex.renderToString(processed, {
      output: 'mathml',
      throwOnError: false,
      displayMode: false,
    });
  });

  const inner =
    `<div xmlns="http://www.w3.org/1999/xhtml" ` +
    `style="display:flex;align-items:center;justify-content:center;` +
    `width:100%;height:100%;color:${theme.colors.text};` +
    `font-family:${theme.fontFamily};font-size:${theme.fontSize}px">` +
    htmlParts.join('') +
    `</div>`;

  return foreignObject(x, y, w, h, inner);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LabelSpan =
  | { kind: 'text'; content: string }
  | { kind: 'latex'; expr: string };

// ---------------------------------------------------------------------------
// parseLatexLabel
// ---------------------------------------------------------------------------

/**
 * Split a raw label string into an array of {@link LabelSpan} values.
 *
 * `<latex>…</latex>` regions become `{ kind: 'latex', expr }` spans.
 * Surrounding text becomes `{ kind: 'text', content }` spans.
 * Empty text spans are omitted from the result.
 *
 * Examples:
 *   "<latex>\\frac{a}{b}</latex>"
 *     → [{ kind:'latex', expr:'\\frac{a}{b}' }]
 *
 *   "prefix <latex>x^2</latex> suffix"
 *     → [{ kind:'text', content:'prefix ' }, { kind:'latex', expr:'x^2' },
 *        { kind:'text', content:' suffix' }]
 *
 *   "plain text"
 *     → [{ kind:'text', content:'plain text' }]
 */
export function parseLatexLabel(raw: string): LabelSpan[] {
  const spans: LabelSpan[] = [];
  // Case-insensitive to be tolerant of <LATEX>…</LATEX> variants.
  const re = /<latex>([\s\S]*?)<\/latex>/gi;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(raw)) !== null) {
    const before = raw.slice(last, match.index);
    if (before.length > 0) {
      spans.push({ kind: 'text', content: before });
    }
    spans.push({ kind: 'latex', expr: match[1] ?? '' });
    last = match.index + match[0].length;
  }

  const tail = raw.slice(last);
  if (tail.length > 0) {
    spans.push({ kind: 'text', content: tail });
  }

  // Guarantee at least one span — if input had no latex tags we still
  // return a text span (even for empty input: one empty text span).
  if (spans.length === 0) {
    spans.push({ kind: 'text', content: raw });
  }

  return spans;
}

// ---------------------------------------------------------------------------
// measureLatex
// ---------------------------------------------------------------------------

/** Structural markers that add height to a LaTeX expression. */
const STRUCTURAL_MARKERS = [
  '\\frac',
  '\\sum',
  '\\int',
  '\\prod',
  '\\sqrt',
] as const;

/**
 * Count "semantic atoms" in a LaTeX expression: each `\command` counts as
 * one atom (it renders as roughly one symbol-width), each non-structural
 * non-whitespace character counts as one atom, and `{`, `}`, `^`, `_`, `\`
 * are skipped (they are structural, not visual).
 *
 * This gives a far better width estimate than raw character count, because
 * multi-character commands like `\epsilon` or `\lambda` produce a single glyph.
 */
function countAtoms(expr: string): number {
  let count = 0;
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i]!;
    if (ch === '\\') {
      // Consume the command name; each named command → one atom
      let j = i + 1;
      while (j < expr.length && /[a-zA-Z]/.test(expr[j]!)) j++;
      if (j > i + 1) count++;  // named command (e.g. \frac, \lambda)
      // bare backslash-symbol (e.g. \\) → skip silently
      i = j;
    } else if (ch === '{' || ch === '}' || ch === '^' || ch === '_') {
      i++; // structural — skip
    } else if (ch === ' ' || ch === '\n' || ch === '\t') {
      i++; // whitespace — skip
    } else {
      count++; // regular character or operator
      i++;
    }
  }
  return count;
}

/**
 * Heuristic bounding box for a LaTeX expression.
 *
 * Width: count semantic atoms (each `\command` = 1, each visible char = 1)
 *        then multiply by 10px, floored at 120px.
 * Height: base 40px + 20px per structural marker (`\frac`, `\sum`, `\int`,
 *         `\prod`, `\sqrt`), capped at 80px.
 */
export function measureLatex(raw: string): { width: number; height: number } {
  // Strip <latex>…</latex> wrapper if present — the tags themselves must not
  // contribute to the atom count.
  const expr = raw.replace(/^<latex>([\s\S]*?)<\/latex>$/i, '$1').trim();

  let structuralCount = 0;
  for (const marker of STRUCTURAL_MARKERS) {
    let pos = 0;
    while ((pos = expr.indexOf(marker, pos)) !== -1) {
      structuralCount++;
      pos += marker.length;
    }
  }

  const height = Math.min(40 + structuralCount * 20, 80);
  const width = Math.max(120, countAtoms(expr) * 10);

  return { width, height };
}

// ---------------------------------------------------------------------------
// renderLatexMathML
// ---------------------------------------------------------------------------

/**
 * Render a LaTeX expression to an SVG `<foreignObject>` containing KaTeX
 * MathML output.
 *
 * @param expr   - LaTeX expression string.  `<latex>` / `</latex>` wrapper
 *                 tags are stripped automatically if present.
 * @param x      - Top-left x coordinate of the foreignObject.
 * @param y      - Top-left y coordinate of the foreignObject.
 * @param w      - Width of the foreignObject.
 * @param h      - Height of the foreignObject.
 * @param color  - Text fill colour (applied as CSS `color` on the wrapper div).
 * @returns SVG string containing `<foreignObject …>…</foreignObject>`.
 */
export function renderLatexMathML(
  expr: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): string {
  // Strip <latex>…</latex> wrapper if present.
  const stripped = expr.replace(/^<latex>([\s\S]*?)<\/latex>$/i, '$1').trim();

  const mathml = katex.renderToString(stripped, {
    output: 'mathml',
    throwOnError: false,
    displayMode: true,
  });

  // The foreignObject must contain an XHTML namespace wrapper for MathML to
  // render correctly in browsers.
  const inner =
    `<div xmlns="http://www.w3.org/1999/xhtml" ` +
    `style="display:flex;align-items:center;justify-content:center;` +
    `width:100%;height:100%;color:${color}">${mathml}</div>`;

  return foreignObject(x, y, w, h, inner);
}

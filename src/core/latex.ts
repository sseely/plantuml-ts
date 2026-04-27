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

/**
 * Render a node label as an SVG element, routing to KaTeX `<foreignObject>`
 * when the label contains a `<latex>` tag, and to a plain `<text>` element
 * otherwise.
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
  if (label.includes('<latex>')) {
    const { width: w, height: h } = measureLatex(label);
    return renderLatexMathML(label, cx - w / 2, cy - h / 2, w, h, theme.colors.text);
  }
  return text(cx, cy, label, {
    textAnchor: 'middle',
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fill: theme.colors.text,
  });
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
 * Heuristic bounding box for a LaTeX expression.
 *
 * Sizing formula (D3):
 *   base height = 40
 *   +20 px per structural marker (`\frac`, `\sum`, `\int`, `\prod`, `\sqrt`),
 *   capped at a total height of 80.
 *   width = max(120, expr.length * 5.5)
 */
export function measureLatex(expr: string): { width: number; height: number } {
  let structuralCount = 0;
  for (const marker of STRUCTURAL_MARKERS) {
    // Count all non-overlapping occurrences.
    let pos = 0;
    while ((pos = expr.indexOf(marker, pos)) !== -1) {
      structuralCount++;
      pos += marker.length;
    }
  }

  const height = Math.min(40 + structuralCount * 20, 80);
  const width = Math.max(120, expr.length * 5.5);

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

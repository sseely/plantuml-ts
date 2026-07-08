/**
 * SVG primitive builders — pure string functions, no DOM API.
 *
 * All SVG markup in plantuml-ts flows through these functions.
 * Callers compose the returned strings; nothing here touches document or DOM.
 */

import { paintToSvg } from './paint.js';
import type { Paint } from './paint.js';
import { arrowHead, ALL_ARROW_TYPES } from './svg-markers.js';

// Arrow-marker builders live in ./svg-markers (no Paint involvement); re-export
// them here so existing importers of `core/svg.js` are unaffected by the split.
export { arrowHead, arrowHeadRef, ALL_ARROW_TYPES } from './svg-markers.js';
export type { ArrowType } from './svg-markers.js';

// ---------------------------------------------------------------------------
// Style interfaces
// ---------------------------------------------------------------------------

export interface BoxStyle {
  fill?: Paint;
  stroke?: Paint;
  strokeWidth?: number;
  strokeDasharray?: string;
  rx?: number;
  opacity?: number;
  filter?: string;
}

export interface LineStyle {
  stroke?: Paint;
  strokeWidth?: number;
  strokeDasharray?: string;
  markerEnd?: string;
  markerStart?: string;
}

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  fill?: Paint;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: 'middle' | 'central' | 'auto' | 'hanging';
}

/**
 * Arbitrary SVG attribute map.  Keys are attribute names (e.g. `fill`,
 * `transform`); values are strings or numbers — `undefined` entries are
 * silently omitted from output.
 */
export type SvgAttrs = Record<string, string | number | undefined>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Named-entity replacements for the XML-significant characters. Built from a
// string (not a regex literal) — the complexity checker miscounts regex
// literals containing `<`/`>` (same workaround as paint.ts).
const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};
const XML_RE = new RegExp('[&<>"]', 'g');

/**
 * Escape characters that are special in XML text content and attribute values.
 */
function escapeXml(s: string): string {
  return s.replace(XML_RE, (ch) => XML_ENTITIES[ch] ?? ch);
}

/**
 * Build a flat attribute string from an object.
 * Only includes entries where the value is not undefined.
 */
function attrs(
  entries: ReadonlyArray<readonly [string, string | number | undefined]>,
): string {
  const parts: string[] = [];
  for (const [name, value] of entries) {
    if (value !== undefined) {
      parts.push(`${name}="${String(value)}"`);
    }
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

/**
 * Build a flat attribute string from a SvgAttrs record.
 * Only includes entries where the value is not undefined.
 */
function attrsFromRecord(record: SvgAttrs): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(record)) {
    if (value !== undefined) {
      parts.push(`${name}="${String(value)}"`);
    }
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

/**
 * Like {@link SvgAttrs} but each value may also be a {@link Paint}. Used by the
 * free-form `extraAttrs` bag of `ellipse`/`diamond`, resolved via
 * {@link resolvePaintAttrs}.
 */
export type SvgAttrsPaint = Record<string, string | number | Paint | undefined>;

/**
 * Resolve one {@link Paint} (a style's `fill`/`stroke`) to its plain attribute
 * value plus any inline `<linearGradient>` def it needs. A plain
 * string/`undefined` round-trips with `def: ''`, so output stays byte-identical
 * to the pre-Paint implementation for non-gradient input.
 */
function resolvePaint(p: Paint | undefined): {
  value: string | undefined;
  def: string;
} {
  if (p === undefined) return { value: undefined, def: '' };
  const resolved = paintToSvg(p);
  return { value: resolved.fill, def: resolved.def ?? '' };
}

/**
 * Resolve every {@link Paint} in a free-form {@link SvgAttrsPaint} record to a
 * plain {@link SvgAttrs}, collecting the `<linearGradient>` defs those gradients
 * need. Non-Paint entries pass through unchanged.
 */
function resolvePaintAttrs(record: SvgAttrsPaint): {
  plain: SvgAttrs;
  def: string;
} {
  const plain: SvgAttrs = {};
  let def = '';
  for (const [key, value] of Object.entries(record)) {
    if (value !== null && typeof value === 'object') {
      const resolved = paintToSvg(value);
      plain[key] = resolved.fill;
      def += resolved.def ?? '';
    } else {
      plain[key] = value;
    }
  }
  return { plain, def };
}

// ---------------------------------------------------------------------------
// Primitive builders
// ---------------------------------------------------------------------------

/**
 * `<rect>` element.
 */
export function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  style: BoxStyle = {},
): string {
  const fillR = resolvePaint(style.fill);
  const strokeR = resolvePaint(style.stroke);
  const a = attrs([
    ['x', x],
    ['y', y],
    ['width', w],
    ['height', h],
    ['fill', fillR.value],
    ['stroke', strokeR.value],
    ['stroke-width', style.strokeWidth],
    ['stroke-dasharray', style.strokeDasharray],
    ['rx', style.rx],
    ['opacity', style.opacity],
    ['filter', style.filter],
  ] as const);
  return `${fillR.def}${strokeR.def}<rect${a}/>`;
}

/**
 * `<line>` element.
 */
export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: LineStyle = {},
): string {
  const strokeR = resolvePaint(style.stroke);
  const a = attrs([
    ['x1', x1],
    ['y1', y1],
    ['x2', x2],
    ['y2', y2],
    ['stroke', strokeR.value],
    ['stroke-width', style.strokeWidth],
    ['stroke-dasharray', style.strokeDasharray],
    ['marker-end', style.markerEnd],
    ['marker-start', style.markerStart],
  ] as const);
  return `${strokeR.def}<line${a}/>`;
}

/**
 * `<text>` element wrapping content in a `<tspan>`.
 *
 * Content is XML-escaped. Style attributes are placed on the outer `<text>`.
 */
export function text(
  x: number,
  y: number,
  content: string,
  style: TextStyle = {},
): string {
  const fillR = resolvePaint(style.fill);
  const a = attrs([
    ['x', x],
    ['y', y],
    ['font-family', style.fontFamily],
    ['font-size', style.fontSize],
    ['font-weight', style.fontWeight],
    ['font-style', style.fontStyle],
    ['fill', fillR.value],
    ['text-anchor', style.textAnchor],
    ['dominant-baseline', style.dominantBaseline],
  ] as const);
  return `${fillR.def}<text${a}><tspan>${escapeXml(content)}</tspan></text>`;
}

/**
 * `<path>` element. Always rendered with fill="none" — paths are used
 * exclusively for lines and edges, never for filled shapes.
 */
export function path(d: string, style: LineStyle = {}): string {
  const strokeR = resolvePaint(style.stroke);
  const a = attrs([
    ['d', d],
    ['fill', 'none'],
    ['stroke', strokeR.value],
    ['stroke-width', style.strokeWidth],
    ['stroke-dasharray', style.strokeDasharray],
    ['marker-end', style.markerEnd],
    ['marker-start', style.markerStart],
  ] as const);
  return `${strokeR.def}<path${a}/>`;
}

/**
 * `<ellipse>` element centred at (cx, cy) with horizontal radius rx and
 * vertical radius ry.  Optional SvgAttrs are appended after the geometry
 * attributes.
 */
export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  extraAttrs?: SvgAttrsPaint,
): string {
  const a = attrs([
    ['cx', cx],
    ['cy', cy],
    ['rx', rx],
    ['ry', ry],
  ] as const);
  const resolved =
    extraAttrs !== undefined ? resolvePaintAttrs(extraAttrs) : undefined;
  const extra = resolved !== undefined ? attrsFromRecord(resolved.plain) : '';
  const def = resolved?.def ?? '';
  return `${def}<ellipse${a}${extra}/>`;
}

/**
 * Diamond shape rendered as a `<polygon>`.
 *
 * The four points are computed from the centre (cx, cy) and the half-size:
 * - top:    (cx, cy - size)
 * - right:  (cx + size, cy)
 * - bottom: (cx, cy + size)
 * - left:   (cx - size, cy)
 */
export function diamond(
  cx: number,
  cy: number,
  size: number,
  extraAttrs?: SvgAttrsPaint,
): string {
  const points =
    `${cx},${cy - size} ` +
    `${cx + size},${cy} ` +
    `${cx},${cy + size} ` +
    `${cx - size},${cy}`;
  const a = attrs([['points', points]] as const);
  const resolved =
    extraAttrs !== undefined ? resolvePaintAttrs(extraAttrs) : undefined;
  const extra = resolved !== undefined ? attrsFromRecord(resolved.plain) : '';
  const def = resolved?.def ?? '';
  return `${def}<polygon${a}${extra}/>`;
}

/**
 * `<polygon>` from an explicit point list, with fill/stroke styling.
 */
export function polygon(
  points: ReadonlyArray<{ x: number; y: number }>,
  style: BoxStyle = {},
): string {
  const pts = points.map((p) => `${p.x},${p.y}`).join(' ');
  const fillR = resolvePaint(style.fill);
  const strokeR = resolvePaint(style.stroke);
  const a = attrs([
    ['points', pts],
    ['fill', fillR.value],
    ['stroke', strokeR.value],
    ['stroke-width', style.strokeWidth],
    ['stroke-dasharray', style.strokeDasharray],
  ] as const);
  return `${fillR.def}${strokeR.def}<polygon${a}/>`;
}

/**
 * `<g>` group element — two overloads:
 *
 * 1. Legacy: `group(id: string, children: string[])` — wraps an array of
 *    child strings in `<g id="…">…</g>`.  Used throughout the existing
 *    codebase.
 *
 * 2. New: `group(children: string, extraAttrs?: SvgAttrs)` — wraps a single
 *    pre-composed child string in `<g …>…</g>` with arbitrary SVG attrs.
 */
export function group(id: string, children: string[]): string;
export function group(children: string, extraAttrs?: SvgAttrs): string;
export function group(
  first: string,
  second?: string[] | SvgAttrs,
): string {
  if (Array.isArray(second)) {
    // Legacy overload: group(id, children[])
    return `<g id="${first}">${second.join('')}</g>`;
  }
  // New overload: group(children, extraAttrs?)
  // After the Array.isArray guard, `second` is narrowed to SvgAttrs | undefined
  const extra = second !== undefined ? attrsFromRecord(second) : '';
  return `<g${extra}>${first}</g>`;
}

/**
 * `<defs>` element.
 */
export function defs(children: string[]): string {
  return `<defs>${children.join('')}</defs>`;
}

/**
 * `<foreignObject>` element.
 *
 * Used to embed HTML/MathML content (e.g. KaTeX MathML) inside SVG.
 * The `content` string is inserted verbatim — callers are responsible for
 * providing valid (X)HTML content including any required namespace attributes.
 *
 * @param x       - Top-left x coordinate.
 * @param y       - Top-left y coordinate.
 * @param w       - Width of the foreignObject.
 * @param h       - Height of the foreignObject.
 * @param content - Inner HTML/MathML string (verbatim, not escaped).
 */
export function foreignObject(
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
): string {
  return (
    `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}">` +
    content +
    `</foreignObject>`
  );
}

// ---------------------------------------------------------------------------
// SVG root
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Note box (sticky-note shape with dog-ear fold)
// ---------------------------------------------------------------------------

export interface NoteBoxStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dogEar?: number;
}

/**
 * Renders a sticky-note shape: a rectangle with the top-right corner
 * replaced by a folded dog-ear, plus two crease lines that show the fold.
 *
 * Returns only the shape SVG — callers render text on top.
 *
 * @param dogEar - Size of the folded corner in px (default 10).
 */
export function noteBox(
  x: number,
  y: number,
  w: number,
  h: number,
  style: NoteBoxStyle = {},
): string {
  const {
    fill = '#FEFECE',
    stroke = '#AAAAAA',
    strokeWidth = 1,
    dogEar = 10,
  } = style;
  const sw = strokeWidth;
  const d = dogEar;
  // Pentagon: top-left → fold-point on top edge → dog-ear corner → bottom-right → bottom-left
  const body =
    `<path d="M${x},${y} L${x + w - d},${y} L${x + w},${y + d} ` +
    `L${x + w},${y + h} L${x},${y + h} Z" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  // Two crease lines: vertical drop from fold-point, then horizontal to right edge
  const crease =
    `<line x1="${x + w - d}" y1="${y}" x2="${x + w - d}" y2="${y + d}" stroke="${stroke}" stroke-width="${sw}"/>` +
    `<line x1="${x + w - d}" y1="${y + d}" x2="${x + w}" y2="${y + d}" stroke="${stroke}" stroke-width="${sw}"/>`;
  return body + crease;
}

/**
 * Builds the outer `<svg>` wrapper.
 *
 * Always embeds all arrow markers in a `<defs>` block so callers can
 * freely use `markerEnd`/`markerStart` referencing `arrowHeadRef(type)`
 * without worrying about whether the marker has been included.
 *
 * @param bgColor   - Background color used to fill hollow arrowheads (extension,
 *   implementation, aggregation) so the edge line is masked inside the shape.
 *   Defaults to white; pass `theme.colors.background` for theme correctness.
 * @param extraDefs - Optional extra `<marker>` (or other `<defs>`) strings to
 *   include in the single top-level `<defs>` block. Inserting markers here
 *   guarantees they are defined before any `url(#id)` reference in the body,
 *   which is required when the SVG is injected via `innerHTML`.
 */
// Matches one inline gradient def. Built from a string (not a regex literal) —
// the complexity checker miscounts `<`/`>` in literals. The id capture is the
// FNV/base36 content-hash `paintToSvg` emits (`g` + [0-9a-z]); `[\s\S]*?` is
// newline-safe and non-greedy so adjacent distinct defs don't merge.
const GRADIENT_DEF_RE = new RegExp(
  '<linearGradient id="(g[0-9a-z]+)"[\\s\\S]*?</linearGradient>',
  'g',
);

/**
 * Collapse repeated inline `<linearGradient>` defs (decision D3): shapes emit
 * their gradient def inline before themselves, so a gradient shared by N shapes
 * appears N times. Because the id is a content hash, repeats are byte-identical
 * — keep the first occurrence per id and drop the rest.
 */
function dedupeGradientDefs(svg: string): string {
  const seen = new Set<string>();
  return svg.replace(GRADIENT_DEF_RE, (match, id: string) => {
    if (seen.has(id)) return '';
    seen.add(id);
    return match;
  });
}

export function svgRoot(
  width: number,
  height: number,
  children: string[],
  bgColor = '#FFFFFF',
  extraDefs = '',
): string {
  const markers = ALL_ARROW_TYPES.map((t) => arrowHead(t, bgColor));
  const defsBlock = defs([...markers, extraDefs]);
  const isSolid = bgColor !== 'transparent' && bgColor !== 'none';
  const bgRect = isSolid
    ? `<rect width="${width}" height="${height}" fill="${bgColor}"/>`
    : '';
  const body = dedupeGradientDefs(defsBlock + bgRect + children.join(''));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    body +
    `</svg>`
  );
}

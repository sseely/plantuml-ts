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
  ry?: number;
  opacity?: number;
  filter?: string;
}

export interface LineStyle {
  stroke?: Paint;
  strokeWidth?: number;
  strokeDasharray?: string;
  markerEnd?: string;
  markerStart?: string;
  /** `<path id="...">` -- jar's `Link#idCommentForSvg()` value
   *  (`class/renderer.ts#linkIdForSvg`). */
  id?: string;
  /** `<path codeLine="...">` -- jar's `Link#getCodeLine()` (0-indexed
   *  source line), emitted verbatim as a string attribute, matching
   *  `core/klimt/drawing/svg/svg-graphics-elements.ts`'s own `codeLine`
   *  emission for the klimt path. */
  codeLine?: string;
  /** `<path fill="...">` -- OPTIONAL, defaults to `'none'` (this function's
   *  own long-standing "paths are lines/edges, never filled shapes"
   *  convention, unchanged for every existing caller that omits it). G2/N13
   *  (`class/renderer-note.ts#renderTipNote`) is the first caller that
   *  needs a FILLED path: the Opale zigzag-notch note outline is a single
   *  `<path>` (arc + line commands, not representable as a `<polygon>`)
   *  with a real background fill, matching jar's own `Opale.java#drawU`
   *  (`ug.apply(noteBackgroundColor.bg())` before `ug.draw(polygon)`). */
  fill?: Paint;
}

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  fill?: Paint;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: 'middle' | 'central' | 'auto' | 'hanging';
  /**
   * Emitted verbatim as the SVG `text-decoration` attribute. The error diagram
   * (`src/core/error/error-renderer.ts`) needs `wavy underline` -- what the jar
   * emits under the offending source line -- and `underline` for the Welcome
   * block's hyperlink. Neither is expressible as a font property.
   */
  textDecoration?: string;
  /**
   * G2 N4: the pre-measured text width, matching klimt's own `textLength`
   * emission (`core/klimt/drawing/svg/svg-graphics-elements.ts`'s
   * `applyTextLengthAdjust`) -- jar (`-DPLANTUML_DETERMINISTIC_TEXT=true`)
   * emits this on every `<text>` so the SVG viewer stretches/compresses
   * glyphs to the SAME width this port's own measurer computed, rather than
   * leaving inter-character spacing up to the viewer's own font metrics.
   * Additive/optional: every pre-existing caller of `text()` omits it
   * (unchanged output) except class's member/header rows (G2 N4).
   */
  textLength?: number;
  /** Always `'spacing'` in this codebase's own usage (matches klimt's own
   *  `LengthAdjust.SPACING` default) -- kept as a real field, not a hardcoded
   *  literal in `text()`, so a future `spacingAndGlyphs` caller does not need
   *  a signature change. */
  lengthAdjust?: 'spacing' | 'spacingAndGlyphs';
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
    ['ry', style.ry],
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
 * `<text>` element with plain (un-tspan-wrapped) text content.
 *
 * G2 N4: previously ALWAYS wrapped content in a bare `<tspan>` -- removed.
 * jar's own single-run text draws (`SvgGraphicsCore#text`/
 * `svg-graphics-elements.ts`'s own `setTextContent`, which this port's
 * klimt path already mirrors with zero `<tspan>`) never wrap a simple
 * string in `<tspan>` at all -- `<tspan>` is reserved for MULTI-styled-run
 * or explicit multi-LINE text, each getting its OWN dedicated `<tspan
 * x="..." y="...">` (e.g. `diagrams/activity/renderer.ts`'s own multiline
 * builder, which never calls this function). Verified: 0/351+ cached jar
 * fixtures across `state`/`object` (the two other `core/svg.ts#text()`
 * consumers surveyed) contain a `<tspan>` for a single-run label; this was
 * a universal, cross-diagram-type divergence (`svg/g/g/text/tspan`,
 * 407/718 reach in class's own census alone, `plans/g2-class-svg/
 * ledger.md` N4) -- description/component/usecase are UNAFFECTED (klimt-
 * drawn, never call this function; their own census stays byte-identical).
 *
 * Content is XML-escaped. Style attributes are placed on the outer `<text>`.
 */
/**
 * Normalize a raw skinparam font-family value for SVG attribute emission.
 *
 * `skinparam defaultFontName "Liberation Mono"` retains its surrounding
 * quotes as part of the theme's raw string (mirrors upstream's own
 * `FontStack#fullDefinition`, which keeps them too) -- but `attrs()` below
 * does no XML escaping, so embedding a literal `"` inside a `"`-delimited
 * attribute value produces malformed XML. Upstream's own SVG writer
 * (`FontStack#getSvgFamily`, klimt/font/FontStack.java:187) resolves this
 * the SAME way: swap `"` for `'` rather than stripping/escaping -- jar-
 * verified (`tipude-10-tizi427`: `font-family="'Liberation Mono'"`). G2 N12.
 */
function toSvgFontFamily(family: string | undefined): string | undefined {
  return family === undefined ? undefined : family.replace(/"/g, "'");
}

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
    ['font-family', toSvgFontFamily(style.fontFamily)],
    ['font-size', style.fontSize],
    ['font-weight', style.fontWeight],
    ['font-style', style.fontStyle],
    ['fill', fillR.value],
    ['text-anchor', style.textAnchor],
    ['dominant-baseline', style.dominantBaseline],
    ['text-decoration', style.textDecoration],
    ['lengthAdjust', style.lengthAdjust],
    ['textLength', style.textLength],
  ] as const);
  return `${fillR.def}<text${a}>${escapeXml(content)}</text>`;
}

/**
 * `<path>` element. Always rendered with fill="none" — paths are used
 * exclusively for lines and edges, never for filled shapes.
 */
export function path(d: string, style: LineStyle = {}): string {
  const strokeR = resolvePaint(style.stroke);
  const fillR = style.fill !== undefined ? resolvePaint(style.fill) : undefined;
  const a = attrs([
    ['d', d],
    ['fill', fillR?.value ?? 'none'],
    ['stroke', strokeR.value],
    ['stroke-width', style.strokeWidth],
    ['stroke-dasharray', style.strokeDasharray],
    ['marker-end', style.markerEnd],
    ['marker-start', style.markerStart],
    ['id', style.id],
    ['codeLine', style.codeLine],
  ] as const);
  return `${strokeR.def}${fillR?.def ?? ''}<path${a}/>`;
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

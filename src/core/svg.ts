/**
 * SVG primitive builders — pure string functions, no DOM API.
 *
 * All SVG markup in plantuml-js flows through these functions.
 * Callers compose the returned strings; nothing here touches document or DOM.
 */

// ---------------------------------------------------------------------------
// Style interfaces
// ---------------------------------------------------------------------------

export interface BoxStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  rx?: number;
  opacity?: number;
}

export interface LineStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  markerEnd?: string;
  markerStart?: string;
  /** Sets SVG `color` attribute so marker children can use `currentColor`. */
  color?: string;
}

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  fill?: string;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: 'middle' | 'central' | 'auto';
}

/**
 * Arbitrary SVG attribute map.  Keys are attribute names (e.g. `fill`,
 * `transform`); values are strings or numbers — `undefined` entries are
 * silently omitted from output.
 */
export type SvgAttrs = Record<string, string | number | undefined>;

// ---------------------------------------------------------------------------
// Arrow type
// ---------------------------------------------------------------------------

export type ArrowType =
  | 'sync'
  | 'async'
  | 'reply'
  | 'replyAsync'
  | 'extension'
  | 'implementation'
  | 'composition'
  | 'aggregation'
  | 'dependency'
  | 'lost'
  | 'found';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Escape characters that are special in XML text content and attribute values.
 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  const a = attrs([
    ['x', x],
    ['y', y],
    ['width', w],
    ['height', h],
    ['fill', style.fill],
    ['stroke', style.stroke],
    ['stroke-width', style.strokeWidth],
    ['stroke-dasharray', style.strokeDasharray],
    ['rx', style.rx],
    ['opacity', style.opacity],
  ] as const);
  return `<rect${a}/>`;
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
  const a = attrs([
    ['x1', x1],
    ['y1', y1],
    ['x2', x2],
    ['y2', y2],
    ['stroke', style.stroke],
    ['stroke-width', style.strokeWidth],
    ['stroke-dasharray', style.strokeDasharray],
    ['marker-end', style.markerEnd],
    ['marker-start', style.markerStart],
  ] as const);
  return `<line${a}/>`;
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
  const a = attrs([
    ['x', x],
    ['y', y],
    ['font-family', style.fontFamily],
    ['font-size', style.fontSize],
    ['font-weight', style.fontWeight],
    ['font-style', style.fontStyle],
    ['fill', style.fill],
    ['text-anchor', style.textAnchor],
    ['dominant-baseline', style.dominantBaseline],
  ] as const);
  return `<text${a}><tspan>${escapeXml(content)}</tspan></text>`;
}

/**
 * `<path>` element. Always rendered with fill="none" — paths are used
 * exclusively for lines and edges, never for filled shapes.
 */
export function path(d: string, style: LineStyle = {}): string {
  const a = attrs([
    ['d', d],
    ['fill', 'none'],
    ['stroke', style.stroke],
    ['stroke-width', style.strokeWidth],
    ['stroke-dasharray', style.strokeDasharray],
    ['marker-end', style.markerEnd],
    ['marker-start', style.markerStart],
    ['color', style.color],
  ] as const);
  return `<path${a}/>`;
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
  extraAttrs?: SvgAttrs,
): string {
  const a = attrs([
    ['cx', cx],
    ['cy', cy],
    ['rx', rx],
    ['ry', ry],
  ] as const);
  const extra = extraAttrs !== undefined ? attrsFromRecord(extraAttrs) : '';
  return `<ellipse${a}${extra}/>`;
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
  extraAttrs?: SvgAttrs,
): string {
  const points =
    `${cx},${cy - size} ` +
    `${cx + size},${cy} ` +
    `${cx},${cy + size} ` +
    `${cx - size},${cy}`;
  const a = attrs([['points', points]] as const);
  const extra = extraAttrs !== undefined ? attrsFromRecord(extraAttrs) : '';
  return `<polygon${a}${extra}/>`;
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
// Arrow markers
// ---------------------------------------------------------------------------

/**
 * Returns the marker id string for a given ArrowType.
 * Used as the `id` attribute on the `<marker>` element and as the
 * target of `url(#<id>)` references.
 */
export function arrowHeadRef(type: ArrowType): string {
  return `arrow-${type}`;
}

/**
 * Returns a `<marker>` element string for the given ArrowType.
 *
 * Design notes (from planning/decisions.md, decision D3):
 * - sync / reply      : filled closed triangle
 * - async / replyAsync: open arrowhead (two lines, no fill)
 * - extension         : large hollow triangle (inheritance)
 * - implementation    : same hollow triangle as extension
 * - composition       : filled diamond
 * - aggregation       : hollow diamond
 * - dependency        : open arrowhead (like async)
 * - lost / found      : circle marker
 */
export function arrowHead(type: ArrowType, bgColor = '#FFFFFF'): string {
  const id = arrowHeadRef(type);

  switch (type) {
    case 'sync':
    case 'reply':
      // Filled closed triangle pointing right
      return (
        `<marker id="${id}" markerWidth="10" markerHeight="7" ` +
        `refX="9" refY="3.5" orient="auto">` +
        `<polygon points="0 0, 10 3.5, 0 7" fill="#000000"/>` +
        `</marker>`
      );

    case 'async':
    case 'replyAsync':
      // Open arrowhead (two-line "V" shape, no fill)
      return (
        `<marker id="${id}" markerWidth="10" markerHeight="7" ` +
        `refX="9" refY="3.5" orient="auto">` +
        `<polyline points="0 0, 9 3.5, 0 7" fill="none" stroke="#000000" stroke-width="1.5"/>` +
        `</marker>`
      );

    case 'dependency':
      // Open arrowhead — fixed pixel size (markerUnits="userSpaceOnUse") so the
      // arrowhead does not scale with the edge stroke-width. Uses currentColor so
      // the referencing element's `color` attribute propagates into the marker.
      return (
        `<marker id="${id}" markerWidth="10" markerHeight="7" ` +
        `refX="9" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">` +
        `<polyline points="0 0, 9 3.5, 0 7" fill="none" stroke="currentColor" stroke-width="1.5"/>` +
        `</marker>`
      );

    case 'extension':
    case 'implementation':
      // Large hollow triangle (UML inheritance / realization).
      // Fill with background color so the edge line is masked inside the triangle.
      return (
        `<marker id="${id}" markerWidth="12" markerHeight="10" ` +
        `refX="11" refY="5" orient="auto">` +
        `<polygon points="0 0, 11 5, 0 10" fill="${bgColor}" stroke="#000000" stroke-width="1.5"/>` +
        `</marker>`
      );

    case 'composition':
      // Filled diamond
      return (
        `<marker id="${id}" markerWidth="12" markerHeight="8" ` +
        `refX="11" refY="4" orient="auto">` +
        `<polygon points="0 4, 5 0, 11 4, 5 8" fill="#000000"/>` +
        `</marker>`
      );

    case 'aggregation':
      // Hollow diamond — fill with background color to mask the line inside.
      return (
        `<marker id="${id}" markerWidth="12" markerHeight="8" ` +
        `refX="11" refY="4" orient="auto">` +
        `<polygon points="0 4, 5 0, 11 4, 5 8" fill="${bgColor}" stroke="#000000" stroke-width="1.5"/>` +
        `</marker>`
      );

    case 'lost':
      // Circle at the end of the line
      return (
        `<marker id="${id}" markerWidth="8" markerHeight="8" ` +
        `refX="4" refY="4" orient="auto">` +
        `<circle cx="4" cy="4" r="3" fill="#000000"/>` +
        `</marker>`
      );

    case 'found':
      // Circle at the start of the line (hollow to distinguish from lost)
      return (
        `<marker id="${id}" markerWidth="8" markerHeight="8" ` +
        `refX="4" refY="4" orient="auto">` +
        `<circle cx="4" cy="4" r="3" fill="none" stroke="#000000" stroke-width="1.5"/>` +
        `</marker>`
      );
  }
}

// ---------------------------------------------------------------------------
// SVG root
// ---------------------------------------------------------------------------

/** All arrow types — used to embed every marker in every svgRoot. */
const ALL_ARROW_TYPES: readonly ArrowType[] = [
  'sync',
  'async',
  'reply',
  'replyAsync',
  'extension',
  'implementation',
  'composition',
  'aggregation',
  'dependency',
  'lost',
  'found',
];

/**
 * Builds the outer `<svg>` wrapper.
 *
 * Always embeds all arrow markers in a `<defs>` block so callers can
 * freely use `markerEnd`/`markerStart` referencing `arrowHeadRef(type)`
 * without worrying about whether the marker has been included.
 *
 * @param bgColor - Background color used to fill hollow arrowheads (extension,
 *   implementation, aggregation) so the edge line is masked inside the shape.
 *   Defaults to white; pass `theme.colors.background` for theme correctness.
 */
export function svgRoot(
  width: number,
  height: number,
  children: string[],
  bgColor = '#FFFFFF',
): string {
  const markers = ALL_ARROW_TYPES.map((t) => arrowHead(t, bgColor));
  const defsBlock = defs(markers);
  const isSolid = bgColor !== 'transparent' && bgColor !== 'none';
  const bgRect = isSolid
    ? `<rect width="${width}" height="${height}" fill="${bgColor}"/>`
    : '';
  const body = defsBlock + bgRect + children.join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    body +
    `</svg>`
  );
}

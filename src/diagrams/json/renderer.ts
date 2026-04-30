/**
 * JSON diagram SVG renderer.
 *
 * Synchronous: JsonGeometry + Theme → SVG string.
 * No DOM, no async, no canvas.
 */

import { rect, line, text, path, svgRoot } from '../../core/svg.js';
import type { Theme } from '../../core/theme.js';
import type { JsonGeometry, JsonNodeGeo, JsonEdgeGeo, JsonRowGeo } from './layout.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const H_PAD = 8;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function valueColor(
  valueType: JsonRowGeo['valueType'],
  json: Theme['colors']['graph']['json'],
): string {
  switch (valueType) {
    case 'string':  return json?.stringValue  ?? '#3A6E96';
    case 'number':  return json?.numberValue  ?? '#A67F52';
    case 'boolean': return json?.booleanValue ?? '#BE5D47';
    case 'null':    return json?.nullValue    ?? '#767676';
    default:        return json?.keyText      ?? '#181818';
  }
}

function buildEdgePathD(
  edge: JsonEdgeGeo,
): string {
  const pts = edge.points;
  if (pts.length === 0) return '';

  const p0 = pts[0];
  if (p0 === undefined) return '';

  if (pts.length === 1) {
    return `M ${p0.x} ${p0.y}`;
  }

  if (edge.spline && pts.length >= 4) {
    // Explicit Bézier control points: M p0 C p1 p2 p3 [C p4 p5 p6 ...]
    const parts: string[] = [`M ${p0.x} ${p0.y}`];
    let i = 1;
    while (i + 2 < pts.length) {
      const cp1 = pts[i]!;
      const cp2 = pts[i + 1]!;
      const end = pts[i + 2]!;
      parts.push(`C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`);
      i += 3;
    }
    return parts.join(' ');
  }

  // Straight line (2-point or spline=false)
  const p1 = pts[pts.length - 1]!;
  return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`;
}

function renderNode(node: JsonNodeGeo, theme: Theme): string {
  const json = theme.colors.graph.json;
  const bg       = json?.background          ?? '#FFFFFF';
  const border   = json?.border              ?? '#181818';
  const headerBg = json?.headerBackground    ?? '#F1F1F1';
  const hlBg     = json?.highlightBackground ?? '#FEFECE';
  const keyColor = json?.keyText             ?? '#181818';

  const parts: string[] = [];

  // --- Highlighted row backgrounds (behind everything else) ---
  for (const row of node.rows) {
    if (row.highlight) {
      parts.push(
        rect(1, row.y + 1, node.width - 2, row.height - 1, {
          fill: hlBg,
        }),
      );
    }
  }

  // --- Outer border ---
  parts.push(
    rect(0, 0, node.width, node.height, {
      fill: bg,
      stroke: border,
      strokeWidth: 1,
      rx: 4,
    }),
  );

  // --- Key-column background ---
  parts.push(
    rect(0, 0, node.keyColWidth, node.height, {
      fill: headerBg,
    }),
  );

  // --- Row separators (skip first row — no line above the first entry) ---
  for (let i = 1; i < node.rows.length; i++) {
    const row = node.rows[i]!;
    parts.push(
      line(0, row.y, node.width, row.y, {
        stroke: border,
        strokeWidth: 0.5,
      }),
    );
  }

  // --- Vertical column divider ---
  parts.push(
    line(node.keyColWidth, 0, node.keyColWidth, node.height, {
      stroke: border,
      strokeWidth: 0.5,
    }),
  );

  // --- Row text ---
  for (const row of node.rows) {
    const midY = row.y + row.height / 2;

    // Key text
    parts.push(
      text(H_PAD, midY, row.key, {
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize,
        fill: keyColor,
        dominantBaseline: 'middle',
      }),
    );

    // Value text (skip for nested/empty values)
    if (row.value !== '') {
      parts.push(
        text(node.keyColWidth + H_PAD, midY, row.value, {
          fontFamily: theme.fontFamily,
          fontSize: theme.fontSize,
          fill: valueColor(row.valueType, json),
          dominantBaseline: 'middle',
        }),
      );
    }
  }

  const inner = parts.join('');
  return `<g transform="translate(${node.x}, ${node.y})">${inner}</g>`;
}

function renderEdge(edge: JsonEdgeGeo, theme: Theme): string {
  const d = buildEdgePathD(edge);
  if (d === '') return '';

  const stroke = theme.colors.graph.json?.arrowColor ?? theme.colors.arrow;

  return path(d, {
    stroke,
    strokeWidth: 1,
    markerEnd: 'url(#arrow-dependency)',
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a JSON diagram geometry into an SVG string.
 */
export function renderJson(geo: JsonGeometry, theme: Theme): string {
  if (geo.nodes.length === 0) {
    return svgRoot(0, 0, []);
  }

  const parts: string[] = [];

  if (geo.title !== undefined) {
    const titleY = Math.ceil(theme.fontSize * 1.4);
    parts.push(
      text(geo.width / 2, titleY, geo.title, {
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize,
        fontWeight: 'bold',
        fill: theme.colors.text,
        textAnchor: 'middle',
      }),
    );
  }

  for (const node of geo.nodes) {
    parts.push(renderNode(node, theme));
  }

  for (const edge of geo.edges) {
    parts.push(renderEdge(edge, theme));
  }

  return svgRoot(geo.width, geo.height, parts, theme.colors.background);
}

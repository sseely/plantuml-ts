/**
 * JSON diagram SVG renderer.
 *
 * Synchronous: JsonGeometry + Theme → SVG string.
 * No DOM, no async, no canvas.
 */

import { rect, line, text, path, svgRoot, ellipse } from '../../core/svg.js';
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

  // Stub + optional horizontal segment + S-curve to child.
  // When a rank-boundary waypoint is present (3-point edge), the edge travels
  // horizontally to clear wider siblings at the same rank before curving to
  // the destination. Without a waypoint (2-point edge), it curves directly.
  const DOT_STUB = 13;
  const pEnd = pts[pts.length - 1]!;
  const pCurveStart = pts.length >= 3 ? pts[pts.length - 2]! : p0;
  const dx = pEnd.x - pCurveStart.x;
  const dy = pEnd.y - pCurveStart.y;
  const cp1x = pCurveStart.x + dx * 0.4;
  const cp2x = pCurveStart.x + dx * 0.6;
  const cp2y = pCurveStart.y + dy * 0.6;
  const curve = `C ${cp1x} ${pCurveStart.y} ${cp2x} ${cp2y} ${pEnd.x} ${pEnd.y}`;
  const horizontal = pts.length >= 3 ? `L ${pCurveStart.x} ${p0.y} ` : '';
  return `M ${p0.x - DOT_STUB} ${p0.y} L ${p0.x} ${p0.y} ${horizontal}${curve}`;
}

function renderNode(node: JsonNodeGeo, theme: Theme): string {
  const json = theme.colors.graph.json;
  // Inherit from global theme colors when no explicit JSON override is set.
  // This allows built-in themes (amiga, cerulean, etc.) to colorize JSON nodes
  // without needing per-theme json overrides.
  const bg       = json?.background       ?? theme.colors.background;
  const border   = json?.border           ?? theme.colors.border;
  // headerBackground inherits from the node background (matches upstream style inheritance)
  const headerBg = json?.headerBackground ?? bg;
  const hlBg     = json?.highlightBackground ?? '#CCFF02';
  const keyColor = json?.keyText          ?? theme.colors.text;

  // jsonDiagram.node style overrides (defaults from plantuml.skin yamlDiagram,jsonDiagram block)
  const rx              = json?.roundCorner ?? 10;
  const borderWidth     = json?.nodeLineThickness ?? 1.5;
  const nodeFontSize    = json?.nodeFontSize   ?? theme.fontSize;
  const nodeFontFamily  = json?.nodeFontFamily ?? theme.fontFamily;
  const nodeFontColor   = json?.nodeFontColor;
  const nodeFontBold    = json?.nodeFontBold   ?? false;
  const nodeFontItalic  = json?.nodeFontItalic ?? false;
  const textAlign       = json?.textAlign ?? 'left';

  const parts: string[] = [];

  // --- Outer fill (no stroke yet — border drawn last to stay on top) ---
  parts.push(
    rect(0, 0, node.width, node.height, {
      fill: bg,
      rx,
    }),
  );

  // --- Key-column background ---
  parts.push(
    rect(0, 0, node.keyColWidth, node.height, {
      fill: headerBg,
    }),
  );

  // --- Highlighted row backgrounds ---
  for (const row of node.rows) {
    if (row.highlight) {
      parts.push(
        rect(1, row.y + 1, node.width - 2, row.height - 1, {
          fill: hlBg,
        }),
      );
    }
  }

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

    // Compute key text x and textAnchor based on textAlign.
    // Key column alignment.
    let keyX: number;
    let keyAnchor: 'start' | 'middle' | 'end';
    if (textAlign === 'center') {
      keyX = node.keyColWidth / 2;
      keyAnchor = 'middle';
    } else if (textAlign === 'right') {
      keyX = node.keyColWidth - H_PAD;
      keyAnchor = 'end';
    } else {
      keyX = H_PAD;
      keyAnchor = 'start';
    }

    // Key text — bold by default (plantuml.skin jsonDiagram.node.header { FontStyle bold })
    // Can be overridden to non-bold via element.header { FontStyle: plain }
    const headerBold = json?.headerFontBold !== false;
    parts.push(
      text(keyX, midY, row.key, {
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize,
        fill: keyColor,
        dominantBaseline: 'middle',
        textAnchor: keyAnchor,
        ...(headerBold ? { fontWeight: 'bold' } : {}),
      }),
    );

    // Value text (skip for nested/empty values)
    if (row.value !== '') {
      const lineH = row.height / row.valueLines.length;
      const vColor = nodeFontColor ?? valueColor(row.valueType, json);
      const valueColWidth = node.width - node.keyColWidth;

      // Compute value text x and textAnchor based on textAlign.
      let valueX: number;
      let valueAnchor: 'start' | 'middle' | 'end';
      if (textAlign === 'center') {
        valueX = node.keyColWidth + valueColWidth / 2;
        valueAnchor = 'middle';
      } else if (textAlign === 'right') {
        valueX = node.width - H_PAD;
        valueAnchor = 'end';
      } else {
        valueX = node.keyColWidth + H_PAD;
        valueAnchor = 'start';
      }

      for (let li = 0; li < row.valueLines.length; li++) {
        const lineY = row.y + lineH * li + lineH / 2;
        parts.push(
          text(valueX, lineY, row.valueLines[li]!, {
            fontFamily: nodeFontFamily,
            fontSize: nodeFontSize,
            fill: vColor,
            dominantBaseline: 'middle',
            textAnchor: valueAnchor,
            ...(nodeFontBold ? { fontWeight: 'bold' } : {}),
            ...(nodeFontItalic ? { fontStyle: 'italic' } : {}),
          }),
        );
      }
    }
  }

  // --- Outer border drawn last so it paints over the fills at the corners ---
  parts.push(
    rect(0, 0, node.width, node.height, {
      fill: 'none',
      stroke: border,
      strokeWidth: borderWidth,
      rx,
    }),
  );

  const inner = parts.join('');
  return `<g transform="translate(${node.x}, ${node.y})">${inner}</g>`;
}

function renderEdge(edge: JsonEdgeGeo, theme: Theme): string {
  const d = buildEdgePathD(edge);
  if (d === '') return '';

  const stroke = theme.colors.graph.json?.arrowColor ?? theme.colors.arrow;

  const linePart = path(d, {
    stroke,
    strokeWidth: 1,
    strokeDasharray: '3 3',
    markerEnd: 'url(#arrow-dependency)',
  });

  const DOT_STUB = 13;
  const p0 = edge.points[0];
  const dotPart =
    p0 !== undefined ? ellipse(p0.x - DOT_STUB, p0.y, 3, 3, { fill: stroke }) : '';

  return dotPart + linePart;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a JSON diagram geometry into an SVG string.
 */
export function renderJson(geo: JsonGeometry, theme: Theme): string {
  if (geo.error !== undefined) {
    const PAD = 12;
    const FONT_SIZE = 14;
    const msgWidth = geo.error.length * FONT_SIZE * 0.6 + PAD * 2;
    const msgHeight = FONT_SIZE + PAD * 2;
    const svgWidth = msgWidth + PAD * 2;
    const svgHeight = msgHeight + PAD * 2;
    const boxX = PAD;
    const boxY = PAD;
    const parts = [
      rect(boxX, boxY, msgWidth, msgHeight, {
        fill: '#FFFFFF',
        stroke: '#888888',
        rx: 4,
      }),
      text(boxX + PAD, boxY + PAD + FONT_SIZE, geo.error, {
        fontFamily: 'Courier, monospace',
        fontSize: FONT_SIZE,
        fill: '#000000',
      }),
    ];
    return svgRoot(svgWidth, svgHeight, parts);
  }

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

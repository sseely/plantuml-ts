/**
 * Renderer for @startdot diagrams.
 *
 * Converts a DotGeometry produced by layoutDot() into an SVG string.
 * The renderer is a pure function: same inputs always produce same output.
 */

import { rect, ellipse, path, text, svgRoot } from '../../core/svg.js';
import type { TextStyle, BoxStyle } from '../../core/svg.js';
import { arrowHeadRef } from '../../core/svg.js';
import type { DotGeometry, DotNodeGeo, DotEdgeGeo } from './ast.js';
import type { Theme } from '../../core/theme.js';

// Padding between the top edge of the SVG and diagram content when a title
// is present.
const TITLE_HEIGHT = 30;

// Default stroke width for node shapes.
const NODE_STROKE_WIDTH = 1.5;

// Margin added on the left and top of the diagram content.  The layout engine
// already adds 12px on the right and bottom, so this value keeps all four
// sides roughly balanced.
const MARGIN = 12;

// ---------------------------------------------------------------------------
// Node rendering helpers
// ---------------------------------------------------------------------------

// DEFAULT_FILL from graphviz const.h — used when style=filled but no fillcolor/color set.
const DEFAULT_NODE_FILL = 'lightgrey';

function nodeStyle(
  node: DotNodeGeo,
  theme: Theme,
): { fill: string; stroke: string; strokeWidth: number } {
  // C penColor(): N_color → DEFAULT_COLOR ("black")
  const stroke = node.nodeColor ?? theme.colors.border;
  // C findFill(): N_fillcolor → N_color → DEFAULT_FILL ("lightgrey")
  // Only applied when style.filled (C: istyle.filled = true).
  const fill = node.styleFilled
    ? (node.fillColor ?? node.nodeColor ?? DEFAULT_NODE_FILL)
    : theme.colors.nodeBackground;
  return { fill, stroke, strokeWidth: NODE_STROKE_WIDTH };
}

function renderNode(node: DotNodeGeo, theme: Theme, xOffset: number, yOffset: number): string {
  const { x: rawX, y: rawY, width, height, shape, label } = node;
  const x = rawX + xOffset;
  const y = rawY + yOffset;
  // layout engine returns TOP-LEFT corner; shape primitives that take a center need cx/cy.
  const cx = x + width / 2;
  const cy = y + height / 2;
  const textStyle: TextStyle = {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fill: theme.colors.text,
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  };

  switch (shape) {
    case 'box': {
      const style: BoxStyle = nodeStyle(node, theme);
      return (
        rect(x, y, width, height, style) +
        text(cx, cy, label, textStyle)
      );
    }

    case 'ellipse':
    case 'circle': {
      const style = nodeStyle(node, theme);
      return (
        ellipse(cx, cy, width / 2, height / 2, {
          fill: style.fill,
          stroke: style.stroke,
          'stroke-width': style.strokeWidth,
        }) +
        text(cx, cy, label, textStyle)
      );
    }

    case 'diamond': {
      const style = nodeStyle(node, theme);
      // The node bounding box is 2× the padded label size (Graphviz poly_init).
      // Draw with separate horizontal (width/2) and vertical (height/2) half-extents
      // so the diamond is proportional to the label, not forced square.
      const hw = width / 2;
      const hh = height / 2;
      const pts = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
      return (
        `<polygon points="${pts}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${NODE_STROKE_WIDTH}"/>` +
        text(cx, cy, label, textStyle)
      );
    }

    case 'plaintext': {
      return text(cx, cy, label, textStyle);
    }
  }
}

// ---------------------------------------------------------------------------
// Cluster rendering helpers
// ---------------------------------------------------------------------------

// Stroke color for cluster bounding boxes (C: penColor on subgraph → black).
const CLUSTER_STROKE = '#000000';
const CLUSTER_STROKE_WIDTH = 1;
// C: const.h GAP=4; PAD adds 2*GAP=8 to label height → border height.
// Label centre = box_top + border_height/2  (C: place_graph_label, UR.y - d.y/2).
const CLUSTER_LABEL_GAP = 8;

function renderCluster(
  cl: { id: string; label: string | null; x: number; y: number; width: number; height: number; labelHeight?: number },
  theme: Theme,
  xOffset: number,
  yOffset: number,
): string {
  const x = cl.x + xOffset;
  const y = cl.y + yOffset;
  const boxEl = rect(x, y, cl.width, cl.height, {
    fill: 'none',
    stroke: CLUSTER_STROKE,
    strokeWidth: CLUSTER_STROKE_WIDTH,
  });

  if (cl.label === null) return boxEl;

  // Label centred horizontally, centred vertically inside the top border strip.
  // The border strip height = labelHeight + CLUSTER_LABEL_GAP (matches layout.ts).
  const lx = x + cl.width / 2;
  const borderHeight = (cl.labelHeight ?? theme.fontSize) + CLUSTER_LABEL_GAP;
  const ly = y + borderHeight / 2;
  const labelEl = text(lx, ly, cl.label, {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fill: theme.colors.text,
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  });
  return boxEl + labelEl;
}

// ---------------------------------------------------------------------------
// Edge rendering helpers
// ---------------------------------------------------------------------------

/**
 * Build an SVG path `d` attribute from a list of points.
 *
 * When `spline` is true and there are at least 4 points the points are
 * interpreted in Bezier format (M P0 then groups of 3: CP1 CP2 endpoint)
 * and `C` commands are emitted.  Otherwise polyline `L` commands are used.
 */
function buildPathD(
  points: Array<{ x: number; y: number }>,
  xOffset: number,
  yOffset: number,
  spline?: boolean,
): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points as [{ x: number; y: number }, ...Array<{ x: number; y: number }>];
  const ox = xOffset;
  const oy = yOffset;
  const parts = [`M ${first.x + ox},${first.y + oy}`];

  if (spline === true && points.length >= 4) {
    // Bezier format: P0, CP1, CP2, P1, CP1', CP2', P2, ...
    // SVG: M P0 C CP1 CP2 P1 C CP1' CP2' P2 ...
    let idx = 0;
    while (idx + 2 < rest.length) {
      const cp1 = rest[idx]!;
      const cp2 = rest[idx + 1]!;
      const ep  = rest[idx + 2]!;
      parts.push(
        `C ${cp1.x + ox},${cp1.y + oy} ${cp2.x + ox},${cp2.y + oy} ${ep.x + ox},${ep.y + oy}`,
      );
      idx += 3;
    }
    // Fall through with L for any remaining points (shouldn't happen in
    // well-formed spline data, but be defensive).
    for (; idx < rest.length; idx++) {
      const pt = rest[idx]!;
      parts.push(`L ${pt.x + ox},${pt.y + oy}`);
    }
  } else {
    for (const pt of rest) {
      parts.push(`L ${pt.x + ox},${pt.y + oy}`);
    }
  }

  return parts.join(' ');
}

function midpoint(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  const mid = Math.floor(points.length / 2);
  // When points.length is even, interpolate between mid-1 and mid.
  if (points.length >= 2 && points.length % 2 === 0) {
    const a = points[mid - 1]!;
    const b = points[mid]!;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return points[mid] ?? { x: 0, y: 0 };
}

function renderEdge(edge: DotEdgeGeo, theme: Theme, xOffset: number, yOffset: number): string {
  if (edge.points.length === 0) return '';

  const edgeColor = theme.colors.arrow;

  const d = buildPathD(edge.points, xOffset, yOffset, edge.spline);

  const strokeWidth = edge.edgeStyle === 'bold' ? 3 : 1.5;
  const strokeDasharray =
    edge.edgeStyle === 'dashed' ? '6 3' :
    edge.edgeStyle === 'dotted' ? '2 3' :
    undefined;

  const dir = edge.dir ?? (edge.directed ? 'forward' : 'none');
  const markerEnd =
    (dir === 'forward' || dir === 'both') ? `url(#${arrowHeadRef('sync')})` : undefined;
  const markerStart =
    (dir === 'back' || dir === 'both') ? `url(#${arrowHeadRef('sync-back')})` : undefined;

  const pathStyle = {
    stroke: edgeColor,
    strokeWidth,
    ...(strokeDasharray !== undefined ? { strokeDasharray } : {}),
    ...(markerEnd !== undefined ? { markerEnd } : {}),
    ...(markerStart !== undefined ? { markerStart } : {}),
  };

  const pathEl = path(d, pathStyle);

  let labelEl = '';
  if (edge.label !== null) {
    // Use the layout-computed position when available; fall back to midpoint.
    const lx = edge.labelX !== undefined ? edge.labelX + xOffset : midpoint(edge.points).x + xOffset;
    const ly = edge.labelY !== undefined ? edge.labelY + yOffset : midpoint(edge.points).y + yOffset;
    // White background rect knocks out the edge line behind the text so the
    // label is readable even when the bezier curve sweeps through the label
    // area on diagonal edges (Graphviz routes splines around the label box;
    // we approximate that here with an opaque mask).
    if (edge.labelWidth !== undefined && edge.labelHeight !== undefined) {
      const lw = edge.labelWidth;
      const lh = edge.labelHeight;
      labelEl =
        `<rect x="${lx - lw / 2}" y="${ly - lh / 2}" width="${lw}" height="${lh}" fill="white"/>` +
        text(lx, ly, edge.label, {
          fontFamily: theme.fontFamily,
          fontSize: theme.fontSize - 2,
          fill: theme.colors.graph.edgeLabel,
          textAnchor: 'middle',
          dominantBaseline: 'middle',
        });
    } else {
      labelEl = text(lx, ly, edge.label, {
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize - 2,
        fill: theme.colors.graph.edgeLabel,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }
  }

  return pathEl + labelEl;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function renderDot(geo: DotGeometry, theme: Theme): string {
  const hasTitle = geo.title !== null;
  // Ensure the canvas is wide enough for the title text (centered, so it
  // needs titleWidth + 2×MARGIN total).  Diagram content width already
  // includes the right-side margin from the layout engine.
  const contentWidth = geo.totalWidth + MARGIN;
  const minTitleWidth = geo.titleWidth !== undefined ? geo.titleWidth + 2 * MARGIN : 0;
  const finalWidth = Math.max(contentWidth, minTitleWidth);
  // When the title is wider than the content, shift nodes/edges right so the
  // diagram is horizontally centred beneath the title.
  const xOffset = MARGIN + Math.floor((finalWidth - contentWidth) / 2);
  const yOffset = MARGIN + (hasTitle ? TITLE_HEIGHT : 0);
  const finalHeight = geo.totalHeight + yOffset;

  const children: string[] = [];

  // Title element — centred in the title band above the content.
  if (hasTitle) {
    children.push(
      text(finalWidth / 2, MARGIN + TITLE_HEIGHT / 2, geo.title!, {
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize + 2,
        fill: theme.colors.text,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      }),
    );
  }

  // Clusters drawn before edges and nodes (C: emit_clusters runs first).
  for (const cluster of geo.clusters) {
    children.push(renderCluster(cluster, theme, xOffset, yOffset));
  }

  // Edges drawn before nodes so nodes appear on top.
  for (const edge of geo.edges) {
    children.push(renderEdge(edge, theme, xOffset, yOffset));
  }

  // Nodes
  for (const node of geo.nodes) {
    children.push(renderNode(node, theme, xOffset, yOffset));
  }

  const bgColor = theme.colors.background;
  return svgRoot(finalWidth, finalHeight, children, bgColor);
}

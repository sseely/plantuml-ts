/**
 * Activity diagram SVG renderer.
 *
 * Pure function: ActivityGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type {
  ActivityGeometry,
  ActivityNodeGeo,
  ActivityEdgeGeo,
  SwimlaneGeo,
} from './layout.js';
import type { Theme } from '../../core/theme.js';
import { svgRoot, rect, line, text, diamond } from '../../core/svg.js';
import { renderNodeLabel } from '../../core/latex.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SWIMLANE_HEADER_H = 28;
const ACTION_RX = 8;
const NOTE_FOLD = 8;

// ---------------------------------------------------------------------------
// Label helper
// ---------------------------------------------------------------------------

function renderLabel(label: string, cx: number, cy: number, theme: Theme): string {
  return renderNodeLabel(label, cx, cy, theme);
}

// ---------------------------------------------------------------------------
// Node shape renderers
// ---------------------------------------------------------------------------

function renderStart(node: ActivityNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const r = node.height / 2;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${theme.colors.border}"/>`;
}

function renderStop(node: ActivityNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const outerR = node.height / 2;
  const innerR = outerR * 0.55;
  return (
    `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="${theme.colors.border}" stroke-width="2"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="${theme.colors.border}"/>`
  );
}

function renderAction(node: ActivityNodeGeo, theme: Theme): string {
  const fill = node.color ?? theme.colors.background;
  const box = rect(node.x, node.y, node.width, node.height, {
    fill,
    stroke: theme.colors.border,
    strokeWidth: 1,
    rx: ACTION_RX,
  });
  const label = node.label ?? '';
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2 + theme.fontSize / 3;
  const labelEl = renderLabel(label, cx, cy, theme);
  return box + labelEl;
}

function renderBar(node: ActivityNodeGeo, theme: Theme): string {
  return rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.border,
  });
}

function renderDiamond(node: ActivityNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const size = node.width / 2;
  const shape = diamond(cx, cy, size, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
  });
  if (node.label === undefined || node.label === '') return shape;
  const label = text(cx, cy, node.label, {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize - 2,
    fill: theme.colors.text,
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  });
  return shape + label;
}

function renderNote(node: ActivityNodeGeo, theme: Theme): string {
  const { x, y, width, height } = node;
  const noteFill = theme.colors.noteBackground;
  // Rect with folded corner: clip the top-right corner via a polygon
  const points =
    `${x},${y} ` +
    `${x + width - NOTE_FOLD},${y} ` +
    `${x + width},${y + NOTE_FOLD} ` +
    `${x + width},${y + height} ` +
    `${x},${y + height}`;
  const body =
    `<polygon points="${points}" fill="${noteFill}" stroke="${theme.colors.border}"/>` +
    // Fold line
    `<line x1="${x + width - NOTE_FOLD}" y1="${y}" x2="${x + width - NOTE_FOLD}" y2="${y + NOTE_FOLD}" stroke="${theme.colors.border}"/>` +
    `<line x1="${x + width - NOTE_FOLD}" y1="${y + NOTE_FOLD}" x2="${x + width}" y2="${y + NOTE_FOLD}" stroke="${theme.colors.border}"/>`;
  const label = node.label ?? '';
  const labelEl = text(
    x + 4,
    y + NOTE_FOLD + theme.fontSize,
    label,
    {
      fill: theme.colors.text,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
    },
  );
  return body + labelEl;
}

function renderNode(node: ActivityNodeGeo, theme: Theme): string {
  switch (node.kind) {
    case 'start':
      return renderStart(node, theme);
    case 'stop':
    case 'end':
    case 'kill':
      return renderStop(node, theme);
    case 'action':
      return renderAction(node, theme);
    case 'break':
      return renderDiamond(node, theme);
    case 'repeat-start':
      return renderDiamond(node, theme);
    case 'fork-bar':
    case 'split-bar':
    case 'join-bar':
      return renderBar(node, theme);
    case 'if-split':
    case 'while-header':
      return renderDiamond(node, theme);
    case 'if-merge':
      return '';
    case 'note':
      return renderNote(node, theme);
    default:
      // Unknown kind: render a plain rect as a fallback
      return rect(node.x, node.y, node.width, node.height, {
        fill: theme.colors.background,
        stroke: theme.colors.border,
      });
  }
}

// ---------------------------------------------------------------------------
// Edge renderer
// ---------------------------------------------------------------------------

function arrowTip(
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: string,
): string {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return '';
  const udx = dx / len;
  const udy = dy / len;
  const size = 8;
  const px = -udy * size * 0.4;
  const py = udx * size * 0.4;
  const x1 = x - udx * size + px;
  const y1 = y - udy * size + py;
  const x2 = x - udx * size - px;
  const y2 = y - udy * size - py;
  return `<polygon points="${x},${y} ${x1},${y1} ${x2},${y2}" fill="${color}"/>`;
}

/**
 * Render the label for an edge, optionally with a colored background pill.
 *
 * When `color` is provided, a filled rect is rendered behind the label text.
 * Pill dimensions: width = approx label char count × (fontSize × 0.6) + 8px
 * padding; height = fontSize + 4px padding.
 */
function renderEdgeLabel(
  label: string,
  midX: number,
  midY: number,
  color: string | undefined,
  theme: Theme,
): string {
  if (color !== undefined) {
    const textWidth = label.length * (theme.fontSize * 0.6);
    const pillW = textWidth + 8;
    const pillH = theme.fontSize + 4;
    const pillX = midX - pillW / 2;
    const pillY = midY - pillH / 2;
    const background = rect(pillX, pillY, pillW, pillH, {
      fill: color,
      stroke: 'none',
    });
    const labelEl = text(midX, midY, label, {
      fill: theme.colors.text,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      textAnchor: 'middle',
      dominantBaseline: 'central',
    });
    return background + labelEl;
  }

  // No color: plain text label offset slightly from the midpoint
  return text(midX + 4, midY - 4, label, {
    fill: theme.colors.text,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
  });
}

function renderEdge(edge: ActivityEdgeGeo, theme: Theme): string {
  const pts = edge.points;
  if (pts.length < 2) return '';

  const pointsAttr = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const polyline = `<polyline points="${pointsAttr}" fill="none" stroke="${theme.colors.border}" stroke-width="1.5"/>`;

  // Arrowhead at last point, direction from second-to-last to last
  const last = pts[pts.length - 1]!;
  const prev = pts[pts.length - 2]!;
  const dx = last.x - prev.x;
  const dy = last.y - prev.y;
  const arrow = arrowTip(last.x, last.y, dx, dy, theme.colors.border);

  // Optional edge label near midpoint
  let labelEl = '';
  if (edge.label !== undefined) {
    const mid = Math.floor(pts.length / 2);
    const midPt = pts[mid]!;
    labelEl = renderEdgeLabel(edge.label, midPt.x, midPt.y, edge.color, theme);
  }

  return polyline + arrow + labelEl;
}

// ---------------------------------------------------------------------------
// Swimlane renderer
// ---------------------------------------------------------------------------

function renderSwimlanes(
  swimlanes: readonly SwimlaneGeo[],
  totalHeight: number,
  theme: Theme,
): string {
  if (swimlanes.length === 0) return '';

  const parts: string[] = [];

  // Header band background
  parts.push(
    rect(0, 0, swimlanes.reduce((acc, s) => acc + s.width, 0), SWIMLANE_HEADER_H, {
      fill: theme.colors.background,
      stroke: theme.colors.border,
    }),
  );

  for (const lane of swimlanes) {
    // Lane header text, centered
    parts.push(
      text(lane.x + lane.width / 2, SWIMLANE_HEADER_H / 2 + theme.fontSize / 3, lane.name, {
        textAnchor: 'middle',
        fill: theme.colors.text,
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize,
        fontWeight: 'bold',
      }),
    );

    // Vertical divider on the left edge of this lane (skip the very first)
    if (lane.x > 0) {
      parts.push(
        line(lane.x, 0, lane.x, totalHeight, {
          stroke: theme.colors.border,
          strokeWidth: 1,
        }),
      );
    }
  }

  // Horizontal line separating header from diagram body
  const totalWidth = swimlanes.reduce((acc, s) => acc + s.width, 0);
  parts.push(
    line(0, SWIMLANE_HEADER_H, totalWidth, SWIMLANE_HEADER_H, {
      stroke: theme.colors.border,
      strokeWidth: 1,
    }),
  );

  return parts.join('');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render an activity diagram geometry into an SVG string.
 */
export function renderActivity(geo: ActivityGeometry, theme: Theme): string {
  const children: string[] = [];

  // Background
  children.push(
    rect(0, 0, geo.totalWidth, geo.totalHeight, {
      fill: theme.colors.background,
    }),
  );

  // Swimlanes (drawn before nodes so nodes appear on top)
  if (geo.swimlanes.length > 0) {
    children.push(renderSwimlanes(geo.swimlanes, geo.totalHeight, theme));
  }

  // Nodes
  for (const node of geo.nodes) {
    children.push(renderNode(node, theme));
  }

  // Edges
  for (const edge of geo.edges) {
    children.push(renderEdge(edge, theme));
  }

  return svgRoot(geo.totalWidth, geo.totalHeight, children, theme.colors.background);
}

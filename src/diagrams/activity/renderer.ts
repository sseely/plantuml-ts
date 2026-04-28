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
const ACTION_H_PAD = 16;
const NOTE_FOLD = 8;

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

function renderLabel(label: string, cx: number, cy: number, theme: Theme): string {
  return renderNodeLabel(label, cx, cy, theme);
}

function renderMultilineText(
  lines: string[],
  cx: number,
  cy: number,
  theme: Theme,
): string {
  const lh = theme.fontSize * 1.4;
  const totalH = lh * lines.length;
  // y of first line baseline so the block is vertically centred around cy
  let y = cy - totalH / 2 + lh * 0.8;
  const attrs = `text-anchor="middle" font-family="${theme.fontFamily}" font-size="${theme.fontSize}" fill="${theme.colors.text}"`;
  const tspans = lines
    .map((ln) => {
      const el = `<tspan x="${cx}" y="${y.toFixed(1)}">${ln.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</tspan>`;
      y += lh;
      return el;
    })
    .join('');
  return `<text ${attrs}>${tspans}</text>`;
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

/**
 * Renders an `end` node as a circle with an X through it, matching upstream
 * PlantUML's distinction between `stop` (bullseye) and `end` (crossed circle).
 */
function renderEnd(node: ActivityNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const r = node.height / 2;
  // Diagonal length so the X tips reach the circle border at 45°
  const d = r * Math.SQRT1_2;
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${theme.colors.border}" stroke-width="1.5"/>` +
    `<line x1="${cx - d}" y1="${cy - d}" x2="${cx + d}" y2="${cy + d}" stroke="${theme.colors.border}" stroke-width="1.5"/>` +
    `<line x1="${cx - d}" y1="${cy + d}" x2="${cx + d}" y2="${cy - d}" stroke="${theme.colors.border}" stroke-width="1.5"/>`
  );
}

function renderAction(node: ActivityNodeGeo, theme: Theme): string {
  const fill = node.color ?? theme.colors.nodeBackground;
  const box = rect(node.x, node.y, node.width, node.height, {
    fill,
    stroke: theme.colors.border,
    strokeWidth: 1,
    rx: ACTION_RX,
  });
  const label = node.label ?? '';
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const lines = label.split('\n');
  let labelEl: string;
  if (lines.length > 1) {
    const lh = theme.fontSize * 1.4;
    const totalH = lh * lines.length;
    let lineY = cy - totalH / 2 + lh * 0.8;
    const labelX = node.x + ACTION_H_PAD;
    const attrs = `text-anchor="start" font-family="${theme.fontFamily}" font-size="${theme.fontSize}" fill="${theme.colors.text}"`;
    const tspans = lines
      .map((ln) => {
        const el = `<tspan x="${labelX}" y="${lineY.toFixed(1)}">${ln.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</tspan>`;
        lineY += lh;
        return el;
      })
      .join('');
    labelEl = `<text ${attrs}>${tspans}</text>`;
  } else {
    labelEl = renderLabel(label, cx, cy + theme.fontSize / 3, theme);
  }
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
    fill: theme.colors.nodeBackground,
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

function renderSignalLabel(label: string, x: number, cy: number, theme: Theme): string {
  const labelX = x + ACTION_H_PAD;
  const lines = label.split('\n');
  if (lines.length === 1) {
    return text(labelX, cy, label, {
      fill: theme.colors.text,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      textAnchor: 'start',
      dominantBaseline: 'central',
    });
  }
  const lh = theme.fontSize * 1.4;
  const totalH = lh * lines.length;
  let lineY = cy - totalH / 2 + lh * 0.8;
  const attrs = `text-anchor="start" font-family="${theme.fontFamily}" font-size="${theme.fontSize}" fill="${theme.colors.text}"`;
  const tspans = lines
    .map((ln) => {
      const el = `<tspan x="${labelX}" y="${lineY.toFixed(1)}">${ln.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</tspan>`;
      lineY += lh;
      return el;
    })
    .join('');
  return `<text ${attrs}>${tspans}</text>`;
}

function renderChevronLeft(node: ActivityNodeGeo, theme: Theme): string {
  const { x, y, width: w, height: h } = node;
  const fill = node.color ?? theme.colors.nodeBackground;
  // <<input>> = UML receive signal: flat left side (right-angle corners at
  // top-left and bottom-left). Right side: two lines from top-right and
  // bottom-right corners go inward/left at 60° to horizontal, meeting at
  // the midpoint of the right edge → concave right notch pointing left.
  // dent = (h/2) / tan(60°) = h / (2√3)
  const dent = h / (2 * Math.sqrt(3));
  const points = [
    `${x},${y}`,
    `${x + w},${y}`,
    `${x + w - dent},${y + h / 2}`,
    `${x + w},${y + h}`,
    `${x},${y + h}`,
  ].join(' ');
  const shape = `<polygon points="${points}" fill="${fill}" stroke="${theme.colors.border}" stroke-width="1"/>`;
  return shape + renderSignalLabel(node.label ?? '', x, y + h / 2, theme);
}

function renderChevronRight(node: ActivityNodeGeo, theme: Theme): string {
  const { x, y, width: w, height: h } = node;
  const fill = node.color ?? theme.colors.nodeBackground;
  // 60° to horizontal: dent = (h/2) / tan(60°) = h / (2√3)
  const dent = h / (2 * Math.sqrt(3));
  // <<output>> = right-pointing arrow: body rectangle indented on right,
  // vertex pointing right at the midpoint of the right edge.
  const points = [
    `${x},${y}`,
    `${x + w - dent},${y}`,
    `${x + w},${y + h / 2}`,
    `${x + w - dent},${y + h}`,
    `${x},${y + h}`,
  ].join(' ');
  const shape = `<polygon points="${points}" fill="${fill}" stroke="${theme.colors.border}" stroke-width="1"/>`;
  return shape + renderSignalLabel(node.label ?? '', x, y + h / 2, theme);
}

function renderHexagon(node: ActivityNodeGeo, theme: Theme): string {
  const { x, y, width: w, height: h } = node;
  const fill = node.color ?? theme.colors.nodeBackground;
  const dent = h / 2;
  const points = [
    `${x + dent},${y}`,
    `${x + w - dent},${y}`,
    `${x + w},${y + h / 2}`,
    `${x + w - dent},${y + h}`,
    `${x + dent},${y + h}`,
    `${x},${y + h / 2}`,
  ].join(' ');
  const shape = `<polygon points="${points}" fill="${fill}" stroke="${theme.colors.border}" stroke-width="1"/>`;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const lines = (node.label ?? '').split('\n');
  const labelEl =
    lines.length > 1
      ? renderMultilineText(lines, cx, cy, theme)
      : renderLabel(node.label ?? '', cx, cy + theme.fontSize / 3, theme);
  return shape + labelEl;
}

function renderParallelogram(node: ActivityNodeGeo, theme: Theme): string {
  const { x, y, width: w, height: h } = node;
  const fill = node.color ?? theme.colors.nodeBackground;
  // Right-leaning parallelogram: interior angles 75° (acute) / 105° (obtuse).
  // tan(75°) = h/d  →  d = h / (2 + √3) = h · (2 − √3)
  const d = h * (2 - Math.sqrt(3));
  const points = [
    `${x + d},${y}`,
    `${x + w},${y}`,
    `${x + w - d},${y + h}`,
    `${x},${y + h}`,
  ].join(' ');
  const shape = `<polygon points="${points}" fill="${fill}" stroke="${theme.colors.border}" stroke-width="1"/>`;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const lines = (node.label ?? '').split('\n');
  const labelEl =
    lines.length > 1
      ? renderMultilineText(lines, cx, cy, theme)
      : renderLabel(node.label ?? '', cx, cy + theme.fontSize / 3, theme);
  return shape + labelEl;
}

function renderNote(node: ActivityNodeGeo, theme: Theme): string {
  const { x, y, width: w, height: h } = node;
  const noteFill = theme.colors.noteBackground;
  const stroke = theme.colors.border;
  // Opale balloon spike geometry (matches Opale.java: delta=4, cornersize=NOTE_FOLD)
  const DELTA = 4;
  const spike = node.spikeTip;
  let bodyPath: string;
  if (spike !== undefined && node.notePosition === 'left') {
    // Note is LEFT of action → spike protrudes from the RIGHT side of the box
    const relY = spike.y - y;
    const y1 = Math.max(NOTE_FOLD, Math.min(relY - DELTA, h - 2 * DELTA));
    bodyPath =
      `M${x},${y} ` +
      `L${x},${y + h} ` +
      `L${x + w},${y + h} ` +
      `L${x + w},${y + y1 + 2 * DELTA} ` +
      `L${spike.x},${spike.y} ` +
      `L${x + w},${y + y1} ` +
      `L${x + w},${y + NOTE_FOLD} ` +
      `L${x + w - NOTE_FOLD},${y} Z`;
  } else if (spike !== undefined && node.notePosition === 'right') {
    // Note is RIGHT of action → spike protrudes from the LEFT side of the box
    const relY = spike.y - y;
    const y1 = Math.max(0, Math.min(relY - DELTA, h - 2 * DELTA));
    bodyPath =
      `M${x},${y} ` +
      `L${x},${y + y1} ` +
      `L${spike.x},${spike.y} ` +
      `L${x},${y + y1 + 2 * DELTA} ` +
      `L${x},${y + h} ` +
      `L${x + w},${y + h} ` +
      `L${x + w},${y + NOTE_FOLD} ` +
      `L${x + w - NOTE_FOLD},${y} Z`;
  } else {
    // Standalone note (no associated action) — plain folded-corner rect
    bodyPath =
      `M${x},${y} ` +
      `L${x},${y + h} ` +
      `L${x + w},${y + h} ` +
      `L${x + w},${y + NOTE_FOLD} ` +
      `L${x + w - NOTE_FOLD},${y} Z`;
  }
  const body =
    `<path d="${bodyPath}" fill="${noteFill}" stroke="${stroke}" stroke-width="1"/>` +
    `<line x1="${x + w - NOTE_FOLD}" y1="${y}" x2="${x + w - NOTE_FOLD}" y2="${y + NOTE_FOLD}" stroke="${stroke}"/>` +
    `<line x1="${x + w - NOTE_FOLD}" y1="${y + NOTE_FOLD}" x2="${x + w}" y2="${y + NOTE_FOLD}" stroke="${stroke}"/>`;

  const label = node.label ?? '';
  const lines = label.split('\n');
  const lh = theme.fontSize * 1.4;
  const labelX = x + 4;
  let labelEl: string;
  if (lines.length > 1) {
    const attrs = `text-anchor="start" font-family="${theme.fontFamily}" font-size="${theme.fontSize}" fill="${theme.colors.text}"`;
    let lineY = y + NOTE_FOLD + theme.fontSize;
    const tspans = lines
      .map((ln) => {
        const el = `<tspan x="${labelX}" y="${lineY.toFixed(1)}">${ln.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</tspan>`;
        lineY += lh;
        return el;
      })
      .join('');
    labelEl = `<text ${attrs}>${tspans}</text>`;
  } else {
    labelEl = text(labelX, y + NOTE_FOLD + theme.fontSize, label, {
      fill: theme.colors.text,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
    });
  }
  return body + labelEl;
}

function renderNode(node: ActivityNodeGeo, theme: Theme): string {
  switch (node.kind) {
    case 'start':
      return renderStart(node, theme);
    case 'stop':
    case 'kill':
      return renderStop(node, theme);
    case 'end':
      return renderEnd(node, theme);
    case 'action':
      if (node.stereotype === 'input') return renderChevronLeft(node, theme);
      if (node.stereotype === 'output') return renderChevronRight(node, theme);
      if (node.stereotype === 'save') return renderParallelogram(node, theme);
      return renderAction(node, theme);
    case 'break':
      // `break` is a flow-control marker — it has no visible glyph in
      // upstream PlantUML. The layout still places a zero-area anchor for
      // edge routing, but rendering produces no shape.
      return '';
    case 'repeat-start':
      return renderDiamond(node, theme);
    case 'fork-bar':
    case 'split-bar':
    case 'join-bar':
      return renderBar(node, theme);
    case 'if-split':
    case 'while-header':
      return (node.label !== undefined && node.label !== '')
        ? renderHexagon(node, theme)
        : renderDiamond(node, theme);
    case 'repeat-cond':
      return renderHexagon(node, theme);
    case 'if-merge':
      return '';
    case 'note':
      return renderNote(node, theme);
    default:
      // Unknown kind: render a plain rect as a fallback
      return rect(node.x, node.y, node.width, node.height, {
        fill: theme.colors.nodeBackground,
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

  // Optional mid-segment arrowhead (used for repeat back-edges)
  let midArrowEl = '';
  if (edge.midArrow === true && pts.length >= 2) {
    let maxLen = 0;
    let maxI = 1;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1]!;
      const p1 = pts[i]!;
      const len = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2);
      if (len > maxLen) { maxLen = len; maxI = i; }
    }
    const segStart = pts[maxI - 1]!;
    const segEnd = pts[maxI]!;
    const midX = (segStart.x + segEnd.x) / 2;
    const midY = (segStart.y + segEnd.y) / 2;
    midArrowEl = arrowTip(midX, midY, segEnd.x - segStart.x, segEnd.y - segStart.y, theme.colors.border);
  }

  // Optional edge label near midpoint
  let labelEl = '';
  if (edge.label !== undefined) {
    const mid = Math.floor(pts.length / 2);
    const midPt = pts[mid]!;
    labelEl = renderEdgeLabel(edge.label, midPt.x, midPt.y, edge.color, theme);
  }

  return polyline + arrow + midArrowEl + labelEl;
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

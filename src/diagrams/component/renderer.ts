/**
 * Component diagram SVG renderer.
 *
 * Pure function: ComponentGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type { ComponentGeometry, ComponentNodeGeo, ComponentEdgeGeo } from './layout.js';
import type { Theme } from '../../core/theme.js';
import {
  rect,
  text,
  path,
  ellipse,
  svgRoot,
  arrowHeadRef,
} from '../../core/svg.js';

// ---------------------------------------------------------------------------
// Kind classification — kept local; avoids importing the full AST module
// ---------------------------------------------------------------------------

const CONTAINER_KINDS = new Set([
  'package',
  'node',
  'folder',
  'frame',
  'cloud',
  'database',
  'storage',
]);

/** A node is rendered as a container only when it has children. */
function isRenderedAsContainer(node: ComponentNodeGeo): boolean {
  return CONTAINER_KINDS.has(node.kind) && node.children.length > 0;
}

// ---------------------------------------------------------------------------
// Node renderers
// ---------------------------------------------------------------------------

function renderComponentNode(node: ComponentNodeGeo, theme: Theme): string {
  const bg = rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.graph.classBackground,
    stroke: theme.colors.border,
    strokeWidth: 1,
  });

  // Small component icon: two tiny protruding rectangles on the right side
  const iconW = 8;
  const iconH = 5;
  const iconX = node.x + node.width - iconW / 2;
  const iconTopY = node.y + node.height * 0.3;
  const iconBotY = node.y + node.height * 0.55;
  const iconTop = rect(iconX, iconTopY, iconW, iconH, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
    strokeWidth: 1,
  });
  const iconBot = rect(iconX, iconBotY, iconW, iconH, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
    strokeWidth: 1,
  });

  const labelEl = text(
    node.x + node.width / 2,
    node.y + node.height / 2 + theme.fontSize / 2,
    node.display,
    {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fill: theme.colors.text,
      textAnchor: 'middle',
    },
  );

  return bg + iconTop + iconBot + labelEl;
}

function renderInterfaceNode(node: ComponentNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const rx = node.width / 2;
  const ry = node.height / 2;

  const circle = ellipse(cx, cy, rx, ry, {
    fill: 'none',
    stroke: theme.colors.border,
    'stroke-width': 1,
  });

  const labelEl = text(
    cx,
    node.y + node.height + theme.fontSize,
    node.display,
    {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fill: theme.colors.text,
      textAnchor: 'middle',
    },
  );

  return circle + labelEl;
}

function renderDatabaseNode(node: ComponentNodeGeo, theme: Theme): string {
  const rx = node.width / 2;
  const ry = Math.max(8, Math.round(node.height * 0.18));
  const cx = node.x + rx;
  const topY = node.y + ry;
  const bodyH = node.height - ry * 2;
  const botY = topY + bodyH;

  const body = rect(node.x, topY, node.width, bodyH, {
    fill: theme.colors.graph.classBackground,
    stroke: 'none',
  });
  const leftLine = `<line x1="${node.x}" y1="${topY}" x2="${node.x}" y2="${botY}" stroke="${theme.colors.border}" stroke-width="1"/>`;
  const rightLine = `<line x1="${node.x + node.width}" y1="${topY}" x2="${node.x + node.width}" y2="${botY}" stroke="${theme.colors.border}" stroke-width="1"/>`;
  const bottomEl = ellipse(cx, botY, rx, ry, {
    fill: theme.colors.graph.classBackground,
    stroke: theme.colors.border,
    'stroke-width': 1,
  });
  const topEl = ellipse(cx, topY, rx, ry, {
    fill: theme.colors.graph.classBackground,
    stroke: theme.colors.border,
    'stroke-width': 1,
  });
  const labelEl = text(
    cx,
    topY + bodyH / 2 + theme.fontSize / 3,
    node.display,
    {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fill: theme.colors.text,
      textAnchor: 'middle',
    },
  );

  return body + bottomEl + leftLine + rightLine + topEl + labelEl;
}

function renderContainerNode(node: ComponentNodeGeo, theme: Theme): string {
  // UML folder-tab shape matching PlantUML's PackageStyle.drawFolder:
  //   tab width = max(30, width/4), notch height = 10
  //   polygon: (0,0)→(tabW,0)→(tabW+7,tabH)→(width,tabH)→(width,height)→(0,height)→close
  //   separator line at y=tabH from x=0 to x=tabW+7
  const tabW = Math.max(30, Math.round(node.width / 4));
  const tabH = 10;
  const x = node.x;
  const y = node.y;
  const w = node.width;
  const h = node.height;
  const stroke = theme.colors.graph.packageBorder;
  const fill = theme.colors.graph.packageBackground;

  const points = [
    `${x},${y}`,
    `${x + tabW},${y}`,
    `${x + tabW + 7},${y + tabH}`,
    `${x + w},${y + tabH}`,
    `${x + w},${y + h}`,
    `${x},${y + h}`,
  ].join(' ');

  const folderPath = `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;

  const sepLine = `<line x1="${x}" y1="${y + tabH}" x2="${x + tabW + 7}" y2="${y + tabH}" stroke="${stroke}" stroke-width="1"/>`;

  const labelEl = text(
    x + 6,
    y + theme.fontSize - 2,
    node.display,
    {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fontWeight: 'bold',
      fill: theme.colors.text,
      textAnchor: 'start',
    },
  );

  const childrenSvg = node.children
    .map((child) => renderNode(child, theme))
    .join('');

  return folderPath + sepLine + labelEl + childrenSvg;
}

function renderNode(node: ComponentNodeGeo, theme: Theme): string {
  if (node.kind === 'interface') return renderInterfaceNode(node, theme);
  if (node.kind === 'database' && node.children.length === 0) return renderDatabaseNode(node, theme);
  if (isRenderedAsContainer(node)) return renderContainerNode(node, theme);
  return renderComponentNode(node, theme);
}

// ---------------------------------------------------------------------------
// Edge renderers
// ---------------------------------------------------------------------------

function buildPathD(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  const p0 = points[0];
  if (p0 === undefined) return '';
  if (points.length === 1) return `M ${p0.x},${p0.y}`;

  if (points.length === 2) {
    const p1 = points[1]!;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    // CP1: exit source mostly vertically, slight horizontal drift
    // CP2: enter target at an angle proportional to the horizontal distance
    // — gives ~27° entry angle for strongly diagonal edges (e.g. Mobile→API)
    const cp1x = p0.x + dx * 0.1;
    const cp1y = p0.y + dy * 0.45;
    const cp2x = p1.x - dx * 0.3;
    const cp2y = p1.y - dy * 0.4;
    return (
      `M ${p0.x},${p0.y} ` +
      `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`
    );
  }

  // Catmull-Rom → cubic Bezier for 3+ points
  const parts: string[] = [`M ${p0.x},${p0.y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const prev = points[i > 0 ? i - 1 : 0]!;
    const curr = points[i]!;
    const next1 = points[i + 1]!;
    const next2 = points[i + 2 < points.length ? i + 2 : i + 1]!;
    const cp1x = curr.x + (next1.x - prev.x) / 6;
    const cp1y = curr.y + (next1.y - prev.y) / 6;
    const cp2x = next1.x - (next2.x - curr.x) / 6;
    const cp2y = next1.y - (next2.y - curr.y) / 6;
    parts.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next1.x},${next1.y}`);
  }
  return parts.join(' ');
}

function renderEdge(edge: ComponentEdgeGeo, theme: Theme): string {
  const d = buildPathD(edge.points);
  if (d === '') return '';

  const arrowMarker =
    edge.arrowHead === 'filled' ? 'sync' :
    edge.arrowHead === 'none' ? undefined :
    'dependency';

  const edgePath = path(d, {
    stroke: theme.colors.arrow,
    strokeWidth: 1.5,
    ...(edge.dashed ? { strokeDasharray: '5 5' } : {}),
    ...(arrowMarker !== undefined
      ? { markerEnd: `url(#${arrowHeadRef(arrowMarker)})` }
      : {}),
  });

  if (edge.label === undefined) {
    return edgePath;
  }

  // Perpendicular offset: push label to the right side of the edge so it
  // doesn't overlap the path line or adjacent nodes.
  const pts = edge.points;
  const mid = Math.floor(pts.length / 2);
  const pA = pts[mid > 0 ? mid - 1 : 0]!;
  const pB = pts[mid]!;
  const dx = pB.x - pA.x;
  const dy = pB.y - pA.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // CW perpendicular (right side): (dy/len, -dx/len)
  const labelX = edge.label.x + (dy / len) * 16;
  const labelY = edge.label.y + (-dx / len) * 16;

  const labelEl = text(labelX, labelY, edge.label.text, {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize - 2,
    fill: theme.colors.graph.edgeLabel,
    textAnchor: 'middle',
  });

  return edgePath + labelEl;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a component diagram geometry into an SVG string.
 */
export function renderComponent(geo: ComponentGeometry, theme: Theme): string {
  const children: string[] = [];

  // 1. Background
  children.push(
    rect(0, 0, geo.totalWidth, geo.totalHeight, {
      fill: theme.colors.background,
    }),
  );

  // 2. Nodes (recursive, top-level only; children rendered inside containers)
  for (const node of geo.nodes) {
    children.push(renderNode(node, theme));
  }

  // 3. Edges
  for (const edge of geo.edges) {
    children.push(renderEdge(edge, theme));
  }

  return svgRoot(geo.totalWidth, geo.totalHeight, children, theme.colors.background);
}

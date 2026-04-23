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
  const border = rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.graph.packageBackground,
    stroke: theme.colors.graph.packageBorder,
    strokeWidth: 1,
    strokeDasharray: '4 2',
  });

  const labelEl = text(
    node.x + 6,
    node.y + theme.fontSize + 4,
    node.display,
    {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fill: theme.colors.text,
      textAnchor: 'start',
    },
  );

  // Render children recursively
  const childrenSvg = node.children
    .map((child) => renderNode(child, theme))
    .join('');

  return border + labelEl + childrenSvg;
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
  const first = points[0];
  if (first === undefined) return '';

  const parts: string[] = [`M ${first.x},${first.y}`];
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt !== undefined) {
      parts.push(`L ${pt.x},${pt.y}`);
    }
  }
  return parts.join(' ');
}

function renderEdge(edge: ComponentEdgeGeo, theme: Theme): string {
  const d = buildPathD(edge.points);
  if (d === '') return '';

  const markerType = edge.dashed ? 'dependency' : 'sync';
  const edgePath = path(d, {
    stroke: theme.colors.arrow,
    strokeWidth: 1.5,
    ...(edge.dashed ? { strokeDasharray: '5 5' } : {}),
    markerEnd: `url(#${arrowHeadRef(markerType)})`,
  });

  if (edge.label === undefined) {
    return edgePath;
  }

  const labelEl = text(edge.label.x, edge.label.y, edge.label.text, {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
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

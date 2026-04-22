/**
 * Use case diagram SVG renderer.
 *
 * Pure function: UseCaseGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type { UseCaseGeometry, UCNodeGeo, UCEdgeGeo } from './layout.js';
import type { Theme } from '../../core/theme.js';
import {
  svgRoot,
  rect,
  text,
  line,
  path,
  ellipse,
} from '../../core/svg.js';

// ---------------------------------------------------------------------------
// Container kind guard
// ---------------------------------------------------------------------------

const CONTAINER_KINDS: ReadonlySet<string> = new Set([
  'package',
  'rectangle',
  'node',
  'folder',
  'frame',
  'cloud',
  'database',
]);

function isContainerKind(kind: string): boolean {
  return CONTAINER_KINDS.has(kind);
}

// ---------------------------------------------------------------------------
// Node renderers
// ---------------------------------------------------------------------------

/**
 * Render a stick-figure actor node.
 * node.width = 50, node.height = 70.
 */
function renderActor(node: UCNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y;
  const stroke = theme.colors.graph.actorStroke;

  // Head circle (r=8)
  const head =
    `<circle cx="${cx}" cy="${cy + 8}" r="8"` +
    ` stroke="${stroke}" fill="none"/>`;

  // Body: bottom of head to waist
  const body = line(cx, cy + 16, cx, cy + 40, { stroke });

  // Arms: horizontal at waist level
  const arms = line(cx - 14, cy + 28, cx + 14, cy + 28, { stroke });

  // Left leg
  const leftLeg = line(cx, cy + 40, cx - 12, cy + 58, { stroke });

  // Right leg
  const rightLeg = line(cx, cy + 40, cx + 12, cy + 58, { stroke });

  // Label below figure
  const label = text(cx, cy + 70, node.display, {
    textAnchor: 'middle',
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fill: theme.colors.text,
  });

  return head + body + arms + leftLeg + rightLeg + label;
}

/**
 * Render a use case node as a horizontal ellipse with centered label.
 */
function renderUseCaseNode(node: UCNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;

  const oval = ellipse(cx, cy, node.width / 2, node.height / 2, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
  });

  const label = text(cx, cy + theme.fontSize / 3, node.display, {
    textAnchor: 'middle',
    fill: theme.colors.text,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
  });

  return oval + label;
}

/**
 * Render a container node (package, rectangle, etc.) with a dashed border
 * and a label in the top-left, then recursively render children inside.
 */
function renderContainer(node: UCNodeGeo, theme: Theme): string {
  const box = rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.graph.packageBackground,
    stroke: theme.colors.graph.packageBorder,
    strokeWidth: 1,
    strokeDasharray: '4 2',
  });

  const label = text(node.x + 6, node.y + theme.fontSize + 4, node.display, {
    textAnchor: 'start',
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fill: theme.colors.text,
  });

  const children = node.children
    .map((child) => renderNode(child, theme))
    .join('');

  return box + label + children;
}

/**
 * Dispatch to the correct renderer for a single node.
 */
function renderNode(node: UCNodeGeo, theme: Theme): string {
  if (node.kind === 'actor') {
    return renderActor(node, theme);
  }
  if (node.kind === 'usecase') {
    return renderUseCaseNode(node, theme);
  }
  if (isContainerKind(node.kind)) {
    return renderContainer(node, theme);
  }
  // Unknown kind — fallback rect so nothing is lost
  return rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
  });
}

// ---------------------------------------------------------------------------
// Edge renderer
// ---------------------------------------------------------------------------

/**
 * Build a path `d` string from an ordered list of points.
 */
function buildEdgePath(
  points: ReadonlyArray<{ x: number; y: number }>,
): string {
  if (points.length === 0) return '';
  const first = points[0];
  if (first === undefined) return '';
  const start = `M ${first.x},${first.y}`;
  const rest = points.slice(1);
  if (rest.length === 0) return start;
  const segments = rest.map((p) => `L ${p.x},${p.y}`).join(' ');
  return `${start} ${segments}`;
}

/**
 * Compute the midpoint of an edge's point list for label placement.
 */
function edgeMidpoint(
  points: ReadonlyArray<{ x: number; y: number }>,
): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) {
    const p = points[0]!;
    return { x: p.x, y: p.y };
  }
  const midIdx = Math.floor(points.length / 2);
  const a = points[midIdx - 1]!;
  const b = points[midIdx]!;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function renderEdge(edge: UCEdgeGeo, theme: Theme): string {
  const d = buildEdgePath(edge.points);
  if (d === '') return '';

  const strokeDasharray = edge.dashed ? '5 5' : undefined;

  const edgePath = path(d, {
    stroke: theme.colors.arrow,
    strokeWidth: 1.5,
    ...(strokeDasharray !== undefined ? { strokeDasharray } : {}),
    markerEnd: 'url(#arrow-dependency)',
  });

  let extras = '';

  if (edge.stereotype !== undefined) {
    const mid = edgeMidpoint(edge.points);
    extras += text(mid.x, mid.y - 6, `«${edge.stereotype}»`, {
      textAnchor: 'middle',
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize - 2,
      fill: theme.colors.graph.edgeLabel,
    });
  }

  if (edge.label !== undefined) {
    const lbl = edge.label;
    extras += text(lbl.x, lbl.y, lbl.text, {
      textAnchor: 'middle',
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize - 2,
      fill: theme.colors.graph.edgeLabel,
    });
  }

  return edgePath + extras;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a use case diagram geometry into an SVG string.
 *
 * Pure function — no DOM, no side effects.
 */
export function renderUseCase(geo: UseCaseGeometry, theme: Theme): string {
  const children: string[] = [];

  // Background
  children.push(
    rect(0, 0, geo.totalWidth, geo.totalHeight, {
      fill: theme.colors.background,
    }),
  );

  // Nodes (containers recurse into their children)
  for (const node of geo.nodes) {
    children.push(renderNode(node, theme));
  }

  // Edges
  for (const edge of geo.edges) {
    children.push(renderEdge(edge, theme));
  }

  return svgRoot(geo.totalWidth, geo.totalHeight, children);
}

/**
 * Unified description diagram SVG renderer — public API and edge rendering.
 *
 * Node shape rendering is delegated to renderer-helpers.ts (split for the
 * 500-line complexity limit). This module owns:
 *   - buildSplinePathD  — cubic-bezier path from graphviz control points
 *   - renderEdgeLabels  — stereotype and explicit label text overlay
 *   - renderEdge        — edge path, arrowhead, labels
 *   - renderDescription — public entry point
 *
 * Edge paths follow the cubic-bezier-from-spline-points precedent in
 * src/diagrams/dot/renderer.ts (~line 169): M start, then C cp1 cp2 ep
 * per triple of graphviz control points.
 *
 * Pure function: DescriptionGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type { DescriptionGeometry, DescriptionEdgeGeo } from './layout.js';
import type { Theme } from '../../core/theme.js';
import { rect, text, path, svgRoot, arrowHeadRef } from '../../core/svg.js';
import { renderNode } from './renderer-helpers.js';

// ---------------------------------------------------------------------------
// Edge rendering — cubic-bezier splines from graphviz control points
// ---------------------------------------------------------------------------

/**
 * Build an SVG path `d` string from graphviz spline control points.
 *
 * points[0] is the curve start; subsequent triples (cp1, cp2, endpoint)
 * each form one cubic bezier segment — the spline format from
 * dotgen/dotsplines.c as produced by the T5 layout.
 *
 * When rest.length >= 3 emits:  M start  C cp1 cp2 ep  [C ...]
 *
 * Graceful fallback: degenerate point counts (< 4 total, or leftover
 * after bezier groups) use L (polyline) — never throws, never drops.
 * Matches the defensive pattern in dot/renderer.ts buildPathD.
 */
function buildSplinePathD(
  points: ReadonlyArray<{ x: number; y: number }>,
): string {
  if (points.length === 0) return '';
  const first = points[0]!;
  if (points.length === 1) return `M ${first.x},${first.y}`;

  const parts: string[] = [`M ${first.x},${first.y}`];
  const rest = points.slice(1);

  if (rest.length >= 3) {
    // Consume triples (cp1, cp2, endpoint) as cubic bezier segments
    let idx = 0;
    while (idx + 2 < rest.length) {
      const cp1 = rest[idx]!;
      const cp2 = rest[idx + 1]!;
      const ep  = rest[idx + 2]!;
      parts.push(`C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${ep.x},${ep.y}`);
      idx += 3;
    }
    // Leftover points that don't form a full triple — polyline fallback
    for (; idx < rest.length; idx++) {
      const pt = rest[idx]!;
      parts.push(`L ${pt.x},${pt.y}`);
    }
  } else {
    // < 4 total points: polyline fallback for degenerate inputs
    for (const pt of rest) {
      parts.push(`L ${pt.x},${pt.y}`);
    }
  }

  return parts.join(' ');
}

/** Approximate midpoint of a point list for edge label/stereotype placement. */
function edgeMidpoint(
  points: ReadonlyArray<{ x: number; y: number }>,
): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) { const p = points[0]!; return { x: p.x, y: p.y }; }
  const mid = Math.floor(points.length / 2);
  const a = points[mid - 1]!;
  const b = points[mid]!;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Build stereotype + explicit label text overlays for an edge. */
function renderEdgeLabels(edge: DescriptionEdgeGeo, theme: Theme): string {
  const labelStyle = {
    textAnchor: 'middle' as const,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize - 2,
    fill: theme.colors.graph.edgeLabel,
  };
  let result = '';
  if (edge.stereotype !== undefined) {
    const mid = edgeMidpoint(edge.points);
    result += text(mid.x, mid.y - 6, `«${edge.stereotype}»`, labelStyle);
  }
  if (edge.label !== undefined) {
    const lbl = edge.label;
    result += text(lbl.x, lbl.y, lbl.text, labelStyle);
  }
  return result;
}

function renderEdge(edge: DescriptionEdgeGeo, theme: Theme): string {
  const d = buildSplinePathD(edge.points);
  if (d === '') return '';
  // filled → sync triangle; none → no marker; open / default → dependency
  const arrowMarker =
    edge.arrowHead === 'filled' ? 'sync' :
    edge.arrowHead === 'none'   ? undefined :
    'dependency';
  const edgePath = path(d, {
    stroke: theme.colors.arrow,
    strokeWidth: 1.5,
    ...(edge.dashed ? { strokeDasharray: '5 5' } : {}),
    ...(arrowMarker !== undefined ? { markerEnd: `url(#${arrowHeadRef(arrowMarker)})` } : {}),
  });
  return edgePath + renderEdgeLabels(edge, theme);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a descriptive diagram geometry into an SVG string.
 *
 * Accepts the output of {@link layoutDescription} and produces a complete
 * SVG document. Arrowhead `<defs>` are embedded automatically by svgRoot.
 *
 * Pure function — no DOM, no side effects.
 */
export function renderDescription(geo: DescriptionGeometry, theme: Theme): string {
  const children: string[] = [];
  children.push(rect(0, 0, geo.totalWidth, geo.totalHeight, { fill: theme.colors.background }));
  for (const node of geo.nodes) children.push(renderNode(node, theme));
  for (const edge of geo.edges) children.push(renderEdge(edge, theme));
  return svgRoot(geo.totalWidth, geo.totalHeight, children, theme.colors.background);
}

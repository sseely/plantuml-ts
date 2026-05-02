/**
 * Renderer for @startdot diagrams.
 *
 * Converts a DotGeometry produced by layoutDot() into an SVG string.
 * The renderer is a pure function: same inputs always produce same output.
 */

import { rect, ellipse, diamond, path, text, svgRoot } from '../../core/svg.js';
import type { TextStyle, BoxStyle } from '../../core/svg.js';
import { arrowHeadRef } from '../../core/svg.js';
import type { DotGeometry, DotNodeGeo, DotEdgeGeo } from './ast.js';
import type { Theme } from '../../core/theme.js';

// Padding between the top edge of the SVG and diagram content when a title
// is present.
const TITLE_HEIGHT = 30;

// Default stroke width for node shapes.
const NODE_STROKE_WIDTH = 1.5;

// ---------------------------------------------------------------------------
// Node rendering helpers
// ---------------------------------------------------------------------------

function nodeStyle(theme: Theme): { fill: string; stroke: string; strokeWidth: number } {
  return {
    fill: theme.colors.nodeBackground,
    stroke: theme.colors.border,
    strokeWidth: NODE_STROKE_WIDTH,
  };
}

function renderNode(node: DotNodeGeo, theme: Theme, yOffset: number): string {
  const { x, y: rawY, width, height, shape, label } = node;
  const y = rawY + yOffset;
  // x,y from the layout engine are the TOP-LEFT corner of the node bounding box.
  // All shape primitives that take a center need cx/cy.
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
      const style: BoxStyle = nodeStyle(theme);
      return (
        rect(x, y, width, height, style) +
        text(cx, cy, label, textStyle)
      );
    }

    case 'ellipse':
    case 'circle': {
      const style = nodeStyle(theme);
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
      const style = nodeStyle(theme);
      return (
        diamond(cx, cy, Math.min(width, height) / 2, {
          fill: style.fill,
          stroke: style.stroke,
          'stroke-width': NODE_STROKE_WIDTH,
        }) +
        text(cx, cy, label, textStyle)
      );
    }

    case 'plaintext': {
      return text(cx, cy, label, textStyle);
    }
  }
}

// ---------------------------------------------------------------------------
// Edge rendering helpers
// ---------------------------------------------------------------------------

function buildPathD(points: Array<{ x: number; y: number }>, yOffset: number): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points as [{ x: number; y: number }, ...Array<{ x: number; y: number }>];
  const parts = [`M ${first.x},${first.y + yOffset}`];
  for (const pt of rest) {
    parts.push(`L ${pt.x},${pt.y + yOffset}`);
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

function renderEdge(edge: DotEdgeGeo, theme: Theme, yOffset: number): string {
  if (edge.points.length === 0) return '';

  const edgeColor = theme.colors.arrow;

  const d = buildPathD(edge.points, yOffset);
  const edgeStyle = edge.directed
    ? {
        stroke: edgeColor,
        strokeWidth: 1.5,
        markerEnd: `url(#${arrowHeadRef('sync')})`,
      }
    : {
        stroke: edgeColor,
        strokeWidth: 1.5,
      };

  const pathEl = path(d, edgeStyle);

  let labelEl = '';
  if (edge.label !== null) {
    const mp = midpoint(edge.points);
    labelEl = text(mp.x, mp.y + yOffset, edge.label, {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize - 2,
      fill: theme.colors.graph.edgeLabel,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    });
  }

  return pathEl + labelEl;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function renderDot(geo: DotGeometry, theme: Theme): string {
  const hasTitle = geo.title !== null;
  const yOffset = hasTitle ? TITLE_HEIGHT : 0;
  const finalWidth = geo.totalWidth;
  const finalHeight = geo.totalHeight + yOffset;

  const children: string[] = [];

  // Title element
  if (hasTitle) {
    children.push(
      text(finalWidth / 2, 20, geo.title!, {
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize + 2,
        fill: theme.colors.text,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      }),
    );
  }

  // Edges drawn before nodes so nodes appear on top.
  for (const edge of geo.edges) {
    children.push(renderEdge(edge, theme, yOffset));
  }

  // Nodes
  for (const node of geo.nodes) {
    children.push(renderNode(node, theme, yOffset));
  }

  const bgColor = theme.colors.background;
  return svgRoot(finalWidth, finalHeight, children, bgColor);
}

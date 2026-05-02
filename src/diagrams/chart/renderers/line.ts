/**
 * LineRenderer — draws a line chart series as an SVG fragment.
 *
 * Ported from LineRenderer.java (net.sourceforge.plantuml.chart).
 * Marker shapes are drawn inline here (upstream handles them in
 * ChartRenderer.java's drawLegendScatterMarker / ScatterRenderer).
 *
 * @module
 */

import type { LineSeriesGeo, DataPoint } from '../layout.js';
import type { Theme } from '../../../core/theme.js';

// ---------------------------------------------------------------------------
// Marker drawing helpers
// ---------------------------------------------------------------------------

/** Radius / half-size for all marker shapes — matches upstream sizing. */
const MARKER_RADIUS = 4;

function drawCircleMarker(p: DataPoint, color: string): string {
  return (
    `<circle cx="${p.x}" cy="${p.y}" r="${MARKER_RADIUS}"` +
    ` fill="${color}" stroke="${color}"/>`
  );
}

function drawSquareMarker(p: DataPoint, color: string): string {
  const offset = MARKER_RADIUS;
  const size = MARKER_RADIUS * 2;
  return (
    `<rect x="${p.x - offset}" y="${p.y - offset}"` +
    ` width="${size}" height="${size}"` +
    ` fill="${color}" stroke="${color}"/>`
  );
}

function drawTriangleMarker(p: DataPoint, color: string): string {
  // Upward-pointing triangle centred on (p.x, p.y).
  // Apex 5px above centre, base corners 3px below centre ±4px wide —
  // mirrors the UPolygon coordinates in ChartRenderer.java
  // drawLegendScatterMarker: points (0, -size/2), (-size/2, +size/2), (+size/2, +size/2)
  // with size ≈ 8 (MARKER_RADIUS*2).
  const top = `${p.x},${p.y - 5}`;
  const bl = `${p.x - MARKER_RADIUS},${p.y + 3}`;
  const br = `${p.x + MARKER_RADIUS},${p.y + 3}`;
  return (
    `<polygon points="${top} ${bl} ${br}"` +
    ` fill="${color}" stroke="${color}"/>`
  );
}

function drawMarker(
  p: DataPoint,
  shape: LineSeriesGeo['markerShape'],
  color: string,
): string {
  switch (shape) {
    case 'square':
      return drawSquareMarker(p, color);
    case 'triangle':
      return drawTriangleMarker(p, color);
    default:
      return drawCircleMarker(p, color);
  }
}

// ---------------------------------------------------------------------------
// Data label helper
// ---------------------------------------------------------------------------

function drawLabel(p: DataPoint): string {
  return (
    `<text x="${p.x}" y="${p.y - 10}"` +
    ` text-anchor="middle" font-size="10">${String(p.value)}</text>`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Draw a single line series as an SVG fragment (no `<svg>` wrapper).
 *
 * Renders:
 *  - Straight line segments between consecutive data points
 *  - A marker (circle / square / triangle) at every data point
 *  - Optional value labels above each data point
 *
 * All pixel coordinates are pre-computed in `geo.points`; this function
 * performs no axis-to-pixel math.
 */
export function drawLine(geo: LineSeriesGeo, _theme: Theme): string {
  if (geo.points.length === 0) return '';

  const parts: string[] = [];

  // --- Line segments ---
  for (let i = 0; i < geo.points.length - 1; i++) {
    const p1 = geo.points[i]!;
    const p2 = geo.points[i + 1]!;
    parts.push(
      `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"` +
        ` stroke="${geo.color}" stroke-width="2"/>`,
    );
  }

  // --- Markers and optional labels ---
  for (const p of geo.points) {
    parts.push(drawMarker(p, geo.markerShape, geo.color));
    if (geo.showLabels) {
      parts.push(drawLabel(p));
    }
  }

  return parts.join('\n');
}

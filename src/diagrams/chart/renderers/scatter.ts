/**
 * ScatterRenderer — draws a scatter chart series as an SVG fragment.
 *
 * Ported from ScatterRenderer.java (net.sourceforge.plantuml.chart).
 * Key distinction from line: scatter draws isolated markers at each
 * data point with NO connecting line segments.
 *
 * @module
 */

import type { ScatterSeriesGeo, DataPoint } from '../layout.js';
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
  // mirrors ScatterRenderer.java drawTriangleMarker:
  //   top (0, -size/2), bottom-left (-size/2, +size/2), bottom-right (+size/2, +size/2)
  // with size = 8 (MARKER_RADIUS * 2).
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
  shape: ScatterSeriesGeo['markerShape'],
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
    `<text x="${p.x + 6}" y="${p.y - 4}"` +
    ` font-size="10">${String(p.value)}</text>`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Draw a single scatter series as an SVG fragment (no `<svg>` wrapper).
 *
 * Renders isolated markers (circle / square / triangle) at every data
 * point. Unlike line charts, NO connecting line segments are drawn —
 * this is the defining characteristic of scatter charts in upstream.
 *
 * Pixel coordinates come pre-computed from `geo.points`; this function
 * performs no axis-to-pixel math. Coordinate-pair mode (xValue set on
 * points) is transparent — layout has already resolved pixel positions.
 */
export function drawScatter(geo: ScatterSeriesGeo, _theme: Theme): string {
  if (geo.points.length === 0) return '';

  const parts: string[] = [];

  for (const p of geo.points) {
    parts.push(drawMarker(p, geo.markerShape, geo.color));
    if (geo.showLabels) {
      parts.push(drawLabel(p));
    }
  }

  return parts.join('\n');
}

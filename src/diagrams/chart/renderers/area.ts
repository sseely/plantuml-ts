/**
 * AreaRenderer — draws an area chart series as an SVG fragment.
 *
 * Ported from AreaRenderer.java (net.sourceforge.plantuml.chart).
 * The filled polygon is constructed from the top-edge points (forward)
 * and baseline points (reverse) then closed. A separate stroke path is
 * drawn along the top edge to give the area a defined upper boundary.
 *
 * @module
 */

import type { AreaSeriesGeo, DataPoint } from '../layout.js';
import type { Theme } from '../../../core/theme.js';

// ---------------------------------------------------------------------------
// Constants — sourced from AreaRenderer.java
// ---------------------------------------------------------------------------

/** Fill opacity for the area polygon — matches upstream alpha. */
const FILL_OPACITY = 0.5;

/** Stroke width for the top-edge line — matches UStroke.withThickness(2.0). */
const TOP_EDGE_STROKE_WIDTH = 2;

/** Vertical offset (px) for data labels above the data point. */
const LABEL_OFFSET_Y = 8;

/** Font size for data labels. */
const LABEL_FONT_SIZE = 10;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the SVG path `d` attribute for the filled area polygon.
 *
 * Forward through `points` (top edge), then reverse through `baselinePoints`
 * (bottom edge), closed with Z — matches the UPolygon construction in
 * AreaRenderer.java.
 */
function buildFillPath(points: DataPoint[], baselinePoints: DataPoint[]): string {
  const p0 = points[0]!;
  const parts: string[] = [`M ${p0.x},${p0.y}`];

  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    parts.push(`L ${p.x},${p.y}`);
  }

  for (let i = baselinePoints.length - 1; i >= 0; i--) {
    const b = baselinePoints[i]!;
    parts.push(`L ${b.x},${b.y}`);
  }

  parts.push('Z');
  return parts.join(' ');
}

/**
 * Build the top-edge stroke path `d` attribute.
 * Traces forward through `points` with M + L segments.
 */
function buildStrokePath(points: DataPoint[]): string {
  const p0 = points[0]!;
  const parts: string[] = [`M ${p0.x},${p0.y}`];

  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    parts.push(`L ${p.x},${p.y}`);
  }

  return parts.join(' ');
}

/**
 * Format a data value for a label — mirrors AreaRenderer.java formatValue().
 */
function formatValue(value: number): string {
  if (Math.abs(value) < 0.01 && value !== 0) {
    return value.toExponential(2);
  }
  if (value === Math.trunc(value)) {
    return String(Math.trunc(value));
  }
  return value.toFixed(2);
}

function drawLabel(p: DataPoint): string {
  return (
    `<text x="${p.x}" y="${p.y - LABEL_OFFSET_Y}"` +
    ` text-anchor="middle" font-size="${LABEL_FONT_SIZE}">${formatValue(p.value)}</text>`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Draw a single area series as an SVG fragment (no `<svg>` wrapper).
 *
 * Renders:
 *  - A filled `<path>` polygon (top edge + baseline in reverse) at 50% opacity
 *  - A stroked `<path>` along the top edge for a clear upper boundary
 *  - Optional value labels above each top-edge point
 *
 * All pixel coordinates are pre-computed in `geo.points` and
 * `geo.baselinePoints`; this function performs no axis-to-pixel math.
 */
export function drawArea(geo: AreaSeriesGeo, _theme: Theme): string {
  if (geo.points.length === 0) return '';

  const parts: string[] = [];

  if (geo.points.length === 1) {
    // Single-point degenerate case: draw a vertical line from baseline to point.
    const p = geo.points[0]!;
    const b = geo.baselinePoints[0] ?? { x: p.x, y: p.y };
    parts.push(
      `<line x1="${p.x}" y1="${b.y}" x2="${p.x}" y2="${p.y}"` +
        ` stroke="${geo.color}" stroke-width="${TOP_EDGE_STROKE_WIDTH}"/>`,
    );

    if (geo.showLabels) {
      parts.push(drawLabel(p));
    }

    return parts.join('\n');
  }

  // --- Filled area polygon ---
  const fillD = buildFillPath(geo.points, geo.baselinePoints);
  parts.push(
    `<path d="${fillD}"` +
      ` fill="${geo.color}" fill-opacity="${FILL_OPACITY}" stroke="none"/>`,
  );

  // --- Top-edge stroke ---
  const strokeD = buildStrokePath(geo.points);
  parts.push(
    `<path d="${strokeD}"` +
      ` fill="none" stroke="${geo.color}" stroke-width="${TOP_EDGE_STROKE_WIDTH}"/>`,
  );

  // --- Optional data labels ---
  if (geo.showLabels) {
    for (const p of geo.points) {
      parts.push(drawLabel(p));
    }
  }

  return parts.join('\n');
}

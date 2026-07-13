/**
 * renderChart() — SVG orchestrator for chart diagrams.
 *
 * Receives a fully pre-computed ChartGeometry from layoutChart() and
 * produces a complete SVG string by delegating to the series sub-renderers
 * and drawing axes, grid lines, legend, and annotations inline.
 *
 * Drawing order mirrors ChartRenderer.java exactly:
 *  1. Background rect (handled by svgRoot)
 *  2. Plot area background
 *  3. Grid lines
 *  4. Area series
 *  5. Bar series
 *  6. Line series
 *  7. Scatter series
 *  8. Axes (h-axis, v-axis)
 *  9. Secondary Y-axis (if present)
 * 10. Legend (if present)
 * 11. Annotations
 *
 * @module
 */

import type { ChartGeometry, AxisGeometry, LegendGeometry, AnnotationGeometry } from './layout.js';
import type { Theme } from '../../core/theme.js';
import { rect, line, text } from '../../core/svg.js';
import type { AssembledSvg } from '../../core/dispatcher.js';
import { drawBar } from './renderers/bar.js';
import { drawLine } from './renderers/line.js';
import { drawArea } from './renderers/area.js';
import { drawScatter } from './renderers/scatter.js';

// ---------------------------------------------------------------------------
// Layout constants (mirrors ChartRenderer.java)
// ---------------------------------------------------------------------------

/** Length of axis tick marks in pixels. */
const TICK_SIZE = 5;
/** Font size used for axis tick labels. */
const TICK_LABEL_FONT_SIZE = 11;
/** Font size used for axis titles. */
const AXIS_TITLE_FONT_SIZE = 12;
/** Size of legend swatch rectangles in pixels. */
const LEGEND_SWATCH_SIZE = 12;
/** Horizontal gap between swatch and label text. */
const LEGEND_SWATCH_TEXT_GAP = 4;
/** Vertical spacing between legend entries in vertical layout. */
const LEGEND_ENTRY_SPACING_V = 18;
/** Inner padding within the legend bounding box. */
const LEGEND_INNER_PAD = 8;

// ---------------------------------------------------------------------------
// Grid lines
// ---------------------------------------------------------------------------

/**
 * Draw horizontal grid lines across the plot area at every v-axis grid pixel.
 */
function drawHorizontalGridLines(geo: ChartGeometry): string {
  if (geo.vAxis.gridPixels.length === 0) return '';
  const parts: string[] = [];
  for (const py of geo.vAxis.gridPixels) {
    parts.push(
      line(geo.plotArea.x, py, geo.plotArea.x + geo.plotArea.width, py, {
        stroke: '#CCCCCC',
        strokeWidth: 1,
        strokeDasharray: '4 2',
      }),
    );
  }
  return parts.join('\n');
}

/**
 * Draw vertical grid lines down the plot area at every h-axis grid pixel.
 */
function drawVerticalGridLines(geo: ChartGeometry): string {
  if (geo.hAxis.gridPixels.length === 0) return '';
  const parts: string[] = [];
  for (const px of geo.hAxis.gridPixels) {
    parts.push(
      line(px, geo.plotArea.y, px, geo.plotArea.y + geo.plotArea.height, {
        stroke: '#CCCCCC',
        strokeWidth: 1,
        strokeDasharray: '4 2',
      }),
    );
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Axis rendering
// ---------------------------------------------------------------------------

/**
 * Draw the horizontal (category / x) axis:
 *  - Axis line along the bottom of the plot area
 *  - A short vertical tick below the axis for each tick mark
 *  - A centered label below each tick
 *  - An optional title centered below the axis
 */
function drawHAxis(axis: AxisGeometry, geo: ChartGeometry, theme: Theme): string {
  const parts: string[] = [];
  const plotBottom = geo.plotArea.y + geo.plotArea.height;

  // Axis line
  parts.push(
    line(geo.plotArea.x, plotBottom, geo.plotArea.x + geo.plotArea.width, plotBottom, {
      stroke: theme.colors.border,
      strokeWidth: 1,
    }),
  );

  // Tick marks and labels
  for (const tick of axis.ticks) {
    parts.push(
      line(tick.pixelPos, plotBottom, tick.pixelPos, plotBottom + TICK_SIZE, {
        stroke: theme.colors.border,
        strokeWidth: 1,
      }),
    );
    parts.push(
      text(tick.pixelPos, plotBottom + TICK_SIZE + 4, tick.label, {
        fontFamily: theme.fontFamily,
        fontSize: TICK_LABEL_FONT_SIZE,
        fill: theme.colors.text,
        textAnchor: 'middle',
        dominantBaseline: 'hanging',
      }),
    );
  }

  // Axis title
  if (axis.title.length > 0) {
    if (axis.titlePos.rotate) {
      parts.push(
        `<text x="${axis.titlePos.x}" y="${axis.titlePos.y}"` +
          ` font-family="${theme.fontFamily}"` +
          ` font-size="${String(AXIS_TITLE_FONT_SIZE)}"` +
          ` fill="${theme.colors.text}"` +
          ` text-anchor="middle"` +
          ` transform="rotate(-90,${String(axis.titlePos.x)},${String(axis.titlePos.y)})"` +
          `><tspan>${axis.title}</tspan></text>`,
      );
    } else {
      parts.push(
        text(axis.titlePos.x, axis.titlePos.y, axis.title, {
          fontFamily: theme.fontFamily,
          fontSize: AXIS_TITLE_FONT_SIZE,
          fill: theme.colors.text,
          textAnchor: 'middle',
        }),
      );
    }
  }

  return parts.join('\n');
}

/**
 * Draw a vertical (y) axis — either primary (left) or secondary (right).
 *
 * leftSide=true  → axis on left edge, ticks extend left, labels right-aligned left of ticks
 * leftSide=false → axis on right edge, ticks extend right, labels left-aligned right of ticks
 */
function drawVAxis(
  axis: AxisGeometry,
  geo: ChartGeometry,
  theme: Theme,
  leftSide: boolean,
): string {
  const parts: string[] = [];
  const axisX = leftSide ? geo.plotArea.x : geo.plotArea.x + geo.plotArea.width;

  // Axis line
  parts.push(
    line(axisX, geo.plotArea.y, axisX, geo.plotArea.y + geo.plotArea.height, {
      stroke: theme.colors.border,
      strokeWidth: 1,
    }),
  );

  // Tick marks and labels
  for (const tick of axis.ticks) {
    if (leftSide) {
      parts.push(
        line(axisX - TICK_SIZE, tick.pixelPos, axisX, tick.pixelPos, {
          stroke: theme.colors.border,
          strokeWidth: 1,
        }),
      );
      parts.push(
        text(axisX - TICK_SIZE - 3, tick.pixelPos, tick.label, {
          fontFamily: theme.fontFamily,
          fontSize: TICK_LABEL_FONT_SIZE,
          fill: theme.colors.text,
          textAnchor: 'end',
          dominantBaseline: 'middle',
        }),
      );
    } else {
      parts.push(
        line(axisX, tick.pixelPos, axisX + TICK_SIZE, tick.pixelPos, {
          stroke: theme.colors.border,
          strokeWidth: 1,
        }),
      );
      parts.push(
        text(axisX + TICK_SIZE + 3, tick.pixelPos, tick.label, {
          fontFamily: theme.fontFamily,
          fontSize: TICK_LABEL_FONT_SIZE,
          fill: theme.colors.text,
          textAnchor: 'start',
          dominantBaseline: 'middle',
        }),
      );
    }
  }

  // Axis title: left axis rotates -90° (reads bottom-to-top),
  //             right axis rotates +90° (reads top-to-bottom, letters face outward)
  if (axis.title.length > 0) {
    const rotateDeg = leftSide ? -90 : 90;
    parts.push(
      `<text x="${axis.titlePos.x}" y="${axis.titlePos.y}"` +
        ` font-family="${theme.fontFamily}"` +
        ` font-size="${String(AXIS_TITLE_FONT_SIZE)}"` +
        ` fill="${theme.colors.text}"` +
        ` text-anchor="middle"` +
        ` transform="rotate(${rotateDeg},${String(axis.titlePos.x)},${String(axis.titlePos.y)})"` +
        `><tspan>${axis.title}</tspan></text>`,
    );
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Legend rendering
// ---------------------------------------------------------------------------

/**
 * Pixel position for a single legend entry, computed at render time from
 * the bounding box in LegendGeometry.
 */
interface LegendEntryPos {
  x: number;
  y: number;
  color: string;
  name: string;
  markerShape?: 'circle' | 'square' | 'triangle';
  markerSize?: number;
}

/**
 * Compute per-entry pixel positions within the legend bounding box.
 *
 * Orientation is detected heuristically: if legend.height > legend.width / 2
 * we use vertical stacking (left / right legends), otherwise horizontal.
 */
function positionLegendEntries(legend: LegendGeometry): LegendEntryPos[] {
  const result: LegendEntryPos[] = [];
  let curX = legend.x + LEGEND_INNER_PAD;
  let curY = legend.y + LEGEND_INNER_PAD;
  const isVertical = legend.position === 'left' || legend.position === 'right';

  for (const entry of legend.entries) {
    const pos: LegendEntryPos = { x: curX, y: curY, color: entry.color, name: entry.name };
    if (entry.markerShape !== undefined) pos.markerShape = entry.markerShape;
    if (entry.markerSize !== undefined) pos.markerSize = entry.markerSize;
    result.push(pos);
    if (isVertical) {
      curY += LEGEND_ENTRY_SPACING_V;
    } else {
      // Horizontal: advance by swatch + gap + approximate text width + padding
      curX += LEGEND_SWATCH_SIZE + LEGEND_SWATCH_TEXT_GAP + entry.name.length * 7 + LEGEND_INNER_PAD;
    }
  }
  return result;
}

/** Draw the marker shape for a scatter legend swatch, centered in the swatch cell. */
function drawLegendScatterSwatch(pe: LegendEntryPos): string {
  const cx = pe.x + LEGEND_SWATCH_SIZE / 2;
  const cy = pe.y + LEGEND_SWATCH_SIZE / 2;
  const r = (pe.markerSize ?? 8) / 2;
  const shape = pe.markerShape ?? 'circle';
  const c = pe.color;

  if (shape === 'circle') {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" stroke="${c}"/>`;
  }
  if (shape === 'square') {
    return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="${c}" stroke="${c}"/>`;
  }
  // triangle
  const top = `${cx},${cy - (r + 1)}`;
  const bl = `${cx - r},${cy + (r - 1)}`;
  const br = `${cx + r},${cy + (r - 1)}`;
  return `<polygon points="${top} ${bl} ${br}" fill="${c}" stroke="${c}"/>`;
}

/**
 * Draw the legend bounding rect and all swatch+label entries.
 */
function drawLegend(legend: LegendGeometry, theme: Theme): string {
  const parts: string[] = [];

  // Border rect
  parts.push(
    rect(legend.x, legend.y, legend.width, legend.height, {
      fill: '#FFFFFF',
      stroke: theme.colors.border,
      strokeWidth: 1,
    }),
  );

  const positions = positionLegendEntries(legend);

  for (const pe of positions) {
    // For scatter series, draw the actual marker shape; others get a color square
    if (pe.markerShape !== undefined) {
      parts.push(drawLegendScatterSwatch(pe));
    } else {
      parts.push(
        rect(pe.x, pe.y, LEGEND_SWATCH_SIZE, LEGEND_SWATCH_SIZE, {
          fill: pe.color,
          stroke: theme.colors.border,
          strokeWidth: 1,
        }),
      );
    }
    // Label text to the right of the swatch
    parts.push(
      text(
        pe.x + LEGEND_SWATCH_SIZE + LEGEND_SWATCH_TEXT_GAP,
        pe.y + LEGEND_SWATCH_SIZE / 2,
        pe.name,
        {
          fontFamily: theme.fontFamily,
          fontSize: TICK_LABEL_FONT_SIZE,
          fill: theme.colors.text,
          textAnchor: 'start',
          dominantBaseline: 'middle',
        },
      ),
    );
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Annotation rendering
// ---------------------------------------------------------------------------

/**
 * Draw a single annotation:
 *  - Text label at (labelX, labelY)
 *  - Optional arrow line toward arrowTarget when hasArrow is true
 */
function drawAnnotation(ann: AnnotationGeometry, theme: Theme): string {
  const parts: string[] = [];

  // Label text with a few pixels of padding below it
  parts.push(
    text(ann.labelX, ann.labelY, ann.text, {
      fontFamily: theme.fontFamily,
      fontSize: TICK_LABEL_FONT_SIZE,
      fill: theme.colors.text,
      textAnchor: 'middle',
    }),
  );

  if (ann.hasArrow && ann.arrowTargetX !== undefined && ann.arrowTargetY !== undefined) {
    const lineStartY = ann.labelY + TICK_LABEL_FONT_SIZE / 2 + 3;
    const tipX = ann.arrowTargetX;
    const tipY = ann.arrowTargetY;
    const arrowSize = 5;

    // Line from bottom of label to just above the arrowhead tip
    parts.push(
      line(ann.labelX, lineStartY, tipX, tipY - arrowSize, {
        stroke: theme.colors.arrow,
        strokeWidth: 1,
      }),
    );

    // Filled triangle arrowhead pointing downward at the tip
    const ax = tipX;
    const ay = tipY;
    parts.push(
      `<polygon points="${ax},${ay} ${ax - arrowSize},${ay - arrowSize * 1.6} ${ax + arrowSize},${ay - arrowSize * 1.6}" fill="${theme.colors.arrow}"/>`,
    );
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Error diagram
// ---------------------------------------------------------------------------

/**
 * Return a visually distinct error SVG (red border, error text).
 */
function renderErrorDiagram(errors: string[]): string {
  const message = errors.join('; ');
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const width = 600;
  const height = 80;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>` +
    `<text x="10" y="28" fill="#dc2626" font-family="monospace" font-size="12">Chart error:</text>` +
    `<text x="10" y="52" fill="#dc2626" font-family="monospace" font-size="11">${escaped}</text>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a chart diagram from pre-computed geometry.
 *
 * The `geo` parameter may carry an optional `errors` array (injected by the
 * plugin's layoutSync wrapper in index.ts from the AST). When errors are
 * present the function short-circuits to a visually distinct error SVG.
 */
export function renderChart(
  geo: ChartGeometry & { errors?: readonly string[] },
  theme: Theme,
): AssembledSvg {
  // Error path — surface parse/validation errors. This inline emitter
  // bypasses svgRoot entirely (no arrow-marker defs / viewBox needed for a
  // fixed-size error box), so it returns the `completeSvg` escape hatch
  // rather than a RenderFragment.
  if (geo.errors !== undefined && geo.errors.length > 0) {
    return { completeSvg: renderErrorDiagram([...geo.errors]) };
  }

  const parts: string[] = [];

  // Diagram-level title is no longer drawn here (mission G0b/T8) -- it
  // flows through ast.chrome.title and is drawn once, centrally, by
  // applyChrome (src/index.ts) around the RenderFragment this function
  // returns. (TITLE_SPACE in layout.ts still reserves the same top margin
  // unconditionally -- see that constant's doc comment.)

  // 2. Plot area background
  parts.push(
    rect(geo.plotArea.x, geo.plotArea.y, geo.plotArea.width, geo.plotArea.height, {
      fill: '#FFFFFF',
      stroke: 'none',
    }),
  );

  // 3. Grid lines — v-axis gridPixels → horizontal; h-axis gridPixels → vertical
  parts.push(drawHorizontalGridLines(geo));
  parts.push(drawVerticalGridLines(geo));

  // 4. Area series (drawn first, below bars and lines)
  for (const s of geo.series) {
    if (s.type === 'area') {
      parts.push(drawArea(s, theme));
    }
  }

  // 5. Bar series
  for (const s of geo.series) {
    if (s.type === 'bar') {
      parts.push(drawBar(s, theme));
    }
  }

  // 6. Line series
  for (const s of geo.series) {
    if (s.type === 'line') {
      parts.push(drawLine(s, theme));
    }
  }

  // 7. Scatter series
  for (const s of geo.series) {
    if (s.type === 'scatter') {
      parts.push(drawScatter(s, theme));
    }
  }

  // 8. Primary axes
  parts.push(drawHAxis(geo.hAxis, geo, theme));
  parts.push(drawVAxis(geo.vAxis, geo, theme, /* leftSide */ true));

  // 9. Secondary Y-axis (right edge)
  if (geo.v2Axis !== undefined) {
    parts.push(drawVAxis(geo.v2Axis, geo, theme, /* leftSide */ false));
  }

  // 10. Legend
  if (geo.legend !== undefined) {
    parts.push(drawLegend(geo.legend, theme));
  }

  // 11. Annotations
  for (const ann of geo.annotations) {
    parts.push(drawAnnotation(ann, theme));
  }

  return {
    body: parts.filter((p) => p.length > 0).join(''),
    width: geo.svgWidth,
    height: geo.svgHeight,
    background: geo.bgColor,
  };
}

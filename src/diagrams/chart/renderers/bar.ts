/**
 * BarRenderer — SVG fragment generator for bar chart series.
 *
 * Mirrors BarRenderer.java (drawVertical / drawHorizontal / label placement).
 * All pixel geometry is pre-computed in BarSeriesGeo.rects by layout.ts —
 * this module only converts those rects into SVG markup.
 *
 * @module
 */

import type { BarSeriesGeo } from '../layout.js';
import type { Theme } from '../../../core/theme.js';
import { rect as svgRect, text as svgText } from '../../../core/svg.js';

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/**
 * Darken a `#RRGGBB` hex color by multiplying each channel by `factor`.
 *
 * Mirrors the bar-border darkening described in the task spec.
 * Returns `fallback` when `hex` is not a valid 7-char `#RRGGBB` string.
 */
function darkenHex(hex: string, factor = 0.8, fallback = '#000000'): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return fallback;
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Value formatting — mirrors BarRenderer.java formatValue()
// ---------------------------------------------------------------------------

/**
 * Format a data value for display on a bar label.
 *
 * Mirrors formatValue() in BarRenderer.java:
 *   - Very small non-zero values → scientific notation (2 sig figs)
 *   - Integer values → no decimal places
 *   - All others → 2 decimal places
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a single bar series as an SVG fragment (no `<svg>` wrapper).
 *
 * Coordinates come pre-computed from `BarSeriesGeo.rects` (layout.ts).
 * This function is pure: same inputs always produce the same SVG string.
 *
 * @param geo   Pre-computed geometry for this bar series.
 * @param theme Active theme (used for border color fallback).
 * @returns     SVG fragment string.
 */
export function drawBar(geo: BarSeriesGeo, theme: Theme): string {
  const fill = geo.color;
  const stroke = /^#[0-9a-fA-F]{6}$/.test(fill)
    ? darkenHex(fill, 0.8, theme.colors.border)
    : theme.colors.border;

  const parts: string[] = [];

  for (const r of geo.rects) {
    // Bar rectangle
    parts.push(
      svgRect(r.x, r.y, r.width, r.height, {
        fill,
        stroke,
        strokeWidth: 1,
      }),
    );

    // Optional data label — mirrors drawLabel() / drawLabelHorizontal() in BarRenderer.java
    if (geo.showLabels) {
      const label = formatValue(r.value);

      if (geo.horizontal) {
        // Horizontal bar: label to the right of the bar end.
        // x = right edge + 4, y = vertical center of bar + 4 (approximate text baseline).
        // Mirrors drawLabelHorizontal(): x = barWidth + 5, y = y + barHeight / 2
        parts.push(
          svgText(
            r.x + r.width + 4,
            r.y + r.height / 2 + 4,
            label,
            {
              fontSize: 10,
              fill: '#000000',
              textAnchor: 'start',
            },
          ),
        );
      } else {
        // Vertical bar:
        //   positive value  → label above the top of the bar (r.y - 4)
        //   negative value  → label below the bottom of the bar (r.y + r.height + 4)
        //
        // BarRenderer.java drawVertical():
        //   labelY = value < 0 ? y + barHeight + 5 : y - 5
        //
        // In SVG coords r.y is the top of the rect (smaller y = higher on canvas),
        // so "above the bar" is r.y - offset and "below the bar" is r.y + r.height + offset.
        const labelY = r.value < 0 ? r.y + r.height + 4 : r.y - 4;
        parts.push(
          svgText(
            r.x + r.width / 2,
            labelY,
            label,
            {
              fontSize: 10,
              fill: '#000000',
              textAnchor: 'middle',
            },
          ),
        );
      }
    }
  }

  return parts.join('\n');
}

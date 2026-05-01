import { line, text, diamond, svgRoot } from '../../core/svg.js';
import type { ChronologyGeometry } from './ast.js';
import type { Theme } from '../../core/theme.js';

export function renderChronology(geo: ChronologyGeometry, theme: Theme): string {
  const parts: string[] = [];

  // Header row day ticks (y = 0 to headerHeight = 30)
  for (const tick of geo.dayTicks) {
    parts.push(
      line(tick.x, 0, tick.x, 8, { stroke: '#888888', strokeWidth: 1 }),
    );
    parts.push(
      text(tick.x + 2, 10, tick.label, {
        fontFamily: 'sans-serif',
        fontSize: 10,
        dominantBaseline: 'hanging',
        fill: '#555555',
      }),
    );
  }

  // Baseline
  parts.push(
    line(0, geo.baselineY, geo.totalWidth, geo.baselineY, {
      stroke: '#333333',
      strokeWidth: 1.5,
    }),
  );

  // Per-event rendering
  for (const ev of geo.events) {
    // Dashed vertical tick centered on baseline
    parts.push(
      line(ev.x, geo.baselineY - 10, ev.x, geo.baselineY + 10, {
        stroke: '#666666',
        strokeWidth: 1,
        strokeDasharray: '3 3',
      }),
    );

    // Diamond marker
    parts.push(
      diamond(ev.x, geo.baselineY, 10, {
        fill: '#000000',
        stroke: '#000000',
        'stroke-width': 1,
      }),
    );

    // Label
    if (ev.labelAbove) {
      parts.push(
        text(ev.x, geo.baselineY - 26, ev.name, {
          fontFamily: 'sans-serif',
          fontSize: 12,
          textAnchor: 'middle',
          fill: '#000000',
        }),
      );
    } else {
      parts.push(
        text(ev.x, geo.baselineY + 16, ev.name, {
          fontFamily: 'sans-serif',
          fontSize: 12,
          textAnchor: 'middle',
          dominantBaseline: 'hanging',
          fill: '#000000',
        }),
      );
    }
  }

  return svgRoot(geo.totalWidth, geo.totalHeight, parts, theme.colors.background);
}

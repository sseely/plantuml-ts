/**
 * Annotation-command wiring for the chart diagram parser (mission G0b/T6,
 * T8).
 *
 * `title` now routes through the shared chrome annotation matcher along
 * with caption/legend/header/footer/mainframe (T8 migrated it off the
 * bespoke `ast.title` field onto `ast.chrome.title`). Chart also owns a
 * `legend left|right|top|bottom` data-series position command (RE_LEGEND)
 * that shares the `legend` keyword with the chrome legend directive --
 * `tryChartLegend` must win for `legend <pos>` so it is never misread as
 * chrome legend TEXT; the chrome matcher only ever fires for a genuine
 * `legend ... end legend` block (or `legend "text"` — untested here, not a
 * chart fixture shape).
 */

import { describe, it, expect } from 'vitest';
import { parseChart } from '../../../src/diagrams/chart/parser.js';
import { isEmpty } from '../../../src/core/annotations/index.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function src(lines: string[]): UmlSource {
  return { lines, type: 'chart' };
}

describe('parseChart — annotation commands (mission G0b/T6, T8)', () => {
  it('single-line `title X` populates chrome.title (T8), not a bespoke ast.title field', () => {
    const ast = parseChart(src(['title My Chart', 'bar "sales" [10, 20]']));
    expect(ast.chrome?.title.display).toEqual(['My Chart']);
    expect(ast.series).toHaveLength(1);
  });

  it('`legend right` still resolves as chart’s own data-series legend position, not chrome text', () => {
    const ast = parseChart(src(['legend right', 'bar "sales" [10, 20]']));
    expect(ast.legendPosition).toBe('right');
    expect(isEmpty(ast.chrome!)).toBe(true);
  });

  it('multi-line `legend ... end legend` populates chrome.legend, not the data-series legend position', () => {
    const ast = parseChart(src(['bar "sales" [10, 20]', 'legend', 'a legend line', 'end legend']));
    expect(ast.chrome?.legend.display).toEqual(['a legend line']);
    expect(ast.legendPosition).toBe('none');
    expect(ast.series).toHaveLength(1);
  });

  it('single-line caption populates chrome.caption, not a chart command', () => {
    const ast = parseChart(src(['caption a caption', 'bar "sales" [10, 20]']));
    expect(ast.chrome?.caption.display).toEqual(['a caption']);
    expect(ast.series).toHaveLength(1);
  });

  it('annotation-free fixture parses identically (no chrome, empty chrome annotations)', () => {
    const ast = parseChart(src(['bar "sales" [10, 20]']));
    expect(isEmpty(ast.chrome!)).toBe(true);
    expect(ast.series).toHaveLength(1);
  });
});

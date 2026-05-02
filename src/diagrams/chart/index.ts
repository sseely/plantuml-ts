import type { SyncPlugin } from '../../core/dispatcher.js';
import type { ChartDiagramAST } from './ast.js';
import type { ChartGeometry } from './layout.js';
import { parseChart } from './parser.js';
import { layoutChart } from './layout.js';
import { renderChart } from './renderer.js';

/**
 * ChartGeometry extended with an optional errors array so that parse/validation
 * errors discovered in the AST can flow through the fixed SyncPlugin.render()
 * signature to the renderer.
 */
type ChartGeoWithErrors = ChartGeometry & { errors?: readonly string[] };

export const chartPlugin: SyncPlugin<ChartDiagramAST, ChartGeoWithErrors> = {
  type: 'chart',

  accepts(_lines: readonly string[]): boolean {
    return false;
  },

  parse(source) {
    return parseChart(source);
  },

  layoutSync(ast, theme, measurer) {
    const geo = layoutChart(ast, theme, measurer);
    if (ast.errors.length > 0) {
      return { ...geo, errors: ast.errors };
    }
    return geo;
  },

  render(geo, theme) {
    return renderChart(geo, theme);
  },
};

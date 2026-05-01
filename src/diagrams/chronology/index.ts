import type { SyncPlugin } from '../../core/dispatcher.js';
import type { ChronologyDiagramAST, ChronologyGeometry } from './ast.js';
import { parseChronology } from './parser.js';
import { layoutChronology } from './layout.js';
import { renderChronology } from './renderer.js';

export const chronologyPlugin: SyncPlugin<ChronologyDiagramAST, ChronologyGeometry> = {
  type: 'chronology',

  accepts(_lines: readonly string[]): boolean {
    return false;
  },

  parse(source) {
    return parseChronology(source);
  },

  layoutSync(ast, _theme, _measurer) {
    return layoutChronology(ast);
  },

  render(geo, theme) {
    return renderChronology(geo, theme);
  },
};

import type { SyncPlugin } from '../../core/dispatcher.js';
import type { BoardDiagramAST, BoardGeometry } from './ast.js';
import { parseBoard } from './parser.js';
import { layoutBoard } from './layout.js';
import { renderBoard } from './renderer.js';

export const boardPlugin: SyncPlugin<BoardDiagramAST, BoardGeometry> = {
  type: 'board',

  accepts(_lines: readonly string[]): boolean {
    return false;
  },

  parse(source) {
    return parseBoard(source);
  },

  layoutSync(ast, _theme, _measurer) {
    return layoutBoard(ast);
  },

  render(geo, theme) {
    return renderBoard(geo, theme);
  },
};

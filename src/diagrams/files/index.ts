import type { SyncPlugin } from '../../core/dispatcher.js';
import type { FilesDiagramAST, FilesGeometry } from './ast.js';
import { parseFiles } from './parser.js';
import { layoutFiles } from './layout.js';
import { renderFiles } from './renderer.js';

export const filesPlugin: SyncPlugin<FilesDiagramAST, FilesGeometry> = {
  type: 'files',

  accepts(_lines: readonly string[]): boolean {
    return false;
  },

  parse(source) {
    return parseFiles(source);
  },

  layoutSync(ast, _theme, measurer) {
    return layoutFiles(ast, measurer);
  },

  render(geo, theme) {
    return renderFiles(geo, theme);
  },
};

/**
 * JSON diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 *
 * Accepts sources that begin with a JSON literal ({, [) or a #highlight
 * directive, matching @startjson / @endjson blocks extracted by the
 * block-extractor.
 */

import type { SyncPlugin } from '../../core/dispatcher.js';
import type { JsonDiagramAST } from './ast.js';
import type { JsonGeometry } from './layout.js';
import { parseJson } from './parser.js';
import { layoutJson } from './layout.js';
import { renderJson } from './renderer.js';

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const jsonPlugin: SyncPlugin<JsonDiagramAST, JsonGeometry> = {
  type: 'json',

  accepts(lines: readonly string[]): boolean {
    const first = lines.find((l) => l.trim().length > 0)?.trim() ?? '';
    return (
      first.startsWith('{') ||
      first.startsWith('[') ||
      first.startsWith('#highlight')
    );
  },

  parse(source) {
    return parseJson(source);
  },

  layoutSync(ast, theme, measurer) {
    return layoutJson(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderJson(geo, theme);
  },
};

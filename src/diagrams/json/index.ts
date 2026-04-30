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
    // Skip leading directive lines that appear before the JSON body in
    // @startjson blocks (title, skinparam, scale, hide, skin, !assume, !pragma,
    // <style>…</style>). Mirrors Java StyleExtractor pre-filtering.
    let inStyle = false;
    for (const line of lines) {
      const t = line.trim();
      if (t === '') continue;
      if (t === '<style>') { inStyle = true; continue; }
      if (inStyle) { if (t === '</style>') inStyle = false; continue; }
      if (/^(?:title |skinparam |scale |skin |hide |!assume |!pragma )/i.test(t)) continue;
      // Any valid JSON value: object, array, string, boolean keyword, null, number
      return (
        t.startsWith('{') ||
        t.startsWith('[') ||
        t.startsWith('#highlight') ||
        t.startsWith('"') ||
        t === 'null' ||
        t === 'true' ||
        t === 'false' ||
        /^-?[0-9]/.test(t)
      );
    }
    return false;
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

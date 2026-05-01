/**
 * YAML diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 *
 * Accepts sources that begin with a YAML key-value, list item, or
 * #highlight directive — i.e., content that is NOT a JSON literal.
 * Matches @startyaml / @endyaml blocks extracted by the block-extractor.
 *
 * NOTE: For @startyaml blocks, the dispatcher routes by type directly
 * (never calls accepts()). The accepts() logic here handles the rare case
 * where YAML appears inside @startuml. It must be conservative enough not
 * to steal sequence/class content (which also starts with word chars).
 * YAML-specific markers: key-value pairs contain ": ", list items start
 * with "- ", and #highlight is the only directive prefix used by YAML.
 */

import type { SyncPlugin } from '../../core/dispatcher.js';
import type { JsonDiagramAST } from '../json/ast.js';
import type { JsonGeometry } from '../json/layout.js';
import { parseYaml } from './parser.js';
import { layoutJson } from '../json/layout.js';
import { renderJson } from '../json/renderer.js';

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const yamlPlugin: SyncPlugin<JsonDiagramAST, JsonGeometry> = {
  type: 'yaml',

  accepts(lines: readonly string[]): boolean {
    // Skip leading directive lines that appear before the YAML body in
    // @startyaml blocks (title, skinparam, scale, hide, skin, !assume, !pragma,
    // <style>…</style>). Mirrors Java StyleExtractor pre-filtering.
    let inStyle = false;
    for (const line of lines) {
      const t = line.trim();
      if (t === '') continue;
      if (t === '<style>') { inStyle = true; continue; }
      if (inStyle) { if (t === '</style>') inStyle = false; continue; }
      if (/^(?:title |skinparam |scale |skin |hide |!assume |!pragma )/i.test(t)) continue;
      // JSON content — not YAML
      if (t.startsWith('{') || t.startsWith('[') || t.startsWith('"')) {
        return false;
      }
      if (t === 'null' || t === 'true' || t === 'false') {
        return false;
      }
      if (/^-?[0-9]/.test(t)) {
        return false;
      }
      // Require YAML-specific syntax to avoid matching sequence/class content
      // that also starts with word chars:
      //   - key-value:  "word: " pattern (colon-space after a word)
      //   - list item:  "- " prefix (hyphen-space)
      //   - highlight:  "#highlight" prefix
      return (
        t.startsWith('#highlight') ||
        t.startsWith('- ') ||
        /^\w[\w\s]*:/.test(t)
      );
    }
    return false;
  },

  parse(source) {
    return parseYaml(source);
  },

  layoutSync(ast, theme, measurer) {
    return layoutJson(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderJson(geo, theme);
  },
};

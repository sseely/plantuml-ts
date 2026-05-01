/**
 * HCL diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 *
 * HCL diagrams are only routed via @starthcl / @endhcl blocks extracted
 * by the block-extractor (START_SUFFIX_MAP['hcl'] === 'hcl'). The accepts()
 * method always returns false — HCL content is never auto-detected inside
 * @startuml blocks. (D4)
 */

import type { SyncPlugin } from '../../core/dispatcher.js';
import type { JsonDiagramAST } from '../json/ast.js';
import type { JsonGeometry } from '../json/layout.js';
import { parseHcl } from './parser.js';
import { layoutJson } from '../json/layout.js';
import { renderJson } from '../json/renderer.js';

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const hclPlugin: SyncPlugin<JsonDiagramAST, JsonGeometry> = {
  type: 'hcl',

  accepts(_lines: readonly string[]): boolean {
    return false;
  },

  parse(source) {
    return parseHcl(source);
  },

  layoutSync(ast, theme, measurer) {
    return layoutJson(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderJson(geo, theme);
  },
};

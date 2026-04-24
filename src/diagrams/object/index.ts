/**
 * Object diagram plugin — wires together parser, class layout, and class renderer
 * for use with the DiagramRegistry dispatcher.
 *
 * Object diagrams share the class diagram layout and renderer. Only the parser
 * differs: object instances use "field = value" members instead of typed methods.
 */

import type { SyncPlugin } from '../../core/dispatcher.js';
import type { ClassDiagramAST } from '../class/ast.js';
import type { ClassGeometry } from '../class/layout.js';
import { parseObject } from './parser.js';
import { layoutClass } from '../class/layout.js';
import { renderClass } from '../class/renderer.js';

// ---------------------------------------------------------------------------
// Accepts heuristics
// ---------------------------------------------------------------------------

const OBJECT_ACCEPTS_PATTERNS: readonly RegExp[] = [
  /^object\s+/i,
  /^object\s*$/i,
];

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const objectPlugin: SyncPlugin<ClassDiagramAST, ClassGeometry> = {
  type: 'object',

  accepts(lines: readonly string[]): boolean {
    return lines
      .slice(0, 20)
      .some((l) => OBJECT_ACCEPTS_PATTERNS.some((p) => p.test(l.trim())));
  },

  parse(block) {
    return parseObject(block);
  },

  layoutSync(ast, theme, measurer) {
    return layoutClass(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderClass(geo, theme);
  },
};

/**
 * Class diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 */

import type { SyncPlugin } from '../../core/dispatcher.js';
import type { ClassDiagramAST } from './ast.js';
import type { ClassGeometry } from './layout.js';
import { parseClass } from './parser.js';
import { layoutClass } from './layout.js';
import { renderClass } from './renderer.js';

// ---------------------------------------------------------------------------
// Accepts heuristics
// ---------------------------------------------------------------------------

/**
 * Patterns that appear in class diagrams.
 *
 * Tested against the first 20 lines of a @startuml block (after the
 * @startuml/@enduml wrapper lines have been stripped by the block extractor).
 */
const CLASS_ACCEPTS_PATTERNS: readonly RegExp[] = [
  /^class\s/i,
  /^abstract\s+class\s/i,
  /^interface\s/i,
  /^enum\s/i,
  /^annotation\s/i,
  /<\|--|<\|\.\.|--\|>|\.\.\|>|\*--|o--|--\*|--o/,
];

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const classPlugin: SyncPlugin<ClassDiagramAST, ClassGeometry> = {
  type: 'class',

  accepts(lines: readonly string[]): boolean {
    return lines
      .slice(0, 20)
      .some((l) => CLASS_ACCEPTS_PATTERNS.some((p) => p.test(l)));
  },

  parse(block) {
    return parseClass(block);
  },

  layoutSync(ast, theme, measurer) {
    return layoutClass(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderClass(geo, theme);
  },
};

/**
 * Class diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 */

import type { SyncPlugin } from '../../core/dispatcher.js';
import type { ClassDiagramAST } from './ast.js';
import type { ClassGeometry } from './layout.js';
import { hasDescriptiveSignal } from '../../core/descriptive-keywords.js';
import { REL_DISPATCH_RE } from './class-relationship-parser.js';
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
    // Upstream's class factory trial-parses and *fails* on descriptive element
    // lines (node/cloud/usecase/...), letting the description factory win.
    // Reproduce that outcome: decline blocks carrying a descriptive signal
    // before `^interface\s` (et al.) can steal a deployment/use-case diagram.
    //
    // Exclude relationship lines from the signal first: a class NAMED like a
    // descriptive keyword used as a relationship endpoint (`Queue "1" -- "*"
    // QueueEntry`) starts with `queue` and would otherwise be mistaken for a
    // `queue` element declaration, wrongly declining the block to description.
    // A relationship line is never a descriptive element declaration.
    const declLines = lines.filter((l) => !REL_DISPATCH_RE.test(l.trim()));
    if (hasDescriptiveSignal(declLines)) return false;
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

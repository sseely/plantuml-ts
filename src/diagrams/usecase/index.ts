/**
 * Use case diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 */

import type { SyncPlugin } from '../../core/dispatcher.js';
import type { UseCaseDiagramAST } from './ast.js';
import type { UseCaseGeometry } from './layout.js';
import { parseUseCase } from './parser.js';
import { layoutUseCase } from './layout.js';
import { renderUseCase } from './renderer.js';

// ---------------------------------------------------------------------------
// Accepts heuristics
// ---------------------------------------------------------------------------

const USECASE_ACCEPTS_PATTERNS: readonly RegExp[] = [
  /^:\w/,         // :Actor: colon shorthand
  /^usecase\s/i,
  /^\(\w/,        // (Use Case) parens shorthand
  /^rectangle\s/i,
  // `actor` intentionally omitted — sequence diagrams also use `actor`,
  // and `usecase`/`rectangle`/`(...)` uniquely identify use case diagrams
];

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const usecasePlugin: SyncPlugin<UseCaseDiagramAST, UseCaseGeometry> = {
  type: 'usecase',

  accepts(lines: readonly string[]): boolean {
    return lines
      .slice(0, 20)
      .some((l) =>
        USECASE_ACCEPTS_PATTERNS.some((p) => p.test(l.trim())),
      );
  },

  parse(block) {
    return parseUseCase(block);
  },

  layoutSync(ast, theme, measurer) {
    return layoutUseCase(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderUseCase(geo, theme);
  },
};

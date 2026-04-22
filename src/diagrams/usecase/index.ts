/**
 * Use case diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 */

import type { AsyncPlugin } from '../../core/dispatcher.js';
import type { UseCaseDiagramAST } from './ast.js';
import type { UseCaseGeometry } from './layout.js';
import { parseUseCase } from './parser.js';
import { layoutUseCase } from './layout.js';
import { renderUseCase } from './renderer.js';

// ---------------------------------------------------------------------------
// Accepts heuristics
// ---------------------------------------------------------------------------

const USECASE_ACCEPTS_PATTERNS: readonly RegExp[] = [
  /^actor\s/i,
  /^:\w/,         // :Actor: colon shorthand
  /^usecase\s/i,
  /^\(\w/,        // (Use Case) parens shorthand
  /^rectangle\s/i,
];

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const usecasePlugin: AsyncPlugin<UseCaseDiagramAST, UseCaseGeometry> = {
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

  async layout(ast, theme, measurer) {
    return layoutUseCase(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderUseCase(geo, theme);
  },
};

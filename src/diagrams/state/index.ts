/**
 * State diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 */

import type { AsyncPlugin } from '../../core/dispatcher.js';
import type { StateDiagramAST } from './ast.js';
import type { StateGeometry } from './layout.js';
import { parseState } from './parser.js';
import { layoutState } from './layout.js';
import { renderState } from './renderer.js';

// ---------------------------------------------------------------------------
// Accepts heuristics
// ---------------------------------------------------------------------------

/** Patterns that appear in state diagrams but not other diagram types. */
const STATE_ACCEPTS_PATTERNS: readonly RegExp[] = [
  /\[\*\]/, // [*] → initial/final pseudostate
  /^state\s/i, // state keyword
  /<<(fork|join|choice|history|deepHistory)>>/i,
];

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const statePlugin: AsyncPlugin<StateDiagramAST, StateGeometry> = {
  type: 'state',

  accepts(lines: readonly string[]): boolean {
    return lines.slice(0, 20).some((l) =>
      STATE_ACCEPTS_PATTERNS.some((p) => p.test(l)),
    );
  },

  parse(block) {
    return parseState(block);
  },

  async layout(ast, theme, measurer) {
    return layoutState(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderState(geo, theme);
  },
};

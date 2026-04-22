/**
 * Component diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 */

import type { AsyncPlugin } from '../../core/dispatcher.js';
import type { ComponentDiagramAST } from './ast.js';
import type { ComponentGeometry } from './layout.js';
import { parseComponent } from './parser.js';
import { layoutComponent } from './layout.js';
import { renderComponent } from './renderer.js';

// ---------------------------------------------------------------------------
// Accepts heuristics
// ---------------------------------------------------------------------------

const COMPONENT_ACCEPTS_PATTERNS: readonly RegExp[] = [
  /^\[.+\]/,         // [ComponentName]
  /^\(\)/,            // () interface shorthand
  /^component\s/i,
  /^interface\s/i,
  /^package\s/i,
  /^node\s/i,
  /^folder\s/i,
  /^frame\s/i,
  /^cloud\s/i,
  /^database\s/i,
  /^storage\s/i,
];

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const componentPlugin: AsyncPlugin<ComponentDiagramAST, ComponentGeometry> = {
  type: 'component',

  accepts(lines: readonly string[]): boolean {
    return lines
      .slice(0, 20)
      .some((l) => COMPONENT_ACCEPTS_PATTERNS.some((p) => p.test(l.trim())));
  },

  parse(block) {
    return parseComponent(block);
  },

  async layout(ast, theme, measurer) {
    return layoutComponent(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderComponent(geo, theme);
  },
};

/**
 * Component diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 */

import type { SyncPlugin } from '../../core/dispatcher.js';
import type { ComponentDiagramAST } from './ast.js';
import type { ComponentGeometry } from './layout.js';
import { parseComponent } from './parser.js';
import { layoutComponent } from './layout.js';
import { renderComponent } from './renderer.js';

// ---------------------------------------------------------------------------
// Accepts heuristics
// ---------------------------------------------------------------------------

const COMPONENT_ACCEPTS_PATTERNS: readonly RegExp[] = [
  /^\[.+\]/,         // [ComponentName] bracket notation
  /^\(\)/,            // () interface shorthand
  /^component\s/i,
  /^package\s/i,
  /^node\s/i,
  /^folder\s/i,
  /^frame\s/i,
  /^cloud\s/i,
  /^storage\s/i,
  // `database` and `interface` omitted — both are also valid sequence/class
  // diagram keywords and cause false-positives when sequence is registered last
];

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const componentPlugin: SyncPlugin<ComponentDiagramAST, ComponentGeometry> = {
  type: 'component',

  accepts(lines: readonly string[]): boolean {
    return lines
      .slice(0, 20)
      .some((l) => COMPONENT_ACCEPTS_PATTERNS.some((p) => p.test(l.trim())));
  },

  parse(block) {
    return parseComponent(block);
  },

  layoutSync(ast, theme, measurer) {
    return layoutComponent(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderComponent(geo, theme);
  },
};

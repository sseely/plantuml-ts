/**
 * Activity diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 */

import type { SyncPlugin } from '../../core/dispatcher.js';
import type { ActivityDiagramAST } from './ast.js';
import type { ActivityGeometry } from './layout/tile-layout.js';
import { parseActivity } from './parser.js';
import { layoutActivity } from './layout/tile-layout.js';
import { renderActivity } from './renderer.js';

// ---------------------------------------------------------------------------
// Accepts heuristics
// ---------------------------------------------------------------------------

/** Keywords that appear in activity diagrams but not other diagram types. */
const ACTIVITY_ACCEPTS_PATTERNS: readonly RegExp[] = [
  /^start\s*$/i,
  /^stop\s*$/i,
  /^end\s*$/i,
  /^:\s*.+;\s*$/,              // :action;
  /^:[^:;]+$/,                 // :multi-line-opener — no second colon (excludes :actor:), no semicolon
  /^if\s*\(/i,
  /^while\s*\(/i,
  /^repeat\s*$/i,
  /^fork\s*$/i,
  /^split\s*$/i,
  /^\|.+\|/,                   // |swimlane|
  /^fork\s+again\s*$/i,
  /^split\s+again\s*$/i,
];

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const activityPlugin: SyncPlugin<ActivityDiagramAST, ActivityGeometry> = {
  type: 'activity',

  accepts(lines: readonly string[]): boolean {
    return lines.slice(0, 30).some((l) =>
      ACTIVITY_ACCEPTS_PATTERNS.some((p) => p.test(l.trim())),
    );
  },

  parse(block) {
    return parseActivity(block);
  },

  layoutSync(ast, theme, measurer) {
    return layoutActivity(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderActivity(geo, theme);
  },
};

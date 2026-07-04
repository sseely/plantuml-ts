/**
 * Description diagram plugin — the consolidated engine for component, use-case,
 * and deployment diagrams (upstream `DescriptionDiagramFactory`). Wires the
 * merged parser, symbol-aware layout, and symbol-dispatched renderer into one
 * SyncPlugin keyed off the full `CommandCreateElementFull.ALL_TYPES` keyword set.
 *
 * Registration into `src/index.ts` is deferred to Batch 8 — while the old
 * `component`/`usecase` plugins are still registered, adding `description` would
 * create overlapping `accepts()` claims.
 */

import type { SyncPlugin } from '../../core/dispatcher.js';
import type { DescriptionDiagramAST } from './ast.js';
import type { DescriptionGeometry } from './layout.js';
import { hasDescriptiveElement } from '../../core/descriptive-keywords.js';
import { parseDescription } from './parser.js';
import { layoutDescription } from './layout.js';
import { renderDescription } from './renderer.js';

export const descriptionPlugin: SyncPlugin<
  DescriptionDiagramAST,
  DescriptionGeometry
> = {
  type: 'description',

  accepts(lines: readonly string[]): boolean {
    // Claim any block carrying a full ALL_TYPES keyword (incl. interface/
    // package/actor, which this engine owns) or an element shorthand. Superset
    // of hasDescriptiveSignal — mirrors upstream's single DESCRIPTION factory.
    return hasDescriptiveElement(lines);
  },

  parse(block) {
    return parseDescription(block);
  },

  layoutSync(ast, theme, measurer) {
    return layoutDescription(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderDescription(geo, theme);
  },
};

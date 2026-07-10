/**
 * Description diagram plugin — the consolidated engine for component, use-case,
 * and deployment diagrams (upstream `DescriptionDiagramFactory`). Wires the
 * merged parser, symbol-aware layout, and the klimt-backed renderer (T17
 * cutover) into one SyncPlugin keyed off the full
 * `CommandCreateElementFull.ALL_TYPES` keyword set.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type { SyncPlugin } from '../../core/dispatcher.js';
import type { DescriptionDiagramAST } from './ast.js';
import type { DescriptionGeometry } from './layout.js';
import { hasDescriptiveElement } from '../../core/descriptive-keywords.js';
import { seedOf } from '../../core/klimt/drawing/svg/svg-graphics-core.js';
import { parseDescription } from './parser.js';
import { layoutDescription } from './layout.js';
import { renderDescription } from './renderer.js';

/**
 * Reconstructs the raw `@start.../@end...` block text `UmlSource.seed()`
 * (see `svg-graphics-core.ts#seedOf`'s doc comment) hashes upstream.
 *
 * `UmlSource.lines` (this port's `block-extractor.ts`) already strips the
 * `@start`/`@end` marker lines and trims leading/trailing blanks before the
 * plugin ever sees them, so the exact original marker token (`@startuml` vs
 * `@startcomponent`, any trailing title text, and any blank lines the
 * extractor trimmed) is unrecoverable at this layer — a known, documented
 * gap (see the T17 mission report). `@startuml`/`@enduml` is the closest
 * reconstructable approximation and matches the common case exactly.
 *
 * This only affects the seed-derived gradient/shadow/filter ids
 * (`SvgGraphicsCore`'s `filterUid`/`shadowId`/`gradientId`) — diagrams with
 * no gradient fill or shadow never reference those ids anywhere in the
 * rendered SVG, so the approximation is invisible for the overwhelming
 * majority of description diagrams.
 */
function reconstructSourceForSeed(block: UmlSource): string {
  return ['@startuml', ...block.lines, '@enduml'].join('\n');
}

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
    const ast = parseDescription(block);
    // T17 seed thread (see ast.ts's `DescriptionDiagramAST.seed` doc
    // comment) — computed once here, at the only point the raw source text
    // is available anywhere in the plugin pipeline.
    return { ...ast, seed: seedOf(reconstructSourceForSeed(block)) };
  },

  layoutSync(ast, theme, measurer) {
    return layoutDescription(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderDescription(geo, theme);
  },
};

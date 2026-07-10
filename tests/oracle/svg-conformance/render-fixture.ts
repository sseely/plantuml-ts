/**
 * Shared low-level render helper for svg-description conformance tests
 * (T18). Renders a fixture through the description engine's low-level
 * pipeline — `parseDescription` -> `layoutDescription` -> `renderDescription`
 * — injecting ONE measurer instance into BOTH the layout and render stages.
 *
 * Mirrors `scripts/svg-conformance-census.ts#renderFixture` (and its
 * `buildThemeForFixture` helper) exactly, including its rationale for
 * bypassing `renderSync`/`descriptionPlugin.render`: the public
 * `SyncPlugin#render(geo, theme)` contract has no measurer parameter (by
 * design — production always draws with `jarMeasurer`, see `renderer.ts`'s
 * own doc comment), so comparing against a deterministic-text-mode golden
 * requires calling the lower-level functions directly with the SAME
 * measurer on both stages. Theme resolution is inlined for the same reason
 * the census script inlines it: `buildTheme` in `src/index.ts` is private
 * and not exported, and this task's write-set does not include widening
 * that module's exports.
 */
import { preprocess } from '../../../src/core/preprocessor.js';
import { extractBlocks } from '../../../src/core/block-extractor.js';
import { resolveTheme } from '../../../src/core/theme.js';
import { resolveSkinparam, parseStyleBlock } from '../../../src/core/skinparam.js';
import { applyStyleMap } from '../../../src/core/style-map-theme.js';
import type { Theme } from '../../../src/core/theme.js';
import type { StyleMap } from '../../../src/core/skinparam.js';
import type { StringMeasurer } from '../../../src/core/measurer.js';
import { parseDescription } from '../../../src/diagrams/description/parser.js';
import { layoutDescription } from '../../../src/diagrams/description/layout.js';
import { renderDescription } from '../../../src/diagrams/description/renderer.js';
import { seedOf } from '../../../src/core/klimt/drawing/svg/svg-graphics-core.js';

function buildThemeForFixture(preprocessed: ReturnType<typeof preprocess>): Theme {
  const base = resolveTheme(preprocessed.theme ?? 'default');
  const withSkinparam = resolveSkinparam(preprocessed.skinparam, base).theme;

  const styleMap = preprocessed.styles
    .map(parseStyleBlock)
    .reduce<StyleMap>((acc, m) => {
      m.forEach((props, selector) => {
        const existing = acc.get(selector) ?? new Map<string, string>();
        props.forEach((v, k) => existing.set(k, v));
        acc.set(selector, existing);
      });
      return acc;
    }, new Map());

  const flatRoot = styleMap.get('') ?? new Map<string, string>();
  const withStyles = resolveSkinparam(flatRoot, withSkinparam).theme;
  return applyStyleMap(styleMap, withStyles);
}

/** Renders a `.puml` fixture through the description engine's low-level
 * pipeline with `measurer` injected into both the layout and render stages.
 * Throws if the markup contains no diagram block. */
export function renderFixture(markup: string, measurer: StringMeasurer): string {
  const preprocessed = preprocess(markup);
  const theme = buildThemeForFixture(preprocessed);
  const blocks = extractBlocks(preprocessed.lines);
  if (blocks.length === 0) throw new Error('no diagram block found');
  const block = { ...blocks[0]!, rawStyles: preprocessed.styles };
  const ast = parseDescription(block);
  const seeded = { ...ast, seed: seedOf(['@startuml', ...block.lines, '@enduml'].join('\n')) };
  const geo = layoutDescription(seeded, theme, measurer);
  return renderDescription(geo, theme, measurer);
}

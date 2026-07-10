import { preprocess } from './core/preprocessor.js';
import { extractBlocks } from './core/block-extractor.js';
import { registry } from './core/dispatcher.js';
import { resolveTheme, deepMergeTheme } from './core/theme.js';
import { resolveSkinparam, parseStyleBlock } from './core/skinparam.js';
import { applyStyleMap } from './core/style-map-theme.js';
import { CanvasMeasurer, FormulaMeasurer } from './core/measurer.js';
import { jarMeasurer } from './core/measurer-jar.js';
import { sequencePlugin } from './diagrams/sequence/index.js';
import { classPlugin } from './diagrams/class/index.js';
import { statePlugin } from './diagrams/state/index.js';
import { descriptionPlugin } from './diagrams/description/index.js';
import { activityPlugin } from './diagrams/activity/index.js';
import { objectPlugin } from './diagrams/object/index.js';
import { jsonPlugin } from './diagrams/json/index.js';
import { yamlPlugin } from './diagrams/yaml/index.js';
import { hclPlugin } from './diagrams/hcl/index.js';
import { boardPlugin } from './diagrams/board/index.js';
import { chronologyPlugin } from './diagrams/chronology/index.js';
import { filesPlugin } from './diagrams/files/index.js';
import { packetdiagPlugin } from './diagrams/packetdiag/index.js';
import { chartPlugin } from './diagrams/chart/index.js';
import { dotPlugin } from './diagrams/dot/index.js';
import type { Theme } from './core/theme.js';
import type { StyleMap } from './core/skinparam.js';
import type { StringMeasurer } from './core/measurer.js';
import type { DiagramType } from './core/block-extractor.js';
import type { IncludeFetcher } from './core/include-resolver.js';
import { resolveIncludes } from './core/include-resolver.js';
import type { PreprocessorResult } from './core/preprocessor.js';

// Register plugins in specificity order — most specific first, sequence last.
// Sequence plugin uses broad arrow heuristics (-->) that overlap with graph
// diagram types; graph plugins match unique structural keywords that sequence
// diagrams never contain.
registry.register(objectPlugin);
registry.register(classPlugin);
registry.register(statePlugin);
// Consolidated descriptive engine — replaces the old component + usecase
// plugins (upstream's single DescriptionDiagramFactory). Registered in the
// old component slot; accepts() is order-independent vs activity (activity's
// patterns exclude :actor: and the descriptive keyword/shorthand set).
registry.register(descriptionPlugin);
registry.register(activityPlugin);
registry.register(yamlPlugin);
registry.register(jsonPlugin);
registry.register(hclPlugin);
registry.register(boardPlugin);
registry.register(chronologyPlugin);
registry.register(filesPlugin);
registry.register(packetdiagPlugin);
registry.register(chartPlugin);
registry.register(dotPlugin);
registry.register(sequencePlugin);

export interface RenderOptions {
  theme?: 'default' | 'dark' | 'sketchy' | 'monochrome' | Partial<Theme>;
  measurer?: StringMeasurer;
  maxWidth?: number;
  fetcher?: IncludeFetcher;
}

function getDefaultMeasurer(): StringMeasurer {
  try {
    return new CanvasMeasurer();
  } catch {
    return new FormulaMeasurer();
  }
}

/**
 * Per-plugin default measurer resolution (T17, D12): the description
 * engine's production default is the jar-faithful measurer — its klimt
 * text emission is already jar-calibrated (D12), and mismatched layout vs
 * render metrics would misposition every entity/cluster/edge it draws.
 * Every other diagram type keeps the existing Canvas/Formula default
 * unchanged (acceptance criterion 3 — no cross-engine bleed). An explicit
 * `options.measurer` always wins, for both branches (e.g.
 * `scripts/dot-sync-report.ts`'s own oracle-DOT-emission measurer, which
 * bypasses this resolution entirely by calling `layoutDescription`
 * directly rather than going through `render()`/`renderSync()`).
 */
function resolveMeasurer(pluginType: DiagramType, options?: RenderOptions): StringMeasurer {
  if (options?.measurer !== undefined) return options.measurer;
  if (pluginType === 'description') return jarMeasurer;
  return getDefaultMeasurer();
}


/**
 * Four-stage theme resolution:
 *
 * Stage 1 — Named base theme.
 *   String options.theme overrides !theme from source (existing behavior).
 *
 * Stage 2 — Apply skinparam directives from source on top of the base theme.
 *
 * Stage 3 — Apply <style> blocks from source.
 *   3a. Merge all StyleMaps from all style blocks.
 *   3b. Top-level bare declarations ("" key) flow through resolveSkinparam.
 *   3c. Element-scoped entries (e.g. "actor", "class") go through applyStyleMap.
 *
 * Stage 4 — Caller Partial<Theme> wins over everything.
 *
 * Resolution order confirmed against upstream TContext.java:executeTheme().
 */
function buildTheme(preprocessed: PreprocessorResult, options?: RenderOptions): Theme {
  // Stage 1: named base theme
  const themeName =
    typeof options?.theme === 'string'
      ? options.theme
      : (preprocessed.theme ?? 'default');
  const base = resolveTheme(themeName);

  // Stage 2: apply skinparam directives from source
  const withSkinparam = resolveSkinparam(preprocessed.skinparam, base).theme;

  // Stage 3: apply <style> blocks from source
  // 3a. Merge all StyleMaps (last writer wins per selector+property)
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

  // 3b. Top-level bare declarations ("" key) → resolveSkinparam (existing behavior)
  const flatRoot = styleMap.get('') ?? new Map<string, string>();
  const withStyles = resolveSkinparam(flatRoot, withSkinparam).theme;

  // 3c. Element-scoped entries → applyStyleMap
  const withStyleMap = applyStyleMap(styleMap, withStyles);

  // Stage 4: caller Partial<Theme> wins over everything
  if (options?.theme !== undefined && typeof options.theme === 'object') {
    return deepMergeTheme(withStyleMap, options.theme);
  }
  return withStyleMap;
}

export function renderSync(source: string, options?: RenderOptions): string {
  try {
    // Check for !include directives — not supported in sync path
    if (/^!include\s/m.test(source)) {
      throw new Error(
        '!include directives are not supported in renderSync — use render() instead',
      );
    }
    const preprocessed = preprocess(source);
    const theme = buildTheme(preprocessed, options);
    const blocks = extractBlocks(preprocessed.lines);
    if (blocks.length === 0) {
      return errorSvg('No diagram found in source');
    }
    const block = { ...blocks[0]!, rawStyles: preprocessed.styles };
    const plugin = registry.resolve(block);
    if (!('layoutSync' in plugin)) {
      return errorSvg(
        `renderSync() is not supported for this diagram type — use render()`,
      );
    }
    const measurer = resolveMeasurer(plugin.type, options);
    const ast = plugin.parse(block);
    const geo = plugin.layoutSync(ast, theme, measurer);
    return plugin.render(geo, theme);
  } catch (err) {
    return errorSvg(String(err));
  }
}

export async function render(
  source: string,
  options?: RenderOptions,
): Promise<string> {
  try {
    const resolved = await resolveIncludes(source, options?.fetcher);
    const preprocessed = preprocess(resolved);
    const theme = buildTheme(preprocessed, options);
    const blocks = extractBlocks(preprocessed.lines);
    if (blocks.length === 0) {
      return errorSvg('No diagram found in source');
    }
    const block = { ...blocks[0]!, rawStyles: preprocessed.styles };
    const plugin = registry.resolve(block);
    const measurer = resolveMeasurer(plugin.type, options);
    const ast = plugin.parse(block);
    const geo =
      'layoutSync' in plugin
        ? plugin.layoutSync(ast, theme, measurer)
        : await plugin.layout(ast, theme, measurer);
    return plugin.render(geo, theme);
  } catch (err) {
    return errorSvg(String(err));
  }
}

export async function renderAll(
  source: string,
  options?: RenderOptions,
): Promise<string[]> {
  try {
    const resolved = await resolveIncludes(source, options?.fetcher);
    const preprocessed = preprocess(resolved);
    const theme = buildTheme(preprocessed, options);
    const blocks = extractBlocks(preprocessed.lines);
    const results = await Promise.all(
      blocks.map(async (rawBlock) => {
        const block = { ...rawBlock, rawStyles: preprocessed.styles };
        try {
          const plugin = registry.resolve(block);
          const measurer = resolveMeasurer(plugin.type, options);
          const ast = plugin.parse(block);
          const geo =
            'layoutSync' in plugin
              ? plugin.layoutSync(ast, theme, measurer)
              : await plugin.layout(ast, theme, measurer);
          return plugin.render(geo, theme);
        } catch (err) {
          return errorSvg(String(err));
        }
      }),
    );
    return results;
  } catch (err) {
    return [errorSvg(String(err))];
  }
}

function errorSvg(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80">` +
    `<rect width="400" height="80" fill="#fee2e2" stroke="#dc2626" stroke-width="1"/>` +
    `<text x="10" y="30" fill="#dc2626" font-family="monospace" font-size="12">PlantUML error:</text>` +
    `<text x="10" y="55" fill="#dc2626" font-family="monospace" font-size="11">${escaped}</text>` +
    `</svg>`
  );
}

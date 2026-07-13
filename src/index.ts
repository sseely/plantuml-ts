import type { PreprocessorFailure } from './core/preprocessor.js';
import { buildBlockUmls, isBlockEmpty } from './core/BlockUmlBuilder.js';
import type { BlockUml, BlockUmlOk } from './core/BlockUmlBuilder.js';
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
import type { DiagramType, UmlSource } from './core/block-extractor.js';
import type { IncludeFetcher, IncludeStore } from './core/include-resolver.js';
import { prefetchIncludes } from './core/include-resolver.js';
import type { PreprocessorResult } from './core/preprocessor.js';
import { ErrorUml } from './core/error/ErrorUml.js';
import { PSystemErrorEmpty } from './core/error/PSystemErrorEmpty.js';
import { PSystemErrorPreprocessor } from './core/error/PSystemErrorPreprocessor.js';
import { PSystemErrorV2 } from './core/error/PSystemErrorV2.js';
import { PSystemWelcome } from './core/error/PSystemWelcome.js';
import { umlSourceOf } from './core/error/UmlSource.js';
import { renderPSystemError, renderPSystemWelcome } from './core/error/error-renderer.js';
import { readLines } from './core/tim/ReadLineReader.js';
import type { StringLocated } from './core/tim/StringLocated.js';

// Register plugins in specificity order — most specific first, sequence last.
// Sequence plugin uses broad arrow heuristics (-->) that overlap with graph
// diagram types; graph plugins match unique structural keywords that sequence
// diagrams never contain.
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
  /** Async include fetcher used by `render()` / `renderAll()` to PREFILL the
   *  include store. Ignored by `renderSync` (which cannot await). */
  fetcher?: IncludeFetcher;
  /**
   * Pre-populated include content: `path -> source`, read SYNCHRONOUSLY by the
   * TIM interpreter wherever upstream would open a file (`src/core/tim/
   * IncludeStore.ts`). Two reasons to pass one:
   *
   *  - `renderSync` cannot fetch. A store is the ONLY way it resolves includes.
   *  - Stdlib bundles. `!include <c4/C4_Context.puml>` resolves from the store
   *    and nowhere else — this port vendors no stdlib asset (mission SI5b).
   *
   * `render()` treats it as a base: it fetches the rest on top, and never
   * mutates it. An include that neither the store nor the fetcher can serve is a
   * typed error naming the path, never a silent skip.
   */
  includeStore?: IncludeStore;
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

/**
 * The block's preprocessed interior, carrying the `<style>` blocks the
 * interpreter pulled out of THAT block (upstream keeps them inside it).
 */
function umlSourceOfBlock(block: BlockUmlOk): UmlSource {
  return { ...block.source, rawStyles: block.preprocessed.styles };
}

export function renderSync(source: string, options?: RenderOptions): string {
  try {
    // renderSync cannot fetch. With no store there is nothing to resolve an
    // !include against, so say so here rather than let the interpreter raise a
    // per-path IncludeNotFoundError the caller cannot act on. With a store, the
    // interpreter resolves includes exactly as render() does.
    if (options?.includeStore === undefined && /^!include\s/m.test(source)) {
      throw new Error(
        '!include directives are not supported in renderSync without options.includeStore — ' +
          'use render(), or prefetch the includes and pass options.includeStore',
      );
    }
    const blocks = buildBlockUmls(source, { includeStore: options?.includeStore });
    if (blocks.length === 0) return welcomeSvg(options);

    const block = blocks[0]!;
    if (!block.ok) return preprocessorErrorSvg(block.failure, options);
    if (isBlockEmpty(block)) return emptySvg(block, options);

    const umlSource = umlSourceOfBlock(block);
    const theme = buildTheme(block.preprocessed, options);
    const plugin = registry.resolve(umlSource);
    if (!('layoutSync' in plugin))
      throw new Error('renderSync() is not supported for this diagram type — use render()');

    const measurer = resolveMeasurer(plugin.type, options);
    const ast = plugin.parse(umlSource);
    const geo = plugin.layoutSync(ast, theme, measurer);
    return plugin.render(geo, theme);
  } catch (err) {
    return errorSvg(source, err, options);
  }
}

export async function render(
  source: string,
  options?: RenderOptions,
): Promise<string> {
  try {
    const includeStore = await prefetchIncludes(source, options?.fetcher, options?.includeStore);
    const blocks = buildBlockUmls(source, { includeStore });
    if (blocks.length === 0) return welcomeSvg(options);

    return await renderBlock(blocks[0]!, options);
  } catch (err) {
    return errorSvg(source, err, options);
  }
}

export async function renderAll(
  source: string,
  options?: RenderOptions,
): Promise<string[]> {
  try {
    const includeStore = await prefetchIncludes(source, options?.fetcher, options?.includeStore);
    const blocks = buildBlockUmls(source, { includeStore });
    return await Promise.all(blocks.map(async (block) => renderBlock(block, options)));
  } catch (err) {
    return [errorSvg(source, err, options)];
  }
}

/**
 * One block, end to end. Every block carries its OWN theme now: `!theme`,
 * `skinparam` and `<style>` live inside the `@start...@end` pair, and upstream
 * scopes them to it (each `BlockUml` runs its own `TimLoader`).
 */
async function renderBlock(block: BlockUml, options?: RenderOptions): Promise<string> {
  if (!block.ok) return preprocessorErrorSvg(block.failure, options);
  if (isBlockEmpty(block)) return emptySvg(block, options);

  const umlSource = umlSourceOfBlock(block);
  try {
    const theme = buildTheme(block.preprocessed, options);
    const plugin = registry.resolve(umlSource);
    const measurer = resolveMeasurer(plugin.type, options);
    const ast = plugin.parse(umlSource);
    const geo =
      'layoutSync' in plugin
        ? plugin.layoutSync(ast, theme, measurer)
        : await plugin.layout(ast, theme, measurer);
    return plugin.render(geo, theme);
  } catch (err) {
    // The block's own lines, so the listing shows the diagram that failed.
    return errorSvg(umlSource.lines.join('\n'), err, options);
  }
}

// ---------------------------------------------------------------------------
// Error diagrams — upstream's `BlockUml#getDiagram`
//
// PlantUML never throws at its caller: a malformed document still produces an
// SVG. What used to sit here (a homegrown 400x80 red box reading "PlantUML
// error: <toString of whatever was thrown>") is replaced by the faithful
// render — the Welcome block for a short source, the version banner, `[From
// string (line N) ]`, the source listing with the offending line waved in red,
// and the message.
// ---------------------------------------------------------------------------

/** The measurer the error diagram lays its text out with. */
function errorMeasurer(options?: RenderOptions): StringMeasurer {
  return options?.measurer ?? getDefaultMeasurer();
}

/**
 * A preprocessor (TIM) failure: an orphan `!endif`, an unknown function, an
 * unresolvable include. The trace is the lines the interpreter really executed
 * — through includes, loops and macro bodies — with the message already marked
 * on its last line.
 * @see ~/git/plantuml/.../BlockUml.java#getDiagram
 */
function preprocessorErrorSvg(failure: PreprocessorFailure, options?: RenderOptions): string {
  const system = new PSystemErrorPreprocessor(umlSourceOf(failure.input), failure.trace);
  return renderPSystemError(system, errorMeasurer(options));
}

/**
 * A failure AFTER preprocessing (parse, layout or render). This port has no
 * per-line parser trace to hand over — upstream's parsers report the line they
 * choked on — so the listing is the diagram's own source and the message is
 * attributed to its last line.
 */
function errorSvg(source: string, err: unknown, options?: RenderOptions): string {
  // The last-resort handler: it runs on input already known to be broken -- up
  // to and including a caller who passed something that is not a string at all
  // (`renderAll(null)`, pinned by tests/integration/index.test.ts). A throw
  // from HERE escapes render(), which is the one thing this path exists to
  // prevent, so it does not trust its own argument.
  const input: readonly StringLocated[] = readLines(typeof source === 'string' ? source : '');
  const trace = umlSourceOf(input);
  const error = new ErrorUml('EXECUTION_ERROR', errorMessage(err), 0, trace[trace.length - 1]);
  const system =
    trace.length === 0
      ? new PSystemErrorEmpty(trace, trace, error)
      : new PSystemErrorV2(trace, trace, error, err);
  return renderPSystemError(system, errorMeasurer(options));
}

/**
 * Nothing to draw: the document has no `@start…@end` block at all. The jar
 * renders the Welcome screen here (live-oracle verified), not an error.
 * @see ~/git/plantuml/.../eggs/PSystemWelcome.java
 */
function welcomeSvg(options?: RenderOptions): string {
  return renderPSystemWelcome(new PSystemWelcome(), errorMeasurer(options));
}

/**
 * The block parsed, ran, and said nothing -- upstream's *Empty description*,
 * raised by `PSystemCommandFactory#createSystem` before any command runs. The
 * assumed type is the FIRST factory the `@start` line selects: for `@startuml`
 * that is `SequenceDiagramFactory` (every legacy factory raises the same empty
 * error, and `PSystemErrorUtils#merge` keeps the first of the equal-scoring
 * ones) -- jar-verified, `Empty description (Assumed diagram type: sequence)`.
 * For a typed block (`@startjson`, ...) it is that block's own type.
 *
 * The listing is the `@start` line alone, waved, which is what the jar draws.
 *
 * @see ~/git/plantuml/.../command/PSystemAbstractFactory.java#buildEmptyError
 */
function emptySvg(block: BlockUmlOk, options?: RenderOptions): string {
  const startLine = block.rawSource[0]!;
  const assumed: DiagramType = block.suffix === 'uml' ? UML_EMPTY_ASSUMED_TYPE : block.source.type;
  const error = new ErrorUml('SYNTAX_ERROR', EMPTY_DESCRIPTION, 0, startLine, assumed);
  const system = new PSystemErrorEmpty(block.rawSource, [startLine], error);
  return renderPSystemError(system, errorMeasurer(options));
}

/** @see ~/git/plantuml/.../command/PSystemAbstractFactory.java#EMPTY_DESCRIPTION */
const EMPTY_DESCRIPTION = 'Empty description';

/** The first factory `@startuml` selects -- see {@link emptySvg}. */
const UML_EMPTY_ASSUMED_TYPE: DiagramType = 'sequence';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

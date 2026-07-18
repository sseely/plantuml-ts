/**
 * Dispatcher: holds a registry of DiagramPlugin instances and resolves
 * which plugin handles a given UmlSource by calling accepts() in
 * registration order. Unknown types produce an error-sentinel plugin
 * that renders a graceful error SVG.
 */

import type { DiagramType, UmlSource } from './block-extractor.js';
import type { Theme } from './theme.js';
import type { StringMeasurer } from './measurer.js';

// ---------------------------------------------------------------------------
// SyncPlugin / AsyncPlugin / DiagramPlugin union
// ---------------------------------------------------------------------------

/**
 * The fragment a plugin returns from `render()` in the common case: inner
 * SVG markup plus the dimensions/background/defs the central `assembleSvg`
 * (src/index.ts) needs to call `svgRoot` exactly once, after chrome (T7)
 * has had a chance to decorate. This re-mirrors upstream's
 * `getTextBlock -> addChrome -> exporter` order (decisions.md D2).
 */
export interface RenderFragment {
  /** Inner SVG markup — svgRoot's `children` argument (already joined). */
  body: string;
  width: number;
  height: number;
  /** svgRoot's `bgColor` argument. Omit to take svgRoot's own default. */
  background?: string;
  /** svgRoot's `extraDefs` argument. Omit to take svgRoot's own default. */
  extraDefs?: string;
  /**
   * G1 I1: set ONLY by `description/renderer.ts#unwrapKlimtSvg` (never by
   * any other `RenderFragment` producer) — tells `assembleSvg` (src/index.ts)
   * to reassemble via `description/renderer.ts#assembleKlimtShell` (klimt's
   * OWN root-attribute/prolog/defs conventions) instead of the generic
   * `svgRoot` (core/svg.ts) every other engine uses. `unwrapKlimtSvg` only
   * ever runs on an ANNOTATED description-diagram fragment (its own doc
   * comment), so this never touches an unannotated klimt document or any
   * other engine's fragment — `svgRoot`'s own behavior is unchanged.
   */
  klimtShell?: true;
  /**
   * G2 N1 ("SVG root shell" mechanism): set ONLY by
   * `class/renderer.ts#renderClass` -- tells `assembleSvg` (src/index.ts) to
   * reassemble via `class/renderer-shell.ts#assembleClassShell` (jar's
   * class-diagram root-attribute/prolog/defs conventions, the SAME literal
   * shape `assembleKlimtShell` uses for description -- see
   * `core/klimt/document-shell.ts#assembleDocumentShell`, the shared
   * mechanics both delegate to) instead of the generic `svgRoot`
   * (core/svg.ts). Never set by any other engine's fragment -- `svgRoot`'s
   * own behavior for every other engine is unchanged.
   */
  classShell?: true;
  /**
   * G2 N1: set by `core/annotations/chrome.ts#applyChrome` whenever it
   * added its OWN single bare `<g>` wrap around a decorated fragment's body
   * (i.e. `decorated === true` inside that function). A klimt-shaped
   * fragment (`klimtShell`) never reads this flag -- `unwrapKlimtSvg`
   * already strips klimt's own content `<g>` before chrome runs, so
   * `applyChrome`'s wrap is the ONLY one for that path. A class-shaped
   * fragment (`classShell`) DOES read it: `assembleClassShell` must wrap
   * `fragment.body` in exactly one bare `<g>` itself for the UNANNOTATED
   * case (nothing else would), but must NOT wrap a second time when chrome
   * already did -- this flag is the signal that distinguishes the two.
   * Every other engine ignores it (harmless, unread).
   */
  bodyWrapped?: true;
  /**
   * G2 N46: set ONLY by `class/renderer.ts#renderClass` -- the diagram
   * body's PRE-document-margin/PRE-`SvgGraphics#ensureVisible`-quirk ink
   * dims (`class/layout-ink-extent.ts#computeClassRawInkDims`), distinct
   * from `width`/`height` above (which stay the POST-margin/quirk value a
   * no-chrome canvas needs). `core/annotations/chrome.ts#applyChrome` uses
   * these -- instead of `width`/`height` -- as the "original" diagram-body
   * size fed into `decorateEntityImage`'s centering math, matching jar's
   * own `DiagramChromeFactory.create`/`DecorateEntityImage` composition
   * order (margin applied AFTER chrome, not before -- see
   * `plans/g2-class-svg/ledger.md` N46 for the jar-verified mechanism).
   * `undefined` for every other engine (unread, harmless) and for class's
   * OWN degenerate/empty/multi-page geometries (`class/layout.ts
   * #ClassGeometry.rawWidth`'s own doc comment).
   */
  preChromeWidth?: number;
  preChromeHeight?: number;
}

/**
 * Escape hatch for plugins that emit a complete `<svg>` document themselves
 * and do not go through the shared `svgRoot` assembler — the description
 * (klimt) engine, and any renderer's own inline error-document path (e.g.
 * chart's `renderErrorDiagram`). `assembleSvg` returns `completeSvg` as-is.
 */
export interface CompleteSvg {
  completeSvg: string;
}

/** Union of everything a plugin's `render()` may hand back. */
export type AssembledSvg = RenderFragment | CompleteSvg;

/**
 * A plugin that performs layout synchronously.
 * Discriminated from AsyncPlugin by the presence of `layoutSync`.
 */
export interface SyncPlugin<AST = unknown, Geo = unknown> {
  readonly type: DiagramType;
  accepts(lines: readonly string[]): boolean;
  parse(source: UmlSource): AST;
  layoutSync(ast: AST, theme: Theme, measurer: StringMeasurer): Geo;
  render(geo: Geo, theme: Theme): AssembledSvg;
}

/**
 * A plugin that performs layout asynchronously (e.g. web-worker, WASM).
 * Discriminated from SyncPlugin by the absence of `layoutSync` and the
 * presence of `layout`.
 */
export interface AsyncPlugin<AST = unknown, Geo = unknown> {
  readonly type: DiagramType;
  accepts(lines: readonly string[]): boolean;
  parse(source: UmlSource): AST;
  layout(ast: AST, theme: Theme, measurer: StringMeasurer): Promise<Geo>;
  render(geo: Geo, theme: Theme): AssembledSvg;
}

/**
 * Union of all plugin shapes accepted by the registry.
 *
 * Type-narrow at call sites with `'layoutSync' in plugin` to detect SyncPlugin.
 */
export type DiagramPlugin<AST = unknown, Geo = unknown> =
  | SyncPlugin<AST, Geo>
  | AsyncPlugin<AST, Geo>;

// ---------------------------------------------------------------------------
// Error-sentinel plugin
// ---------------------------------------------------------------------------

/** Returned when no registered plugin accepts a source block. */
const ERROR_SENTINEL: SyncPlugin = {
  type: 'unknown',
  accepts: (_lines: readonly string[]) => false,
  parse: (_source: UmlSource) => ({}),
  layoutSync: (
    _ast: unknown,
    _theme: Theme,
    _measurer: StringMeasurer,
  ): unknown => ({}),
  render: (_geo: unknown, theme: Theme): AssembledSvg => ({
    completeSvg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="60">` +
      `<rect width="300" height="60" fill="#fff8f8" stroke="${theme.colors.error}"/>` +
      `<text x="10" y="35" font-family="${theme.fontFamily}" font-size="${theme.fontSize.toString()}" fill="${theme.colors.error}">` +
      `Error: unknown diagram type` +
      `</text>` +
      `</svg>`,
  }),
};

// ---------------------------------------------------------------------------
// DiagramRegistry class
// ---------------------------------------------------------------------------

export class DiagramRegistry {
  private readonly plugins: DiagramPlugin[] = [];

  /**
   * Register a plugin. Plugins are probed in registration order;
   * the first plugin whose accepts() returns true wins.
   */
  register(plugin: DiagramPlugin): void {
    this.plugins.push(plugin);
  }

  /**
   * Resolve the plugin that handles the given source block.
   *
   * For blocks with an explicit @start<type> directive (e.g. @startjson),
   * match by plugin.type first — this avoids false positives from broad
   * heuristics in other plugins (e.g. the component plugin matching JSON
   * arrays via [...]). Type-based routing is skipped for types that can also
   * be assigned by content probing in @startuml blocks ('sequence', 'class',
   * 'state'), where accepts() scanning must remain authoritative.
   *
   * For @startuml blocks and ambiguous types, fall through to accepts() scanning.
   */
  resolve(source: UmlSource): DiagramPlugin {
    // Types producible by detectUmlType from @startuml content probing —
    // these must always go through accepts() to avoid misrouting.
    const AMBIGUOUS_TYPES = new Set(['sequence', 'class', 'state', 'unknown']);
    if (!AMBIGUOUS_TYPES.has(source.type)) {
      const typed = this.plugins.find((p) => p.type === source.type);
      if (typed !== undefined) return typed;
    }
    for (const plugin of this.plugins) {
      if (plugin.accepts(source.lines)) {
        return plugin;
      }
    }
    // Nothing claimed the content. Upstream still has a diagram type in hand
    // (`DiagramType.findStartTypes` on the `@start` line) and still runs the
    // factories for it -- `@startuml` + `title X` is a CLASS diagram in the jar
    // even though no keyword in it says "class". So: fall back to the plugin
    // for the block's OWN type (for `@startuml`, the type `detectUmlType`
    // settled on, whose fallback is upstream's factory order). Only a type no
    // plugin implements reaches the sentinel.
    // @see ~/git/plantuml/.../PSystemBuilder.java#createPSystem
    const typed = this.plugins.find((p) => p.type === source.type);
    if (typed !== undefined) return typed;

    return ERROR_SENTINEL;
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton registry
// ---------------------------------------------------------------------------

export const registry: DiagramRegistry = new DiagramRegistry();

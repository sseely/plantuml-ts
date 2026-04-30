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
 * A plugin that performs layout synchronously.
 * Discriminated from AsyncPlugin by the presence of `layoutSync`.
 */
export interface SyncPlugin<AST = unknown, Geo = unknown> {
  readonly type: DiagramType;
  accepts(lines: readonly string[]): boolean;
  parse(source: UmlSource): AST;
  layoutSync(ast: AST, theme: Theme, measurer: StringMeasurer): Geo;
  render(geo: Geo, theme: Theme): string;
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
  render(geo: Geo, theme: Theme): string;
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
  render: (_geo: unknown, theme: Theme) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="60">` +
    `<rect width="300" height="60" fill="#fff8f8" stroke="${theme.colors.error}"/>` +
    `<text x="10" y="35" font-family="${theme.fontFamily}" font-size="${theme.fontSize.toString()}" fill="${theme.colors.error}">` +
    `Error: unknown diagram type` +
    `</text>` +
    `</svg>`,
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
    return ERROR_SENTINEL;
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton registry
// ---------------------------------------------------------------------------

export const registry: DiagramRegistry = new DiagramRegistry();

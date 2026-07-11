# API reference

The public entry point is `src/index.ts`; the package exports three
rendering functions and one options interface.

## `renderSync`

```ts
function renderSync(source: string, options?: RenderOptions): string;
```

Parses `source`, resolves the theme, lays out the diagram, and renders it to
an SVG string — synchronously. Throws no exceptions to the caller: parse and
layout errors are caught internally and rendered as a small red error SVG
instead.

- **`source`** — PlantUML-language diagram source. Only the first `@start*`
  block is rendered.
- Throws (returns an error SVG, does not `throw`) if `source` contains an
  `!include` directive — `renderSync` does not resolve includes. Use
  `render()` for sources that need them.
- Returns an error SVG if no diagram type in `source` matches a registered
  plugin, or if the resolved plugin does not support synchronous layout.

## `render`

```ts
function render(source: string, options?: RenderOptions): Promise<string>;
```

Same as `renderSync`, but async: resolves `!include` directives first (via
`resolveIncludes()`, using `options.fetcher` if supplied), then renders the
first `@start*` block. Falls back to an async layout path for diagram types
that don't implement `layoutSync`.

## `renderAll`

```ts
function renderAll(source: string, options?: RenderOptions): Promise<string[]>;
```

Same resolution/theme pipeline as `render`, but renders **every** `@start*`
block found in `source` and returns one SVG string per block, in source
order. A failure in one block yields an error SVG for that entry only — it
does not abort the others.

## `RenderOptions`

```ts
interface RenderOptions {
  theme?: 'default' | 'dark' | 'sketchy' | 'monochrome' | Partial<Theme>;
  measurer?: StringMeasurer;
  maxWidth?: number;
  fetcher?: IncludeFetcher;
}
```

- **`theme`** — a named base theme, or a partial theme object merged on top
  of source-driven theme resolution (see [Theme resolution](#theme-and-skinparam-resolution)
  below). Omit to use the theme from a `!theme` directive in `source`, or
  `'default'` if none is present.
- **`measurer`** — override the text measurer for this render. See
  [The measurer seam](#the-measurer-seam).
- **`maxWidth`** — optional layout width constraint (diagram-type dependent).
- **`fetcher`** — override how `!include` URLs are resolved. Only consulted
  by `render()`/`renderAll()`, never `renderSync()`. See
  [The include-resolver seam](#the-include-resolver-seam).

`Theme` and `StringMeasurer` are not exported from the package root — they
are structurally-typed interfaces, so a caller can satisfy them with a plain
object or class that has the matching shape without importing the type.

## The measurer seam

Every layout engine receives a text measurer instead of touching the DOM or
`fs` directly, so measurement can be swapped per environment:

```ts
interface FontSpec {
  family: string;
  size: number;
  weight?: 'normal' | 'bold';
  style?: 'normal' | 'italic';
}

interface StringMeasurer {
  measure(text: string, font: FontSpec): { width: number; height: number };
  getDescent(font: FontSpec, text: string): number;
}
```

If `options.measurer` is omitted, plantuml-ts picks a default per diagram
type:

- **Description diagrams** (component, usecase, node, deployment, …) default
  to the jar-calibrated measurer, since their rendering metrics are tuned
  against upstream's exact text emission.
- **Every other diagram type** defaults to `CanvasMeasurer` (uses the DOM
  `<canvas>` 2D context when available), falling back to `FormulaMeasurer`
  (a formula-based estimate, no DOM) when `CanvasMeasurer` construction
  throws — e.g. under Node or during SSR.

Pass `options.measurer` explicitly to force a specific measurer (or a custom
implementation) regardless of diagram type or environment.

## The include-resolver seam

```ts
type IncludeFetcher = (url: string) => Promise<string>;

function resolveIncludes(
  source: string,
  fetcher?: IncludeFetcher, // defaults to the built-in fetchInclude
): Promise<string>;
```

`render()` and `renderAll()` call `resolveIncludes()` internally before
parsing, replacing each `!include <url>` line with the fetched content.
Includes are resolved recursively (depth-first); a circular include throws.

There is **no filesystem or PlantUML-stdlib resolution built in** — only
URL-based includes via a caller-supplied (or default `fetch`-based) fetcher.
Pass `options.fetcher` to `render()`/`renderAll()` to control this — for
example, to restrict allowed hosts, inject caching, or resolve local files in
a Node host application. See the [known divergences](/divergences) page for
the exact scope of preprocessor/`!include` support.

## Theme and skinparam resolution

Four stages combine to produce the final `Theme` used for a render, each
layered on the previous:

1. **Named base theme** — `options.theme` (if a string) overrides a `!theme`
   directive found in `source`; otherwise the base is `'default'`.
2. **`skinparam` directives** from `source` are applied on top of the base
   theme.
3. **`<style>` blocks** from `source` are applied on top of that — both
   top-level bare declarations and element-scoped selectors (e.g.
   `class { BackgroundColor red }`).
4. **Caller `Partial<Theme>`** — if `options.theme` is an object rather than
   a string, it is deep-merged on top of everything above and wins on every
   conflicting field.

This means a caller-supplied theme object always wins, but named/string
themes only set the starting point — source-level `skinparam`/`<style>`
directives still apply on top of a named theme.

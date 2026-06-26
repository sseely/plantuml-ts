# Architecture Decisions

## D1: `<style>` extraction — inside `preprocess()`

Extract `<style>…</style>` blocks during the single `preprocess()` pass.
`PreprocessorResult` gains `styles: readonly string[]`.

Callers read `preprocessed.styles` for the theming layer. No extra call site.

---

## D2: Parametric macro argument syntax — `##param##`

Port Java's `##param##` substitution syntax exactly.
`!define BOLD(x) <b>##x##</b>` → `BOLD(hello)` expands to `<b>hello</b>`.

`##` delimiters are load-bearing for concatenation: `prefix##x##suffix`.
Word-boundary replacement (used for simple defines) is insufficient here.

---

## D3: Recursive includes — internal helper with visited set

Public API unchanged: `resolveIncludes(source, fetcher?)`.

Internally delegates to `resolveIncludesInner(source, fetcher, visited: Set<string>)`
which recurses into fetched content with the visited set threaded through.
Circular detection: if the URL/path being fetched is already in `visited`, throw
`CircularIncludeError`.

---

## D4: Node.js fs fetcher — separate file

`src/core/include-resolver-node.ts` exports `makeNodeFsFetcher(basePath: string)`.
Uses `node:fs/promises`. Vite's browser build never imports this file.

Path traversal protection: resolve the requested path with `path.resolve(basePath, target)`;
if the result does not start with `path.resolve(basePath)`, throw `IncludeResolveError`.

---

## D5: `!else` — simple toggle

`ConditionalFrame.include` is toggled on `!else`: `frame.include = !frame.include`.
Correct and complete for the `!ifdef`/`!ifndef`/`!else`/`!endif` directive set.
`!elseif` is part of the separate `!if` expression system (future mission).

---

## D6: `!include` in `renderSync` — throw

`renderSync` throws `Error: '!include directives are not supported in renderSync — use render() instead'`
if the preprocessed source still contains an unresolved `!include` line.
(After T5, `render()` resolves includes before preprocessing, so by the time
`renderSync` sees the source the check is moot for well-formed inputs.)

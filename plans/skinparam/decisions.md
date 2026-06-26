# Architecture Decisions

## D1 — Extract `deepMergeTheme` into `theme.ts`

Extract `deepMergeTheme(base: Theme, partial: DeepPartial<Theme>): Theme` from
the inline logic currently inside `resolveTheme`. Export it. `resolveTheme`
becomes a thin wrapper. `resolveSkinparam` calls it to apply the mapped partial.

**Why:** One merge implementation, one test suite. `theme.ts` is the right home.

## D2 — `resolveSkinparam` returns `{ theme, unknown }`

Signature: `resolveSkinparam(skinparams: ReadonlyMap<string,string>, base: Theme): { theme: Theme; unknown: string[] }`

Returns both the merged theme and any keys that had no mapping. Unknown keys
are surfaced to the call site without hidden module state.

**Why:** More composable than option A (hidden state) and less awkward than
option B (caller must merge manually).

## D3 — Support both skinparam forms in preprocessor

Handle `skinparam key value` (single-line) and the block form:
```
skinparam {
  key1 value1
  key2 value2
}
```
Both forms consume their lines and add to `PreprocessorResult.skinparam`.

**Why:** Block form is common in real diagrams. Single-line only would cause
silent failures for many real inputs.

## D4 — `parseStyleBlock` lives in `skinparam.ts`

`parseStyleBlock(raw: string): Map<string,string>` co-located with
`resolveSkinparam`. Strips selector lines (`word {` and `}`), extracts
`key: value` pairs, normalises keys to lowercase.

**Why:** Co-located with its consumer. Can be extracted later if it grows.

## D5 — Three-stage theme resolution (confirmed against upstream Java)

Resolution order in `render()` / `renderAll()` / `renderSync()`:
1. `resolveTheme(preprocessed.theme ?? 'default')` — base theme
2. `resolveSkinparam(preprocessed.skinparam, base).theme` — diagram skinparam overrides
3. If `options.theme` is `Partial<Theme>`: `deepMergeTheme(step2, options.theme)` — caller wins

Verified against `TContext.java:executeTheme()`: the theme file's skinparam
lines are executed at the point `!theme` appears in source; subsequent diagram
skinparam directives override the theme's values.

String-valued `options.theme` (e.g. `'dark'`) replaces `preprocessed.theme`
as the base name — same as current behavior, no change.

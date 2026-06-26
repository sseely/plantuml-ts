# T1 — Preprocessor skinparam collection

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript + Vite,
Vitest tests (90/90/90 coverage). ESLint. Working directory: `/Users/scottseely/git/plantuml-js`.
Branch: `feat/skinparam`.

`src/core/preprocessor.ts` already handles `!define`, `!ifdef`, `!theme`,
`<style>` blocks, and parametric macros. Read the full file before editing.

## Task

Add `skinparam` directive collection to the preprocessor.

### `PreprocessorResult` — add `skinparam`

```typescript
export interface PreprocessorResult {
  readonly lines: readonly string[];
  readonly theme: string | null;
  readonly styles: readonly string[];
  readonly skinparam: ReadonlyMap<string, string>; // ← NEW
}
```

### Parsing — two forms

**Single-line form:**
```
RE_SKINPARAM_LINE = /^skinparam\s+(\w+)\s+(.+)$/
```
When matched: key = `match[1].toLowerCase()`, value = `match[2].trim()`.

**Block form:**
```
skinparam {
  key1 value1
  key2 value2
}
```
Detect the opening `RE_SKINPARAM_BLOCK_OPEN = /^skinparam\s*\{$/.` Enter
`inSkinparamBlock` state. Each subsequent line matching
`RE_SKINPARAM_BLOCK_ENTRY = /^\s*(\w+)\s+(.+)$/` adds a key/value. The closing
`RE_SKINPARAM_BLOCK_CLOSE = /^\s*\}$/` ends collection.

### Key normalisation

Keys are stored as **plain lowercase** (`rawKey.trim().toLowerCase()`). Values
are trimmed. The full `cleanForKeySlow` normalisation (stripping underscores,
collapsing arrow prefixes, etc.) happens inside `resolveSkinparam` in T2 —
not here. This keeps T1 independent of T2 during parallel execution.

If the same normalised key appears multiple times, the last value wins (matches
Java's SkinParam accumulation order).

### Line consumption

Both forms consume their lines — do NOT emit them to `outputLines`.

### Placement in the processing loop

Check for `skinparam` directives **after** the conditional-block skip guard
(`isActive()`) and **after** the `<style>` block check. Skinparam inside an
inactive `!ifdef` block is skipped (not collected).

### Empty-source fast path

Update the early return to include `skinparam: new Map()`.

## Write-Set

- `src/core/preprocessor.ts`
- `tests/unit/preprocessor.test.ts`

## Read-Set

- `src/core/preprocessor.ts` — read fully before editing
- `tests/unit/preprocessor.test.ts` — read fully before editing

## Architecture Decisions

- D3: Support both single-line and block-form skinparam
- D5: Skinparam inside inactive conditional blocks is skipped (not collected)

## Interface Contract

```typescript
export interface PreprocessorResult {
  readonly lines: readonly string[];
  readonly theme: string | null;
  readonly styles: readonly string[];
  readonly skinparam: ReadonlyMap<string, string>;
}
```

`src/index.ts` will consume `preprocessed.skinparam` in T3. No changes to
`src/index.ts` are needed in this task — the new field is additive.

## Acceptance Criteria

- Given `skinparam backgroundColor #FF0000`, when preprocessed, then
  `skinparam.get('backgroundcolor')` = `'#FF0000'` and line not in `outputLines`
- Given `skinparam classArrowColor red`, when preprocessed, then
  `skinparam.get('classarrowcolor')` = `'red'` (plain lowercase only; full
  normalisation to `arrowcolor` happens in resolveSkinparam, not here)
- Given `skinparam { backgroundColor red\n  borderColor blue }`, when
  preprocessed, then both keys collected, neither line in `outputLines`
- Given duplicate key `skinparam foo a` then `skinparam foo b`, then
  `skinparam.get('foo')` = `'b'` (last wins)
- Given `!ifdef X\nskinparam foo bar\n!endif` with X not defined, when
  preprocessed, then `skinparam` is empty (inactive block skipped)
- Given source with no skinparam directives, then `skinparam` is empty map
- All existing preprocessor tests pass (regression)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Commit message:
```
feat(preprocessor): collect skinparam directives into PreprocessorResult

Add skinparam: ReadonlyMap<string,string> to PreprocessorResult. Both the
single-line (skinparam key value) and block (skinparam { }) forms are parsed;
keys are normalised to lowercase and lines are consumed from outputLines.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

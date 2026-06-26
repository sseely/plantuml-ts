# T1 — `<style>` block extraction + `!else` clause

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript + Vite,
Vitest tests (90/90/90 coverage). ESLint. Porting discipline: port Java faithfully.

Branch: `feat/preprocessor`. Working directory: `/Users/scottseely/git/plantuml-js`.

`src/core/preprocessor.ts` already handles `!define`, `!undefine`, `!ifdef`,
`!ifndef`, `!endif`, `!theme`, block comments, and single-line comments.
Read the full file before editing.

## Task

### Part A — `<style>` block extraction

Add `styles: readonly string[]` to `PreprocessorResult`. During the processing
loop, detect `<style>` and `</style>` lines (case-insensitive, trimmed) and
collect lines between them into a style buffer. Do not emit those lines to
`outputLines`. After `</style>`, push the collected buffer as a joined string
into a `styleBlocks` array, then clear the buffer.

Rules:
- Match `<style>` and `</style>` on their own line (trimmed), case-insensitive
- Content lines inside a style block are collected verbatim (no define substitution,
  no comment stripping — style content is opaque)
- Style blocks inside inactive conditional blocks are still stripped (don't emit
  them, but also don't collect them — they're behind a false ifdef)
- Multiple `<style>` blocks in the same source are all collected; each becomes
  a separate entry in `styles`
- Return `styles: styleBlocks` in the result (empty array if none found)

### Part B — `!else` clause

Add `RE_ELSE = /^!else\s*$/` regex. In the processing loop (where `!ifdef`,
`!ifndef`, `!endif` are evaluated), handle `!else`:

```typescript
const elseMatch = RE_ELSE.test(trimmed);
if (elseMatch) {
  const frame = condStack[condStack.length - 1];
  if (frame !== undefined) {
    frame.include = !frame.include;
  }
  continue;
}
```

`ConditionalFrame` must become mutable (`include` not `readonly`) for this to work.
Check whether the current definition has `readonly` and remove it if so.

Place the `!else` check in the same group as `!endif`, `!ifdef`, `!ifndef`
(evaluated even inside inactive blocks so depth tracking stays correct).

## Write-Set

- `src/core/preprocessor.ts`
- `tests/unit/preprocessor.test.ts`

## Read-Set

- `src/core/preprocessor.ts` — read fully before editing
- `tests/unit/preprocessor.test.ts` — read fully before editing

## Architecture Decisions

- D1: `<style>` extracted inside `preprocess()` single pass; `styles` added to result
- D5: `!else` is a simple toggle on the top frame's `include` flag

## Interface Contract

```typescript
export interface PreprocessorResult {
  readonly lines: readonly string[];
  readonly theme: string | null;
  readonly styles: readonly string[];  // ← NEW; empty array if none
}
```

`src/index.ts` destructures `preprocessed.theme` and `preprocessed.lines` only —
the new `styles` field is additive and requires no changes there.

## Acceptance Criteria

- Given `<style>\nbackground: red\n</style>\nAlice -> Bob`, when preprocessed,
  then `lines` = `['Alice -> Bob']` and `styles` = `['background: red']`
- Given source with no `<style>` block, when preprocessed, then `styles` = `[]`
- Given two `<style>` blocks, when preprocessed, then `styles.length` = 2
- Given `!ifdef X\nyes\n!else\nno\n!endif` with X defined, when preprocessed,
  then `lines` = `['yes']`
- Given `!ifdef X\nyes\n!else\nno\n!endif` with X not defined, when preprocessed,
  then `lines` = `['no']`
- Given `!ifndef X\nyes\n!else\nno\n!endif` with X not defined, when preprocessed,
  then `lines` = `['yes']`
- Existing preprocessor tests all still pass (regression)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Commit message:
```
feat(preprocessor): add <style> extraction and !else clause

Port <style>...</style> block stripping from upstream; extracted content
surfaces in PreprocessorResult.styles for the theming layer. Add !else
branch toggle to ifdef/ifndef conditional stack.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

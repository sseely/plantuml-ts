# T2 — Preprocessor

## Context

Project: plantuml-js — TypeScript PlantUML renderer producing SVG in browser.
Stack: TypeScript 5 strict, Vitest for tests. All source in `src/`, tests in
`tests/`. Use `pnpm` for package management.

The preprocessor runs before any other pipeline stage. It expands macros,
applies conditionals, strips comments, and extracts theme hints from raw source
lines before the block extractor sees them.

## Task

Implement `src/core/preprocessor.ts` and its tests using TDD. Write each test
first (red), then implement the minimum code to pass (green). The tests in
`planning/tdd-plan.md` under `tests/unit/preprocessor.test.ts` define the
exact test descriptions and assertions to use.

## Write-set

| File | Action |
|------|--------|
| `src/core/preprocessor.ts` | Create |
| `tests/unit/preprocessor.test.ts` | Create |

## Read-set

- `planning/tdd-plan.md` — section `tests/unit/preprocessor.test.ts` (exact test names and assertions)
- `planning/architecture.md` — section "Preprocessor" (directive table)
- `planning/decisions.md` — D5 (error handling)

## Interface contract

The preprocessor exports one function:

```typescript
export interface PreprocessorResult {
  readonly lines: readonly string[];
  readonly theme: string | null;
}

export function preprocess(
  source: string,
  defines?: ReadonlyMap<string, string>
): PreprocessorResult;
```

- `source` — raw multi-line string (the full document, not split yet)
- `defines` — optional pre-seeded defines (for testing and include chaining)
- Returns: processed lines (comments stripped, macros expanded, conditionals
  resolved) and any `!theme` value found

## Directives to support

| Directive | Behaviour |
|-----------|-----------|
| `' comment` or `/' block comment '/` | Strip line / block |
| `!define TOKEN value` | Substitute TOKEN in all subsequent lines |
| `!define TOKEN` (no value) | Define TOKEN as empty string |
| `!undefine TOKEN` | Remove TOKEN from defines map |
| `!ifdef TOKEN` / `!endif` | Include block if TOKEN is defined |
| `!ifndef TOKEN` / `!endif` | Include block if TOKEN is not defined |
| `!theme name` | Strip line, set result.theme = name |

Do NOT implement `!include` — that is deferred to a later phase.

## Acceptance criteria

- Given `!define FOO bar` then `delay FOO`, when processed, then output
  contains `delay bar` (not `delay FOO`)
- Given `!define DEBUG` (no value) then `note DEBUG`, when processed, then
  output contains `note ` (empty substitution)
- Given `!undefine FOO` after `!define FOO x`, when subsequent line has FOO,
  then FOO is NOT replaced
- Given `!ifdef FOO / note / !endif` with FOO defined, when processed, then
  `note` is in output
- Given `!ifdef FOO / note / !endif` with FOO not defined, when processed,
  then `note` is NOT in output
- Given `' this is a comment`, when processed, then the line is absent from output
- Given `!theme dark`, when processed, then result.theme === 'dark' and the
  directive line is absent from output

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test` all pass. Coverage ≥ 90% on
`src/core/preprocessor.ts`. Commit: `feat(core): implement preprocessor`

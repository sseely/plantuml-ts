# T2 — Parametric macros: `!define MACRO(args) body`

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript + Vite,
Vitest tests (90/90/90 coverage). ESLint. Porting discipline: port Java faithfully.

Branch: `feat/preprocessor`. Working directory: `/Users/scottseely/git/plantuml-js`.

Batch 1 (T1) is complete. `src/core/preprocessor.ts` now has `<style>` extraction
and `!else`. Read the current file fully before editing.

## Task

Add parametric macro support. Upstream Java uses `##param##` for argument
substitution inside macro bodies (from `DefineSignature.java`).

### Data model change

Replace the current `Map<string, string>` defines with a discriminated union:

```typescript
type SimpleDef  = { kind: 'simple';     value: string };
type ParamDef   = { kind: 'parametric'; params: string[]; body: string };
type Define = SimpleDef | ParamDef;

const activeDefines = new Map<string, Define>();
```

### Parsing change

Add a new regex before `RE_DEFINE_WITH_VALUE`:

```typescript
const RE_DEFINE_PARAMETRIC =
  /^!define\s+(\w+)\(([^)]*)\)\s+(.+)$/;
```

When matched:
- Group 1 = macro name
- Group 2 = comma-separated param names (trim each)
- Group 3 = body

Store as `{ kind: 'parametric', params: [...], body }`.

Simple defines (`RE_DEFINE_WITH_VALUE`, `RE_DEFINE_NO_VALUE`) store as
`{ kind: 'simple', value }`.

### Expansion change

Update `applyDefines(line)` to handle both kinds:

**Simple defines** — same word-boundary replacement as before.

**Parametric defines** — for each parametric macro name, check if the line
contains `MACRONAME(`. If yes, replace all occurrences using this logic:

```
regex: /\bMACRONAME\(([^)]*)\)/g
for each match:
  args = split match[1] by ',' and trim each
  if args.length !== params.length: leave the match unchanged (pass through)
  result = body
  for each (param, arg):
    result = result.replaceAll(`##${param}##`, arg)
  replace the full match with result
```

Apply simple defines first, then parametric defines (matching Java's order in
`Defines.applyDefines`).

### `!undefine` — update to work with the new union type

`activeDefines.delete(name)` works for both kinds (no change needed to the
undefine logic itself, just ensure the Map still accepts the new value type).

## Write-Set

- `src/core/preprocessor.ts`
- `tests/unit/preprocessor.test.ts`

## Read-Set

- `src/core/preprocessor.ts` — read the T1-updated file fully
- `tests/unit/preprocessor.test.ts` — read fully

## Architecture Decision

- D2: `##param##` substitution syntax, matching upstream `DefineSignature.java`

## Acceptance Criteria

- Given `!define BOLD(x) <b>##x##</b>` then `BOLD(hello)` in source,
  when preprocessed, output line contains `<b>hello</b>`
- Given `!define PAIR(a,b) ##a## and ##b##` then `PAIR(cats,dogs)`,
  output contains `cats and dogs`
- Given `!define CONCAT(a,b) ##a####b##` then `CONCAT(foo,bar)`,
  output contains `foobar`
- Given wrong arg count `BOLD(x,y)` for a 1-param macro,
  line passes through unchanged
- Given non-parametric `!define FOO bar` + `FOO` in source,
  word-boundary replacement still works (regression)
- Given `!ifdef`/`!define`/`!theme` existing tests, all still pass (regression)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Commit message:
```
feat(preprocessor): add parametric macro expansion

Port DefineSignature.java's ##param## substitution syntax. Parametric
defines are stored separately from simple defines; expansion replaces
MACRO(args) call-sites with body after substituting ##param## tokens.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

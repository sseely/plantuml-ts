# T3 — Business element AST kinds + usecase parser `/` suffix

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.
>
> Read before implementing:
> - `~/git/plantuml/src/main/java/net/sourceforge/plantuml/abel/LeafType.java`
>   (USECASE_BUSINESS — no ACTOR_BUSINESS equivalent; actors use USymbol)
> - `~/git/plantuml/src/main/java/net/sourceforge/plantuml/decoration/symbol/USymbols.java`
>   (ACTOR_STICKMAN_BUSINESS assignment for `:name:/` syntax)
> - `~/git/plantuml/src/main/java/net/sourceforge/plantuml/classdiagram/command/CommandCreateElementFull2.java`
>   (line 183 — where USECASE_BUSINESS is assigned from `/` suffix)

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript +
Vite, Vitest tests (90/90/90 coverage). ESLint. Working directory:
`/Users/scottseely/git/plantuml-js`. Branch: `feat/style-blocks`.

Batch 1 runs in parallel — do not depend on T1 or T2. Read
`src/diagrams/usecase/ast.ts`, `src/diagrams/usecase/parser.ts`, and
`tests/unit/usecase/parser.test.ts` fully before editing.

## Task

### Part A — Extend `UCNodeKind`

In `src/diagrams/usecase/ast.ts`, add two new values to `UCNodeKind`:

```typescript
export type UCNodeKind =
  | 'actor'
  | 'business-actor'   // ← new
  | 'usecase'
  | 'business-usecase' // ← new
  | 'package'
  | 'rectangle'
  | 'node'
  | 'folder'
  | 'frame'
  | 'cloud'
  | 'database'
  | 'system';
```

No other AST changes are needed. The `UCNode` interface is unchanged.

### Part B — Parse `/` suffix in `src/diagrams/usecase/parser.ts`

Two syntax forms get the `/` suffix in PlantUML:

**Business actor:** `:name:/` or `:name: /` (trailing slash after closing colon)

Update the actor parsing pattern to capture an optional trailing `/`:
```
/^:(.+?):\s*(\/)?$/
```
If the slash capture group is present → `kind: 'business-actor'`
Else → `kind: 'actor'`

**Business use case:** `(name)/` or `(name) /`

Update the use case parsing pattern:
```
/^\((.+?)\)\s*(\/)?$/
```
If the slash capture group is present → `kind: 'business-usecase'`
Else → `kind: 'usecase'`

The display name must NOT include the slash. Trim the captured name.

Also update the `actor keyword` form if the parser supports `actor Name/` syntax
(check the existing parser — if this form exists in the Java, port it; otherwise
note it as out of scope for this task).

### Part C — Update layout if needed

Check `src/diagrams/usecase/layout.ts`. If it switches on `UCNodeKind` for
node sizing, add cases for `'business-actor'` and `'business-usecase'` using
the same dimensions as `'actor'` and `'usecase'` respectively. Business element
layout dimensions are identical to their non-business counterparts.

## Write-Set

- `src/diagrams/usecase/ast.ts`
- `src/diagrams/usecase/parser.ts`
- `tests/unit/usecase/parser.test.ts`

## Read-Set

- `src/diagrams/usecase/ast.ts`
- `src/diagrams/usecase/parser.ts`
- `src/diagrams/usecase/layout.ts` — read for UCNodeKind switch cases
- `tests/unit/usecase/parser.test.ts`

## Acceptance Criteria

- Given `":joe2:/"`, when parsed, then node has `kind = 'business-actor'`,
  `display = 'joe2'`
- Given `"(run)/"`, when parsed, then node has `kind = 'business-usecase'`,
  `display = 'run'`
- Given `":joe:"`, when parsed, then `kind = 'actor'` (no regression)
- Given `"(walk)"`, when parsed, then `kind = 'usecase'` (no regression)
- Given `": My Actor :/"`, when parsed, then display is trimmed (`'My Actor'`)
- All existing usecase parser tests pass (regression)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Commit message:
```
feat(usecase): add business-actor and business-usecase AST kinds

Extend UCNodeKind with 'business-actor' and 'business-usecase'. Parse the
trailing / suffix on :name:/ and (name)/ syntax to produce the new kinds.
Layout dimensions are unchanged from their non-business counterparts.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

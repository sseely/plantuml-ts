# T3 — Recursive includes + circular detection

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript + Vite,
Vitest tests (90/90/90 coverage). ESLint. Porting discipline: port Java faithfully.

Branch: `feat/preprocessor`. Working directory: `/Users/scottseely/git/plantuml-js`.

`src/core/include-resolver.ts` already has a flat single-pass `resolveIncludes`.
Read the full file before editing.

## Task

### Add `CircularIncludeError`

```typescript
export class CircularIncludeError extends Error {
  readonly url: string;
  readonly chain: readonly string[];

  constructor(url: string, chain: string[]) {
    super(
      `Circular !include detected: ${[...chain, url].join(' → ')}`,
    );
    this.name = 'CircularIncludeError';
    this.url = url;
    this.chain = chain;
  }
}
```

### Make `resolveIncludes` recursive

Keep the public signature unchanged:
```typescript
export async function resolveIncludes(
  source: string,
  fetcher: IncludeFetcher = fetchInclude,
): Promise<string>
```

Internally, delegate to a private helper:
```typescript
async function resolveIncludesInner(
  source: string,
  fetcher: IncludeFetcher,
  visited: ReadonlySet<string>,
  chain: string[],
): Promise<string>
```

In the helper:
1. Split source into lines
2. For each line matching `INCLUDE_RE`:
   - Extract `url`
   - If `visited.has(url)`: throw `new CircularIncludeError(url, chain)`
   - Fetch content via `fetcher(url)`
   - Recurse: `resolveIncludesInner(content, fetcher, new Set([...visited, url]), [...chain, url])`
   - Push the recursed result
3. Non-include lines push as-is
4. Join with `'\n'` and return

The public `resolveIncludes` calls the helper with `new Set<string>()` and `[]`.

## Write-Set

- `src/core/include-resolver.ts`
- `tests/unit/include-resolver.test.ts`

## Read-Set

- `src/core/include-resolver.ts` — read fully before editing
- `tests/unit/include-resolver.test.ts` — read fully before editing

## Architecture Decision

- D3: Public API unchanged; internal recursive helper with visited set

## Acceptance Criteria

- Given source `!include a` where fetcher('a') returns `!include b` and
  fetcher('b') returns `hello`, when resolved, then result contains `hello`
- Given `!include a` where fetcher('a') returns `!include a` (self-include),
  when resolved, then throws `CircularIncludeError`
- Given a→b→a cycle, when resolved, then throws `CircularIncludeError`
- `CircularIncludeError.chain` contains the inclusion path leading to the cycle
- Given source with no `!include`, when resolved, then source is unchanged
- All existing include-resolver tests still pass (regression)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Commit message:
```
feat(include-resolver): recursive expansion and circular include detection

Refactor resolveIncludes to recurse into fetched content. Thread a visited
Set through the recursion to detect cycles and throw CircularIncludeError
with the full inclusion chain.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

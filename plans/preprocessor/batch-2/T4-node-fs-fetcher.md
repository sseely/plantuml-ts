# T4 — Node.js filesystem fetcher factory

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript + Vite,
Vitest tests (90/90/90 coverage). ESLint.

Branch: `feat/preprocessor`. Working directory: `/Users/scottseely/git/plantuml-js`.

Batch 1 (T3) is complete. `src/core/include-resolver.ts` now has `CircularIncludeError`
and recursive expansion. Read it to understand the `IncludeFetcher` type.

## Task

Create `src/core/include-resolver-node.ts` that exports a `makeNodeFsFetcher`
factory. This file uses `node:fs/promises` and is only imported in Node.js
environments — it is never bundled into the browser build.

### Implementation

```typescript
import { readFile } from 'node:fs/promises';
import { resolve, normalize } from 'node:path';
import { IncludeFetcher, IncludeResolveError } from './include-resolver.js';

export function makeNodeFsFetcher(basePath: string): IncludeFetcher {
  const resolvedBase = resolve(basePath);

  return async (target: string): Promise<string> => {
    const resolvedTarget = resolve(resolvedBase, target);

    // Path traversal protection
    if (!resolvedTarget.startsWith(resolvedBase + '/') &&
        resolvedTarget !== resolvedBase) {
      throw new IncludeResolveError(
        `!include path '${target}' escapes the base directory '${basePath}'`,
        target,
      );
    }

    try {
      return await readFile(resolvedTarget, 'utf-8');
    } catch (err) {
      throw new IncludeResolveError(
        `Failed to read !include '${target}': ${(err as NodeJS.ErrnoException).message}`,
        target,
      );
    }
  };
}
```

Note: use `normalize` on `target` before `resolve` to handle `./` prefixes
that appear in real PlantUML include directives.

### Tests

Create `tests/unit/include-resolver-node.test.ts`. Because the function uses
`node:fs/promises`, mock it with `vi.mock('node:fs/promises', ...)`.

Test cases:
1. Reads a file within basePath and returns its content
2. Resolves relative paths correctly (e.g. `subdir/file.puml`)
3. Throws `IncludeResolveError` for path traversal (`../secret`)
4. Throws `IncludeResolveError` for `../../etc/passwd`
5. Throws `IncludeResolveError` when `readFile` throws ENOENT
6. The returned fetcher is typed as `IncludeFetcher`

## Write-Set

- `src/core/include-resolver-node.ts` *(new file)*
- `tests/unit/include-resolver-node.test.ts` *(new file)*

## Read-Set

- `src/core/include-resolver.ts` — for `IncludeFetcher` and `IncludeResolveError` types/exports

## Architecture Decision

- D4: Separate file for treeshaking; browser build never imports `node:fs`

## Acceptance Criteria

- Given `makeNodeFsFetcher('/base')` and target `'foo.puml'`,
  when fetcher called, then `readFile` called with `/base/foo.puml`
- Given target `'../secret'`, when fetcher called,
  then throws `IncludeResolveError` with message containing 'escapes'
- Given `readFile` throws `ENOENT`, when fetcher called,
  then throws `IncludeResolveError`
- `makeNodeFsFetcher` return type satisfies `IncludeFetcher`
- `npm run typecheck` passes (both tsconfig.json and tsconfig.node.json)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Commit message:
```
feat(include-resolver): add Node.js filesystem fetcher factory

makeNodeFsFetcher(basePath) returns an IncludeFetcher that reads files
relative to basePath using node:fs/promises. Includes path traversal
protection and clear error messages.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

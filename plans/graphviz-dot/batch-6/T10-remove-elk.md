# T10 — Remove ELK

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js renders PlantUML diagrams to SVG. All four graph diagram layout
modules (class, component, state, use case) have been migrated to the dot
layout engine in T6–T9. ELK is no longer called by any production code.
This task removes the dead code and the elkjs npm dependency.

**Stack:** TypeScript 5 strict mode, Vitest, ESLint 9. No Jest.

## Task

1. Verify no remaining imports of `elk-adapter.ts` or `elkjs` in `src/`.
2. Delete `src/core/elk-adapter.ts`.
3. Remove `"elkjs"` from `dependencies` in `package.json`.
4. Run `npm install` to update `package-lock.json`.
5. Verify all tests, typecheck, lint, and build pass.

## Write-set

```
src/core/elk-adapter.ts     (delete)
package.json                (modify — remove elkjs from dependencies)
package-lock.json           (update via npm install)
```

## Read-set

- `src/core/elk-adapter.ts` — confirm it exists and check for any unexpected callers before deleting
- `package.json` — current dependencies section
- `tests/unit/elk-adapter.test.ts` — this test file tests elk-adapter directly; DELETE it too

## Pre-deletion checklist

Before deleting, run:
```bash
grep -r "elk-adapter" src/ tests/
grep -r "elkjs" src/ tests/
```

If any hits remain in `src/` (not `tests/unit/elk-adapter.test.ts`), STOP
and log in decision-journal.md — T6–T9 left a residual import.

If only `tests/unit/elk-adapter.test.ts` references elk-adapter, that test
file must also be deleted (it tests code that no longer exists).

## Acceptance Criteria

- **Given** elkjs removed from package.json, **when** `npm install && npm test`, **then** all tests pass
- **Given** elk-adapter.ts deleted, **when** `npm run typecheck`, **then** zero errors
- **Given** all changes applied, **when** `npm run build`, **then** build succeeds with no bundler errors
- **Given** the Vite demo app, **when** `npm run dev` and a use case diagram is rendered, **then** diagram appears without console errors

## TDD Workflow

T10 is a deletion task — no new tests to write. The red/green protocol is:
1. Delete elk-adapter.ts and elk-adapter.test.ts
2. Run `npm test` — if tests fail (red), fix residual imports
3. Remove elkjs from package.json, run `npm install`
4. Run full quality gate — all green before committing

## Quality Bar

```
npm install
npm test && npm run typecheck && npm run lint && npm run build
```

# T1 — Rename layout.ts → layout.old.ts

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

The activity diagram layout engine (`src/diagrams/activity/layout.ts`) is being
replaced by a tile-based framework. This task renames the old file so the name
`layout.ts` is free for the new implementation, and updates all import sites.

## Task

1. Rename `src/diagrams/activity/layout.ts` to `src/diagrams/activity/layout.old.ts`.
2. Find every file that imports from `./layout`, `../activity/layout`, or any
   path resolving to this module.
3. Update each import to point at `layout.old` instead.
4. Run `npm run typecheck` — must pass with zero errors.
5. Run `npm test` — all tests must pass.
6. Commit: `refactor(activity): rename layout.ts to layout.old.ts for tile rewrite`

## Write-set

- `src/diagrams/activity/layout.old.ts` (renamed from layout.ts)
- `src/diagrams/activity/index.ts` (update import if present)
- Any other file importing from `layout.ts`

## Read-set

- `src/diagrams/activity/layout.ts` — rename target
- `src/diagrams/activity/index.ts` — check for import
- Run `grep -r "activity/layout" src/` to find all import sites

## Architecture Decisions

- D6: layout.ts renamed to layout.old.ts; stays in place as reference

## Acceptance Criteria

- Given the rename is complete, when `npm run typecheck` runs, then zero errors
- Given any file previously importing `layout.ts`, when compiled, then it
  resolves to `layout.old.ts` without error
- Given `npm test` runs, then all tests pass (no regressions from rename)

## Quality Bar

`npm run typecheck` and `npm test` must both pass before committing.

# T8 — Cutover: register, delete, migrate

## Context

The new `description` engine is proven (Batches 3–7). Cut over: register it,
remove the two diverged plugins, and update the remaining references. This is the
step that realizes the consolidation. Do it as one atomic change so the registry
is never in a two-claimants-for-one-block state.

## Task

1. `src/index.ts`: import and `registry.register(descriptionPlugin)`; remove the
   `componentPlugin` and `usecasePlugin` imports + registrations. **Leave the
   skinparam→`graphOverride` style wiring untouched** — it is element-name-keyed
   (`usecaseFill`, `actorFill`, …) and the descriptive renderer still reads it.
2. `src/core/block-extractor.ts`: in the `DiagramType` union add `'description'`;
   remove `'component'` and `'usecase'` (D1). Fix any resulting type errors.
3. Delete `src/diagrams/component/**` and `src/diagrams/usecase/**`.
4. Delete `tests/unit/component/**`, `tests/unit/usecase/**`,
   `tests/integration/component.test.ts`, `tests/integration/usecase.test.ts`
   (their cases were migrated in T4–T7 — verify migration before deleting).
5. `.claude/catalog.md`: replace the "Component" and "Use Case" sections with one
   "Description" section (path `src/diagrams/description/`, `descriptionPlugin`,
   full `USymbol` feature list, note D2 fallback symbols as TODO).
6. Update the `DiagramType` union references anywhere else `'component'`/
   `'usecase'` are matched (grep first).

Do not touch the visual-reference fixtures (`tests/visual/**`,
`tests/fixtures/{component,usecase}/**`) — they render the same diagrams through
the new engine and serve as faithfulness goldens.

## Read-set

- `src/index.ts:1-45` (imports + registrations) and `:88-120` (style wiring — do
  not change).
- `src/core/block-extractor.ts` (`DiagramType` union).
- `.claude/catalog.md` (Component + Use Case sections).
- Grep: `rg -n "'component'|'usecase'|componentPlugin|usecasePlugin" src tests`
  before deleting, to catch stragglers.

## Architecture decisions

D1 (remove old strings), D5 (naming). Locked.

## Interface contract

Consumes `descriptionPlugin` (T7). Produces no new exports; net effect is registry
+ union change.

## Acceptance criteria

- Given the registry after cutover, when a descriptive block resolves, then
  `'description'`; component/usecase plugins are gone.
- Given `DiagramType`, then `'description'` present, `'component'`/`'usecase'`
  absent, `pnpm typecheck` clean.
- Given the oracle DOT-gate on the component+usecase corpus buckets, when re-run,
  then node/edge/cluster counts hold vs the pre-merge baseline.
- Given the full suite, then green at 90/90/90 with no orphaned imports
  (`pnpm lint` clean).
- Given visual references, when re-rendered through the new engine, then within
  tolerance.

## Observability

Final gate: full quality-gate run + oracle DOT-gate + visual references. Log the
oracle delta to `decision-journal.md`.

## Rollback

Reversible — revert the cutover commit restores both plugins (still on the branch
history). No data migration.

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green; oracle gate
holds. One commit: `refactor(T8): cut over to unified description engine`.
Body lists deleted plugins and the `DiagramType` change (touches >3 files).

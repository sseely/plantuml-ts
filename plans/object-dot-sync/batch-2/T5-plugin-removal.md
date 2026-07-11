# T5 — Delete the object plugin, migrate tests, verify dispatch

## Context
Follows T4. decisions.md#d2: nothing keys on plugin type 'object';
once classAccepts covers object/map, `src/diagrams/object/` is dead
code. CLAUDE.md sanctions deleting diverged local structure that was
never faithful to upstream's boundary.

## Task
1. Delete `src/diagrams/object/index.ts` + `parser.ts`; remove the
   `registry.register(objectPlugin)` line from `src/index.ts` (and its
   import).
2. Migrate `src/diagrams/object/*.test.ts` (or tests referencing
   parseObject/objectPlugin — grep first) to exercise the class engine;
   keep every behavioral assertion (they encode ported Java semantics).
3. Verify dispatch non-regression: run
   `npx tsx scripts/dot-sync-report.ts` (default component+usecase) and
   `... class` — EQUAL counts must match their pre-T5 values; run the
   full suite.
4. Record the object EQUAL count post-consolidation in the journal —
   this seeds Phase L's bucket order.

## Write-set
- src/diagrams/object/** (deletion), src/index.ts (registry line),
  migrated test files

## Read-set
- src/diagrams/object/** (what's being deleted), grep for references
- plans/object-dot-sync/decisions.md#d2

## Acceptance criteria
- Given `grep -rn "diagrams/object" src tests`, then zero references
  remain.
- Given the default and class report runs, then EQUAL counts match
  pre-T5 exactly (description 50/81-era numbers per their current
  values; class 680).
- Given `npm test && npm run typecheck && npm run lint && npm run
  build`, then all pass.

## Observability
N/A.

## Rollback
Reversible.

## Commit
`refactor(class-dot): absorb object plugin into class engine (mirror upstream)`

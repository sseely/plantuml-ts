# T4 — Unify oracle jar resolution in dot-sync-report

## Context
`scripts/dot-sync-report.ts#resolveJar` (:69-77) resolves `$PLANTUML_JAR`
then the newest jar in `~/git/plantuml/build/libs`. The committed-golden
workflow (`oracle/capture.sh:16`, `oracle/capture-corpus.sh:26`) uses
`oracle/dist/plantuml-oracle.jar`. Drift between the two would make the
report and the ratchet disagree (decisions.md#d4).

## Task
Change `resolveJar` order to: `$PLANTUML_JAR` →
`oracle/dist/plantuml-oracle.jar` (if it exists) → newest in
`~/git/plantuml/build/libs`. Log which jar was picked (one stderr line).

## Write-set
- `scripts/dot-sync-report.ts`

## Read-set
- `scripts/dot-sync-report.ts:69-77`
- `oracle/capture.sh`, `oracle/build-oracle.sh` (for the dist path)

## Acceptance criteria
- Given no `$PLANTUML_JAR` and an existing `oracle/dist/plantuml-oracle.jar`,
  when the report runs, then it uses the dist jar (stderr line confirms).
- Given a fresh `npx tsx scripts/dot-sync-report.ts class --rebuild` is NOT
  required: cached dumps stay valid — EQUAL remains 357 on a normal run.
  (If the dist jar disagrees with the cache, STOP — that's stop-condition 5
  territory; journal it.)
- Given `$PLANTUML_JAR` set, then it still wins.

## Observability
The stderr jar-path line IS the instrumentation.

## Rollback
Reversible.

## Commit
`fix(dot-sync): prefer oracle/dist jar so report and goldens share one oracle`

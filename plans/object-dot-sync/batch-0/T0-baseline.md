# T0 — Branch, EXPECTED_TAG fix, baseline

## Context
Object-diagram canonical SVGs carry `data-diagram-type="CLASS"`
(upstream renders object via the class engine), so the report's
`EXPECTED_TAG` map (`scripts/dot-sync-report.ts:63`, object→'OBJECT')
classifies zero fixtures.

## Task
1. Create `feature/object-dot-sync` off main.
2. Change `EXPECTED_TAG.object` to `'CLASS'` with a one-line comment
   citing `ClassDiagramFactory.java` (no separate object engine
   upstream).
3. Run `npx tsx scripts/dot-sync-report.ts object` (no --type-tag) and
   record baseline numbers in decision-journal.md.
4. All four gates.

## Write-set
- scripts/dot-sync-report.ts (EXPECTED_TAG entry only — file is at the
  500-line hook cap; a one-line value change is safe, additions are not)

## Acceptance criteria
- Given `dot-sync-report object` without `--type-tag`, then 80
  comparable / 34 EQUAL / 26 no-candidate reported.
- Given the four gates, then all pass.

## Observability
N/A — the report output is the artifact.

## Rollback
Reversible.

## Commit
`chore(object-dot): classify object fixtures via CLASS tag (baseline 34/80)`

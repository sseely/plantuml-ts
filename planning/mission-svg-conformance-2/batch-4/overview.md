# Batch 4 — Assembly ∥ survey/dashboard ∥ overlay

Three parallel tasks, disjoint write-sets. T14 needs T10+T11; T15/T16
depend only on Brief 1's harness and the public render API.

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T14 | EntityImageDescription assembly | typescript-pro (sonnet) | src/core/svek/image/EntityImageDescription.ts, tests/unit/core/svek/entity-image-description.test.ts | T10, T11 | [x] |
| T15 | Survey → parity.json + PARITY-SVG.md dashboard | typescript-pro (sonnet) | scripts/svg-parity-survey.ts, scripts/svg-parity-dashboard.ts, tests/oracle/svg-conformance/PARITY-SVG.md (generated), tests/unit/scripts/svg-parity.test.ts | — | [x] |
| T16 | Overlay triage report | typescript-pro (sonnet) | scripts/svg-overlay-report.ts, tests/unit/scripts/svg-overlay.test.ts | — | [x] |

## Quality gates
Mission-level gates from `../README.md`. T15/T16 scripts run end-to-end
against the still-legacy renderer here (verdicts will be `diverged` —
that is expected and proves the instrument works before the cutover).

## Next
Mark T14–T16 `[x]`, commit (one per task), proceed to Batch 5.

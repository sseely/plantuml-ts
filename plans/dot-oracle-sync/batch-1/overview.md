# Batch 1 — Type-generic parity harness

Three tasks, parallelizable (disjoint write-sets). All three must land before
Phase 2 starts.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Tighten comparator: assert rankdir/nodesep/ranksep; size-median metric | typescript-pro | `tests/oracle/svek-dot.ts`, `tests/oracle/svek-dot.test.ts` (new unit tests) | — | [x] |
| T2 | Report tooling: --slug drill-down; type-generic corpus classification; json/dot oracle probe | typescript-pro | `scripts/dot-sync-report.ts` | — | [x] |
| T3 | Offline ratchet: goldens capture + `tests/oracle/description-parity.ratchet.test.ts` | typescript-pro | `oracle/goldens/description/**`, `tests/oracle/description-parity.ratchet.test.ts`, `oracle/README.md` (goldens section note) | T1 | [x] |

Interface contract shared by all three: `StructuralDiff` /
`compareStructural` in `tests/oracle/svek-dot.ts`. T1 may add fields
(`rankdirOk`, `nodesepOk`, `ranksepOk`, `medianSizeDeltaIn`) but must not
rename or remove existing ones — T2/T3 and the two existing consumers
(`scripts/oracle-gap.ts`, `scripts/visual-qa-dot.ts`,
`tests/oracle/class-dot-parity.test.ts`) compile against them.

Note: after T1 tightens the bar, the EQUAL baseline will DROP below 18/1
(rankdir/nodesep/ranksep now count). Re-measure at the start of Phase 2 and
journal the true baseline; T3 pins only fixtures that are EQUAL under the
NEW bar.

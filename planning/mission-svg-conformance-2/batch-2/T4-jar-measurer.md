# T4 — measurer-jar.ts + DOT-parity impact probe (D12)

## Context
T2 committed the AWT metrics table. This task builds the
`StringMeasurer` implementation on it and measures — without wiring —
what happens to DOT parity if description layout used it.

## Task
1. `src/core/measurer-jar.ts`: a `StringMeasurer` (interface in
   `src/core/measurer.ts` — measure/getDescent) backed by
   `measurer-jar.data.ts`. Reproduce AWT semantics exactly: per-glyph
   advance summation with AWT's rounding (verify against T2's recorded
   raw values), bold/italic handling as upstream does it (read how
   upstream's StringBounder differentiates styles — if upstream uses
   separate AWT fonts per style, the T2 table must already carry them;
   coordinate via the table's shape).
2. **Probe (report-only, wire nothing):** run
   `npx tsx scripts/dot-sync-report.ts class component usecase` twice —
   baseline, then with the jar measurer injected into the description/
   component/usecase layout path via a temporary local harness (do NOT
   commit the wiring — a scratch script is fine). Journal both results.
   **If any count decreases vs 357/234/59: STOP** (mission constraint) —
   report which fixtures regressed and why before any further batch.
   If counts increase, journal the new floor; the maintainer ratchets
   the gate value.

## Write-set
- `src/core/measurer-jar.ts`
- `tests/unit/core/measurer-jar.test.ts`
(Probe wiring is scratch-only — nothing else committed.)

## Read-set
- `src/core/measurer.ts` (interface + StringBounderFixed precedent)
- `src/core/measurer-jar.data.ts` (T2)
- Upstream `klimt/font/StringBounder*.java` (AWT rounding semantics)
- `../decisions.md#d12`

## Interface contracts (consumed by T17)
`export const jarMeasurer: StringMeasurer` (or a factory if per-size
tables require it — journal).

## Acceptance criteria
1. Given the strings/values T2 recorded in its README, when measured at
   14pt, then widths equal the AWT values exactly.
2. Given a bold FontSpec, then measurement follows upstream's bold
   handling (not the regular-width shortcut our fixed table uses).
3. Given the probe, then the journal carries both parity triples and the
   verdict (stop / proceed / ratchet-up).

## Observability / Rollback
Probe results journaled. / Reversible.

## Quality bar
Standard gates green; ≥90/90/90.

## Commit
`feat(T4): jar-metrics StringMeasurer + DOT-parity probe`

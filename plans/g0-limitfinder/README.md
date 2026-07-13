# Mission G0 — LimitFinder ink-extents port + smetana/vizjs oracle re-capture

**Objective.** (1) Port upstream's ink-bounding-box machinery — `MinMax`,
`MinMaxMutable`, `UGraphicNo`, `LimitFinder`, `TextBlockUtils.getMinMax` —
and cut the description engine's document sizing over to it (upstream
`SvekResult.calculateDimension`: LimitFinder walk → `moveDelta(6-minX,
6-minY)` re-anchor → `dims.delta(15,15)`), killing the F4 "document
dimensions 1px short" defect (327/348 diverging description fixtures).
(2) Re-capture the smetana/vizjs oracle fixtures with the pragma stripped
(maintainer ruling 2026-07-12, DIVERGENCES.md § General) so the jar emits
`svek-N.dot` — oracle-blind drops ~42 → ~8 (elk residue only).
(3) With LimitFinder available, attempt the deferred `BigFrame`/mainframe
drawing (retires the G0b TEMPORARY divergence) — escape hatch allowed.

**Exit bar** (mission-index Phase G / G0): doc dims exact on the size-clean
tier (jar 190×65 = ours 190×65 class of fixtures); oracle-blind bucket
drops to the elk-only residue; new DOT-gate baseline recorded with every
newly-comparable fixture EQUAL, ledgered, or size-backlogged.

- Branch: `feat/g0-limitfinder` (from main @ `f184f35`)
- Merge: **merge commit** (mission-brief branch; do not squash)

## Baseline (verified 2026-07-13, main @ f184f35)

```
npm test        7,837 passing (294 files), coverage 98.27 / 94.53 / 98.39
typecheck/lint/build  clean
DOT gate        component 251/259 · usecase 81/87 · class 680/680 · object 78/80 · state 260/261
                oracle-blind: class 35 · component 4-6 · state 6 · usecase 3 · object 1
census          description: 6 conformant / 355 (7 pre-existing errors)
```

## Quality Gates (after every batch)

```
- command: npm test            pass: exit 0, coverage ≥90/90/90   on_fail: fix_and_rerun
- command: npm run typecheck   pass: exit 0                       on_fail: fix_and_rerun
- command: npm run lint        pass: exit 0                       on_fail: fix_and_rerun
- command: npm run build       pass: exit 0                       on_fail: fix_and_rerun
- command: npx tsx scripts/dot-sync-report.ts component usecase class object state
  pass: batch 1 pre-recapture = EXACT baseline above. AFTER T2 lands, the
  SANCTIONED movement: numerators+denominators grow by the newly-comparable
  smetana/vizjs fixtures and oracle-blind shrinks to elk-only; any OTHER
  movement is a stop. Record the new baseline verbatim in the journal.
  on_fail: stop
```

## Batches

| Batch | Tasks | Status |
|---|---|---|
| [batch-1](batch-1/overview.md) — foundations (parallel) | T1 LimitFinder port, T2 pragma-strip re-capture | [ ] |
| [batch-2](batch-2/overview.md) — cutover + triage (parallel) | T3 description dims cutover, T4 newcomer triage + goldens | [ ] |
| [batch-3](batch-3/overview.md) — mainframe + close-out | T5 BigFrame attempt, T6 verify/flip (orchestrator) | [ ] |

## Key documents

- [decisions.md](decisions.md) — locked decisions (D1–D7)
- [decision-journal.md](decision-journal.md) — append every non-trivial call

## Constraints

**Stop conditions:**
- Any DOT-gate movement not attributable to the sanctioned T2 re-capture.
- T3's re-anchor (`moveDelta`) changes interior geometry on any currently
  DOT-EQUAL or SVG-ratcheted fixture (dims may change; interior positions
  of ratcheted goldens may not — the 5-fixture SVG ratchet is the guard).
- Writes outside a task's write-set; 2 consecutive gate failures on the
  same check; 3 same-location changes for the same failing check.
- Agents: NEVER git checkout/reset/stash/clean — read-only git only; the
  orchestrator owns all commits. (G0b incident; specs contain NO
  alternative suggestions this time.)

**Push-forward:** jar-verified constants; golden/backlog bookkeeping per
existing conventions; small klimt additions under upstream names.

**Standing rules:** grep upstream at `~/git/plantuml/src/main/java/net/`
(whole tree); no Node built-ins/Date.now/Math.random in src/; do not
refactor while porting; preserve upstream names (`MinMax`, `LimitFinder`,
`UGraphicNo`, `getMinMax`, `BigFrame`); tests in `tests/unit/` (hooks
exempt); complexity hook playbook per project memory; `npm run typecheck`
is the truth, not LSP diagnostics; orchestrator re-runs all gates.

## Oracle verification

```sh
java -jar oracle/dist/plantuml-oracle.jar -tsvg -pipe < x.puml
npx tsx scripts/svg-conformance-census.ts     # census; F4 fixtures: vapalu, jesibe, cifaki
npx tsx scripts/dot-sync-report.ts component usecase class object state
```

## Out of scope

- svgRoot engines' document dims (class/state/object SVG passes are G2–G4;
  their dims come from their own layouts, untouched here).
- Description DOT → 100% drill work on newly-comparable fixtures that come
  out non-EQUAL (they are RECORDED + ledgered here; fixed in the per-type
  DOT queue item).
- elk fixtures (excluded per DIVERGENCES.md).

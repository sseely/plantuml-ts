# T4 — Newly-comparable fixture triage (goldens + ledger)

Full accounting of the 42 smetana/vizjs fixtures T2's pragma-strip
re-capture made comparable (decisions.md D3/D4). Re-verified myself via
`npx tsx scripts/dot-sync-report.ts <type>` (+ `--equal-list`) before
acting — see per-type totals below, byte-for-byte the T2 baseline
(component 253/262, usecase 84/90, class 708/708, object 78/80, state
266/267).

## class (28 newcomers — 27 smetana + siteza-47-lixe343 vizjs)

All 28 confirmed in `test-results/dot-sync-equal/class.txt`. Class
golden convention is EQUAL-only, no `input.svg`, no size pins
(`class-dot-parity.test.ts:104-138` — ratchet fixtures are any golden
dir without `input.svg`). All 28 added to `oracle/goldens/class/<slug>/`
as `input.puml` + `svek-1.dot` (copied from the warm
`test-results/dot-cache/class/<slug>/{in.puml,svek-1.dot}`).

| slug | verdict | action | files copied | ratchet |
|---|---|---|---|---|
| bemuvo-33-jofa419 | EQUAL | golden | input.puml, svek-1.dot | pass |
| camupi-97-gezi072 | EQUAL | golden | input.puml, svek-1.dot | pass |
| dareti-67-siti389 | EQUAL | golden | input.puml, svek-1.dot | pass |
| dojuvi-07-duja723 | EQUAL | golden | input.puml, svek-1.dot | pass |
| dujinu-38-badu006 | EQUAL | golden | input.puml, svek-1.dot | pass |
| fezugi-39-fujo327 | EQUAL | golden | input.puml, svek-1.dot | pass |
| focabu-31-kide232 | EQUAL | golden | input.puml, svek-1.dot | pass |
| foxata-81-miva542 | EQUAL | golden | input.puml, svek-1.dot | pass |
| gaxipe-22-maxa852 | EQUAL | golden | input.puml, svek-1.dot | pass |
| gerima-02-fade831 | EQUAL | golden | input.puml, svek-1.dot | pass |
| jibili-77-vatu959 | EQUAL | golden | input.puml, svek-1.dot | pass |
| joguva-54-tevo966 | EQUAL | golden | input.puml, svek-1.dot | pass |
| kevoda-64-mije856 | EQUAL | golden | input.puml, svek-1.dot | pass |
| kixiso-09-lezo371 | EQUAL | golden | input.puml, svek-1.dot | pass |
| labele-71-gudo044 | EQUAL | golden | input.puml, svek-1.dot | pass |
| libobe-85-veli517 | EQUAL | golden | input.puml, svek-1.dot | pass |
| lurevi-57-reku842 | EQUAL | golden | input.puml, svek-1.dot | pass |
| pejone-71-tige404 | EQUAL | golden | input.puml, svek-1.dot | pass |
| rizazi-13-sepe706 | EQUAL | golden | input.puml, svek-1.dot | pass |
| siteza-47-lixe343 (vizjs) | EQUAL | golden | input.puml, svek-1.dot | pass |
| tamixa-86-jiku308 | EQUAL | golden | input.puml, svek-1.dot | pass |
| tekena-28-fobe713 | EQUAL | golden | input.puml, svek-1.dot | pass |
| tiguma-69-tovu135 | EQUAL | golden | input.puml, svek-1.dot | pass |
| tomuxi-86-juje957 | EQUAL | golden | input.puml, svek-1.dot | pass |
| xexapu-93-kuto175 | EQUAL | golden | input.puml, svek-1.dot | pass |
| xonamo-50-podo529 | EQUAL | golden | input.puml, svek-1.dot | pass |
| zaloza-02-toti585 | EQUAL | golden | input.puml, svek-1.dot | pass |
| zucedi-63-rugu584 | EQUAL | golden | input.puml, svek-1.dot | pass |

`npx vitest run tests/oracle/class-dot-parity.test.ts`: 715 tests
passed (686 pre-existing + 28 new ratchet + 1 harness-count fixture
already present — no change to harness-health fixtures).

## component (5 newcomers)

| slug | verdict | action | notes |
|---|---|---|---|
| gucefa-91-pume734 | EQUAL | golden (`oracle/goldens/description/`) | input.puml, svek-1.dot |
| nuxamo-38-vuxa816 | EQUAL | golden (`oracle/goldens/description/`) | input.puml, svek-1.dot |
| tojitu-03-ruto643 | STRUCTURAL-DIFF | recorded, NOT fixed, NOT added to any golden | see breakdown below |
| kofovu-01-niti223 | pre-excluded | none — jar errors (`UnsupportedOperationException`), never entered the comparable set | per T2 journal row |
| potatu-55-pave291 | pre-excluded | none — jar type-routes this fixture as CLASS, not component | per T2 journal row |

### tojitu-03-ruto643 diverging-check summary (drill-down)

`npx tsx scripts/dot-sync-report.ts --slug tojitu-03-ruto643 component`:

- `edgeCountOk` FAIL — oracle 88 edges, candidate 91
- `degreeOk` FAIL — degree sequences diverge at the low end
  (oracle `[0,0,0,0,1,1,1,2,...]` vs candidate
  `[1,1,1,1,1,2,2,2,...]` — oracle has 4 zero-degree nodes the
  candidate does not)
- `minlenOk` FAIL — oracle's minlen multiset is all-1s (92 edges);
  candidate carries two `minlen=0` edges the oracle does not
- `clusterOk` FAIL — oracle emits 5 clusters sized
  `[2,6,10,14,32]`; candidate emits **0 clusters** (package/namespace
  nesting is not being grouped into `subgraph cluster*` on our side
  for this fixture)
- `maxSizeDeltaIn`: 0.8641 (not gating — DOT gate fails first on the
  structural checks above)

This seeds the future per-type description-DOT-100% mission's drill
queue (D4) — not drilled here.

`npx vitest run tests/oracle/description-parity.ratchet.test.ts`: 336
tests passed (331 pre-existing + 5 new: 2 component + 3 usecase).

## state (6 newcomers)

All 6 confirmed in `test-results/dot-sync-equal/state.txt`. All added
to `oracle/goldens/state/<slug>/` as `input.puml` + `svek-N.dot`
(1 or 2 graphs per fixture — composite states drive multi-graph
captures). Size deltas measured empirically by copying goldens first
(no backlog entry) and reading the ratchet test's failure message,
which reports the exact `maxSizeDeltaIn` when it exceeds the allowed
(default 0) — 4 fixtures measured 0 and needed no entry; 2 measured
0.05555500000000002 and got a `size-backlog.json` entry at that exact
value.

| slug | verdict | measured maxSizeDeltaIn | action |
|---|---|---|---|
| buniva-95-zije634 | EQUAL | 0 | golden, no backlog entry |
| gimopu-56-rete904 | EQUAL | 0 | golden, no backlog entry |
| mazize-40-paxi649 | EQUAL | 0.05555500000000002 (svek-2.dot) | golden + size-backlog.json entry |
| mozumu-67-mixa626 | EQUAL | 0 | golden, no backlog entry |
| rifefi-73-rofo730 | EQUAL | 0.05555500000000002 (svek-2.dot) | golden + size-backlog.json entry |
| teseci-80-sivi292 | EQUAL | 0 | golden, no backlog entry |

`npx vitest run tests/oracle/state-dot-parity.test.ts`: 267 tests
passed (261 pre-existing + 6 new).

## usecase (3 newcomers)

usecase goldens live in `oracle/goldens/description/` (shared with
component, per the file's own convention — confirmed by reading an
existing entry before copying).

| slug | verdict | action |
|---|---|---|
| robiga-73-tedi466 | EQUAL | golden (`oracle/goldens/description/`) |
| seline-83-vifi756 | EQUAL | golden (`oracle/goldens/description/`) |
| xoculo-95-fuvi894 | EQUAL | golden (`oracle/goldens/description/`) |

Covered by the same `description-parity.ratchet.test.ts` run reported
under component above (336 tests, all passing, includes these 3).

## object (0 newcomers)

D3/T2: object contributed 0 newcomers to this re-capture (all 6
smetana/vizjs slugs in the gated types landed in class/component/
state/usecase). `oracle/goldens/object/` and its `size-backlog.json`
are untouched — confirmed by `git status --porcelain oracle/` showing
no object-tree changes.

## Verification

- `git diff --stat` / `git status --porcelain oracle/`: 39 new golden
  directories (28 class + 5 description + 6 state) plus a 2-line
  addition to `oracle/goldens/state/size-backlog.json`
  (`mazize-40-paxi649`, `rifefi-73-rofo730`). Zero existing golden
  entries modified — no other line in any pre-existing `input.puml`,
  `svek-N.dot`, or backlog value changed.
- Four ratchet suites (`class-dot-parity.test.ts`,
  `state-dot-parity.test.ts`, `object-dot-parity.test.ts`,
  `description-parity.ratchet.test.ts`): **1397/1397 passed**, 0
  failed.
- `npm test`: **7925/7925 passed** (295 test files), up from the
  post-T2/batch-1 baseline of 7886 by exactly +39 (the 39 golden
  additions above — 28 class + 5 description + 6 state). Coverage
  gates and typecheck/lint were not separately touched by this task;
  full `npm test` (which runs the suite + coverage) exited 0.
- No modification outside `oracle/goldens/**` and this file — nothing
  under `src/`, `scripts/`, `tests/` was written.

## Accounting total

28 (class) + 5 (component) + 6 (state) + 3 (usecase) = 42 newcomers,
matching D3's count exactly. 41 EQUAL → golden (39 pinned directly +
2 of those also carrying a size-backlog pin, not double-counted), 1
structural-diff (tojitu-03-ruto643, recorded only), 2 pre-excluded
(kofovu-01-niti223, potatu-55-pave291, never entered the comparable
set per T2).

# Mission G3 — object diagram SVG conformance

**Authorization.** Maintainer, 2026-07-19: "start G3."

**Objective.** Drive the object SVG census to **100% minus known
divergences** (2026-07-14 ruling: every non-conformant fixture carried by
a named DIVERGENCES.md/ledger entry — no anonymous misses). Object
diagrams route through the CLASS engine, so this mission inherits every
G2 subsystem (uids/phantom burns, box chrome, notes, creole, URLs, edge
machinery, style cascades, wrap) — expect a high starting baseline and a
short drill focused on object-SPECIFIC mechanisms (map tables, field
rows, object-specific commands).

- Branch: `feat/g3-object-svg` (from main @ post-G2 merge d740d91)
- Merge: merge commit; orchestrator owns all commits (one per iteration).
- Agents: NEVER git checkout/reset/stash/clean in this repo — NO
  EXCEPTIONS (disposable `git worktree` or the ratchet.json manifest are
  the snapshot methods); no commits.
- Protocol: `plans/dot-oracle-sync/loop-protocol.md`; G2's ledger
  (plans/g2-class-svg/ledger.md) is precedent for shared mechanisms.

## Corpus & oracle (verified fresh 2026-07-19)

```
test-results/dot-cache/object/ — 80 fixtures, cache dated 2026-07-11
(POST-deterministic-text-patch; spot-verified byte-identical to a live
jar run — no re-capture needed, unlike G2's N3).
DOT gate baseline: object 78/80 (the 2 non-equal are pre-existing,
carried since G0; the gate FREEZES at exactly these five counts:
component 262/262 · usecase 90/90 · class 708/708 · object 78/80 ·
state 267/267 — ANY movement = stop condition).
CLASS SVG GATE (new): the 292-fixture class ratchet
(tests/oracle/svg-conformance/class.golden.ratchet.test.ts) must stay
green and the class census zero-diff set identical — object work rides
the class engine; regressions there are regressions, full stop.
DESCRIPTION SVG GATE: the 48-fixture set identical + ratchet green.
Gates per iteration: npm test · typecheck · lint · build ·
dot-sync-report (frozen) · class census (292 set intact) · description
census (48 set intact) · object census (non-dropping).
```

## Iteration queue

| Iter | Scope | Status |
|---|---|---|
| O0 | Harness: extend svg-conformance-census.ts's renderFixtureFor to dispatch `object` through the class pipeline (G2 N0 precedent — check how object fixtures parse: the class engine's object commands); object ratchet harness (oracle/goldens/svg-object/ + object.golden.ratchet.test.ts + parity-object.json via svg-parity-survey's type args); TRUE baseline + `--families` classification + the opening queue table. Landed the `headerRows()` centering/baseline/textLength fix (object/map/json header rows) — census 1/80 -> 5/80. See `plans/g3-object-svg/ledger.md` O0 for the full family table (O1+ queue). | done |
| O1 | Drill family #2 from the O0 table: DATA-row (object field / map cell / json entry) baseline+textLength — same mechanism shape as O0's own fix, formula pre-derived, highest-reach in-scope family | todo |
| O2+ | drill remaining families largest-first per the O0 table | todo |

## Standing rules

Upstream spec: jar cached SVGs + `~/git/plantuml/src/main/java/net/`
(objectdiagram/ + the shared svek/cucadiagram machinery; grep `net/`).
Fix at origin; G2's named mechanisms are precedent — if an object diff
matches a G2-ledgered gvts-genuine/awaiting-maintainer item, ATTRIBUTE
it, don't re-drill. SVG-channel standing rule (maintainer 2026-07-17)
applies. Complexity playbook, TDD, ledger:
plans/g3-object-svg/ledger.md.

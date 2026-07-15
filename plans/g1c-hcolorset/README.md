# Mission G1c — named-CSS-color HColorSet table port

**Authorization.** Maintainer, 2026-07-15: "do it."

**Objective.** Port upstream `HColorSet`'s named-color → hex table
(~150 names) and wire it everywhere colors parse, closing the G1
ledger's I2/T19 named-color family (~23 fixtures in the J3 accounting)
plus I10's extension findings (gradient `stop-color` values, bare
unprefixed hex fills — 2 fixtures). Exit bar: 100% minus known
divergences — the G1c-attributed set conformant or re-attributed.

- Branch: `feat/g1c-hcolorset` (from main @ post-G1b merge)
- Merge: merge commit; orchestrator owns all commits (one per iteration).
- Agents: NEVER git checkout/reset/stash/clean; read-only git; no commits.
- Protocol: `plans/dot-oracle-sync/loop-protocol.md`.

## Baseline (2026-07-15, post-G1b merge)

```
41 / 355 conformant · 1-3: 28 · 4-10: 86 · 11-30: 60 · 31+: 139 · errors: 1
Ratchet: 41 pinned.
DOT gate FROZEN: component 262/262 · usecase 90/90 · class 708/708 ·
object 78/80 · state 267/267.
Gates per iteration: npm test · typecheck · lint · build ·
dot-sync-report (frozen) · census (zero-diff set + ratchet = tripwire).
Measure: npx tsx scripts/svg-conformance-census.ts [--families]
(DeterministicMeasurer section)
```

## Authoritative diagnoses

- G1 ledger (plans/g1-description-svg/ledger.md) § I2 — the named-color
  gap (T19 pre-existing); § I10 "named-color gap extends to
  `<linearGradient>` stop-color values and bare (unprefixed) hex fills".
- G1b ledger § J3 accounting rows: color 23 fixtures + color-extended 2.
- Upstream spec: `~/git/plantuml/src/main/java/net/` —
  `klimt/color/HColorSet.java` (the authoritative name table and parse
  order), `HColors`, and the color-parse call chain. Grep `net/`, never
  just `net/sourceforge/plantuml/`.

## Iteration queue

| Iter | Scope | Reach | Status |
|---|---|---|---|
| K1 | Port HColorSet's full name table + parse semantics (case-insensitivity, name-vs-hex precedence, the dual-color `#back:fore` forms if in-scope for description) into this port's color parsing at origin (paint.ts / parseColorOverride chain); wire gradient stop-color + bare-hex; re-measure, ratchet pass, accounting update | ~25 | todo |

## Standing rules

Same as G1b: fix at origin, jar cached SVGs as oracle, complexity-hook
playbook, TDD, git-archive baselines, ledger named remainders in
plans/g1c-hcolorset/ledger.md.

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
| K1 | Port HColorSet's full name table + parse semantics (case-insensitivity, name-vs-hex precedence, the dual-color `#back:fore` forms if in-scope for description) into this port's color parsing at origin (paint.ts / parseColorOverride chain); wire gradient stop-color + bare-hex; re-measure, ratchet pass, accounting update | ~25 | done |

## Standing rules

Same as G1b: fix at origin, jar cached SVGs as oracle, complexity-hook
playbook, TDD, git-archive baselines, ledger named remainders in
plans/g1c-hcolorset/ledger.md.

## K1 closing summary (2026-07-15)

**Tasks completed vs planned.** 1/1 planned iteration completed:
`klimt/color/ColorTrieNode.ts` (154-entry verbatim table) +
`klimt/color/HColorSet.ts` (`parseSimpleColor`/`toSvgHex`/
`resolveColorToSvgHex`), wired into `paint.ts#paintToSvg` and
`svg-graphics-core.ts`'s `fixColor`/`createSvgGradient`/
`setupBackcolor` — the only two SVG-emission choke points in the
codebase (grep-verified) — plus `tim/builtin/color-utils.ts` (closes
its own self-documented compact-table divergence). Full details:
`ledger.md` § K1.

**Census trajectory.** DeterministicMeasurer (component+usecase, 355
fixtures): **41/355 -> 48/355** conformant (1-3:28->28, 4-10:86->81,
11-30:60->62, 31+:139->135, errors:1->1). Full per-fixture (not just
bucket-aggregate) before/after scan: **0 regressions**, 53 fixtures
improved, 301 unchanged. Ratchet: 41 -> 48 pinned. This closes the
`oracle/goldens/svg-description/README.md` "Known gap" note — the
corpus now has conformant fixtures using a NAMED CSS color for the
first time.

**What closed.** G1b ledger § J3's "I2 named-CSS-color->hex table gap
(T19)" mechanism (23-fixture dominant-signature row) and its
"extended reach" row (gradient stop-color + bare-hex-no-`#`, 2
fixtures: raxata-43-buni314, titona-45-jile471) — both closed AS A
MECHANISM, jar-verified against 8 cached golden SVGs (exceeds the
6-fixture minimum).

**What re-attributed.** The 23-fixture row's exact post-fix
attribution was NOT individually re-derived (no explicit slug list
existed in the source ledger to re-verify against) — 7 of the ~23
crossed all the way to zero-diff; the rest likely now carry the
NEXT-largest diff family as their dominant signature (their color
component is fixed, but color was not their ONLY diff family). A
fresh full-corpus dominant-signature reclassification is future work,
not performed this iteration (ledger.md § K1 "Accounting
re-attribution").

**Decisions made.** 9 logged in `decision-journal.md`, all
push-forward judgment calls (table implementation as Map not literal
trie; two-choke-point wiring strategy; `color-utils.ts` delegation;
`?scheme`/`"automatic"` scope exclusion; `"transparent"`/
`"background"` generalization; no-WHITE-fallback deferred-resolution
design; resolved-value gradient dedup keys; pre-existing test
assertion updates; activity-diagram gap left unaddressed). None
flagged for review beyond their own "needs-signoff" tags (the
`?scheme` form and the activity-diagram gap, both explicitly scoped
out with reach evidence, not silently dropped).

**Quality gate results.** `npm test -- --run`: 317 files / 8536 tests
pass (was 8529 before this iteration's own new tests). `npm run
typecheck`: clean (both tsconfig.json and tsconfig.node.json). `npm
run lint`: clean. `npm run build`: clean. `npx tsx scripts/
dot-sync-report.ts component usecase class object state`: EXACTLY
frozen (component 262/262, usecase 90/90, class 708/708, object
78/80, state 267/267) — verified before AND after all work, zero
drift.

**Known issues / follow-ups.** `?back:fore[:extra]` dual-color scheme
form (1 corpus fixture, out of named accounting); `"automatic"`
keyword (context-dependent, different mechanism class); activity
diagram's start/stop/end nodes bypass both choke points entirely
(separate ad-hoc raw-string pattern, outside this iteration's
census/DOT-gate/accounting scope); full residue-accounting
re-derivation for the ~307 still-non-conformant fixtures. All ledgered
in `ledger.md` § K1 "Named remainders".


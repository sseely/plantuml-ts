# Mission G1b — ink-extent margin + FrontierCalculator (match the Java)

**Authorization.** Maintainer, 2026-07-15: "match the Java, do the mission."
This is G1's largest deferred residue (ledger.md I7 mechanisms B and C):
~108 fixtures directly, plus most of I8's 170-fixture polygon family and
I9's 158-fixture deferred `path/@d` family cascade through it.

**Objective.** Replace this port's flat node-box document margin with
upstream's real ink-extent mechanism, and port the `FrontierCalculator`
port-cluster sizing subsystem. Exit bar: **100% minus known divergences**
(2026-07-14 ruling) — the mission closes when the G1b-attributed fixture
set is conformant or re-attributed to other named mechanisms, with a
refreshed residue accounting.

- Branch: `feat/g1b-ink-extent` (from main @ post-G1 merge)
- Merge: merge commit; orchestrator owns all commits (one per iteration).
- Agents: NEVER git checkout/reset/stash/clean; read-only git; no commits.
- Protocol: `plans/dot-oracle-sync/loop-protocol.md` (one mechanism per
  iteration, diagnosis.md discipline, fix at origin, grow the SVG ratchet,
  ledger the named remainder).

## Baseline (2026-07-15, post-G1 merge)

```
30 / 355 conformant · 1-3: 21 · 4-10: 77 · 11-30: 53 · 31+: 173 · errors: 1
Ratchet: 26 pinned (tests/oracle/svg-conformance/description.golden.ratchet.test.ts)
Post-J1 (2026-07-15): 41 / 355 conformant · 1-3: 28 · 4-10: 86 · 11-30: 57 ·
31+: 142 · errors: 1. Ratchet: 35 pinned. See ledger.md J1 for the full
verification table and the 5 diagnosed (mechanism-B, non-tripwire) regressions.
DOT gate FROZEN THROUGHOUT: component 262/262 · usecase 90/90 · class
708/708 · object 78/80 · state 267/267 (ANY movement = stop condition).
Gates per iteration: npm test (>=90/90/90) · typecheck · lint · build ·
dot-sync-report (frozen) · census (conformant must not DROP; zero-diff
set + ratchet are the over-broad-fix tripwire).
Measure: npx tsx scripts/svg-conformance-census.ts [--families]
(read the DeterministicMeasurer section; output has multiple sections)
```

## Authoritative diagnoses (do not re-derive — verify against these)

Both mechanisms are fully root-caused in `plans/g1-description-svg/
ledger.md` § I7 ("mechanism B" / "mechanism C") with jar citations and
numerically-verified cases. Read those sections first, every iteration.

- **Mechanism C (ink-extent margin).** Jar: `SvekResult.java:125-136
  #calculateDimension` computes `minMax = TextBlockUtils.getMinMax(this,
  stringBounder, false)` — a drawn-INK bounding box over the assembled
  render tree — then `moveDelta(6 - minMax.getMinX(), 6 - minMax.getMinY())`
  (constant 6). This port's `computeGlobalShift` (`layout-geo-post.ts`)
  applies a flat `LAYOUT_MARGIN_LEADING=7` against the raw NODE-BOX
  minimum. The actor Y case is numerically closed (jar 5.5 = 6 − 0.5 ink
  offset); the X-axis formula has an OPEN sub-question (jar `x=7` does not
  cleanly reduce — resolve with jar evidence before generalizing).
  graphviz-ts is RULED OUT with direct evidence (real-dot cross-check).
  NOTE: G0 already ported the ink primitives — `LimitFinder`, `UGraphicNo`,
  `MinMax`, `TextBlockUtils.getMinMax` (src/core/klimt/...), used by the
  doc-dimension pass (`renderer-ink-extent.ts` per G1 ledger). The gap is
  the PLACEMENT path still using the flat margin.
- **Mechanism B (FrontierCalculator).** Jar: `Cluster.java
  #manageEntryExitPoint` (java:410-430) splits members into `insides`
  (full RectangleArea merged) vs `points` (ports — center only, via
  `isNormalPosition==false`); `svek/FrontierCalculator.java` computes the
  cluster's drawn rectangle: when `insides` is empty, core falls back to a
  2×2 box centered on the cluster's OWN graphviz-assigned rectangle, then
  merges port centers, then the push step (`DELTA = 3*EntityPosition.RADIUS
  = 18`, java:47,97-146) expands any edge a port center sits within DELTA
  of (minus the rankdir-perpendicular corner exclusion). Unported;
  `computeContainerBbox` (`layout-helpers.ts`) is a pure padded union with
  no graphviz-cluster floor and no push. Needs the cluster's
  graphviz-assigned rectangle threaded from the layout result.

## Iteration queue

| Iter | Scope | Reach | Status |
|---|---|---|---|
| J1 | Mechanism C: wire `computeGlobalShift` (or its successor, mirroring `SvekResult#calculateDimension`) onto the real ink-extent walk with constant 6; close the X-axis open sub-question with jar evidence FIRST; per-shape ink offsets (actor verified; usecase-ellipse/others to be worked numerically) | ~23 named + ~40 topmost/leftmost cascades | done -- census 30->41 zero-diff (+11), ratchet 26->35, 0 tripwire regressions, DOT gate frozen exact; see ledger.md J1 |
| J2 | Mechanism B: port FrontierCalculator + manageEntryExitPoint insides/points split + DELTA push; thread the graphviz cluster rectangle; add the min-body floor `computeContainerBbox` needs | 4+ direct (gafegu/gocexi/rapaji/kanute) + port-label tie-breaks | done -- pure port-only case FIXED (jar-exact 177x99 on gafegu-06; census 4-10/11-30 bucket shift, 0 tripwire regressions, DOT gate frozen exact); mixed-children case + kanute-77 deferred (named remainders); see ledger.md J2 |
| J3 | Full re-measure: census + `--families`; re-attribute the I8-polygon/I9-path cascades; ratchet growth pass; refreshed residue accounting table (ledger § J3); mission-closing summary | cascade-wide | todo |

## Standing rules

Upstream spec: jar cached SVGs (`test-results/dot-cache/{component,usecase}/
<slug>/in.svg`) + `~/git/plantuml/src/main/java/net/` (grep `net/`, never
just `net/sourceforge/plantuml/`). Fix at origin — never post-hoc
coordinate surgery. graphviz-ts is OUT OF SCOPE (pinned .tgz); before
blaming it, run the real-dot cross-check (I7/I9 technique). Complexity-hook
playbook per project memory (\x22 for quotes in src, string-built regexes
for <>{}, no `new Array<T>()` call syntax, `// #lizard forgives` near fn
END for faithful ports, 500-line cap). TDD — every fixed mechanism ships
its test in the same turn. Baselines via the git-archive snapshot technique
(G1 ledger, I-linkstyle). Ledger: plans/g1b-ink-extent/ledger.md.

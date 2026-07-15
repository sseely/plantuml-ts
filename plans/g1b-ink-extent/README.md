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
| J3 | Full re-measure: census + `--families`; re-attribute the I8-polygon/I9-path cascades; ratchet growth pass; refreshed residue accounting table (ledger § J3); mission-closing summary | cascade-wide | done -- TITLE_LABEL_HEIGHT fixed for DOT-emission+ensureMinWidth (jar-exact, byte-verified), NEW 8px shadow-graph gap named+deferred; census 41/355 unchanged (identity-verified), ratchet 35->41 (parity.json staleness resolved); full 314-fixture accounting table refreshed; 0 tripwire regressions, DOT gate frozen exact; see ledger.md J3 |

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

## Mission-closing summary (J3, 2026-07-15)

**Tasks completed vs planned:** 3/3 planned iterations complete (J1
mechanism C, J2 mechanism B, J3 re-measure + accounting). J3's own scope
(4 tasks: TITLE_LABEL_HEIGHT drill, `--families` re-attribution, ratchet
pass, closing summary) — all 4 done.

**Census trajectory:** 30 -> 41 -> 41 -> 41 (baseline -> J1 -> J2 -> J3).
J1 closed 11 fixtures via the general ink-extent-margin walk; J2/J3 held
the set exactly steady (identity-verified every iteration — same 41
slugs, not just the same count) while improving diff MAGNITUDE on
several non-conformant fixtures (J2: gafegu-06/gocexi-61/rapaji-98/
bujige-52 moved 31+ -> 11-30 bucket; J3: DOT-emission byte-parity
improved for the same 4, invisible to the SVG-diff census but real for
`dot-sync-report.ts`).

**Ratchet:** 26 -> 35 -> 35 -> 41 (baseline -> J1 -> J2 -> J3). J1
backfilled 9 of its 11 new zero-diff fixtures (2 excluded by the
then-stale `parity.json`). J3 resolved that staleness (regenerated via
`npm run svg:survey`, the "one-line refresh" the mission authorized
attempting here) and backfilled the remaining 6 (the 2 J1 excluded plus
4 more that had accumulated the same staleness class since). Every one
of the 41 is AC1(zero-diff)+AC2(present)+AC3(dotEqual) verified by
`description.golden.ratchet.test.ts` itself (44/44 passing), not just
documented.

**Decisions made:** 5 logged in decision-journal.md this iteration (2 for
the TITLE_LABEL_HEIGHT drill — the jar-derivation-vs-J2's-curve-fit
finding, and the deliberate NON-fix of the shadow-graph anchor; 1 for the
parity.json regeneration; the remaining 2 are folded into those same
entries' "why" columns per the table's format). 0 flagged for review — all
were within the mission's own explicit authorization (drill+fix-if-quick-
win, try-parity-regen-if-one-line).

**What re-attributed where:**
- J1's 5 "mechanism-B regression" fixtures: 1 (`fopako-15-labi027`)
  confirmed genuinely mechanism-B mixed-children; 4
  (`duvoru-86-lubo341`/`gabogi-09-zoda184`/`mekimu-46-luzu886`/
  `xirika-05-beju263`) re-attributed by J2 to mechanism C's unclosed
  ellipse/interface ink-offset sub-case.
- `kanute-77-lacu414`: confirmed by J2 structurally unreachable by
  mechanism B (empty package demoted to a leaf before `Cluster`/
  `manageEntryExitPoint` ever runs) — split into its own named row
  ("empty-group/package leaf sizing") in J3's accounting table rather
  than staying folded into I10's demoted-empty-package-bold row.
- 4 of J2's pure-port-only fixtures (`gafegu-06`/`gocexi-61`/`rapaji-98`/
  `bujige-52`) gained a NEW named blocker this iteration: the
  `frontier-shadow-layout.ts` 8px structural gap (not previously named —
  J2's own "17" constant was silently absorbing it without the gap being
  identified as a distinct mechanism).
- ~209 fixtures across 15+ small, already-diagnosed I10 mechanisms
  (color, chrome, creole, uid-order, sprite subsystems, etc.) carried
  over UNCHANGED in count — confirmed untouched by J1/J2/J3 (none of
  those mechanisms overlap the ink-extent-margin / FrontierCalculator
  domain this mission scoped).
- The two large I10 "geometry-cascade" rows (81+23=104) plus the 4-count
  mechanism-B row and the 8-count triage queue (116 total) shrank to 105
  non-conformant after J1's 11 zero-diff closures, then were
  RE-DISTRIBUTED by J3's mechanical re-classification (dominant diff-path
  signature, not hand-verified per-fixture like I10's original pass) into
  181 (geometry-cascade)/73 (childCount)/23 (color)/9/8/4/4/3/3/2/1/1/1/1
  — see the explicit caveat in ledger.md § J3 on why this redistribution
  reflects a coarser (but honestly-disclosed) methodology than I10's.

**Quality gate results (final):** `npm test -- --run` 315/315 test files,
8494/8494 tests, coverage 98.38%/94.59%/98.46%/98.38% (well above the
90/90/90 floor); `npm run typecheck` clean; `npm run lint` clean;
`npm run build` clean; `dot-sync-report.ts` frozen EXACT — component
262/262, usecase 90/90, class 708/708, object 78/80, state 267/267.

**Remaining top mechanisms in reach-descending order** (feeds G1c/E2r/G1d
and the I5g backlog):
1. Geometry-cascade, dominant-signature-only (181, needs an I10-style
   dedicated per-fixture re-derivation to split cleanly into its true
   constituent mechanisms — likely still dominated by mechanism C's
   remaining reach plus I1/I3/I4c/I5g fixtures now presenting
   geometry-dominant post-cascade).
2. I5g `[childCount]`-dominant structural gaps (73).
3. I2 named-CSS-color->hex table (T19) (23).
4. I10 demoted-empty-package/folder bold-title gap (9).
5. I10 triage queue, secondary residuals not drilled (8).
6. `frontier-shadow-layout.ts`'s NEW 8px structural gap (4 direct,
   blocks the shadow-graph anchor from ever using jar-exact dims) —
   HIGH-VALUE target: closing it would let `measureTitleLabel` (already
   correct) feed the shadow graph directly, likely closing several of
   the pure-port-only fixtures to zero-diff.
7. Mechanism C's ellipse/interface ink-offset sub-case (4) — the ORIGINAL
   unclosed sub-question from J1's own doc comment, still open.
8. Mechanism B mixed-children (3) — needs a jar-verified closed formula
   for `insides`-non-empty's `initial`, or evidence it barely matters.

**Known issues / follow-ups:** the 500-line/CCN complexity-cap violations
in `layout.ts`/`layout-geo-post.ts` flagged by J1/J2 remain unaddressed
(pre-existing, "don't refactor while porting" — logged for a dedicated
cleanup iteration, unchanged this iteration). The J3 accounting table's
large dominant-signature buckets (181/73/23) are a coarser methodology
than I10's hand-verified original and should be treated as a STARTING
point for the next drilling iteration, not a final diagnosis.

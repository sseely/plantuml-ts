# G5 ledger

## C0 — harness stand-up, corpus-wide characterization, jar-verified
## diagnosis (mechanism found: caller font-size bug, NOT a measurer defect)
## -- 0 fixtures changed (no in-scope fix exists), gates verified unchanged

### Harness

`scripts/measurer-calibration-report.ts` (new). Walks every cached golden
`in.svg` under `test-results/dot-cache/<type>/<slug>/` for all seven
corpus types (`component usecase class object state dot json`), extracts
every `<text textLength="...">` element (jar's own measured width for
exactly that string at exactly that font — captured under
`-DPLANTUML_DETERMINISTIC_TEXT=true`, per `src/core/measurer-
deterministic.ts`'s own doc comment), and measures the SAME string at the
SAME font attrs through `WidthTableMeasurer` (the `DeterministicMeasurer`
re-export, used by every conformance/ratchet script), `jarMeasurer`
(production's D12 AWT table), and `FormulaMeasurer` (the
`StringBounderFixed` approximation). Buckets % error by
`type|size|weight|style`; prints top-N worst individual samples per
measurer.

**Scope exclusions found and applied** (both discovered by investigating
this script's own first-run "worst sample" output, not assumed up front):

- `elk-layout` (79 samples, 8 fixtures): any fixture whose `in.puml`
  contains `!pragma layout elk` routes through
  `CucaDiagramFileMakerElk.java` — an entirely separate upstream layout
  engine from the svek/graphviz pipeline this port implements. Found by
  tracing `component/dirofi-81-cuga514`'s outlier `"E"` sample
  (`textLength=7.5879` vs the other 23 corpus occurrences of the same
  string/size/weight, all `9.3625`) back to its `in.puml`'s first line.
- `json-diagram` (102 samples, 5 fixtures): `@startjson` diagrams render
  synthetic placeholder/summary text through the JSON engine's own sizing
  path, not the shared svek pipeline (e.g. `"{ ... }"` is a literal
  collapsed-value placeholder the renderer emits, not user content).

### Part A result: the measurer is jar-exact

After excluding the two out-of-scope classes, 13,564 in-scope
`font-family="sans-serif"` samples remain. `WidthTableMeasurer`'s error
across essentially the ENTIRE corpus is **0.000% mean / ≤0.001% max**
(floating-point rounding only) — see every bucket in
`plans/g5-measurer-calibration/README.md`'s referenced report run; full
raw output is reproducible via `npx tsx scripts/measurer-calibration-
report.ts`. Two residual clusters remain, both narrow and NOT connected to
the S13 founding evidence's mechanism:

- `component | size=14 | weight={normal,bold}` (mean 3.77% / 0.35%): 1392
  of these samples come from ONE fixture, `component/gutute-00-gaki684`
  (a `!pragma svek_trace on` stress-test, 9075px tall, deeply nested
  `protocol X { C1 C2 ... }` port declarations) — a small, growing-with-
  string-length divergence (`"C1"` -3.25%, `"C10"` -6.08%) for PORT
  labels specifically. Ruled out: SVG-level `transform`/`scale` (0 matches
  in the file); the `svek_trace` pragma itself (`grep -rn svek_trace
  ~/git/plantuml/src/main/java/net/` — ZERO matches in current upstream
  source, so the pragma is unrecognized/no-op and cannot be the
  mechanism). NOT root-caused further this iteration — see README's "Next
  iteration" item 3.
- Two single-sample anomalies (`component/kokebo-27-vafi688`'s `"b"`
  after a `remove $a` directive; `component/zosuje-43-zebi775`'s
  `"±5px..."` containing a Latin-1 Supplement codepoint) — each 1 sample
  in a 265-fixture corpus, not investigated further (below the mission's
  evidence bar for a dedicated diagnosis).

`jarMeasurer` (production's D12 AWT table) shows the LARGE, EXPECTED,
pre-existing "apples to oranges" gap against the deterministic-mode
oracle (mean errors up to 27% per bucket, worst single sample 199%,
`class/cotacu-63-jisi866`'s `"PERIOD ... Date"`) — this is the documented
dual-measurer architecture decision (2026-07-10, `measurer-
deterministic.ts`'s own header), not a defect: production never claims to
match the deterministic-mode textLength.

### Part B: call-site font-size audit — the real mechanism

Cannot be derived from the oracle SVGs (they report the jar's OWN
correct font size for whatever text role it is, not what THIS PORT'S
call site chose) — derived by reading every edge/relationship-label
`FontSpec` construction directly and comparing against upstream's
`FontParam` enum (`~/git/plantuml/.../klimt/font/FontParam.java:54`):
`ARROW(13, normal)`, distinct from body/entity-name defaults
(`STATE(14, normal)`, `COMPONENT(14, normal)`, etc.).

| Diagram engine | Call site | Uses | Should use | Status |
| --- | --- | --- | --- | --- |
| state | `state-dot-graph.ts:179` | `theme.fontSize` (14) | 13 | MISMATCH |
| state | `state-composite-pass.ts:244` | `theme.fontSize` (14) | 13 | MISMATCH |
| state | `state-composite-pass.ts:326` | `theme.fontSize` (14) | 13 | MISMATCH (this is the S13 `EvNewValueSaved` call site) |
| state | `state-composite-cluster.ts:36` (`measureClusterTitle`) | `theme.fontSize` (14) | 14 | CORRECT — this is composite TITLE text (body-sized), not an edge label; flagged for verification then confirmed by reading its only caller |
| class/object | `class-dot-graph.ts:298` (`labelFont`) | `theme.fontSize` (14) | 13 | MISMATCH — documented as a KNOWN, deliberately-unfixed gap in `class-layout-helpers.ts:96-100` ("left untouched to avoid ANY risk to the frozen DOT gate") |
| class/object | `class-layout-helpers.ts:102` (`CARDINALITY_FONT_SIZE`) | 13 (constant) | 13 | CORRECT — proves the fix pattern is already established in this SAME file |
| component/usecase | `description/layout.ts:735` (`fontSpec`, LAYOUT-time) | `theme.fontSize` (14) | 13 | MISMATCH |
| component/usecase | `description/renderer-edge.ts:21` (`ARROW_LABEL_FONT_SIZE`, RENDER-time) | 13 (constant) | 13 | CORRECT — comment cites the exact prior fix ("G1 I2 finding: a prior `theme.fontSize - 2` ... diverges from the jar the moment `theme.fontSize` differs from 14") |

### Diagnosis (per diagnosis.md — mechanism, origin, causal chain, ruled out)

**Mechanism.** Five call sites across three diagram engines (state,
class/object, description) construct the `FontSpec` for arrow/transition/
relationship edge-label text using `theme.fontSize` (14, the body/entity-
name default, matching upstream `FontParam.STATE`/`FontParam.COMPONENT`)
instead of upstream's `FontParam.ARROW` default (13). The measurer these
call sites feed (`WidthTableMeasurer`) is not at fault — it returns the
mathematically correct width for whatever `(text, size)` pair it
receives; the bug is that these call sites hand it `size=14` for text the
jar renders at `size=13`.

**Origin.** `src/diagrams/state/state-composite-pass.ts:326` (the exact
S13 `EvNewValueSaved` sample): `const font: FontSpec = { family:
ctx.theme.fontFamily, size: ctx.theme.fontSize };` — `ctx.theme.fontSize`
resolves to `theme.ts:842`'s `fontSize: 14` default. Parallel origins:
`state-dot-graph.ts:179`, `state-composite-pass.ts:244` (state);
`class-dot-graph.ts:298` (class/object, ALREADY flagged as a known,
deliberately-deferred gap in that file's own neighboring comment);
`description/layout.ts:735` (component/usecase, LAYOUT side only — the
RENDER side, `description/renderer-edge.ts:21`, was already fixed for
this exact bug class under an earlier mission, "G1 I2").

**Causal chain.** `WidthTableMeasurer.measure("EvNewValueSaved", {size:
14})` = 120.0500px (jar-verified exact match to S13's own reported
value, confirmed directly: `npx tsx` probe against `src/core/measurer.ts`
gives `111.4750` at `size:13` and `120.0500` at `size:14` — the EXACT two
numbers S13 cited as "ours" (120.05) and "jar's real" (111.475)).
`state-composite-pass.ts:326` feeds `size: theme.fontSize` (14) into
`buildEdgeAttrs` → `state-composite-edge-label.ts#edgeLabelAttrs` →
`measurer.measure(text, font)`, producing the oversized 120.05 width that
then feeds graphviz's own label-reservation/positioning calculation
(`labelWidth` on the DOT edge attribute), shifting `labelX` and
compounding into S13's observed ~10.6px right-edge divergence on the real
rendered label box. The jar itself renders this SAME text at `size=13`
(confirmed directly from `test-results/dot-cache/state/bemena-23-
zebu249/in.svg`: `<text ... font-size="13" ... textLength="111.475"
...>EvNewValueSaved</text>`), matching upstream's `FontParam.ARROW(13,
normal)` default exactly.

**Ruled out** (in order investigated):

1. **Measurer table transcription error** (per-codepoint width values
   wrong in `measurer-width-table.data.ts`) — ruled out by the corpus-wide
   sweep: 13,564 in-scope samples at 0.000% mean error across every
   observed size/weight/style. A transcription error would show up as a
   PERSISTENT per-codepoint bias regardless of context; none was found for
   any codepoint that appears meaningfully often in the corpus.
2. **RLE/fallback decode bug** (the specific defect `measurer-
   deterministic.ts`'s own doc comment records as ALREADY fixed under an
   earlier mission, S1-impl/ADR-001) — ruled out as the CURRENT cause: the
   fix is present in the current `measurer.ts` (`charWidth`'s two fallback
   branches), and this iteration's sweep found no astral-codepoint or
   block-overflow divergence in the corpus.
3. **Weight/style handling in `WidthTableMeasurer`** — considered because
   `WidthTableMeasurer.measure` never reads `font.weight`/`font.style` at
   all (confirmed by reading the class body: only `font.size` is used).
   Ruled out as a defect, not a bug: `StringBounderFromWidthTable`
   (deterministic mode) is genuinely weight/style-INVARIANT in the real
   jar too — confirmed by the corpus-wide sweep showing 0.000% mean error
   for EVERY `weight={normal,bold} × style={normal,italic}` combination
   once `size` is held correct; if the jar's deterministic table varied by
   weight/style, those buckets would show a mismatch and none do.
4. **SVG-level scale/transform corrupting the extracted `textLength`**
   (considered for both the ELK outlier and the `gutute-00-gaki684`
   secondary finding) — ruled out for both: `grep -o 'transform=' /
   scale('` on each fixture's `in.svg` returns zero matches; `viewBox`
   matches `width`/`height` exactly in both cases (no implicit scaling).
5. **`!pragma svek_trace on` as the `gutute-00-gaki684` mechanism** —
   ruled out: `grep -rn svek_trace ~/git/plantuml/src/main/java/net/`
   returns zero matches in current upstream source; the pragma is
   unrecognized (a no-op) and cannot be causing a rendering-path
   difference. The TRUE mechanism for that fixture's small, real, port-
   label-specific divergence is UNRESOLVED (see README's "Next iteration"
   item 3) — not chased further, low corpus impact (1/265 component
   fixtures), unrelated to the S13 mechanism.

### Fixture impact

**0 fixtures changed.** No fix landed — no in-scope fix exists (see
"Calibrate" below). `oracle/goldens/svg-*/**` untouched; `oracle/goldens/
state/size-backlog.json` untouched (103 entries, unchanged); `tests/
oracle/svg-conformance/parity-*.json` untouched (no `svg-parity-
survey.ts` regen run — nothing to regenerate against, since no measurer
or layout code changed).

### Calibrate — no in-scope fix exists (scope conflict, logged per
### autonomous-execution.md STOP condition)

Task 3 ("land fixes TDD-first for each bounded mechanism") presupposed a
MEASURER defect. Part A conclusively shows there is none: `WidthTable
Measurer` is jar-exact. The actual mechanism (Part B) is a wrong
`FontSpec.size` at FIVE call sites in `src/diagrams/state/*.ts`,
`src/diagrams/class/class-dot-graph.ts`, and
`src/diagrams/description/layout.ts` — all outside this iteration's
write-set (`src/core/** measurer/font-metrics modules only`). Per
`~/.claude/rules/autonomous-execution.md`'s STOP conditions ("A task
requires modifying files outside its declared write-set AND those files
aren't in any other task's write-set either"), C0 made ZERO changes to
any `src/` file this iteration. See `decision-journal.md` for the logged
decision and README's "Next iteration" section for the recommended fix
(a constant matching the ALREADY-PROVEN-SAFE `CARDINALITY_FONT_SIZE` /
`ARROW_LABEL_FONT_SIZE` pattern already present twice in this codebase).

### Gates (C0, verified before AND after — identical, since 0 `src/`
### files were touched)

- `npm run typecheck`: clean (both configs).
- `npm run lint`: clean.
- `npm test -- --run`: **10128/10128** passing (377 files).
- DOT gate: `component 262/262 - usecase 90/90 - class 708/708 - object
  78/80 - state 267/267` — unchanged from the mission brief's stated
  frozen baseline.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268**.
- `description.golden.ratchet.test.ts`: **51 tests**.
- `class.golden.ratchet.test.ts`: **305 tests**.
- `object.golden.ratchet.test.ts`: **24 tests**.
- `state.golden.ratchet.test.ts`: **54 tests**.
- Censuses: description (no-arg) **48/355**, class **303/718**, object
  **22/80**, state **52/271** — all match the mission brief's stated
  baseline exactly.
- `oracle/goldens/state/size-backlog.json`: **103 entries**, byte-for-byte
  unchanged (`git status --short` confirms — only `scripts/measurer-
  calibration-report.ts` is new/untracked).

### Ratchet / pins

**0 new pins.** No fixture reached zero-diff-and-dotEqual this iteration
(no code changed that could move any fixture).

### C1+ queue

See README's "Next iteration — recommended scope" (three items: primary
font-size fix requiring write-set expansion; re-attempt readiness for the
parked edge-label-ink mechanism once the fix lands; the unresolved
secondary `gutute-00-gaki684` port-label finding).

## C1 — landed 3 of 5 sites (state flat, class), reverted 2 (state
## composite) after a jar-verified size-backlog regression traced to an
## ALREADY-NAMED, pre-existing gap in a different file -- 4 diagram
## engines re-verified stable, 0 census/ratchet movement, edge-label-ink
## re-attempt assessment: STILL BLOCKED, third prerequisite identified

### Per-site landing record

| # | Site | Upstream verification | TDD test (jar-anchored) | Gate result | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | `state-dot-graph.ts:179` (flat `buildDotEdges`) | `FontParam.ARROW(13)`; no `ArrowFontSize` override path exists in this port | `tests/unit/state/state-dot-graph.test.ts` — `buniva-95-zije634` `"xxx"`, jar textLength 19.5px @ size 13 | DOT gate unchanged (262/90/708/78/267); `state-dot-parity.test.ts` 268/268 unaffected (flat pipeline never touches the size-backlog corpus, all composite) | **LANDED** |
| 2 | `state-composite-pass.ts:244` (`addLevelEdges`) | Same `FontParam.ARROW(13)`; S13 founding-evidence call site (`bemena-23-zebu249`'s `EvNewValueSaved`) | `tests/unit/state/state-composite-pass.test.ts` — `nimana-36-veco708` top-level `"go to yes"`/`"go to no"` (45.5/42.79px @ 13) + `bemena-23-zebu249` `"EvNewValueSaved"` (111.475px @ 13, exact S13 sample) | DOT gate unchanged; **`state-dot-parity.test.ts` regressed 268→252 (16 failures)** | **REVERTED** (see finding below) |
| 3 | `state-composite-pass.ts:326` (`sweepOrphanEdges`) | Same `FontParam.ARROW(13)` | Same test file — `nimana-36-veco708` orphan-pool `"go to yes-yes"`/`"go to yes-no"` (70.0375/64.2688px @ 13) | DOT gate unchanged; **`state-dot-parity.test.ts` regressed 268→267 (1 additional failure, `nimana-36-veco708` itself)** | **REVERTED** (see finding below) |
| 4 | `class-dot-graph.ts:298` (`labelFont` → `edgeLabelAttrs`) | Same `FontParam.ARROW(13)`; already flagged in `class-layout-helpers.ts:96-100`'s own comment as a known, deliberately-deferred gap | `tests/unit/class/class-dot-graph.test.ts` — `bejusa-95-gafo325` `"contains"` relationship label, jar textLength 48.425px @ size 13 | DOT gate unchanged; `class-dot-parity.test.ts`/`object-dot-parity.test.ts` both 100% clean (site 4 alone: 794/794) | **LANDED** |
| 5 | `description/layout.ts:735` (`fontSpec`, layout-time) | Same `FontParam.ARROW(13)`; **C0's Part B table was materially incomplete for this site** — see decision 4 | `tests/unit/description/layout-dot-tree.test.ts` — `babafi-51-dixi026` `"use"` link label, jar textLength 20.9625px @ size 13, plus a NODE-measurement regression guard (`"b"`'s body text stays at size 14) | DOT gate unchanged (component 262/262, usecase 90/90); full `npm test -- --run` green | **LANDED** |

### Site 5's real shape — not a simple constant swap

C0's Part B audit described `description/layout.ts:735`'s `fontSpec` as if
it were purely an edge-label site, mirroring the other four. Reading
`runLayout`'s full call graph (`buildDotEdges`, `buildDotNodes`,
`buildPortClusterInfoByAstId`, `computeGraphSpacing`, all sharing the ONE
`fontSpec` param) before editing found this is FALSE: the same `FontSpec`
object feeds node/title/leaf measurement too. Naively swapping it to size
13 would have narrowed every entity/title in every component/usecase
diagram — a correctness regression the mission's protection protocol
exists to prevent, caught by inspection rather than by a failing gate. The
actual fix threads a SEPARATE `edgeFontSpec` (13) into `runLayout`, applied
ONLY at the two edge-label-consuming calls (`buildDotEdges`,
`computeGraphSpacing`); `fontSpec` (14) is untouched everywhere else,
including `degenerateSingleLeaf` (verified out of scope: it early-returns
whenever `ast.links.length !== 0`, so it never measures an edge label).

### Mechanical prerequisite: `description/layout.ts` 500-line split

`description/layout.ts` was 793 lines (over the hook's 500-line cap) BEFORE
any C1 edit — the hook blocks any edit to an over-cap file regardless of
size. Split into `layout.ts` (452 lines) + new `layout-dot-tree.ts` (429
lines) as a PURE MOVE (Phase 2 "DotInputGraph construction" +
Phase 3 "geo tree construction" — `computePortRanksByCluster`,
`buildPortNode`, `buildAnchorNode`, `buildDotNodes`, `buildDotClusters`,
`buildDotEdges`, `applyPortLabelPositions`, `buildGeoNode`, `buildGeoTree`),
mirroring the established split precedent (`svg.ts`→`svg-markers.ts`).
Re-verified zero behavior change BEFORE layering the actual font-size fix
on top (DOT gate, full `description`/`class`/`object` test suites,
`class-dot-parity.test.ts`/`object-dot-parity.test.ts` all unchanged) — this
isolated "did the split break anything" from "did the fix break anything"
as two independently-verified questions.

### Finding: sites 2/3 regress the size-backlog ratchet — root cause
### identified, NOT a defect in the font-size fix itself

After landing all five sites and running the full battery (not just the
DOT gate), `tests/oracle/state-dot-parity.test.ts` showed 17 new failures
(268→251 passing) — every failure a `maxSizeDeltaIn` (node-size drift,
inches) exceeding its pinned `oracle/goldens/state/size-backlog.json`
tolerance. Bisected per diagnosis.md, one site at a time, via `git show
HEAD:<path> > <path>` A/B (never `git checkout`/`reset`):

- Site 1 alone: 268/268 (0 impact — the flat pipeline never touches a
  composite fixture, and none of the 268 ratchet fixtures are flat-only).
- Site 2 alone: 252/268 (16 failures — `bemena-23-zebu249`,
  `bunade-42-fudu910`, `dulixa-11-kufe247`, `fojisi-40-zogo372`,
  `fomusu-59-fupe538`, `jorere-75-peja265`, `kejabo-83-vinu490`,
  `ketibo-84-juzo029`, `kujaju-47-neku764`, `mosigo-88-rove013`,
  `nimise-04-jove070`, `nuboca-13-xape657`, `pajefo-95-neri955`,
  `xepafa-33-lazi826`, `zacajo-09-tamu628`, `zitifa-97-bizo337`).
- Site 3 alone: 267/268 (1 failure — `nimana-36-veco708` only).
- Site 4 alone: 268/268 (0 impact; `class-dot-parity.test.ts`/
  `object-dot-parity.test.ts` both 794/794).

**Mechanism (per diagnosis.md — cause, origin, causal chain, ruled out).**

*Cause.* `bemena-23-zebu249`'s `Configuring` composite is laid out in its
own autonom pass (`svek-1`) then re-enters the parent pass (`svek-2`) as a
single flattened `DotInputNode` whose width is jar-verified from the parent
pass's own `node[id=Configuring]` DOT attribute: real width 392.335px
(5.449097in). Direct probe (`renderSync` + `setLayoutInputObserver`,
`Configuring`'s width in the captured `svek-2` graph):

| | Configuring width (px) | delta from jar (392.335) |
| --- | --- | --- |
| jar real | 392.335 | — |
| pre-C1 (font 14, wrong) | 377.537 | -14.798 (-3.77%) |
| post-C1 sites 2/3 (font 13, jar-exact) | 373.249 | **-19.086 (-4.87%, WORSE)** |

The font-size fix makes the SOURCE label measurement more accurate
(111.475px, exact) but makes the DOWNSTREAM composite-width symptom worse,
not better.

*Origin.* `src/diagrams/state/state-composite-autonom.ts
#buildPlainAutonomSpec`:
```
const childImg = {
  width: Math.max(geometry.width, result.width),
  height: Math.max(geometry.height, result.height),
};
```
This function's OWN doc comment (from an earlier mission, unchanged since)
already names this exact gap as "NOT FULLY CLOSED this iteration... needs
edge-LABEL ink... folded in to reach jar's real size... Queued for S5" —
`geometry.width` (`computeSvekResultGeometry`'s ink-extent walk) does NOT
include edge-label ink at all (per that same comment: "`TransitionGeo.label`
does not carry" the measured width); `result.width` is the raw
`layoutGraph()` canvas width from `svek-1`'s own graphviz solve, which
DOES respond to label width (wider label → wider nodesep/rank spacing →
wider canvas) but only as an ACCIDENTAL side effect, not a deliberate ink
computation.

*Causal chain.* Before C1, `result.width` was inflated by the wrong
(14pt, too-wide) label measurement, which happened to push it CLOSER to
jar's real 392.335px (masking the floor formula's real inadequacy). After
C1's jar-correct 13pt measurement, `result.width` shrinks to its
legitimately-smaller graphviz-computed value — and since `geometry.width`
never included label ink to begin with, `Math.max(geometry.width,
result.width)` now returns a number FURTHER from jar's real value than
before, because the ONE thing that happened to look right (the accidentally
oversized canvas) is no longer accidentally oversized.

*Ruled out.*
1. **A defect in the font-size fix itself** — ruled out: the TDD tests for
   sites 2/3 assert `labelWidth` against jar's own `<text textLength>`
   values directly (e.g. `EvNewValueSaved` = 111.475px, byte-exact to
   jar's SVG) and pass; the measurer/caller-size pairing is provably
   correct.
2. **A NEW defect introduced by this iteration** — ruled out: EVERY one
   of the 16-17 regressed fixtures ALREADY carried a nonzero
   `size-backlog.json` entry before C1 touched anything (e.g. `bemena`:
   0.2312719999999997, pre-existing). A fixture with zero pre-existing
   size gap cannot be pushed over a zero tolerance by this class of
   change without the DOT gate ALSO moving (it did not, for any of the
   four types, at any site).
3. **`class-dot-graph.ts` (site 4) or the flat pipeline (site 1)
   contributing to any state-composite fixture's drift** — ruled out by
   the bisection table above (both independently 268/268/0-impact).

### Edge-label-ink re-attemptability assessment (RECOMMENDATION ONLY —
### not implemented; per task instructions, a re-attempt is a separate
### iteration needing orchestrator+maintainer sign-off, the mission's own
### 3-strike rule, since G4 S4/S12/S13 already spent three)

Re-derived the `bemena-23-zebu249`/`"EvNewValueSaved"` arithmetic with C1's
jar-exact size-13 measurement, against G4 S13's own closing analysis
(`plans/g4-state-svg/ledger.md` §S13, "Root cause of the formula
instability"):

**S13 named TWO independent, compounding gaps** for the edge-label-ink
mechanism: (1) a label-PLACEMENT divergence (jar's real `SvekEdge.java`
label position is not simply "centered on graphviz's own virtual
label-node position" — S13's own evidence: left edges nearly agree,
2.05px apart; right edges diverge 10.63px, "a WIDTH-scaling divergence");
(2) the text-measurement calibration gap this G5 mission exists to close
(120.05px measured vs jar's real 111.475px, a ~7% overestimate). S13's own
conclusion: "(b) first closing the text-measurement calibration gap...
[is] prerequisite work" for a fourth attempt at (a).

**C1 closes gap (2) and confirms it was correctly diagnosed** — the
measurer was never the defect; the caller-side font size was, and it is
now jar-exact at every one of the five call sites (three landed, two
proven-correct-but-reverted). Naive expectation: closing (2) alone should
shrink the residual toward gap (1)'s smaller, standalone ~2px-scale
placement error.

**That expectation does NOT hold, because a THIRD, previously-uncounted
gap dominates.** C1's own size-backlog bisection (above) proves that
closing gap (2) in isolation, on THIS exact fixture (`bemena-23-zebu249`,
the S13 founding sample), makes the OBSERVABLE symptom (composite width)
WORSE, not better — because `state-composite-autonom.ts`'s `Math.max
(geometry.width, result.width)` floor formula (gap 3, already named
"Queued for S5" in that file's own doc comment, predating this mission)
was ACCIDENTALLY partially compensated by gap (2)'s own inflation. This
means S13's "two independent, compounding gaps" framing under-counts by
one: it is a THREE-variable problem (measurement × ink-folding ×
placement), and gap (2)'s closure does not net-improve the residual until
gap (3) is ALSO closed, because gaps (2) and (3) were CANCELING, not
purely compounding, on this specific fixture family.

**Recommendation: still blocked; do NOT re-attempt (a)/(1) yet.** The
correct next step is a fourth, narrower iteration scoped EXACTLY to
`state-composite-autonom.ts#buildPlainAutonomSpec`'s "Queued for S5" item —
replace the `Math.max(geometry.width, result.width)` floor with a formula
that correctly folds edge-label ink into `geometry.width` (jar-verified
per fixture, TDD-first, same discipline as G4 S12/S13's own attempts) —
BEFORE landing G5's sites 2/3 (this iteration's reverted state-composite
font-size fix) or re-attempting G4's label-placement formula (S11-S13's
mechanism). Once gap (3) closes: (a) sites 2/3 should land cleanly (their
TDD tests, `describe.skip`'d in `tests/unit/state/state-composite-pass.
test.ts`, are ready to re-enable verbatim), and (b) the edge-label-ink
mechanism's remaining residual should be JUST gap (1) — S13's own
~2px-scale, single-variable label-placement divergence — a materially
smaller and more tractable problem than the current three-variable tangle
three prior attempts (S4/S12/S13) never isolated cleanly enough to solve.
Sign-off note: G4 S13 explicitly framed itself as "the mission's THIRD
independent attempt" at this mechanism — per this project's own
3-strike discipline, a fourth attempt (even the narrower, better-scoped
one recommended here) needs orchestrator/maintainer sign-off before
starting, not a unilateral C2 decision.

### Fixture impact

0 oracle fixtures changed (`oracle/goldens/**` untouched — no fixture
newly reached zero-diff-and-dotEqual this iteration; all four censuses
verified byte-identical to the C0/mission-brief baseline: description
(no-arg) 48/355, class 303/718, object 22/80, state 52/271). `oracle/
goldens/state/size-backlog.json`: **untouched, 103 entries** (the
would-be-tightened sites 2/3 were reverted before any tighten could be
recorded; nothing to tighten from sites 1/4/5, which don't touch any
size-backlog-listed fixture).

### Gates (C1, final state — sites 1, 4, 5 landed; sites 2, 3 reverted)

- `npm run typecheck`: clean (both configs).
- `npm run lint`: clean.
- `npm test -- --run`: **10134 passed | 5 skipped** (381 files, 380
  passed + 1 file whose 5 tests are all `describe.skip`'d — the reverted
  sites 2/3 evidence, preserved for C2).
- DOT gate: `component 262/262 - usecase 90/90 - class 708/708 - object
  78/80 - state 267/267` — unchanged from the mission brief's frozen
  baseline, at every intermediate site landing AND in the final state.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268** (after
  reverting sites 2/3; regressed to 251/268 with all five sites landed,
  see finding above).
- `description.golden.ratchet.test.ts`: **51 tests** (unchanged).
- `class.golden.ratchet.test.ts`: **305 tests** (unchanged).
- `object.golden.ratchet.test.ts`: **24 tests** (unchanged).
- `state.golden.ratchet.test.ts`: **54 tests** (unchanged).
- Censuses: description (no-arg) **48/355**, class **303/718**, object
  **22/80**, state **52/271** — all byte-identical to the mission-brief
  baseline (no fixture newly hit zero-diff for the DeterministicMeasurer
  ratchet metric from this iteration's site-1/4/5 changes).
- `measurer-calibration-report.ts` re-run: Part A (corpus-wide numeric
  measurement) unchanged from C0 — 0.000% mean error, unaffected by C1
  (C1 changed caller font-size choices, not the measurer). Part B (the
  static, source-derived call-site table baked into the script at C0
  authoring time) is NOT a live scanner — it still prints the C0-era
  MISMATCH rows verbatim for all five sites regardless of C1's actual
  landings; the TRUE after-state is: sites 1/4/5 CORRECT (13, landed),
  sites 2/3 STILL MISMATCH on disk (14, reverted) pending C2's
  `state-composite-autonom.ts` prerequisite fix.

### Ratchet / pins

**0 new pins.** No fixture newly reached zero-diff-and-dotEqual this
iteration for any of the four `golden.ratchet.test.ts` suites (all four
counts unchanged from baseline — see Gates above). This is expected: the
five sites correct EDGE-LABEL font size specifically, a narrow slice of
overall SVG rendering, and the deterministic byte-exact ratchet bar is
considerably higher than DOT structural equality.

### Baseline discrepancy noted, not chased (out of scope)

C1's very first `npm test -- --run` (before any edit) reported
**10130/10130** passing, not the mission brief's stated C0 baseline of
10128/10128 — a 2-test delta with zero `src/` changes on disk (`git
status --short` clean at that point). Not investigated further: likely a
test-count driven by `test-results/dot-cache`/corpus directory contents
(explicitly "ground truth," per the mission's hard boundaries, not
something this iteration modifies or reverts), not a code regression;
unrelated to this iteration's actual deliverable. Logged here per
`~/.claude/rules/memory.md`'s observation-recording discipline, not
chased further (diminishing returns, matches C0's own precedent of
logging-not-chasing the `gutute-00-gaki684` secondary finding).

### C2+ queue

1. **Priority, well-scoped, jar-verifiable in isolation**:
   `state-composite-autonom.ts#buildPlainAutonomSpec`'s `childImg =
   Math.max(geometry.width, result.width)` floor — replace with a formula
   that folds edge-label ink into `geometry.width` (the "Queued for S5"
   item, predating this mission, now proven to ALSO block G5's own
   sites 2/3, not just G4's edge-label-ink mechanism). Re-enable
   `tests/unit/state/state-composite-pass.test.ts`'s five `describe.skip`
   blocks (currently jar-verified-correct, RED against reverted source)
   as the TDD anchor once this lands; re-run the FULL size-backlog ratchet
   as the primary gate (not just the DOT gate, per this iteration's own
   lesson).
2. **After (1) lands**: re-land G5 sites 2/3 verbatim (the font-size
   fix is already correct and tested; only the composite-bbox
   prerequisite was missing).
3. **After (1) AND (2) land**: the edge-label-ink mechanism (G4
   S11-S13) becomes re-attemptable for a FOURTH time (orchestrator/
   maintainer sign-off required, 3-strike rule) with TWO of its THREE
   compounding gaps closed — expected residual is S13's own smaller,
   single-variable label-placement divergence (~2px-scale on the left
   edge, per S13's own evidence), not the current three-variable tangle.
4. **Unchanged from C0**: the secondary `gutute-00-gaki684` (component
   port-label divergence) finding remains unresolved, low priority,
   unrelated to this mechanism.

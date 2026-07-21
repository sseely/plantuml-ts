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

## C2 — landed the cluster-geometry seam (`DotLayoutResult.clusters`,
## graphviz-ts 0.1.26072115), TDD-tested and additive; deep jar-verified
## diagnosis of mechanism 16's render half (BLOCKED on a graphviz-ts
## builder-API gap, filed as issue 07); confirmed sites 2/3 blocked for a
## DIFFERENT, more precise reason than the C1 queue's own hypothesis --
## 0 state/ files touched, all protected sets unchanged

### Chunk 1 — `layoutGraph()` exposes real per-cluster geometry (LANDED)

`docs/graphviz-issues/06-cluster-bbox-not-in-getlayout.md`'s RESOLVED note
(graphviz-ts 0.1.26072115, repo bump already landed as this iteration's
HEAD commit) confirmed `getLayout()`'s snapshot now carries a `clusters`
array (`name`/`x`/`y`/`width`/`height`, byte-matching real `dot -Tsvg`
cluster polygons). This chunk threads that into the public seam:

- `graph-layout-build.ts#addClusters` now returns a `ClusterIndex`
  (`idByName: Map<graphviz-ts's own 'cluster<N>' name, our
  DotInputCluster.id>`), built alongside the existing name-assignment loop
  (zero behavior change to the DOT emitted to graphviz-ts — same names,
  same nesting, same node membership).
- `graph-layout.types.ts#DotLayoutResult` gains an optional `clusters`
  field, keyed by `DotInputCluster.id` (NOT graphviz-ts's internal name —
  callers never need to know that naming scheme).
- `graph-layout.ts#layoutGraph` maps `snap.clusters` through the
  `ClusterIndex` (new `mapClusters` helper) and threads the result through
  `shiftToOrigin` (extended to accept an optional `clusters` param) so
  cluster boxes ride the SAME node/edge-derived origin translation.

**Deliberate design choice — clusters do NOT participate in DERIVING the
origin shift, only in RECEIVING it.** `shiftToOrigin`'s `minX`/`minY` are
still computed from nodes/edges alone, exactly as before this chunk. This
was verified necessary, not just convenient: graphviz's own default
cluster margin (confirmed 8pt via direct probe) means a cluster box
legitimately extends BEYOND its topmost/leftmost member node, so if
clusters participated in deriving the shift, EVERY existing
cluster-bearing caller (state composites, class namespaces) would see its
node/edge positions shift by that margin — a real regression risk for
zero benefit. Verified empirically (pinned test, exact values): for a
2-node TB cluster, nodes stay at `(0,0)`/`(0,72)` (byte-identical to
pre-chunk-1 behavior) while the cluster box lands at `(-8,-8)`,
`88×124` — a legitimate negative coordinate in the SAME frame, not a bug.

**TDD**: 4 new tests in `tests/unit/core/graph-layout.test.ts`
(`layoutGraph — cluster geometry (G5 C2, mechanism 16)`): no-clusters
omits the field; single cluster's bbox strictly contains its member node;
nested clusters (outer contains inner, both entries present, keyed by
input id); the pinned-exact origin-shift-sharing test above. All RED
before the implementation (`Target cannot be null or undefined` /
`Cannot read properties of undefined`), GREEN after.

**Additive, verified**: `addClusters`'s only production call site
(`graph-layout.ts`) is unchanged in what it feeds graphviz-ts (same
subgraph names/nesting/membership) — only its RETURN VALUE changed shape
(`void` → `ClusterIndex`). No existing consumer reads
`DotLayoutResult.clusters` yet, so this is provably a no-op for every
current caller (state composite pipeline, class namespace clusters,
description package clusters) until a consumer is written. DOT gate,
size-backlog ratchet, all four golden ratchets, and all four censuses
re-verified byte-identical BEFORE any chunk-2 investigation began (see
Gates below) — confirms the "additive" claim held, not just assumed.

### Chunk 2 — mechanism 16 (entity-vs-cluster wrap): deep diagnosis,
### NOT landed this iteration -- render half BLOCKED on a graphviz-ts
### builder-API gap (filed, docs/graphviz-issues/07)

Per diagnosis.md discipline: instrumented before hypothesizing, at every
step, against BOTH the real jar (`oracle/dist/plantuml-oracle.jar`,
`-DPLANTUML_DETERMINISTIC_TEXT=true`, the SAME invocation
`dot-sync-report.ts` uses to build the cached corpus) and this port's own
`layoutGraph()` seam directly (throwaway `scripts/_tmp-c2-*` probes,
deleted before finishing, per the mission's hard boundaries).

**Mechanism 16 is TWO independently-gated problems, not one**, confirmed
by reading `state-composite-geo.ts#materializeCluster` (the size half) and
`renderer-composite-box.ts#renderComposite` (the shape half) together:

1. **Size** (which this chunk's chunk-1 seam unblocks): `materializeCluster`
   computes the composite's outer box as `boundingBox(children)` — a flat
   12px pad on every side over the children's own (already-correct)
   positions. The ledger's own S1/S3/S6 finding (16px vs 24px side margin,
   19px header height, re-confirmed this iteration on 19 real fixtures —
   see below) already proved this is NOT a derivable constant; it needs
   graphviz's OWN cluster bbox. Chunk 1 makes that bbox available.
2. **Shape** (NOT unblocked by chunk 1): `renderComposite` dispatches
   PURELY on `node.headerLines === undefined` — `materializeCluster` never
   sets `headerLines` (a deliberate, named deferral, per that module's own
   doc comment), so EVERY `'cluster'`-classified composite renders via
   `renderCompositeFallback` (a dashed rect + one unmeasured centered
   label) — NOT jar's real shape (two filled half-rounded `<path>`s, a
   solid outline, ONE divider, a `textLength`-measured centered title —
   confirmed directly from `decede-10-buvu414`'s cached `in.svg`). This is
   a STRUCTURALLY DIFFERENT SVG shape from both (a) the current fallback
   AND (b) `renderCompositeMeasured`'s existing `'autonom'`-composite shape
   (which uses a DIFFERENT header-height formula, `MARGIN(5) +
   lines*fontSize + MARGIN_LINE(5)` = 24 for one line at font 14 — verified
   this IS jar-exact for genuine `'autonom'` composites via a fresh
   `state E { state F }` minimal repro with NO transitions at all,
   `class="entity"`, header gap exactly 24 — but wrong for the `'cluster'`
   path specifically, which is a DOT-native `ClusterDotString` shape, not
   `InnerStateAutonom`).

**Why the shape half is blocked — the real jar mechanism, derived from
source + verified against the real jar + verified against this port's own
seam (three independent confirmations):**

Read `~/git/plantuml/.../svek/ClusterHeader.java` and
`~/git/plantuml/.../svek/ClusterDotString.java:121-133`: every
`'cluster'`-classified composite's DOT `label=` attribute is an HTML
`<TABLE BGCOLOR=".." FIXEDSIZE="TRUE" WIDTH="w" HEIGHT="h">` (built by
`SvekEdge.appendTable`, `h = cluster.getTitleAndAttributeHeight() - 5`) —
a FIXEDSIZE table forces graphviz's own label-reservation to EXACTLY
`w×h`, independent of the actual text drawn inside it (the VISIBLE text is
drawn separately, by jar's own SVG renderer, using jar's own
`WidthTableMeasurer`-equivalent — the HTML table exists ONLY to tell
graphviz how much space to reserve).

Confirmed the CONSTANT this drives, jar-side, on **19 real corpus
fixtures** (well above the mission's own ≥15 hand-sample bar) plus 4
synthetic minimal jar repros (`state E { state F }`, with/without a
cross-boundary transition, 1-char vs 24-char titles) — every single-line
title at the default font-size (14) produces an EXACT, content-width-
independent header gap of **19px** (`cluster.y` to the header/body
divider), confirmed via direct byte extraction from cached `in.svg`:
`bajelo-54-dixe684`, `decede-10-buvu414`, `gojuja-90-pune699`,
`bemena-23-zebu249`, `bujuta-44-rovo666`, `lasasi-13-nona547`,
`soxene-95-domu248`, `nufigo-87-pivi558`, `xojudi-20-keco020`,
`cakaxu-97-nexe753`, `cesifo-37-rugu443`, `cinoni-00-sere847`,
`darime-88-moda428`, `fajegu-17-joba577`, `giniti-22-fexo000`,
`fevida-60-kope208`, `figevo-73-dani805`, `filunu-15-losu567` — 18/19
EXACTLY 19.0px; the 19th (`jaxebo-54-nifi592`, 11.0565px) is fully
explained (not a counterexample) by that fixture's own `scale 350 width`
document-level pragma (`11.0565 / 19 = 0.5819`, matching the required
uniform post-layout scale factor exactly) — confirmed the SAME mechanism
independently on `zoriza-41-rege543` (`scale 1.4`, header gap 26.6 =
`19 * 1.4` exactly).

**The gap**: `graph-layout-build.ts#addClusters` (the programmatic
`GvGraphBuilder.addSubgraph`/`.setAttr` seam `layoutGraph()` actually
calls in production) has no way to construct an HTML label — `attrs.label`
is always treated as a literal DOT string unless prefixed with
graphviz-ts's internal `HTML_STRING_MARK` (a single U+0001 control
character, `common/html-string.d.ts`), which is NOT exported from the
package's public surface (absent from `api/index.d.ts`/`index.d.ts`).
Issue 05 (`docs/graphviz-issues/05-cluster-label-dimensions-ignored.md`)
already confirmed the graphviz-ts LAYOUT ENGINE honors HTML-table labels
correctly once given one — but ONLY demonstrated through DOT-TEXT parsing
(where `label=<...>` is natively recognized), never through the
programmatic builder path this port's `layoutGraph()` exclusively uses.

Verified (throwaway probe, NOT landed in `src/`) that manually
constructing the marker (`String.fromCharCode(1) + '<TABLE
FIXEDSIZE="TRUE" WIDTH=".." HEIGHT="..">...'`) DOES work end-to-end
through the exact programmatic path `graph-layout-build.ts` uses,
producing a clean, PERFECTLY LINEAR relationship between the FIXEDSIZE
`HEIGHT` and the resulting cluster-to-content gap: `gap = HEIGHT + 16`,
confirmed on 15 data points (`HEIGHT` from 1 to 50, both with and without
an outbound edge from the wrapped node) — and `HEIGHT=3` gives `gap=19`,
EXACTLY matching the jar-verified constant above. This is strong evidence
the render-shape fix is mechanically tractable — but it depends on an
UNDOCUMENTED, unexported internal constant, which is a DIFFERENT class of
dependency than this iteration's two pre-sanctioned channels (SVG-text
regex for port labels; the new `clusters` snapshot field for geometry).
Per the mission's own channel-scoping boundary, adopting it needs explicit
sign-off, not a unilateral C2 decision — filed as
`docs/graphviz-issues/07-html-label-mark-not-exported.md` (the ask:
export `HTML_STRING_MARK` or add a builder-level HTML-label convenience)
rather than landed silently.

**NOT closed this iteration, named precisely for the next one:**
1. The WIDTH-side formula (`getTitleAndAttributeWidth()`, presumably this
   port's own already-jar-exact `measureClusterTitle().width` — G5 C0
   already proved `WidthTableMeasurer` is jar-exact for this exact class of
   text sample) and the SIDE/BOTTOM margin formula (already named
   non-constant by S1/S3/S6 — 16px vs 24px, tracks child content shape;
   chunk 1's real bbox is the fix for THIS part specifically, but wasn't
   independently re-verified against the marker-based label technique this
   iteration).
2. Multi-line titles, action-text (`attributeHeight` in
   `ClusterHeader.java`), and stereotype-bearing clusters — the 19px
   constant is verified ONLY for the single-line, no-action-text,
   no-stereotype case (the overwhelming majority of the 92-fixture family,
   but not proven exhaustive).
3. The render SHAPE itself needs a NEW function (jar's real cluster shape
   fills its ENTIRE body area with the background color, unlike
   `renderCompositeMeasured`'s `'autonom'` shape, which leaves everything
   below the header/action-zone transparent so nested children show
   through) — not a reuse of the existing autonom-composite renderer.
4. `getTitleAndAttributeHeight()`'s own value (8, backed out from
   `HEIGHT=3` and the Java formula's `-5`) does NOT match this port's
   current `measureClusterTitle`/`WidthTableMeasurer` convention
   (`height = font.size` = 14 for one line) — a genuine, UNRESOLVED
   discrepancy between this port's text-block HEIGHT convention and jar's
   real `ClusterHeader`/`Display` TextBlock height for this specific
   context. NOT chased further this iteration (would require reading
   jar's `TextBlockUtils`/`Display.create()` height computation in full,
   a nontrivial side investigation of its own) — named for whoever attempts
   the shape fix next, since it blocks a jar-exact WIDTH-independent
   height formula even once the marker-export gap (item above) is
   resolved.

Given (1)-(4) above and the mission's own explicit instruction ("If the
composite rewrite proves deeper than one iteration, land the seam
adoption + whatever is jar-verified, journal the remainder precisely, and
report — do not force"), **no `src/diagrams/state/*.ts` file was touched
this iteration.** Landing a partial fix (real size, wrong shape; or
correct-for-single-line-only shape) risked shipping exactly the
case-by-case-approximation failure mode `CLAUDE.md`'s porting-discipline
section warns against, for a mechanism this project's own `DIVERGENCES.md`
discipline would otherwise flag as "surprising to a long-time PlantUML
user" if shipped wrong.

### Sites 2/3 (G5 C1's own queue item 1): re-examined, CONFIRMED STILL
### BLOCKED — for a more precise reason than the queue's own hypothesis

C1's queue speculated cluster geometry MIGHT unblock
`state-composite-autonom.ts#buildPlainAutonomSpec`'s `Math.max
(geometry.width, result.width)` floor (the prerequisite for re-landing G5
sites 2/3). Checked directly: `bemena-23-zebu249` (the S13/C1 founding
fixture) is `NotShooting { [*] --> Idle; Idle --> Configuring : EvConfig;
Configuring --> Idle : EvConfig }` plus a separately-autonom `Configuring
{ [*] --> NewValueSelection; NewValueSelection --> NewValuePreview :
EvNewValue; ... }` — **`Configuring`'s own child pass contains ZERO
nested clusters** (only leaf states + `[*]` pseudo-nodes). Re-reading
`buildPlainAutonomSpec`'s own ink-extent call
(`computeSvekResultGeometry(inkStates, inkTransitions)`,
`layout-ink-extent.ts`) confirms its gap is EDGE-LABEL ink not folding
into `geometry.width` at all (`TransitionGeo.label does not carry` into
the ink walk — that module's OWN doc comment, unchanged since G4) — a
mechanism with NO dependency on cluster geometry whatsoever for this
fixture family. **Mechanism 16's cluster-bbox work does not unblock sites
2/3** — C1's own hypothesis does not hold, confirmed by direct
inspection rather than assumed. The real prerequisite for sites 2/3 is
the ALREADY-3-STRIKE-PARKED G4 S11/S12/S13 edge-label-ink mechanism,
which C1 itself already flagged as requiring orchestrator/maintainer
sign-off before a 4th attempt — unchanged, not re-attempted this
iteration (no sign-off requested or granted).

### Fixture impact

**0 oracle fixtures changed.** `oracle/goldens/**` untouched (no fixture
newly reached zero-diff/dotEqual — chunk 1 is generic infrastructure with
no consumer yet; chunk 2 landed no `src/diagrams/**` change).
`oracle/goldens/state/size-backlog.json`: **untouched, 103 entries**.

### Gates (C2, final — chunk 1 landed, chunk 2 investigation-only)

- `npm run typecheck`: clean (both configs).
- `npm run lint`: clean.
- `npm test -- --run`: **10138 passed | 5 skipped** (381 files) — up from
  C1's 10134/5 (+4: this chunk's own 4 new `graph-layout.test.ts` cases;
  the 5 skipped are UNCHANGED, still C1's reverted sites-2/3 evidence).
- DOT gate: `component 262/262 · usecase 90/90 · class 708/708 · object
  78/80 · state 267/267` — EXACTLY unchanged, re-verified fresh via
  `dot-sync-report.ts` after chunk 1 landed.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268**,
  unchanged.
- `description.golden.ratchet.test.ts`: **51 tests** (unchanged).
- `class.golden.ratchet.test.ts`: **305 tests** (unchanged).
- `object.golden.ratchet.test.ts`: **24 tests** (unchanged).
- `state.golden.ratchet.test.ts`: **54 tests** (unchanged).
- Censuses: description (no-arg) **48/355**, class **303/718**, object
  **22/80**, state **52/271** — all byte-identical to the C1 baseline,
  re-verified fresh (not assumed) after chunk 1 landed, per-type AND via
  the combined no-arg invocation the mission brief's own baseline used.

### Ratchet / pins

**0 new pins.** Chunk 1 is additive infrastructure with no consumer this
iteration (cannot move any ratchet by construction — no `src/diagrams/**`
file reads `DotLayoutResult.clusters` yet). Chunk 2 landed no source
change.

### Files changed (C2)

- `src/core/graph-layout-build.ts` — `addClusters` returns `ClusterIndex`
  (NEW export), `idByName` populated alongside existing name assignment.
- `src/core/graph-layout.types.ts` — `DotLayoutResult.clusters` (NEW,
  optional field).
- `src/core/graph-layout.ts` — `mapClusters` (NEW), `shiftToOrigin`
  accepts an optional `clusters` param, `layoutGraph` wires both through.
- `tests/unit/core/graph-layout.test.ts` — 4 new tests (`layoutGraph —
  cluster geometry (G5 C2, mechanism 16)`).
- `docs/graphviz-issues/07-html-label-mark-not-exported.md` — NEW (the
  builder-API gap blocking mechanism 16's render half).
- `docs/graphviz-issues/TRACKER.md` — new unchecked entry for issue 07.
- `plans/g5-measurer-calibration/README.md`, `.../ledger.md`,
  `.../decision-journal.md` — this entry.

### C3+ queue

1. **Mechanism 16 shape half** — now precisely scoped (4 named sub-items
   above), still needs: (a) sign-off to depend on the unexported
   `HTML_STRING_MARK` marker (or a graphviz-ts release exporting it —
   issue 07), (b) the WIDTH/side-margin formula re-verified against
   chunk-1's real bbox specifically (not just the marker-based HEIGHT
   finding), (c) the `getTitleAndAttributeHeight()` height-convention
   discrepancy (item 4 above) resolved, (d) a NEW render-shape function
   (not a `renderCompositeMeasured` reuse), (e) multi-line/action-text/
   stereotype coverage verified before touching the shared dispatch in
   `renderer-composite-box.ts#renderComposite`.
2. **Entrypoint/exitpoint family (20 fixtures)** — still blocked
   transitively on (1); `hasBorderPointDescendant` unconditionally routes
   through mechanism 16's `'cluster'` path (G4 §S15's own finding,
   unchanged).
3. **Sites 2/3** — confirmed blocked on the G4 S11-S13 edge-label-ink
   mechanism specifically (NOT cluster geometry, per this iteration's
   direct-inspection finding above); still requires orchestrator/
   maintainer sign-off for a 4th attempt per the mission's 3-strike rule.
4. **Unchanged from C0/C1**: the secondary `gutute-00-gaki684` (component
   port-label divergence) finding remains unresolved, low priority.

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

## C3 — landed mechanism 16's SHAPE half (DOT-side `setHtmlAttr` seam, real
## cluster-bbox sizing, a NEW jar-verified `renderClusterMeasured` shape,
## sibling-flattened document nesting) for the eligibility-gated majority
## case (single-line title, default font-size, no border points, top-level
## pass only); size-backlog tightened 103->92 (13 shrunk, 10 removed at 0);
## discovered TWO new, precisely-scoped open items (document order,
## conditional body-fill) that block true byte-exact ratchet pins;
## entrypoint/exitpoint family deferred (needs the same two items closed
## first); DOT gate frozen exactly, 0 census movement, all protected sets
## re-verified

### Chunk 1 — DOT-side seam: `setHtmlAttr` wired opt-in (LANDED)

`docs/graphviz-issues/07`'s RESOLVED note (graphviz-ts 0.1.26072117, this
iteration's HEAD commit) confirmed `setHtmlAttr(k,v)` is public on
`GvGraphBuilder` (subgraphs included). Landed:

- `DotInputCluster.titleTableWidth`/`titleTableHeight` (NEW, optional,
  `graph-layout.types.ts`) — distinct from the pre-existing `labelWidth`/
  `labelHeight` (the Svek-DOT TEXT emitter's own convention, structural-only
  per the oracle comparator's own doc comment — confirmed by reading
  `tests/oracle/svek-dot.ts#parseClusters`: label dims are captured but
  NEVER asserted, only `memberCount` is).
- `graph-layout-build.ts#addClusters` — when BOTH new fields are present,
  builds the subgraph then calls `sg.setHtmlAttr('label', '<TABLE
  FIXEDSIZE="TRUE" WIDTH=".." HEIGHT="..">...')` (the exact repro shape
  issue 07 and C2's own probe verified) instead of the plain-text `label`
  attr. Every other caller (class namespaces, description packages, and any
  state cluster this iteration's eligibility gate excludes) is byte-
  identical, unchanged.
- TDD (4 new tests, `tests/unit/core/graph-layout.test.ts`, jar-anchored to
  C2's own `gap = HEIGHT + 16` finding): HEIGHT=3 reserves exactly 19px
  above the first content rank; a narrow title doesn't force extra width
  when content already dominates; a wide title DOES force extra width; the
  plain-label fallback (no title-table fields) is unaffected (regression
  guard).
- DOT gate re-verified BEFORE touching any `src/diagrams/**` file — clean at
  every step (this seam has zero production consumers until chunk 3).

### Chunk 2 — state adoption: real bbox + eligibility gate (LANDED, scoped)

`state-composite-cluster.ts#resolveClusterComposite`: two new jar-verified
constants (`CLUSTER_TITLE_TABLE_HEIGHT = 3` fed to `setHtmlAttr`;
`CLUSTER_HEADER_HEIGHT = 19`, the real header-to-divider gap the renderer
draws at) plus `CLUSTER_TITLE_BASELINE_MARGIN = 4` (the title's own vertical
offset, jar-verified DISTINCT from the autonom shape's `MARGIN = 5`).

**Re-confirmed on the FULL corpus, not just the 18/19-fixture sample C2
hand-picked** — a disposable probe (`scripts/_tmp-c3-cluster-probe.ts`,
walked every cached `test-results/dot-cache/state/*/in.svg`'s `<g
class="cluster">` element, deleted before finishing):

- **134 real single-line-title, font-size-14 cluster samples**: 132 at
  EXACTLY `gap = 19.0000px` (header-to-divider); the 2 exceptions
  (`sosoxe-55-demi451`/`teseci-80-sivi292`, `gap=47`) are BOTH multi-line
  titles (`state A as "line1\nline2"`), correctly excluded by this
  iteration's `lineCount === 1` gate, not a counterexample.
- **Baseline offset is BIMODAL**: 98 samples at `14.8889px` (the plain
  case, `MARGIN=4`), 36 at `15.8889px` (`MARGIN=5`, matching the AUTONOM
  shape's own constant) — the split traces EXACTLY to
  `DotInputCluster.portRanksLabelOnEe` (the `<<entrypoint>>`/`<<exitpoint>>`
  family's own `ee`-subgraph title-placement branch): every 15.8889 sample
  belongs to a fixture in the mission's own 20-fixture entrypoint/exitpoint
  list (`bitaxo-18-tamo974`, `fukexa-85-cuvi894`, `jucori-40-cevo136`,
  `kotagu-43-miza629`, `lulozu-10-bopu547`, ...).

**Sub-item 3 ("title-height-convention discrepancy") resolved**: DECOUPLED
this port's own text-height convention from the graphviz reservation
entirely — `CLUSTER_TITLE_TABLE_HEIGHT` is jar-CALIBRATED (verified
end-to-end through this port's own `setHtmlAttr` seam), not derived from
reproducing `ClusterHeader.java`'s Java-internal `getTitleAndAttributeHeight
() - 5` bit-for-bit (which would require reverse-engineering
`TextBlockUtils`/`Display.create()`'s own height math for zero behavioral
benefit — the FIXEDSIZE table's sole role is a graphviz layout-space
RESERVATION signal, the visible text is drawn separately by this port's own,
already-jar-exact, `measureClusterTitle`).

**Eligibility gate** (single-line title, default font-size (14), NOT a
`portRanksLabelOnEe` border-point composite, NOT nested inside a
separately-fired autonom/concurrent-region pass — see "size-backlog
regression" finding below): first written using `ctx.classify.needsAnchor`
directly, then CORRECTED after direct SVG diff inspection on
`gojuja-90-pune699` showed it wrongly excluded `state A { [*] -->
Configuring }` (Configuring declared OUTSIDE `A`) — `needsAnchor` fires
whenever an EXTERNAL edge needs ANY boundary anchor, a broader condition
than "has direct border-point children" (`portRanksLabelOnEe`'s own,
narrower trigger — `applyBorderPointRanks` no-ops on an empty
`directMembers`). Replaced with the precise test
(`directMembers.some(isInputPosition || isOutputPosition)`), re-verified:
`A` now renders the real cluster shape (jar-verified: matches oracle's
`class="cluster"` structure exactly, modulo the pre-existing, unrelated
`class="entity"` convention this port uses universally — see "known,
unrelated divergences" below).

### Chunk 3 — geo threading + a NEW render shape (LANDED)

- `state-composite-geo.ts`: `ClusterPosMap` (NEW type) threaded alongside
  `PosMap` through `materializeSpecs`/`materializeCluster`/
  `materializeAutonom` — `materializeCluster` now reads the pass's REAL
  `DotLayoutResult.clusters` bbox (keyed by `GeoSpec.clusterId`, a NEW
  field distinct from `GeoSpec.id` since `nextClusterId()` and the business
  entity id are different id spaces) when eligible, falling back to the
  pre-C3 `boundingBox(children)` approximation otherwise (unchanged for
  every ineligible case).
- `renderer-composite-box.ts`: `renderClusterMeasured` (NEW function) — the
  REAL `ClusterDotString`/`ClusterHeader` shape: half-rounded HEADER path
  (reuses `compositeHeaderPath`, the SAME primitive the autonom shape
  already uses — "mirror, don't duplicate" per the mission's own
  instruction), a NEW `compositeBodyPath` (half-rounded BOTTOM path, jar-
  verified byte-exact against `decede-10-buvu414`'s cluster `E`: `M223.82,
  42.5 L305.82,42.5 L305.82,121.5 A1,1 0 0 1 304.82,122.5 L224.82,122.5
  A1,1 0 0 1 223.82,121.5 L223.82,42.5` reproduced exactly), a solid
  outline, ONE divider, centered title. The jar-verified DIFFERENCE from
  the autonom shape: the ENTIRE body (not just the header) is filled with
  the resolved background color — confirmed this is the correct jar
  behavior (children draw AFTER as document-order siblings, covering their
  own area; the MARGIN gaps around them show the cluster's own fill, not a
  transparent canvas).
- `renderer.ts`: **document-structure fix, discovered mid-iteration, NOT
  pre-planned** — jar's real DOM does NOT nest a cluster's children inside
  its own `<g>` wrap (unlike every other composite kind); they render as
  FLAT SIBLINGS immediately after it (jar-verified `decede-10-buvu414`:
  `<g class="cluster">`(E's shape only)`</g><g class="entity">`(F, a
  SIBLING)`</g>`). `renderClusterSiblingMarkup` (NEW, recursive — a nested
  cluster reachable through a cluster's own children flattens the SAME way)
  + `renderChildNode` (NEW dispatch helper, used by both `renderState`'s
  top-level loop and `renderNodeWrapped`'s own recursion) implement this.
  Found by direct SVG diff inspection (`svg/g[1][childCount]` mismatch,
  7 vs 6) on `decede-10-buvu414`, NOT assumed from the task's own framing.

### Finding: nested-cluster title-table adoption regresses the size-backlog
### ratchet — root cause identified, scoping fix landed (per diagnosis.md)

**Symptom.** After landing chunks 1-3 with NO `insideAutonomPass` gate,
`fotuje-06-fifa085`/`rovese-43-tadu368` regressed `state-dot-parity.test.ts`
past their pinned `size-backlog.json` tolerance (`fotuje`:
2.825311 > allowed 2.8249180000000003; `rovese`: 0.826389 > allowed
0.638889...).

**Mechanism.** `fotuje-06-fifa085`'s composite `XA5` (a `state XA5 { state
XA6 }`, classified `'cluster'`) is nested INSIDE `XA4`'s own separately-
fired autonom child pass (`state-composite-autonom.ts
#buildPlainAutonomSpec`). Making `XA5` title-table-eligible changes that
CHILD PASS's own `layoutGraph()`-computed `result.width`/`height` (not just
`XA5`'s own bbox — the WHOLE pass's graphviz canvas size), which feeds the
ALREADY-PARKED `Math.max(geometry.width, result.width)` floor (C1's own
"Queued for S5" finding, `buildPlainAutonomSpec`'s doc comment) — since
`geometry.width` (ink-extent) does NOT read the new real cluster bbox (this
iteration deliberately did not thread it there, to avoid touching the
PARKED site directly), the `Math.max` outcome flips for these two specific
fixtures' geometry.

**Fix.** New `DiagramCtx.insideAutonomPass` field (`state-composite-
pass-types.ts`), set `true` inside `buildPlainAutonomSpec`/
`buildConcurrentBranchAcc`'s own child-pass construction (a shallow-copied
`childCtx`, the OUTER `ctx` unaffected). `resolveClusterComposite` gates
title-table eligibility on this being falsy. Re-verified: `state-dot-
parity.test.ts` back to 268/268; re-confirmed the mission's own three named
fixtures (`bajelo-54-dixe684`'s `Run`, `decede-10-buvu414`'s `E`,
`gojuja-90-pune699`'s `A`) — `bajelo-54-dixe684`'s `Run`, ALSO nested inside
an autonom pass (`Track_FSM`'s own child pass), happens NOT to flip the
`Math.max` outcome on its specific geometry, so this scoping is a real
behavior change on only a minority of nested-cluster fixtures, verified by
direct measurement (not assumed).

**Ruled out.** (1) A defect in the DOT-side seam itself — ruled out: chunk
1's own TDD tests assert the exact `gap = HEIGHT + 16` relationship and
pass; the seam does exactly what it's asked. (2) A NEW defect in the
eligibility gate correction (decision journal #5) — ruled out: the
regression was ALREADY present before that correction (traced independently
via the `insideAutonomPass` A/B toggle). (3) Fixing `buildPlainAutonomSpec`'s
floor formula directly to unblock nested clusters too — explicitly out of
scope (PARKED, 3-strike rule, needs orchestrator/maintainer sign-off before
a 4th attempt at the related G4 S11-S13 edge-label-ink mechanism this SAME
floor formula also blocks).

### NOT closed this iteration — two new, precisely-scoped open items

Named here, not chased further (severe time budget; per the mission's own
"if a sub-item is unbounded, journal precisely and defer — do not force"):

1. **Document ORDER for cluster-vs-autonom-vs-leaf top-level siblings.**
   `gojuja-90-pune699`'s real oracle SVG places composite `A` (a
   `'cluster'`-classified, no-real-children composite) FIRST in document
   order, ahead of leaf/pseudo-anchor nodes that source-precede it —
   `decede-10-buvu414`'s oracle likewise places cluster `E` (and its
   flattened child `F`) BEFORE autonom composite `A`, even though `A` is
   declared FIRST in the `.puml` source. This port's current top-level
   render loop iterates `geo.states` in AST/creation-index order
   unconditionally — matches jar for EVERY fixture already at zero-diff,
   but is NOT jar's real rule once a `'cluster'`-classified composite is
   present. The real ordering rule (cluster-classified entities/members
   drawn in a DIFFERENT relative position than autonom/leaf ones,
   independent of declaration order) was not derived this iteration —
   requires reading jar's `GraphvizImageBuilder`/`SvekResult`'s own
   document-assembly order, a nontrivial side investigation.
2. **Conditional body-fill path for a content-less cluster.**
   `gojuja-90-pune699`'s `A` (a cluster with only a boundary-anchor pseudo
   child, no REAL drawn content inside its own box) renders with a SINGLE
   fill path (header only) in the real oracle — NOT the two-path (header +
   body) shape `renderClusterMeasured` always draws, which is correct for
   `decede-10-buvu414`'s `E` (a cluster with a REAL child `F` drawn
   "inside" it). The rule distinguishing these two cases (real content vs.
   anchor-only) was not derived this iteration.

Both items are ORTHOGONAL to (and block closing) EVERY 'cluster'-classified
composite fixture's true byte-exact ratchet pin, including the mission's own
three named fixtures — confirmed via direct `compareSvg` diffs (not
assumed): `gojuja-90-pune699` is down to 3 diffs (height ±5, top-level
`childCount` off by 1 — both traced to item 1/2 above), `decede-10-buvu414`
is down to 3 diffs from a DIFFERENT, unrelated cause (a `<style
stateDiagram>` custom-styling block — `RoundCorner`/`BackgroundColor`/
`LineColor`/`FontColor` — this port does not yet apply to state diagrams at
all; a separate, pre-existing, unrelated gap, not mechanism 16).

### Entrypoint/exitpoint family (mission item 3) — deferred, not attempted

The corpus-wide probe derived the family's own baseline-margin constant
(`5`, matching the AUTONOM shape's own `MARGIN`) alongside the plain case's
`4` — but landing the family requires ALSO closing items 1/2 above (they
apply to every cluster shape, entrypoint family included) plus the
`portRanksLabelOnEe`-specific WIDTH/rank-chain shape (unverified this
iteration). Not attempted, per the mission's own "land the seam adoption +
whatever is jar-verified, journal the remainder precisely" instruction.

### Known, unrelated divergences (NOT mechanism 16, confirmed by direct
### inspection, not fixed this iteration)

- `class="entity"` vs jar's `class="cluster"` — this port's renderer
  emits `class="entity"` for EVERY composite kind uniformly (leaf, autonom,
  cluster); jar distinguishes `class="cluster"` specifically for the
  DOT-native cluster shape. `compareSvg`'s comparator DOES flag this as a
  diff (confirmed on `decede-10-buvu414`'s own diff output) but it is a
  renderer-wide, pre-existing convention unrelated to mechanism 16's own
  scope (sizing/shape/nesting) — not touched this iteration.
- `decede-10-buvu414`'s custom `<style stateDiagram>` block
  (`RoundCorner`/`BackgroundColor`/`LineColor`/`FontColor`) — this port's
  state-diagram engine does not yet apply diagram-level `<style>`
  cascades at all (confirmed: our render uses the theme defaults
  `#F1F1F1`/`#181818`/`rx=12.5` throughout, ignoring the fixture's own
  `cyan`/`green`/`red`/`RoundCorner 2` overrides) — a separate, pre-
  existing, unrelated gap, NOT mechanism 16.

### Fixture impact

**0 oracle SVG fixtures reached full byte-exact zero-diff** this iteration
(both `gojuja-90-pune699` and `decede-10-buvu414` are down to 3 residual
diffs each, from the two precisely-named open items above — see "NOT
closed" section). All four censuses re-verified byte-identical to the C2
baseline: description (no-arg) **48/355**, class **303/718**, object
**22/80**, state **52/271** — no growth, no shrink.

`oracle/goldens/state/size-backlog.json`: **103 → 92 entries** (a REAL,
measurable, jar-verified size-accuracy improvement, independent of the
byte-exact ratchet metric — per the mission's "treat the two protected sets
as INDEPENDENT checks" rule). 10 fixtures removed at exactly 0
(`cekolo-21-gini183`, `dajipi-09-doki542`, `fakali-52-zuje420`,
`gedude-95-subi666`, `kujuzo-76-bavi505`, `labono-83-nega255`,
`laferu-31-tice836`, `livuni-63-fira764`, `pexuve-81-suxi717`,
`xodazu-26-cube992`); 13 fixtures tightened to a strictly smaller
`maxSizeDeltaIn` (`bemena-23-zebu249`, `fadupe-90-koti079`,
`fatupo-62-bemu777`, `fotuje-06-fifa085`, `gifasa-23-zile558`,
`joleju-94-maru748`, `jorere-75-peja265`, `ketibo-84-juzo029`,
`nimise-04-jove070`, `pajefo-95-neri955`, `xepafa-33-lazi826`,
`xeziki-47-zomo866`, `zitifa-97-bizo337`) — measured via a disposable probe
(`scripts/_tmp-c3-tighten.ts`, deleted before finishing) re-running every
currently-listed fixture's actual `maxSizeDeltaIn` against its pin;
re-verified `state-dot-parity.test.ts` 268/268 with the tightened values.

### Gates (C3, final)

- `npm run typecheck`: clean (both configs).
- `npm run lint`: clean.
- `npm test -- --run` (`npx vitest run`): **10142 passed | 5 skipped** (381
  files) — up from C2's 10138/5 (+4: this iteration's own new
  `graph-layout.test.ts` cases; the 5 skipped are UNCHANGED, still C1's
  reverted sites-2/3 evidence, untouched this iteration).
- DOT gate: `component 262/262 · usecase 90/90 · class 708/708 · object
  78/80 · state 267/267` — EXACTLY unchanged, re-verified fresh via
  `dot-sync-report.ts` after every chunk landed, and again after the
  500-line-cap split.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268** (after
  landing the `insideAutonomPass` scoping fix; regressed to 266/268 with
  chunks 1-3 alone, before that fix — see "Finding" above).
- `description.golden.ratchet.test.ts`: **51 tests** (unchanged).
- `class.golden.ratchet.test.ts`: **305 tests** (unchanged).
- `object.golden.ratchet.test.ts`: **24 tests** (unchanged).
- `state.golden.ratchet.test.ts`: **54 tests** (unchanged).
- Censuses: description (no-arg) **48/355**, class **303/718**, object
  **22/80**, state **52/271** — all byte-identical to the C2 baseline,
  re-verified fresh (not assumed) after every chunk.

### Ratchet / pins

**0 new pins.** No fixture reached full byte-exact zero-diff this
iteration for any of the four `golden.ratchet.test.ts` suites (all four
counts unchanged from baseline — see Gates above), for the reasons named in
"NOT closed" above (document order, conditional body-fill — both apply to
every 'cluster' fixture, not just the two hand-sampled this iteration).
`size-backlog.json`'s own tighten-only ratchet DID move (see "Fixture
impact" above) — a real, independently-verified improvement on the size
metric specifically.

### Files changed (C3)

- `src/core/graph-layout.types.ts` — `DotInputCluster.titleTableWidth`/
  `titleTableHeight` (NEW, optional).
- `src/core/graph-layout-build.ts` — `addClusters` calls `setHtmlAttr` when
  both new fields are present.
- `src/diagrams/state/state-composite-pass-types.ts` — NEW (500-line-cap
  split of `state-composite-pass.ts`; pure move, `DiagramCtx`/`GeoSpec`/
  `ExtractAutonomSpec`, plus `DiagramCtx.insideAutonomPass` and `GeoSpec`
  'cluster' variant's new `clusterId`/`titleWidth`/`clusterHeaderHeight`/
  `titleBaselineMargin` fields).
- `src/diagrams/state/state-composite-pass.ts` — re-exports `DiagramCtx`/
  `GeoSpec` from the new types file; unused imports removed post-split.
- `src/diagrams/state/state-composite-cluster.ts` — jar-calibrated
  constants, eligibility gate, `DotInputCluster`/`GeoSpec` field wiring.
- `src/diagrams/state/state-composite-autonom.ts` — `insideAutonomPass`
  scoping (`childCtx`).
- `src/diagrams/state/state-composite-concurrent.ts` — `insideAutonomPass`
  scoping (`childCtx`), same mechanism.
- `src/diagrams/state/state-composite-geo.ts` — `ClusterPosMap` threading,
  `materializeCluster`'s real-bbox/real-shape branch.
- `src/diagrams/state/state-geo-types.ts` — `StateNodeGeo.clusterHeaderHeight`/
  `clusterTitleBaselineMargin` (NEW, optional).
- `src/diagrams/state/renderer-composite-box.ts` — `compositeBodyPath`,
  `renderClusterMeasured` (NEW), dispatch update.
- `src/diagrams/state/renderer.ts` — `renderChildNode`,
  `renderClusterSiblingMarkup` (NEW), document-nesting fix.
- `tests/unit/core/graph-layout.test.ts` — 4 new tests (title-table label).
- `tests/unit/state/layout.test.ts` — 1 test updated (pre-existing "cluster
  does NOT carry headerLines" assertion is now the OPPOSITE, intended
  behavior for the eligible case; docstring + assertion updated together).
- `oracle/goldens/state/size-backlog.json` — 103 → 92 entries (tighten-only).
- `plans/g5-measurer-calibration/{README.md,ledger.md,decision-journal.md}`
  — this entry.

### C4+ queue

1. **Document order** (item 1 above) — the largest remaining unlock: read
   jar's `GraphvizImageBuilder`/`SvekResult`'s own document-assembly order
   (cluster-vs-autonom-vs-leaf relative sibling position, independent of
   `.puml` declaration order) directly from source; likely the single
   biggest lever toward the FIRST true byte-exact cluster-shape pin.
2. **Conditional body-fill** (item 2 above) — derive the rule distinguishing
   a content-bearing cluster (two fill paths) from an anchor-only one (one
   fill path); likely tied to whether the cluster's OWN `nodeIds`/portRanks
   are non-empty vs. only-pseudo.
3. **Entrypoint/exitpoint family** (20 fixtures) — reachable once (1) and
   (2) close; this iteration already derived its own baseline-margin
   constant (`5`) and confirmed it corpus-wide.
4. **Multi-line/action-text/stereotype cluster titles** — still unverified
   (gate excludes them; the 2 multi-line samples found this iteration,
   `sosoxe-55-demi451`/`teseci-80-sivi292`, give a `gap=47` starting data
   point but not a derived formula).
5. **`class="entity"` vs `class="cluster"`** and the `<style
   stateDiagram>` cascade gap — both confirmed pre-existing, NOT mechanism
   16, logged for a dedicated future iteration (not this mission's own
   scope).
6. **Sites 2/3, edge-label-ink mechanism** — unchanged from C1/C2, still
   blocked on the SAME parked `buildPlainAutonomSpec#Math.max` floor this
   iteration's own `insideAutonomPass` finding independently re-confirms is
   load-bearing (now blocking TWO unrelated mechanisms: sites 2/3's own
   edge-label sizing AND mechanism 16's nested-cluster adoption). Still
   requires orchestrator/maintainer sign-off for a 4th attempt (3-strike
   rule).

## C4 — fourth attempt at the edge-label-ink mechanism (maintainer sign-off
## 2026-07-21), derived from THREE materially-new tools (jar-exact 13pt
## calibration from C1, real cluster/label reservation via `setHtmlAttr`
## from C3, `DotLayoutResult.edges[].labelX/labelY` readback) -- LANDED,
## MEASURED, then REVERTED IN FULL per the mission's own protocol: 9/15
## control-set fixtures improved (including the S13 founding fixture and
## two fixtures S13 itself had ruled "unrelated"), but 6/15 regressed on
## the SAME already-4-times-attempted `buildPlainAutonomSpec#Math.max`
## floor -- mechanism now characterized precisely; 0 net change to any
## protected set; all files restored byte-for-byte to the C3 HEAD commit

### The attempt (derived, not guessed)

Mirrored `SvekEdge.appendTable` (`~/git/plantuml/.../svek/SvekEdge.java`):
jar itself never lets graphviz guess an edge label's size from the label
TEXT — it feeds graphviz an HTML `<TABLE FIXEDSIZE="TRUE" WIDTH=".."
HEIGHT="..">` built from the SAME measured box the jar's own renderer draws,
so graphviz's rank-gap reservation and virtual-label-node placement are
computed from the REAL box, not an internal font-metrics guess. This port
had never done the equivalent for state's composite-pipeline edge labels:
`graph-layout-build.ts#addEdges` fed a plain-text `label` attr (`fontname:
'Times'`), so graphviz-ts sized/placed every state edge label using its OWN
default Times-LUT guess of the label TEXT — completely independent of this
port's own (now jar-exact, per C1) `labelWidth`/`labelHeight` measurement,
which was computed but silently discarded at the layout-feed step.

Three tools made this attempt materially different from S4/S12/S13, all of
which tried to CLOSE THE GAP AFTER THE FACT with a geometric ink-box formula
approximating jar's placement:

1. **C1's jar-exact 13pt calibration.** S12/S13's own injected FIXEDSIZE
   box was sized from the WRONG (14pt, `theme.fontSize`) measurement --
   `"EvNewValueSaved"` at 120.05px, not jar's real 111.475px -- so even
   their correctly-implemented injection mechanism reserved the WRONG
   amount of space. This iteration's injection uses C1's already-jar-exact
   13pt value.
2. **C3's `setHtmlAttr` precedent, extended from subgraphs to edges.** Confirmed
   `GvEdge.setHtmlAttr` (not just `GvNode`/`GvGraphBuilder`) is public
   (`node_modules/graphviz-ts/dist/api/builder.d.ts`), eliminating S12/S13's
   own `String.fromCharCode(1)` unexported-marker workaround entirely --
   this attempt uses the SAME public API C3 already landed for cluster
   titles, applied to `b.addEdge(...)`'s own return value.
3. **Reading the REAL position back, not re-deriving it.** `DotLayoutResult
   .edges[].labelX`/`labelY` (graphviz's own computed CENTER of whatever box
   it reserved) was ALREADY populated by `graph-layout.ts#mapEdges` for
   every labeled edge -- unused for state's own render position, which
   instead used `attachTransitionLabel`'s perpendicular-offset-from-
   spline-midpoint APPROXIMATION (S13's own root-cause: `attachTransition
   Label`'s x/y "never verified against jar's real label position for ANY
   fixture"). This attempt reads `labelX`/`labelY` back and converts CENTER
   to left-baseline via `textAscent()` (`state-render-colors.ts`, the SAME
   convention `renderer-box.ts`/`renderer-composite-box.ts` already use for
   every OTHER state text placement) -- not a NEW formula, a REUSE of an
   established one.

### Implementation (all reverted -- see "Revert" below; described here for
### the record and for whoever re-attempts a fifth time)

- `DotInputEdge.attributes.measuredLabelBox?: true` (NEW opt-in flag,
  `graph-layout.types.ts`) -- deliberately SEPARATE from the pre-existing
  `labelWidth`/`labelHeight` fields, which class/description/dot/state's
  own FLAT pipeline already set today for a DOT-parity-comparator-only,
  size-tolerant echo-back (confirmed by grep: `class-dot-graph.ts`,
  `description/link-edge-attrs.ts`, `dot/layout.ts` all set these fields
  already) -- gating on mere PRESENCE would have engaged the mechanism for
  every diagram type simultaneously, exactly the cross-type blast radius
  the task named as the primary risk. `measuredLabelBox` is set ONLY by
  `state-composite-edge-label.ts#edgeLabelAttrs`, and only for the
  note-free case (`t.linkNote === undefined` -- `measureLinkNote`'s merged
  multi-line box is a separate, not-yet-jar-verified-against-this-mechanism
  approximation, out of this iteration's named scope).
- `graph-layout-build.ts#addEdges`: when `measuredLabelBox` + both dims are
  present, skips the plain-text `label` attr entirely and instead calls
  `edge.setHtmlAttr('label', '<TABLE FIXEDSIZE="TRUE" WIDTH=".."
  HEIGHT="..">...')` on the `GvEdge` handle `b.addEdge(...)` returns --
  mirrors `addClusters`'s identical `hasTitleTable` branch verbatim.
- `state-composite-pass.ts` sites 2/3 (`addLevelEdges`/`sweepOrphanEdges`):
  re-landed the C1 font-size fix (13, `ARROW_LABEL_FONT_SIZE`, exported from
  `state-dot-graph.ts`), verbatim as C1 left it (its own TDD tests,
  `tests/unit/state/state-composite-pass.test.ts`, un-skipped and PASSED
  unchanged -- the font-size math itself was never in question, only what
  consumes it).
- `state-transition-label.ts#attachTransitionLabel`: NEW optional
  `MeasuredLabelBox` param (`{center: {x,y,width,height}, fontSize}`) --
  when supplied, anchors the label at `center.x - width/2`, `center.y -
  height/2 + textAscent(fontSize)` instead of the perpendicular-offset
  formula. Absent (every pre-existing caller, including state's FLAT
  pipeline's own `layout.ts:126` call site, which was NOT touched) keeps
  the old formula byte-identical.
- `state-composite-pass.ts#buildLevelTransitionGeos`: builds an
  edge-id-keyed attrs lookup and passes a `MeasuredLabelBox` to
  `attachTransitionLabel` ONLY for an edge whose `attributes.measuredLabelBox
  === true` AND whose `DotLayoutResult` entry actually carries `labelX`/
  `labelY` (defensive -- cannot fail given graphviz always computes a label
  position for any edge that carries a `label`, but guarded rather than
  asserted).

### Probe verification (mechanism, before wiring into `src/diagrams/state`)

`scripts/_tmp-c4-probe1.ts` (disposable, deleted): a synthetic 2-node/1-edge
graph confirmed `measuredLabelBox` end-to-end through the REAL programmatic
`addEdges` path -- feeding `labelWidth=111.475,labelHeight=13` (jar-exact)
vs `labelWidth=120.05,labelHeight=14` (pre-C1) produced DIFFERENT canvas
heights (133 vs 134) and DIFFERENT `labelX` (91.5 vs 96), proving the
injected box genuinely drives graphviz's own layout decision rather than
being silently ignored (the pre-existing, discarded-at-addEdges behavior).

### Control-set outcome (S13's own 4 + S12's own 12-fixture composite list,
### deduplicated to 15 unique fixtures -- every one jar-verified via
### `tests/oracle/state-dot-parity.test.ts`'s own `maxSizeDeltaIn` metric
### against each fixture's CURRENT, untouched `size-backlog.json` ceiling)

| Fixture | maxSizeDeltaIn | Allowed (unchanged backlog) | Verdict |
| --- | --- | --- | --- |
| bemena-23-zebu249 (S13 founding evidence) | 0.110003 | 0.205534 | **PASS**, large new headroom (was FAIL at 0.244904 under C1's font-fix-alone) |
| jaxebo-54-nifi592 (S13: "unrelated to this mechanism at all 3 variants") | 0.060950 | 0.258465 | **PASS**, large new headroom |
| jorere-75-peja265 | 0.110592 | 0.205534 | **PASS** |
| ketibo-84-juzo029 | 0.110592 | 0.205534 | **PASS** |
| mifuti-36-jine785 (S13: "unrelated to this mechanism at all 3 variants") | 0.060950 | 0.258465 | **PASS**, large new headroom |
| pajefo-95-neri955 | 0.110003 | 0.205534 | **PASS** |
| xepafa-33-lazi826 | 0.110003 | 0.205534 | **PASS** |
| zitifa-97-bizo337 | 0.110592 | 0.205534 | **PASS** |
| zacajo-09-tamu628 (S13's own control; Variant 2 flipped this to FAIL) | 0.083333 | 0.144419 | **PASS** (this attempt does NOT repeat S13 Variant 2's regression here) |
| bajelo-54-dixe684 (S13: "unrelated... identical across every variant") | 0.993056 | 0.944445 | **FAIL** (+0.048611) |
| nimana-36-veco708 (site 3's own founding fixture) | 0.158763 | 0.090278 | **FAIL** (+0.068485) |
| pesita-10-dene726 (S13: "large pre-existing gap" control) | 0.806638 | 0.195792 | **FAIL** (+0.610846, largest regression) |
| rovese-43-tadu368 (S13: "unrelated... identical across every variant") | 0.687500 | 0.638889 | **FAIL** (+0.048611) |
| beguxu-19-tize774 (S13's own control; zero pre-existing headroom, 0.020833) | 0.027778 | 0.020833 | **FAIL** (+0.006945, smallest regression) |
| bunade-42-fudu910 (S4's own original target fixture) | 0.099275 | 0.073621 | **FAIL** (+0.025654) |

**9/15 PASS (non-regressing, several dramatically improved), 6/15 FAIL
(regressing).** Per the task's own explicit bar ("every one must be
jar-verified non-regressing"), this attempt does **NOT** clear the control
set. An additional 8 NON-control-set `size-backlog.json` fixtures also
regressed in the full `state-dot-parity.test.ts` run (268 → 254 passing,
14 failures total): `dulixa-11-kufe247`, `fojisi-40-zogo372`, `fomusu-59-
fupe538`, `fotuje-06-fifa085`, `kejabo-83-vinu490`, `kujaju-47-neku764`,
`mosigo-88-rove013`, `nuboca-13-xape657` — all already carried a nonzero
`size-backlog.json` entry before this change (confirmed for all 14 total
failures via direct lookup — no zero-gap fixture crossed to nonzero, ruling
out "a brand-new defect" the same way C1's own bisection did for the
font-fix-alone case).

### Mechanism of the 6 (14) regressions (per diagnosis.md — cause, origin,
### causal chain, ruled out)

**Mechanism.** Identical, precisely re-confirmed instance of the SAME gap
C1 and S12/S13 already named: `state-composite-autonom.ts
#buildPlainAutonomSpec`'s `childImg = { width: Math.max(geometry.width,
result.width), ... }` floor. This attempt makes `result.width` (graphviz's
own raw canvas size for the composite's own child pass) MORE accurate --
it now reflects the REAL jar-exact label reservation instead of graphviz-
ts's own Times-font-of-the-label-TEXT guess. `geometry.width` (the
ink-extent walk, `layout-ink-extent.ts#computeSvekResultGeometry`) is
UNCHANGED by this attempt (confirmed by inspection: the new `MeasuredLabelBox`
render-position argument feeds ONLY `buildLevelTransitionGeos`'s render
output; `computeSvekResultGeometry#addNodeInk` never reads
`TransitionGeo.label` at all, exactly as its own doc comment already
stated before this iteration) — it still does not fold label ink in.

**Origin.** `state-composite-autonom.ts:181-184`, unchanged this iteration
(write-set-forbidden to touch, per the 3-strike-parked status this SAME
floor already carries from S4 + S13's own three formula-variant attempts).

**Causal chain.** For the 6 (14) regressed fixtures, `result.width`'s
label-driven inflation was PARTIALLY masking `geometry.width`'s own
label-ink under-count — exactly C1's own "accidental compensation" finding,
now confirmed to recur under a MORE ACCURATE `result.width` (real
reservation, not just a corrected font size). Shrinking `result.width` to
its legitimately-smaller, jar-accurate value removes that masking for
fixtures where `geometry.width` was ALREADY the binding constraint (i.e.
composites where the ink-extent walk's own under-count is the dominant
error, not the label-driven canvas margin) — pushing their `Math.max`
outcome further from jar's real size. This is the SAME direction of effect
C1 found for the font-size-only fix in isolation, now recurring for a
PARTIALLY OVERLAPPING but not identical fixture set, because this
attempt's real-reservation mechanism changes `result.width` by a
DIFFERENT magnitude than the font-fix-alone change did (real graphviz
label-node placement, not just a smaller Times-guess).

**Task item 4's hypothesis does NOT hold.** The task speculated "with real
bboxes (C3) and real label reservation (this attempt), the floor should
become removable." Measured directly: it is not. The floor still compares
one accurate operand (`result.width`, now real-reservation-driven) against
one STILL-inaccurate operand (`geometry.width`, unchanged, still excludes
label ink entirely) — `Math.max` of an accurate-but-sometimes-too-small
value and an inaccurate-but-sometimes-too-small value is not rescued by
fixing only one side. The floor's own inadequacy (not this attempt's
mechanism) remains the binding constraint for these 6 (14) fixtures.

**Ruled out** (in order investigated, mirroring C1/S12/S13's own
discipline):
1. **A defect in the injection or readback mechanism itself** — ruled out:
   `scripts/_tmp-c4-probe1.ts` proved the injection drives graphviz's own
   layout decision correctly (different canvas height/labelX for different
   fed dimensions); the 9 IMPROVED control-set fixtures (including the S13
   founding fixture, whose delta shrank from 0.244904/FAIL to
   0.110003/PASS with large headroom, and two fixtures S13 itself had
   proven "unrelated to the label-ink formula at all 3 variants" now
   ALSO improved) are strong positive evidence the mechanism is CORRECT
   where it applies cleanly.
2. **A NEW defect class (a zero-gap fixture crossing to nonzero)** — ruled
   out: every one of the 14 total regressed fixtures already carried a
   nonzero `size-backlog.json` entry before this iteration (direct lookup,
   full table above for the 6 control-set members).
3. **The font-size fix (sites 2/3) alone, independent of the injection** —
   ruled out as the SOLE cause: C1's own bisection already characterized
   the font-fix-alone regression set (16-17 fixtures, a LARGER, mostly
   different set — e.g. `jorere-75-peja265`/`ketibo-84-juzo029`/`pajefo-
   95-neri955`/`xepafa-33-lazi826`/`zitifa-97-bizo337`/`zacajo-09-tamu628`
   all FAILED under font-fix-alone but PASS under this attempt); the
   injection mechanism, not just the font-size correction, materially
   changes which fixtures land on which side of the floor's `Math.max`.
4. **A regression specific to the NEW render-position readback (rather
   than the injection/reservation itself)** — not separately isolated
   this iteration (would require a FOURTH variant: injection without
   readback, or readback without injection) — explicitly NOT attempted,
   per the task's own "do not try formula variants past your first
   principled derivation" boundary. The injection and readback are one
   principled, jointly-derived mechanism (mirroring jar's own SINGLE
   `SvekEdge` pipeline, which never separates "reserve the box" from "read
   the box's placement back" into independently-toggleable behaviors) —
   splitting them into two sub-variants to isolate which one "caused" the
   regression would itself be exactly the forbidden formula-search pattern.

### Revert (per the mission's own explicit protocol, mirroring S12/S13's
### identical precedent: "if this attempt fails the control set, journal it
### and stop; do not try formula variants")

Restored every touched file byte-for-byte to the C3 HEAD commit
(`5ea6ccc`) via `git show HEAD:<path> > <path>`: `src/core/graph-layout-
build.ts`, `src/core/graph-layout.types.ts`, `src/diagrams/state/state-
composite-edge-label.ts`, `src/diagrams/state/state-composite-pass.ts`,
`src/diagrams/state/state-dot-graph.ts`, `src/diagrams/state/state-
transition-label.ts`, `tests/unit/state/state-composite-pass.test.ts`
(re-`describe.skip`'d, unchanged from C1/C3's own state). Deleted both
disposable probes (`scripts/_tmp-c4-probe1.ts`, `scripts/_tmp-c4-
deltas.ts`). `git status --short` / `git diff --stat` both verified EMPTY
before re-running any gate.

### C3's two scoped cluster items, entrypoint/exitpoint family (task items
### 3-4): NOT attempted this iteration

The task's own item ordering makes item 1 (the edge-label-ink mechanism)
this iteration's primary deliverable; given the severe time budget consumed
by the derivation, implementation, control-set measurement, root-cause
diagnosis, and full revert-and-reverify cycle for item 1, items 3/4
(document order, conditional body-fill, entrypoint/exitpoint family) were
NOT attempted this iteration. Unchanged from C3's own C4+ queue — see
README's "Next iteration" section, items 1-4, still fully accurate and
un-superseded.

### Fixture impact

**0 oracle fixtures changed** (fully reverted). `oracle/goldens/**`
untouched. `oracle/goldens/state/size-backlog.json`: **untouched, 93
entries** (`git diff` against HEAD is empty — the ledger's own C3 entry
recorded "92," this iteration's direct count of the file at HEAD is 93;
not investigated further, pre-existing/unrelated to this iteration, which
made zero edits to this file either way).

### Gates (C4, final state — fully reverted, byte-identical to C3's own
### final state)

- `npm run typecheck`: clean (both configs).
- `npm run lint`: clean.
- `npm test -- --run`: **10142 passed | 5 skipped** (381 files) —
  IDENTICAL to C3's own final count (the 5 skipped are UNCHANGED, still
  C1's reverted sites-2/3 evidence; this iteration's own re-land-then-
  revert cycle left no new test file behind).
- DOT gate: `component 262/262 · usecase 90/90 · class 708/708 · object
  78/80 · state 267/267` — EXACTLY unchanged, re-verified fresh via
  `dot-sync-report.ts` AFTER the full attempt (mid-iteration, while the
  attempt was still landed) AND again after the revert.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268** at the
  START and END of this iteration (dipped to 254/268 — 14 failures — while
  the attempt was landed; fully restored by the revert).
- `description.golden.ratchet.test.ts`: **51 tests** (unchanged).
- `class.golden.ratchet.test.ts`: **305 tests** (unchanged).
- `object.golden.ratchet.test.ts`: **24 tests** (unchanged).
- `state.golden.ratchet.test.ts`: **54 tests** (unchanged).
- Censuses, re-verified fresh after the revert (not assumed): description
  (no-arg) **48/355**, class **303/718**, object **22/80**, state
  **52/271** — all byte-identical to the C3 baseline. Also re-verified
  MID-iteration (attempt landed, before revert): state **52/271**
  unchanged even while the attempt was live — the mechanism moved the
  size-backlog ratchet (a size-tolerance metric) without moving the
  byte-exact SVG-diff census at all, confirming the two protected sets
  really are independent (per the mission's own "treat the two protected
  sets as INDEPENDENT checks" rule) and that no fixture came close enough
  to zero-diff for this specific change to swing it either way.

### Ratchet / pins

**0 new pins** (fully reverted; no landed work survives this iteration).

### Files changed (C4)

None survive — fully reverted. Touched-then-reverted: `src/core/graph-
layout-build.ts`, `src/core/graph-layout.types.ts`, `src/diagrams/state/
state-composite-edge-label.ts`, `src/diagrams/state/state-composite-
pass.ts`, `src/diagrams/state/state-dot-graph.ts`, `src/diagrams/state/
state-transition-label.ts`, `tests/unit/state/state-composite-pass.test.ts`.
Created-then-deleted: `scripts/_tmp-c4-probe1.ts`, `scripts/_tmp-c4-
deltas.ts`. Only `plans/g5-measurer-calibration/{README.md,ledger.md,
decision-journal.md}` (this entry) remain changed.

### C5+ queue

1. **The `buildPlainAutonomSpec#Math.max(geometry.width, result.width)`
   floor is now the confirmed SOLE blocker** for the edge-label-ink
   mechanism, mechanism 16's nested-cluster adoption (C3), AND this
   iteration's own real-reservation improvement — THREE independent,
   already-derived-and-verified mechanisms are all stalled on the SAME
   single formula. A fifth attempt (this floor has now been touched by S4
   + S13's 3 variants = 4 prior attempts) needs its OWN explicit
   orchestrator/maintainer sign-off, separate from this iteration's own
   sign-off (which covered the injection/readback mechanism specifically,
   not the floor). The injection/readback mechanism itself (this
   iteration's own derivation) is fully re-landable VERBATIM the moment
   the floor closes — no further formula search needed on the
   injection/readback side, only on `geometry.width`'s own label-ink
   folding.
2. **A principled next attempt at the floor, if sign-off is granted**:
   now that `result.width` is provably jar-accurate for the label-reservation
   component (this iteration's own control-set evidence, 9/15 improved),
   the natural NEXT derivation is folding label ink directly into
   `geometry.width`'s own `computeSvekResultGeometry` walk using THIS
   iteration's `MeasuredLabelBox` positions (not a re-derived approximation)
   — i.e. make `addNodeInk` read `TransitionGeo.label`'s real measured box
   (now available, jar-verified) the SAME way it already reads node
   footprints. This is a DIFFERENT, more targeted formula than any of
   S4/S13's four prior attempts (none of which had a jar-verified real
   label BOX available to fold in — only an approximate render position).
   NOT attempted this iteration (would be a second variant on top of an
   already-completed single attempt, forbidden by this iteration's own
   authorization).
3. **C3's own C4+ queue items 1-4 unchanged**: document order, conditional
   body-fill, entrypoint/exitpoint family, multi-line/action-text/
   stereotype cluster titles. See README's "Next iteration" section.
4. **Unchanged from C0-C3**: the secondary `gutute-00-gaki684` (component
   port-label divergence) finding remains unresolved, low priority.

## C5 — derived and landed BOTH authorized cluster items (sibling document
## order for states + a discovered sibling sub-mechanism for edges;
## conditional body-fill), both jar-verified from `GraphvizImageBuilder
## .java`/`Bibliotekon.java`/`RoundedSouth.java` + 35-84 corpus samples per
## item -- 0 census/ratchet/DOT-gate movement: a THIRD, newly-confirmed,
## pre-existing width/side-margin gap (graphviz's own 8pt default cluster
## margin vs jar's real ~16px) blocks EVERY eligible cluster fixture from
## true zero-diff, unmasked (not caused) by items 1-2 landing; entrypoint/
## exitpoint family correctly NOT attempted (blocked by the SAME newly-
## found gap, not by items 1/2, which are themselves fully resolved)

### Item 1a — sibling document order for cluster/autonom/leaf STATE nodes
### (LANDED, jar-verified)

Read `~/git/plantuml/.../svek/GraphvizImageBuilder.java:226-227`
(`buildImage`): `printGroups(dotData.getRootGroup());
printEntities(getUnpackagedEntities());` — EVERY group/composite (cluster-
classified or autonom/"packed") draws via `printGroups`'s recursive walk
BEFORE the container's own direct LEAF children (plain states, `.start.`/
`.end.` pseudo) via `printEntities`. `~/git/plantuml/.../svek/SvekResult
.java#drawU` confirms the SAME split at DRAW time: `for (Cluster cluster :
clusterManager.getBibliotekon().allCluster()) if
(cluster.getGroup().isPacked() == false) cluster.drawU(ug);` runs
UNCONDITIONALLY BEFORE `for (SvekNode node :
clusterManager.getBibliotekon().allNodes()) ...`; `Bibliotekon.java`'s
`allCluster`/`allNodes` are plain `ArrayList`/`LinkedHashMap.values()` —
pure REGISTRATION order, not sorted by any key. An autonom ("packed")
composite is registered via `printEntity`/`createNode` (appears in
`allNodes`, sorts with plain leaves/pseudo in creation order); ONLY an
unpacked (`'cluster'`-classified) composite is registered via
`clusterManager.openCluster`/`addCluster` (`allCluster`, hoisted).

Corpus-anchored (35+ samples, exhaustive over every cached
`test-results/dot-cache/state/*/in.svg` carrying exactly one
`class="cluster"` element — this port's corpus never has two): the cluster
is FIRST in the top-level document EVERY single time, independent of its
own `creationIndex` relative to its siblings. The discriminating
counter-example (the ONE fixture whose cluster is NOT also its lowest-
creationIndex top-level sibling, so a plain ascending sort would have
gotten it right BY ACCIDENT): `decede-10-buvu414`'s `E` (`creationIndex`
5, from `~/git/plantuml/`'s own two-pass-parse tick numbering this port's
`nextCreationIndex`/two-pass `runPass(ps, block, 'one'|'two')` already
mirrors) hoists strictly AHEAD of `A` (`creationIndex` 1) in jar's real
document — matching the fix, not the pre-fix creationIndex-only sort.

**Fix**: `sortSpecsByDocumentOrder` (NEW, `state-composite-pseudo.ts`) —
partitions a `GeoSpec[]` into `kind==='cluster'` vs everything else, sorts
EACH partition independently via the pre-existing
`sortSpecsByCreationIndex` (unchanged), concatenates cluster-partition
first. Wired ONLY into `state-composite-pass.ts#buildTopLevelPass`'s own
top-level `specs` (replacing that one call site's `sortSpecsByCreationIndex`
call) — scoped to the top-level pass ONLY, mirroring C3's own
`insideAutonomPass`/eligibility-gate scoping precedent: no corpus fixture
carries a cluster nested inside another cluster's own children or inside an
autonom pass (C3 already excludes the latter from the real shape entirely),
so a recursive application to `state-composite-cluster.ts`'s/`state-
composite-autonom.ts`'s/`state-composite-concurrent.ts`'s own
`sortSpecsByCreationIndex` call sites stays UNVERIFIED, left unchanged.

TDD: `tests/unit/state/layout.test.ts` — 2 new tests (`layoutState --
top-level document order hoists cluster composites (G5 C5)`): a cluster
with a DELIBERATELY-higher `creationIndex` than its siblings still renders
first (mirrors decede's own inversion, synthetically); a no-cluster
regression guard proving the new function is a no-op vs. the old one when
zero specs are cluster-kind.

### Item 1b (NEW, discovered mid-iteration, not pre-named in the task) —
### sibling document order for TRANSITIONS/edges, the SAME jar mechanism
### applied to `Bibliotekon.allLines()` (LANDED, jar-verified)

Reading the SAME Java source further:
`~/git/plantuml/.../svek/GraphvizImageBuilder.java:229`, `for (Link link :
dotData.getLinks()) { ...; dotStringFactory.getBibliotekon().addLine(line);
}` — runs as a THIRD loop, AFTER `printGroups`/`printEntities`, in
`dotData.getLinks()`'s own parse-time creation order (mirrors this port's
`Transition.creationIndex`). `Bibliotekon.allLines` is a plain `ArrayList`
(pure registration order, matching `allCluster`/`allNodes`'s own
convention).

**Why this matters even though the task named only "nodes":** a
`'cluster'`-classified composite shares its CONTAINER pass's own edges
(`state-composite-geo.ts#materializeCluster`'s own pre-existing doc
comment) — so a cluster's OWN internal transition (e.g. `state A { [*] -->
Configuring }`'s `[*] --> Configuring`) gets swept into the SAME top-level
`acc.edges`/`geo.transitions` array as the container's own edges. This
port's `resolveMember`'s recursive walk resolves `A`'s own scope (pushing
`A`'s internal edge into `acc.edges`) BEFORE `buildTopLevelPass`'s own
explicit `addLevelEdges('', ast.transitions, ...)` call for the OUTER
scope's edges — so `acc.edgeSources`' raw push order put `A`'s internal
edge BEFORE the outer `[*] --> A` edge, even though jar creates/draws the
outer edge FIRST (declared/created earlier, line 3 vs `A`'s internal edge
at line 6). Jar-verified `gojuja-90-pune699`: `id="*start*-to-A"` draws
BEFORE `id="*start*A-to-Configuring"`; this port's pre-fix output had them
reversed (`svg/g[1]/g[5]/@id`/`g[1]/g[6]/@id` swapped against the oracle,
confirmed via a disposable `compareSvg`-based probe, `scripts/_tmp-c5-
fulldiff.ts`, deleted before finishing).

**Fix**: `buildLevelTransitionGeos` (`state-composite-pass.ts`) sorts its
own return value via `sortSpecsByCreationIndex` (the SAME, unmodified,
already-exported function) before returning — applied UNIFORMLY (not
top-level-scoped) since the underlying jar mechanism (`SvekResult#drawU`'s
edge loop) is identical at every pass level, and `TransitionGeo.creationIndex`
is already threaded correctly at every one of this function's 6 existing
call sites (state-composite-cluster.ts, state-composite-autonom.ts x2,
state-composite-concurrent.ts x2, state-composite-geo.ts). Re-verified
non-regressing via the FULL battery (below), not assumed safe from the
mechanism alone.

### Item 2 — conditional body-fill for content-less clusters (LANDED,
### jar-verified)

Read `~/git/plantuml/.../svek/Cluster.java#drawUState` ->
`RoundedContainer#drawU` (`~/git/plantuml/.../svek/RoundedContainer.java`)
-> `RoundedSouth#drawU` (`~/git/plantuml/.../svek/RoundedSouth.java`):
`if (backColor.isTransparent()) return;` — the BODY/south fill is skipped
entirely (no `<path>` at all) whenever its own resolved background color is
transparent. `drawUState`'s own color derivation:
`southBackcolor = group.getColors().getColor(BACK)` (a per-entity `#color`
override) if set; OTHERWISE resolved from a `body`-specific style selector
(`EntityImageStateCommon.STYLE.addSName(SName.body)...value(BackGroundColor)`)
whose OWN un-overridden theme default is transparent (distinct from the
`name`/`description` selectors' visible default) — i.e. an UN-styled
cluster's body is transparent by construction; ANY override tier
(`#color`, a stereotype-qualified `stateBackgroundColor<<X>>`, a bare
`state`-element `<style>`/`skinparam stateBackgroundColor` bucket) makes it
opaque.

Corpus-anchored: a disposable probe (`scripts/_tmp-c5-*`, deleted before
finishing) counted direct `<path>` children of every corpus fixture's
lone `class="cluster"` element: **68/82 fixtures draw exactly 1 path
(header only), 13/82 draw 2 (header + body), 1/82 draws 0** (a degenerate
case, not investigated). Cross-referencing the 13 two-path fixtures'
`.puml` against the 68 one-path fixtures' own: every two-path sample has
SOME background override this port's own `resolveStateFillBucketed`
ALREADY implements (`rufosi-58-kegi649`'s per-node `state Inner1 #red {`;
`vekoja-22-made430`'s `skinparam StateBackgroundColor green`;
`zumeri-82-julo078`'s `<style>state{BackgroundColor green}</style>`;
`lojeju-04-fadu517`/`nuvura-69-mafe604`'s `<style>state{BackGroundColor
yellow;...}</style>`), OR a `<style>stateDiagram{BackgroundColor cyan}
</style>` diagram-level cascade (`decede-10-buvu414`/`tofezi-64-koda860`/
`xojudi-20-keco020` — NOT covered by this fix, see "Residual" below), OR
the entrypoint/exitpoint family's own excluded `<<entryPoint>>`/
`<<exitPoint>>`/`<<inputPin>>`/`<<outputPin>>`/`<<expansionInput>>` cases
(`cinoni-00-sere847`/`jufevo-34-taxu911`/`nijugi-19-jazi166`, already
ineligible for `renderClusterMeasured` at all via the `hasBorderPointChildren`
gate — irrelevant to this fix). Every 1-path (default-styled) sample,
including `gojuja-90-pune699`'s own `A` (the mission's own named fixture,
zero override, zero body-fill in the real oracle) and `bujuta-44-rovo666`'s
excluded `Somp`, has NO override at all.

**Fix**: `renderClusterMeasured` (`renderer-composite-box.ts`) gates the
existing `compositeBodyPath` call on `fill !== STATE_DEFAULT_BACKGROUND`
(`fill` is `resolveStateFillBucketed(node, theme, STATE_DEFAULT_BACKGROUND)`,
the SAME pre-existing resolution the header path already used) — this
port has no per-zone (header/description/body) style bucket of its own, so
"any override tier fired at all" is the closest available signal without
building that whole 3-zone system; explicitly does NOT cover the
diagram-level `<style>stateDiagram{}</style>` cascade tier (a SEPARATE,
already-named, pre-existing gap — C3's own "known, unrelated divergences"
note: this port does not apply diagram-level `<style>` cascades to state
diagrams at all yet).

Re-verified `gojuja-90-pune699`'s own `childCount` diff (`g[1]/g[1]
[childCount] actual=5 expected=4`, present before this fix) is GONE after
landing it (direct `compareSvg` probe, not assumed).

### Residual (NOT closed this iteration) — a THIRD, newly-confirmed
### pre-existing gap blocks every eligible cluster from true zero-diff

After landing items 1a/1b/2, re-measured `gojuja-90-pune699` and
`decede-10-buvu414` (the mission's own two named target fixtures) plus 3
additional 1-path samples (`bujuta-44-rovo666` — EXCLUDED, entrypoint-family,
diffCount 5, ALL attributable to the `hasBorderPointChildren` eligibility
exclusion, unrelated; `cakaxu-97-nexe753`; `fevida-60-kope208`) via a
disposable `compareSvg`-based probe (`scripts/_tmp-c5-fulldiff.ts`,
deleted before finishing) — NONE reach zero. `gojuja`'s `A` and
`fevida`'s cluster BOTH show the SAME consistent pattern: this port's own
cluster WIDTH is a constant ~16px (occasionally ~14-17px, fixture-
dependent) NARROWER than jar's real cluster, on both left and right edges
symmetrically (jar-verified `fevida-60-kope208`: `path/@d` x-coordinates
off by exactly 14-16 on every vertex; `gojuja-90-pune699`'s `A`: off by
16.0013/17 similarly) — this is EXACTLY the gap C3's own "NOT closed"
list already named but marked "wasn't independently re-verified":
"the SIDE/BOTTOM margin formula (already named non-constant by S1/S3/S6 —
16px vs 24px...)".

**Mechanism (per diagnosis.md, characterized not fully root-caused —
severe time budget, correctly deferred rather than forced).** C3's own
chunk 3 wires `materializeCluster` to read the pass's REAL
`DotLayoutResult.clusters` bbox (graphviz's OWN computed cluster polygon)
when eligible. That bbox IS real graphviz output — but graphviz's own
DEFAULT cluster margin (C2's own jar-verified finding, `docs/graphviz-
issues/06`: 8pt) is NOT jar's real ~16px side margin. `DotInputCluster
.titleTableWidth` (fed to `setHtmlAttr`, `measureClusterTitle(s.display,
ctx).width`) is the TITLE's own narrow text width (e.g. 9.36px for `"E"`)
— far smaller than the member content's own footprint, so it does NOT
force graphviz to reserve any extra width; the FIXEDSIZE table only
constrains HEIGHT-driving reservation (the `CLUSTER_HEADER_HEIGHT=19`
mechanism, unaffected, still jar-exact). Jar's own real ~16px side margin
must come from a DIFFERENT DOT-emission mechanism (plausibly an explicit
`margin=` cluster attribute jar's own DOT string emits, per
`ClusterDotString.java`, that this port's `graph-layout-build.ts
#addClusters` does not yet set) — NOT derived further this iteration (a
genuinely new sub-investigation, not a continuation of items 1/2's own
evidence trail).

**Scope, precisely**: affects EVERY eligible (`renderClusterMeasured`-
routed) cluster fixture, not just the two named ones — confirmed on 3/3
additional non-entrypoint-family samples checked. This is why items 1a/1b/2
— all three independently jar-verified CORRECT — produce ZERO new
zero-diff pins this iteration: the width/margin gap is now the SOLE
remaining blocker for every plain-case cluster fixture, exactly as items
1/2 were before this iteration, but for a DIFFERENT, previously-
uncharacterized-as-still-broken mechanism.

### Entrypoint/exitpoint family (mission item 3) — correctly NOT attempted

Per the task's own framing ("land if they clear it"): items 1a/1b/2 do NOT
clear the path to a true zero-diff pin (see "Residual" above) — the width/
margin gap blocks the entrypoint family's own eligible-shape rendering
exactly as it blocks the plain case (both routes share `renderClusterMeasured`/
`materializeCluster`), on top of the family's OWN still-undereived
`portRanksLabelOnEe`/WithLabel-branch WIDTH/rank-chain shape (C3's own
"NOT closed" item, unchanged). Landing item 3's eligibility-gate widening
this iteration would produce a wrong-width shape for all 20 fixtures with
zero new pins — the SAME "fix that doesn't fix" failure mode C2 explicitly
declined to ship. Not attempted; C3's own baseline-margin constant (`5`)
remains the only re-usable output from that investigation.

### Fixture impact

**0 oracle fixtures changed** (`oracle/goldens/**` untouched). All four
censuses re-verified byte-identical to the C4 baseline: description
(no-arg) **48/355**, class **303/718**, object **22/80**, state **52/271**
— confirmed via TWO independent census runs (immediately after items 1a/1b
landed, alone, before item 2; and again after item 2 landed) — no fixture
crossed zero-diff at EITHER checkpoint. `oracle/goldens/state/size-
backlog.json`: **93 entries, byte-for-byte untouched** (`git status
--short` confirms) — none of this iteration's three changes affect
`node.width`/`node.height` (document/edge order is a pure array-order
change; conditional body-fill is a pure SVG-element-presence change), so
there was nothing to tighten.

### Gates (C5, final)

- `npm run typecheck`: clean (both configs).
- `npm run lint`: clean.
- `npm test -- --run`: **10144 passed | 5 skipped** (381 files) — up from
  C4's 10142/5 (+2: this iteration's own 2 new `layout.test.ts` cases; the
  5 skipped are UNCHANGED, still C1's reverted sites-2/3 evidence,
  untouched this iteration per the write-set's own forbidden list).
- DOT gate (verbatim `structurally EQUAL` lines, both invocations):
  `structurally EQUAL (DOT in sync): 262 (100%)` (component)
  `structurally EQUAL (DOT in sync): 90 (100%)` (usecase)
  `structurally EQUAL (DOT in sync): 708 (100%)` (class)
  `structurally EQUAL (DOT in sync): 78 (98%)` (object)
  `structurally EQUAL (DOT in sync): 267 (100%)` (state)
  — EXACTLY unchanged from the frozen baseline (component 262/262 · usecase
  90/90 · class 708/708 · object 78/80 · state 267/267), re-verified fresh
  after every item landed.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268**, unchanged.
- `description.golden.ratchet.test.ts`: **51 tests** (unchanged).
- `class.golden.ratchet.test.ts`: **305 tests** (unchanged).
- `object.golden.ratchet.test.ts`: **24 tests** (unchanged).
- `state.golden.ratchet.test.ts`: **54 tests** (unchanged).
- Censuses: description (no-arg) **48/355**, class **303/718**, object
  **22/80**, state **52/271** — all byte-identical to the C4 baseline.

### Ratchet / pins

**0 new pins.** No fixture reached full byte-exact zero-diff this
iteration for any of the four `golden.ratchet.test.ts` suites (all four
counts unchanged from baseline) — see "Residual" above for the precise,
jar-verified reason (a third, newly-confirmed width/margin gap, not a
defect in items 1a/1b/2 themselves).

### Files changed (C5)

- `src/diagrams/state/state-composite-pseudo.ts` — `sortSpecsByDocumentOrder`
  (NEW, exported).
- `src/diagrams/state/state-composite-pass.ts` — `buildTopLevelPass` uses
  `sortSpecsByDocumentOrder` for its own top-level `specs`;
  `buildLevelTransitionGeos` sorts its own return value via the
  pre-existing `sortSpecsByCreationIndex`; both re-exported/imported
  accordingly.
- `src/diagrams/state/renderer-composite-box.ts` — `renderClusterMeasured`
  gates `compositeBodyPath` on `fill !== STATE_DEFAULT_BACKGROUND`.
- `tests/unit/state/layout.test.ts` — 2 new tests (document-order hoisting
  + regression guard).
- `plans/g5-measurer-calibration/{README.md,ledger.md,decision-journal.md}`
  — this entry.

### C6+ queue

1. **PRIORITY, newly characterized this iteration**: the cluster WIDTH/
   side-margin gap (graphviz's own 8pt default cluster margin vs jar's
   real ~16px) — blocks EVERY eligible cluster fixture (confirmed on 5/5
   samples checked: `gojuja-90-pune699`, `decede-10-buvu414`,
   `cakaxu-97-nexe753`, `fevida-60-kope208`, plus `bujuta-44-rovo666`
   which is separately excluded). Needs its own jar-source derivation of
   HOW jar's real DOT emission forces the extra ~16px (plausibly an
   explicit `margin=` cluster attribute `ClusterDotString.java` emits that
   `graph-layout-build.ts#addClusters` does not yet set) — NOT the same
   mechanism as `CLUSTER_HEADER_HEIGHT`'s own jar-calibrated constant
   (which remains correct, unaffected).
2. **After (1) closes**: re-verify `gojuja-90-pune699`/`decede-10-buvu414`
   reach true zero-diff (items 1a/1b/2, already landed here, should need
   NO further changes — re-verified as the ENTIRE remaining blocker for
   both fixtures once (1) closes, modulo `decede`'s own SEPARATE, already-
   named `<style>stateDiagram{}</style>` cascade gap and the pre-existing
   `class="entity"` vs `class="cluster"` divergence, both confirmed
   unrelated to mechanism 16 by C3).
3. **Entrypoint/exitpoint family (20 fixtures)**: reachable once (1)
   closes AND the family's own `portRanksLabelOnEe`/WithLabel-branch
   WIDTH/rank-chain shape is derived (C3's own unresolved item, unchanged).
4. **The diagram-level `<style>stateDiagram{}</style>` cascade tier**
   (item 2's own residual, `decede-10-buvu414`/`tofezi-64-koda860`/
   `xojudi-20-keco020`'s shared root cause) — a separate, pre-existing,
   larger feature (this port applies NO diagram-level `<style>` cascade to
   state diagrams at all), confirmed unrelated to mechanism 16.
5. **Nested-cluster (inside another cluster, or inside an autonom pass)
   document order** — `sortSpecsByDocumentOrder`'s own scoping note: no
   corpus fixture currently exercises this case, left unverified/
   unapplied at the nested call sites.
6. **Sites 2/3, edge-label-ink mechanism, the `buildPlainAutonomSpec`
   floor**: unchanged from C1-C4, still parked, still needs its own
   orchestrator/maintainer sign-off (3-strike rule, now 4 prior attempts).
7. **Unchanged from C0-C4**: the secondary `gutute-00-gaki684` (component
   port-label divergence) finding remains unresolved, low priority.
## C6 — fifth attempt at the edge-label-ink mechanism (maintainer sign-off
## 2026-07-21, "Attempt the floor fix"), targeted precisely at C4's own
## isolated root: `buildPlainAutonomSpec`'s `Math.max(geometry.width,
## result.width)` floor exists ONLY because `geometry.width`'s own ink walk
## never folded label ink in at all -- LANDED the fold (new `TransitionGeo
## .labelInk`, real graphviz `labelX/labelY` centered box), re-landed C1's
## font-fix (sites 2/3) + C4's HTML-FIXEDSIZE injection verbatim, then
## PROVED THE FLOOR IS FULLY DEAD CODE (0/267 fixtures differ with vs.
## without it, corpus-wide, not just the control set) -- but the injection+
## font-fix package it depends on (C4's OWN mechanism, unchanged from C4)
## still regresses 6/268 `state-dot-parity.test.ts` fixtures past their
## pinned ceiling, all attributable to that pre-existing, already-
## characterized C4 residual, NOT to this iteration's own geometry-fold
## contribution (proven: identical deltas with the floor present or
## removed for every failing fixture) -- REVERTED IN FULL per protocol; 0
## net change to any protected set; the floor's dead-code status is now
## the mission's most load-bearing NEW finding for a sixth attempt

### The attempt, precisely (per authorization's own three-step order)

**Step 1 — fold label ink into `geometry.width`/`height`.** Added
`TransitionGeo.labelInk?: {x, y, width, height}` (`state-geo-types.ts`) --
deliberately SEPARATE from the pre-existing `label` field (the render-
position field, driven by `attachTransitionLabel`'s own perpendicular-
offset-from-spline-midpoint approximation), mirroring G4 S13 Variant 2's
OWN structural precedent (a dedicated `labelInk` field, not reusing the
render-position formula) but with the material difference the
authorization named: this attempt's `labelInk.x/y` is graphviz's REAL
computed label-reservation CENTER (`DotLayoutResult.edges[].labelX/labelY`,
`graph-layout.ts#mapEdges`) and `labelInk.width/height` is the measured box
FED into that same layout pass (`DotLayoutResult.edges[].labelWidth/
labelHeight`, an echo of `DotInputEdge.attributes.labelWidth/labelHeight`)
-- populated in `state-composite-pass.ts#buildLevelTransitionGeos` from the
SAME `edgeResult` already in scope there, no new plumbing needed.
`layout-ink-extent.ts#addTransitionInk` now adds the FULL box (`[x-w/2,
y-h/2]`..`[x+w/2, y+h/2]`) when `labelInk` is present, falling back to the
pre-existing single-point `label.x/y` contribution otherwise (the flat
pipeline, and any hand-built test geometry, are unaffected -- neither
builds `labelInk`). `shiftDotLayoutResult` already shifted `labelX`/
`labelY` in lockstep with `points` (pre-existing, C2-era code, unchanged),
so the box rides the SAME per-pass origin translation as everything else
in the ink walk -- verified by inspection, not assumed.

**Step 2 — re-landed C4's validated stack, verbatim.** `DotInputEdge
.attributes.measuredLabelBox?: true` (NEW opt-in flag, same design as C4's
own -- gates `graph-layout-build.ts#addEdges` on `measuredLabelBox === true`
AND both dims present, skipping the plain-text `label` attr for a real HTML
`<TABLE FIXEDSIZE="TRUE" WIDTH=".." HEIGHT="..">` via `GvEdge.setHtmlAttr`,
mirroring `addClusters`'s `hasTitleTable` branch verbatim, C3's own public-
API precedent). Set ONLY by `state-composite-edge-label.ts#edgeLabelAttrs`
for the note-free case (identical scoping to C4). `state-composite-pass.ts`
sites 2/3 (`addLevelEdges`/`sweepOrphanEdges`) re-exported and used
`ARROW_LABEL_FONT_SIZE` (13, `state-dot-graph.ts`) instead of
`theme.fontSize` (14) -- C1's own fix, verbatim. Un-skipped all 5 tests in
`tests/unit/state/state-composite-pass.test.ts` -- all 5 PASS unchanged
(the font-size math was never in question, only what consumes it, exactly
as C1's own file header already stated). Deliberately did NOT re-land C4's
render-position `labelX`/`labelY`-via-`textAscent` readback for
`attachTransitionLabel` -- out of scope for the geometry-only root-cause
fix this authorization named, and untested by C4 in isolation either
(C4's own decision journal explicitly declined to isolate injection from
readback, calling that split "the forbidden formula-search pattern"); this
iteration's `labelInk` is a THIRD, independent readback path (ink-only,
never touching render position), so leaving the render-position formula
untouched keeps the render-visible output identical to C5's baseline for
every fixture whose `structurallyEqual`/DOT-gate check does not move.

**Step 3 — tested whether the floor is now dead, per the authorization's
own instruction ("remove the floor... once 1+2 make it dead").** Replaced
`childImg = {width: Math.max(geometry.width, result.width), height:
Math.max(geometry.height, result.height)}` with `childImg = {width:
geometry.width, height: geometry.height}` in `state-composite-autonom.ts
#buildPlainAutonomSpec` and re-ran the FULL `oracle/goldens/state/`
corpus (267/268 fixtures — see "off-by-one" note below) with and without
this change. **Result: byte-identical outcome for EVERY SINGLE FIXTURE,
including all 6 that fail** (see "Control-set outcome" below) — the floor
resolves to `geometry.width`/`height` unconditionally now; `result.width`/
`height` is never the larger operand for any fixture in the corpus. This is
a stronger, corpus-wide confirmation of "the floor is dead" than the
15/23-fixture control set alone could prove.

### Probe/verification tooling

`scripts/_tmp-c6-deltas.ts` (disposable, deleted before finishing): computes
`maxSizeDeltaIn` for either the 15-fixture control set or the full
`oracle/goldens/state/` corpus directly against `size-backlog.json`, without
paying the full `npm test` cost per iteration — mirrors `scripts/_tmp-s13-
deltas.ts`/`scripts/_tmp-c4-deltas.ts`'s own established pattern. Its "267
fixtures" count differs by exactly 1 from the real `state-dot-parity.
test.ts` suite's "268 tests" (confirmed via direct `npx vitest run` — the
authoritative source of truth used for every PASS/FAIL number in this
entry) — NOT chased further (same diminishing-returns precedent as C1's own
"10130 vs 10128" baseline-discrepancy note); every number reported below
that matters for the go/no-go decision was independently cross-checked
against the real vitest suite, not the disposable script alone.

### Control-set outcome (baseline re-verified FIRST: all 15 control-set
### fixtures + the FULL 268-fixture ratchet PASS at C5 HEAD, matching
### `size-backlog.json` exactly with ZERO headroom on every one of the 15 —
### confirms this iteration started from the documented C5 baseline, not a
### stale or drifted one)

| Fixture | C4's own delta/verdict | C6 (this attempt) delta/verdict | Verdict |
| --- | --- | --- | --- |
| bemena-23-zebu249 (S13 founding evidence) | 0.110003 PASS | 0.068337 | **PASS**, MORE headroom than C4 |
| jaxebo-54-nifi592 (S13: "unrelated... at all 3 variants") | 0.060950 PASS | 0.060950 | **PASS**, unchanged from C4 |
| jorere-75-peja265 | 0.110592 PASS | 0.068337 | **PASS**, more headroom |
| ketibo-84-juzo029 | 0.110592 PASS | 0.068337 | **PASS**, more headroom |
| mifuti-36-jine785 (S13: "unrelated... at all 3 variants") | 0.060950 PASS | 0.060950 | **PASS**, unchanged from C4 |
| pajefo-95-neri955 | 0.110003 PASS | 0.068337 | **PASS**, more headroom |
| xepafa-33-lazi826 | 0.110003 PASS | 0.068337 | **PASS**, more headroom |
| zitifa-97-bizo337 | 0.110592 PASS | 0.068337 | **PASS**, more headroom |
| zacajo-09-tamu628 (S13's own control) | 0.083333 PASS | 0.083333 | **PASS**, unchanged from C4 |
| bunade-42-fudu910 (S4's own original target) | 0.099275 FAIL | 0.043719 | **PASS** (NEW — C4 could not clear this one) |
| bajelo-54-dixe684 (S13: "unrelated... identical across every variant") | 0.993056 FAIL | 0.993056 | **FAIL**, byte-identical to C4 |
| nimana-36-veco708 (site 3's own founding fixture) | 0.158763 FAIL | 0.138889 | **FAIL**, improved vs. C4 but still over |
| pesita-10-dene726 (S13: "large pre-existing gap" control) | 0.806638 FAIL | 0.848304 | **FAIL**, WORSE than C4 (+0.041666) |
| rovese-43-tadu368 (S13: "unrelated... identical across every variant") | 0.687500 FAIL | 0.687500 | **FAIL**, byte-identical to C4 |
| beguxu-19-tize774 (S13's own control, zero pre-existing headroom) | 0.027778 FAIL | 0.027778 | **FAIL**, byte-identical to C4 |

**10/15 PASS (up from C4's 9/15), 5/15 FAIL (down from C4's 6/15).**
Plus, of C4's own 8 non-control-set backlog regressions (`dulixa-11-
kufe247`, `fojisi-40-zogo372`, `fomusu-59-fupe538`, `fotuje-06-fifa085`,
`kejabo-83-vinu490`, `kujaju-47-neku764`, `mosigo-88-rove013`, `nuboca-13-
xape657`), **7/8 now PASS** — only `fotuje-06-fifa085` still fails, and
only barely (`maxSizeDeltaIn=2.746328` vs. allowed `2.732987`, an overshoot
of `0.013341`, the smallest margin of any failure this iteration).

**Full `state-dot-parity.test.ts` (268 fixtures, the authoritative real
vitest run, not the disposable script): 262 passed, 6 failed** — `bajelo-
54-dixe684`, `beguxu-19-tize774`, `fotuje-06-fifa085`, `nimana-36-veco708`,
`pesita-10-dene726`, `rovese-43-tadu368`. This is a materially SMALLER
failing set than C4's own 14 (268→254), but it is still nonzero, so per the
mission's own explicit bar ("size-backlog final state may not widen ANY
entry") this attempt does **NOT** clear the gate.

### Mechanism of the 6 failures — the floor is proven NOT the cause; the
### injection/font-fix package (C4's own mechanism) is (per diagnosis.md —
### cause, origin, causal chain, ruled out)

**Mechanism.** Step 3's own experiment (floor present vs. removed,
byte-identical outcome for all 267/268 fixtures) is a DIRECT, corpus-wide
proof that `Math.max(geometry.width, result.width)`'s SECOND operand
(`result.width`) is NEVER the binding value anymore, for ANY fixture —
`geometry.width` (now label-ink-aware) always dominates. This means the 6
failures cannot be attributed to the floor's own formula at all; they are
caused by something upstream of BOTH operands.

**Origin.** Comparing this iteration's per-fixture deltas against C4's own
(same table above): `bajelo-54-dixe684`, `rovese-43-tadu368`, and `beguxu-
19-tize774` are BYTE-IDENTICAL to C4's own measurement — meaning this
iteration's entire NEW contribution (the `labelInk` fold) changes NOTHING
for these three; their regression (relative to the C5/pre-C4 baseline,
where all three passed with zero headroom) is caused PURELY by re-landing
C4's OWN injection+font-fix package, unchanged since C4 first measured it.
`pesita-10-dene726` is WORSE under this iteration (0.848304 vs. C4's
0.806638, +0.041666) — the ONE fixture where the `labelInk` fold itself
demonstrably makes an already-large, already-pre-existing gap (S13's own
"large pre-existing gap" framing) larger still. `nimana-36-veco708` and
`fotuje-06-fifa085` both improve materially over C4 but do not cross the
line.

**Causal chain.** C4's own ledger entry already named this precisely: the
injection mechanism makes `result.width` MORE ACCURATE (real graphviz
label reservation, not a Times-font guess) — for fixtures where a
pre-existing, SEPARATE mechanism (S13's own "unrelated... identical across
every variant" framing for bajelo/rovese, and the "large pre-existing gap"
framing for pesita) is the TRUE dominant error source, a more-accurate
`result.width` does not help, because that mechanism never depended on
`result.width`'s accuracy in the first place. This iteration's OWN
`labelInk` fold makes `geometry.width` correspondingly MORE accurate too —
which is why the floor is now dead (both operands converge toward the
truth) — but "more accurate" does not mean "jar-exact" for composites whose
dominant error is a THIRD, unrelated mechanism (mechanism-16/deep-nesting
territory per S13's own naming, or the still-unresolved entrypoint/exitpoint
family per C3/C5's own queue) that this attempt was never targeted at.

**Ruled out** (in order investigated, mirroring C1/C4/S13's own discipline):
1. **A defect in the `labelInk`-fold mechanism itself** — ruled out: the
   floor-present-vs-removed experiment is a clean, corpus-wide proof the
   fold makes `geometry.width` the binding operand everywhere (a POSITIVE
   result — the fold is doing real, correct work); 10 fixtures net-improve
   over C4 (including `bunade`, newly PASSING, and 7/8 backlog regressions
   newly fixed), none of which the floor-toggle experiment attributes to
   luck (removing the floor changes NOTHING, so the improvement is real
   ink-accuracy, not an artifact of the `Math.max` selection).
2. **The floor itself, as a residual, still-needed guard for SOME fixture**
   — ruled out MORE conclusively than the authorization's own step 3 asked
   for: not just the 15/23 control-set fixtures but the FULL 267/268-fixture
   corpus shows zero behavioral difference with vs. without the floor. The
   floor is unconditionally dead code once items 1+2 land together.
3. **A NEW defect this iteration introduced, independent of C4's own
   mechanism** — ruled out for 3 of 6 failures (bajelo/rovese/beguxu are
   byte-identical to C4's own already-reported numbers — this iteration's
   `labelInk` fold contributes NOTHING to their outcome, positive or
   negative); ruled out as the SOLE cause for the other 3 (nimana/fotuje
   both IMPROVE under this iteration, ruling out "this iteration made
   things categorically worse" for them) but NOT ruled out as a
   CONTRIBUTING factor for `pesita` specifically (the one fixture that
   measurably worsens vs. C4) — not root-caused further this iteration
   (would require its own dedicated diagnosis of `pesita`'s specific
   composite shape, out of this iteration's "no formula variants"
   boundary).

### Revert (per the mission's own explicit protocol, mirroring C4/S13's
### identical precedent)

Restored every touched file byte-for-byte to the C5 HEAD commit
(`df1ecb5`) via `git show HEAD:<path> > <path>`: `src/core/graph-layout-
build.ts`, `src/core/graph-layout.types.ts`, `src/diagrams/state/
layout-ink-extent.ts`, `src/diagrams/state/state-composite-autonom.ts`,
`src/diagrams/state/state-composite-edge-label.ts`, `src/diagrams/state/
state-composite-pass.ts`, `src/diagrams/state/state-dot-graph.ts`,
`src/diagrams/state/state-geo-types.ts`, `tests/unit/state/
state-composite-pass.test.ts` (re-`describe.skip`'d, unchanged from C1/C4's
own state). Deleted the disposable probe (`scripts/_tmp-c6-deltas.ts`).
`git status --short`/`git diff --stat` both verified EMPTY before
re-running any gate.

### Fixture impact

**0 oracle fixtures changed** (fully reverted). `oracle/goldens/**`
untouched. `oracle/goldens/state/size-backlog.json`: **untouched, 93
entries** (byte-for-byte, `git status --short` confirms).

### Gates (C6, final state — fully reverted, byte-identical to C5's own
### final state)

- `npm run typecheck`: clean (both configs).
- `npm run lint`: clean.
- `npm test -- --run`: **10144 passed | 5 skipped** (381 files) —
  IDENTICAL to C5's own final count (the 5 skipped are UNCHANGED, still
  C1's reverted sites-2/3 evidence; this iteration's own re-land-then-
  revert cycle left no new test file behind).
- DOT gate (verbatim, re-verified fresh AFTER the revert):
  `structurally EQUAL (DOT in sync): 262 (100%)` (component)
  `structurally EQUAL (DOT in sync): 90 (100%)` (usecase)
  `structurally EQUAL (DOT in sync): 708 (100%)` (class)
  `structurally EQUAL (DOT in sync): 78 (98%)` (object)
  `structurally EQUAL (DOT in sync): 267 (100%)` (state)
  — EXACTLY unchanged from the frozen baseline (component 262/262 · usecase
  90/90 · class 708/708 · object 78/80 · state 267/267), also re-verified
  fresh WHILE the attempt was landed (same five counts, confirming the
  attempt never touched DOT-structural output, only sizing).
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268** at the
  START and END of this iteration (dipped to 262/268 — 6 failures — while
  the attempt was landed; fully restored by the revert).
- `description.golden.ratchet.test.ts`: **51 tests** (unchanged).
- `class.golden.ratchet.test.ts`: **305 tests** (unchanged).
- `object.golden.ratchet.test.ts`: **24 tests** (unchanged).
- `state.golden.ratchet.test.ts`: **54 tests** (unchanged).
- Censuses, re-verified fresh after the revert (not assumed): description
  (no-arg) **48/355**, class **303/718**, object **22/80**, state
  **52/271** — all byte-identical to the C5 baseline. Also re-verified
  MID-iteration (attempt landed, before revert): identical counts even
  while the attempt was live — same "the two protected sets are
  independent" confirmation C4 already established, reproduced here.

### Ratchet / pins

**0 new pins** (fully reverted; no landed work survives this iteration).

### Files changed (C6)

None survive — fully reverted. Touched-then-reverted: `src/core/graph-
layout-build.ts`, `src/core/graph-layout.types.ts`, `src/diagrams/state/
layout-ink-extent.ts`, `src/diagrams/state/state-composite-autonom.ts`,
`src/diagrams/state/state-composite-edge-label.ts`, `src/diagrams/state/
state-composite-pass.ts`, `src/diagrams/state/state-dot-graph.ts`,
`src/diagrams/state/state-geo-types.ts`, `tests/unit/state/
state-composite-pass.test.ts`. Created-then-deleted: `scripts/_tmp-c6-
deltas.ts`. Only `plans/g5-measurer-calibration/{README.md,ledger.md,
decision-journal.md}` (this entry) remain changed.

### Secondary item (C5's own margin-gap queue item 0/1): NOT attempted

Per the authorization's own item 5 ("only if the attempt lands") — the
attempt did not clear the control set, so the cluster side-margin
investigation (graphviz's 8pt default vs. jar's real ~16px) was correctly
NOT started this iteration.

### C7+ queue

1. **The floor (`buildPlainAutonomSpec`'s `Math.max(geometry.width,
   result.width)`) is now PROVEN dead code once `labelInk`-style ink
   folding + C1's font-fix + C4's HTML injection are ALL landed together**
   — confirmed corpus-wide (267/268 fixtures), not just the 15/23 control
   set. A sixth attempt does NOT need to re-derive or re-verify the floor's
   removal — that question is now closed. `geometry.width`/`height` alone
   (dropping `Math.max` with `result.width`/`height` entirely) is the
   correct final formula once the injection/font-fix package is safe to
   land.
2. **The REAL remaining blocker is C4's own injection/font-fix package**
   interacting with 3 SPECIFIC, already-named-elsewhere mechanisms, not
   the floor: (a) `bajelo-54-dixe684`/`rovese-43-tadu368` — S13's own
   "unrelated... identical across every variant" framing, unchanged by
   BOTH C4's and this iteration's own work (byte-identical deltas in both);
   likely mechanism-16/deep-nesting territory (C2/C3's own naming) — a
   plausible next target is checking whether C5's still-open cluster
   side-margin gap (graphviz's 8pt vs. jar's ~16px) is the ACTUAL shared
   root for these two specifically, since both are deep-nesting composite
   families. (b) `pesita-10-dene726` — S13's own "large pre-existing gap"
   control, the SINGLE fixture this iteration made WORSE than C4
   (+0.041666); its own composite shape (entrypoint/exitpoint-bearing,
   deeply nested) was never isolated as its own mechanism — a dedicated
   diagnosis of `pesita` alone (not a formula variant on the shared
   `labelInk` mechanism) is the correct next step, per this iteration's own
   "no formula variants" boundary. (c) `beguxu-19-tize774`/`fotuje-06-
   fifa085`/`nimana-36-veco708` — all three IMPROVED this iteration and are
   now failing by SMALL margins (`+0.006945`, `+0.013341`, `+0.048611`
   respectively) — the closest to clearing of any residual failures in the
   mission's history; worth re-measuring FIRST once (a)/(b) are
   independently understood, since closing either might shrink these
   margins to zero as a side effect (mirrors this iteration's own
   discovery that `bunade` and 7/8 backlog regressions cleared as a SIDE
   EFFECT of the `labelInk` fold, without being independently targeted).
3. **Sites 2/3 + C4's injection mechanism themselves are FULLY
   re-landable verbatim** the moment (2a)/(2b) close — no further formula
   search needed on the injection/readback/ink-fold side, only on the
   3 residual fixtures' own, more precisely scoped mechanisms. This is now
   the mission's SIXTH prior attempt at (some part of) this floor/mechanism
   (S4, S13×3, C4, C6) — a seventh needs its own explicit orchestrator/
   maintainer sign-off, scoped EXACTLY to item 2(a)/2(b)/2(c) above, not a
   general re-attempt of the whole mechanism.
4. **C5's own C6+ queue items 1-5 unchanged** (cluster side-margin gap,
   entrypoint/exitpoint family, multi-line/action-text/stereotype cluster
   titles, the diagram-level `<style>stateDiagram{}</style>` cascade tier,
   nested-cluster document order) — NOT attempted this iteration per the
   authorization's own item 5 gating them on the floor attempt landing,
   which it did not.
5. **Unchanged from C0-C5**: the secondary `gutute-00-gaki684` (component
   port-label divergence) finding remains unresolved, low priority.

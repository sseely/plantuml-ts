# Mission Index — the executable grind queue

The `roadmap.md` is the *why*. This is the *what-next, executably*: a work
queue a loop can pull from. Each mission has a **status**, a **blocked-by**
list, an **exit bar** (how you know it's done), and a **measurement** (the
command that reports progress). The grind loop reads this file, picks the
lowest-ID mission that is `todo` and unblocked, executes it to its exit bar,
flips it to `done`, and repeats.

This is the whole-port analog of `plans/dot-oracle-sync/loop-protocol.md`:
that file loops *within* one mission; this file loops *across* missions.

## Grind protocol (meta-loop)

1. **Pick.** Lowest-ID mission with `status: todo` and every `blocked-by`
   already `done`. Ties: lower ID first.
2. **Brief.** If the mission has no `plans/<name>/` brief, generate one with
   `/plan-mission` before executing. Missions that are themselves loops
   (depth passes, new diagram types) get a `loop-protocol.md` like
   dot-oracle-sync's.
3. **Execute** to the exit bar. Depth/type missions run as their own inner
   loop (diagnose → port → ratchet → commit per iteration).
4. **Verify** the exit bar with the measurement command. Do not flip to `done`
   on vibes — the command must report the bar met.
5. **Record.** Flip `status` here, one commit. Ledger anything deferred.
6. **Repeat.** Compact between missions; re-read this file after compaction.

**Standing rule (from roadmap §1): never mark a diagram type `done` on
breadth alone.** A type is `done` only when its depth gate is met. The gate is
a **conformance verdict**, not a feeling — see `planning/conformance.md`.
Graded (graphviz-ts model): `conformant` (structure + numeric-in-tolerance +
non-numeric-exact) is the bar; `structural-match` (shape right, numbers
drifting) is progress; report both percentages. Today's DOT bar measures
`structural-match` (sizes tolerant); S1i unlocks `conformant`. Types that
render but are unverified are `shallow`, not `done`.

## Status legend

- `done` — exit bar met and verified.
- `shallow` — renders output, depth UNVERIFIED (breadth-only). Needs a depth pass.
- `wip` — in progress.
- `todo` — not started, unblocked or blocked (see blocked-by).
- `spike` — needs a decision/experiment before it becomes a normal mission.

---

## Phase A — Depth passes (highest ROI: convert shallow → faithful)

Reuse the dot-oracle-sync harness (`scripts/dot-sync-report.ts`, the ratchet,
per-type goldens). Each is an inner loop to ≥90% EQUAL + zero unexplained.

| ID | Mission | Status | Blocked-by | Exit bar | Measurement |
|----|---------|--------|-----------|----------|-------------|
| A1 | description DOT-sync | done | — | ≥90% structural-match now (→ conformant after S1L) + every miss ledgered, both corpora. **DONE 2026-07-12: component 251/259 (97%), usecase 79/87 (91%), zero unledgered** — plans/dot-oracle-sync/ (P2/i1–i28; ledger: kermor pragma, set-separator, remove-<<stereotype>> link removal, stdlib SI5 family, TIM-json family, rich-text measurement). Conformant flip still gated on S1L. | `npx tsx scripts/dot-sync-report.ts component usecase` |
| A2 | class DOT-sync | done | A1, S1L | class ≥90% conformant + ledger. **Baseline 2026-07-06: 1% EQUAL (9/680)** — needs the STRUCTURAL port (HTML-table class nodes + compartments, qualifier ports, newpage, edge decorations), NOT sizing. Scoped in `planning/a2-class-dot-sync.md`; warrants `/plan-mission`. Reuses S1L infra. **DONE 2026-07-11: 680/680 comparable EQUAL (100%), zero divergences, empty ledger** — plans/class-dot-sync/. Unblocks A3/A4; queue class SVG-conformance (tier 2) next. | `npx tsx scripts/dot-sync-report.ts class` |
| A3 | object DOT-sync | done | A2 | object ≥90% conformant + ledger. **DONE 2026-07-11: 78/80 comparable EQUAL (98%), 2 ledgered (creole `{{}}` embedded sub-diagrams — unimplemented subsystem), zero unledgered** — plans/object-dot-sync/. Object absorbed into the class engine (upstream has no object engine); `map`/embedded-`json` ported; 78-golden ratchet with per-fixture size pins (29-entry shrink-only size backlog in oracle/goldens/object/size-backlog.json). | `npx tsx scripts/dot-sync-report.ts object` |
| A4 | state DOT-sync | done | A2 | state ≥90% conformant + ledger. **DONE 2026-07-12: 260/261 comparable EQUAL (99.6%), 1 ledgered (graphviz-ts render crash on verified-correct DOT — file upstream), zero unledgered** — plans/state-dot-sync/. Svek-faithful rewrite (two-pass ParserPass parse, quark name resolution incl. dotted-id hierarchy, autarkic child passes in getOrdered global order, CONC regions as first-class firing units, cluster envelopes + zaent, notes/json leaves); 260-golden ratchet with shrink-only size backlog (~90 entries = the size-fidelity work queue). | `npx tsx scripts/dot-sync-report.ts state` |
| A5 | json/yaml/hcl depth | spike | S2 | oracle defined + type ≥90% on it | (blocked on S2 decision) |

Note: A2–A4 assert node sizes (not tolerant) from the start — goldens are now
captured under deterministic measurement (**S1i** done), but the leaf-box sizing
port (**S1L**) must land first so the port's sizes actually match; otherwise the
size assertion fails on the same box-height/multi-line gaps found for description.

## Phase B — Decisions/spikes that unblock large tranches

Resolve before spending on the missions they gate.

| ID | Mission | Status | Blocked-by | Exit bar | Notes |
|----|---------|--------|-----------|----------|-------|
| S1 | text-measurement fidelity strategy | done | — | ADR-001 accepted: port PlantUML's `UnicodeFontWidthSansSerif` width table + neutralize oracle via `SVG_DETERMINISTIC` | Resolved 2026-07-05 — graphviz-ts neutralization pattern; see `planning/adr/ADR-001-text-measurement.md` |
| S1i | S1-impl: `WidthTableMeasurer` + oracle re-baseline | done | S1 | ✅ width table + `WidthTableMeasurer` (14 tests). ✅ oracle re-captured under `-DPLANTUML_DETERMINISTIC_TEXT` + all 294 goldens re-pinned deterministic (commit `e8d124d`); structure unchanged (component 234/259, usecase 59/87), ratchet green. **Sizes stay tolerant** — asserting them is blocked on S1L (measurement is now neutral; residual is proven layout) | Neutralization done; the tolerant→asserted flip moves to **S1L** below |
| S1L | description leaf-box sizing port (unlocks `conformant`) | wip (plateaued) | S1i | Port `EntityImageDescription.calculateDimension` + USymbol `asSmall` margins + multi-line text-block height into `measureLeafNode`, then move `width`/`height` tolerant→asserted in `compareStructural`. Exit: ≥90% description `conformant` (≤0.01in) | **Diagnosed 2026-07-05**: box branch `layout-helpers.ts:171-175` has 3 gaps — (1) single-line height 35.6px vs oracle 44px (0.611in); (2) no multi-line term (oracle +14px/line: 1-line 0.611→2-line 0.806); (3) variable/markup `display` measures empty → width falls to `BOX_MIN_WIDTH` vs oracle's real content. Only 4/262 EQUAL fixtures within ±0.01in today. `BOX_HEIGHT_FACTOR`/`EXTRA` are tolerant-era approximations. **Plateaued 2026-07-06 at 62% component / 44% usecase** size-conformance among structurally-EQUAL fixtures after ~14 passes (from ~1%) — everything cleanly exact is done; remainder is the messy/tolerance tier (package/folder tab geometry, interface shield, LaTeX/emoji/sprites, wrapWidth) with near-zero per-fix gains. Per `planning/s1l-leaf-sizing.md`: proceed to A2 (its infra is what A2 needs); revisit with a tolerance-exclusion policy (~67% conformant-among-sizeable) |
| S2 | Smetana-vs-svek oracle for json/yaml/hcl | spike | — | decision: extend oracle / new oracle / SVG-only scope | Current oracle can't see Smetana output |
| S3 | stub-engine authenticity audit | spike | — | oracle-diff neato/fdp/sfdp/circo/twopi/osage stubs vs upstream on consuming types; list which (if any) need authentic ports | Authentic ports are 0.5k–16k C lines each — avoid unless proven needed |
| S4 | stdlib include surface audit | done | — | frequency table of `!include <…>` across pdiff corpus → bundle priority list. **DONE 2026-07-12** — `planning/s4-stdlib-audit.md` | **Inverts SI5's assumed shape.** `!include` is rare: 69/5688 fixtures (1.2%). Bundle priority: **tupadr3 (19) → c4 (10) → cloudinsight (8) → archimate (6) → aws (5)**; top-5 = ~48 of ~60 stdlib fixtures; rest ≤2 each. But the *preprocessor* half is 3–4× bigger (`!define` 123, `!procedure` 50, `!unquoted` 48, `!function` 46, `!definelong` 42, `!startsub` 7 — union ~200, cross-type). TIM is started not absent: we have 2 of upstream's **76 builtins** + a partial Eater set. **Therefore SI5 splits into SI5a (preprocessor, unblocked) and SI5b (bundling, licensing-gated).** |

## Phase C — Shared infrastructure (unblocks multiple types)

| ID | Mission | Status | Blocked-by | Exit bar | Notes |
|----|---------|--------|-----------|----------|-------|
| SI2 | `src/core/datetime.ts` | todo | — | parses PlantUML date formats + relative offsets + working days; unit-tested | Blocks Timing, Gantt |
| SI3 | `src/core/railroad/` | todo | — | terminal/nonterminal/seq/choice/opt/repeat → SVG; unit-tested | Blocks EBNF, Regex |
| SI4 | `src/core/golem/` grid | todo | — | 2D tile grid, edges between tile centers; unit-tested | Blocks Flow; eval Salt/Wire |
| SI5a | preprocessor / TIM completion | done | S4 | `!function` declare+return, `!foreach`/`!while`, `!$var` + scoping, `!startsub`/`!includesub`, `!elseif`, all builtins resolve; TIM-json ledger entry retired; no DOT regressions; four gates green. **DONE 2026-07-13** — `plans/si5a-tim/`, branch `feat/si5a-tim`. | **Ported upstream's entire TIM subsystem (~13.4k LOC Java) and CUT `preprocessor.ts` OVER TO IT.** `src/core/tim/` now holds the real `TContext` interpreter driving the `CodeIterator` decorator chain (`iterator/`), 25 `Eater*` subclasses, the expression evaluator (`expression/`: ShuntingYard→RPN, `TValue`), the memory/scoping model (`TMemory`/`TVariableScope`/`VariableManager`), **all 74 builtins** (`builtin/`) behind an injected `TimEnvironment` seam (clock/RNG/file/stdlib — nothing in `src/` touches `fs`/`process.env`/`Date.now()`/`Math.random()`), and a **sync `IncludeStore`** seam (`render()` prefetches async; `renderSync` takes a caller-supplied store). The flat line-loop — which **structurally could not** express nested `!foreach`/`!while`/`!if` — is gone, along with `resolveIncludes`, the textual pre-pass that ran *before* conditionals (so an `!include` in a false `!ifdef` was fetched AND inlined). **Results: 7,586 tests (+1,036 from the 6,550 baseline); DOT usecase 79→81/87, everything else at baseline (component 251/259, class 680/680, object 78/80, state 260/261) — zero regressions.** TIM-json ledger entry (zoriso-46, sidame) verified EQUAL and **retired**. `!include <bundle/…>`'s silent skip replaced by a typed `StdlibNotBundledError` — **seam only, nothing vendored** (SI5b still gated on the licensing ruling). 6 divergences recorded in `DIVERGENCES.md` § Preprocessor (TIM); one (orphan `!else`/`!elseif`/`!endif`) is **temporary, pending SI6**. |
| SI5b | stdlib bundling | blocked (awaiting maintainer ruling) | S4, licensing ruling | `!include <bundle/…>` resolves for the vendorable bundles; C4/AWS smoke fixtures parse | **License audit done 2026-07-12; AWS verdict CORRECTED same day** (`planning/s4-stdlib-audit.md`). **ALL top-5 bundles are VENDOR-OK — no bundle is excluded on licensing grounds.** `c4`/`archimate`: MIT pure macro libs, no artwork. `tupadr3`/`cloudinsight`: MIT glue + CC BY 4.0 / Apache-2.0 / SIL OFL 1.1 artwork, attribution required. `aws`/`awslib*`: CC BY-**ND** 2.0 — an earlier draft called this NOT-VENDORABLE, which **was wrong**: §3(a)/(b) expressly grant incorporation into *Collective Works*, §1(a) says a Collective Work is not a Derivative Work, and §4(a) says the collective work "apart from the Work itself" need **not** be made subject to CC BY-ND (so our MIT stands). ND bites only on *modification*. **Hard constraint: vendor sprites VERBATIM** — any regenerate/re-encode/recolor step voids the AWS grant, so the pipeline must be a checksummed file copy, not a transform. Each bundle ships under `stdlib/<bundle>/` with its own LICENSE + a consolidated `stdlib/LICENSES.md`. **Open:** AWS Architecture Icons *Terms of Use* page not yet read (separate doc from the repo LICENSE). **Awaiting sign-off.** Gates D15 (C4), E2 (sprite registry). |
| SI6 | error-diagram path (`PSystemError`) | done | SI5a | `renderSync` renders an **error diagram** instead of throwing; orphan `!else`/`!elseif`/`!endif` error faithfully. **DONE 2026-07-13** — branch `feat/si6-error-diagram`; four gates green; DOT gate at baseline with no denominator moved (component 251/259, usecase 81/87, class 680/680, object 78/80, state 260/261). | **The premise this mission was written on was FALSE, and the record is corrected in `DIVERGENCES.md`:** the port DID have an error path — `src/index.ts#errorSvg`, a homegrown red box wired into every `catch` — so a preprocessor throw never escaped `renderSync`. It simply was not FAITHFUL. Ported `net/sourceforge/plantuml/error/` (`PSystemError`, `PSystemErrorV2`, `PSystemErrorEmpty`, `PSystemErrorPreprocessor`, `PSystemUnsupported`, `PSystemErrorUtils`, `ErrorUml`) + `eggs/PSystemWelcome` into `src/core/error/`, and REPLACED the red box with it: Welcome block (only under 5 source lines, as upstream gates it), version banner, `[From string (line N) ]`, the executed-source listing with the offending line waved red, the message. **Prerequisite discovered mid-mission:** `LineLocation` was an `unknown` stand-in and `readLines` stored a bare array index, so nothing could say WHERE an error was — ported `LineLocation`/`LineLocationImpl` and the real reader chain (top-level = `"string"`, includes described by target and parented on the `!include` line). `preprocessOrError()` is upstream's `TimLoader#load` (captures instead of throwing, marks the trace's last line); `preprocess()` stays as the throwing facade. **Retired all 3 divergences:** orphan conditionals now throw `No if related to this <directive>`; `TContext` throws `Function not found <name>`; `RetrieveProcedure`'s invented null guard removed. **Fixed a coupling this exposed:** `!undefine`'s macro removal was built ON the passthrough (it left the name in the `functions3` trie), so the trie is now rebuilt from survivors. Unclosed `!ifdef` at EOF still tolerated and pinned. Jar-verified line-for-line on the orphan `!endif` and the `Function not found` cases. 7,636 tests (+50). |
| SI7 | pipeline order: split `@start…@end` **before** TIM | done | SI5a | `extractBlocks` runs on near-raw lines; TIM preprocesses each block's *interior*. `buveco-86-tibo673` renders. | **Architectural divergence found 2026-07-13 (SI6 verification).** Our order is `preprocess() → extractBlocks()`. **Upstream's is the reverse**, and the distinction is load-bearing: `BlockUmlBuilder` reads through `preproc2.Preprocessor` — which does **only** config-injection + line-merging, **NOT** TIM — so `@start`/`@end` are detected on near-raw lines and **cannot be swallowed by a conditional**. TIM (`TContext`, `!ifdef`) then runs on the block's *interior*. Because we invert this, a conditional can eat our `@enduml`: `buveco-86-tibo673` (an unclosed `!ifdef`, itself a PlantUML bug report — forum.plantuml.net/6808) loses its `@enduml`, so `extractBlocks` finds no block and we emit "no diagram found" where the jar renders the title. **Do NOT patch this in `extractBlocks` by closing unclosed blocks at EOF** — that is a symptom fix at the wrong layer and gives a *new* wrong answer on a *false* unclosed `!ifdef` (where the jar correctly reports an empty document). Mirror upstream's order instead. Also needs a **default diagram type** for a content-less `@startuml` (jar → `CLASS`; we → "unknown diagram type"). **Impact: 1 of 5,694 pdiff fixtures; 0 of the 1,428 DOT-gating fixtures** — real but not urgent. **Done 2026-07-13** (`feat/si7-pipeline-order`): `src/core/BlockUmlBuilder.ts` mirrors upstream — raw split, then TIM per block. Blocks now carry their own theme/skinparam/`<style>`, an empty block renders the jar's `Empty description`, and a `@startuml` no probe claims falls back to `class` (upstream factory order). DOT gate unmoved on all five types (component 251/259, usecase 81/87, class 680/680, object 78/80, state 260/261); 7643 tests green. Residual: `buveco-86` now renders as the CLASS diagram the jar renders, but its **title is not drawn** — `title` is an ignored directive in every engine of this port (`state-commands.ts:96`, `description/parser.ts:379`), a pre-existing gap SI7 does not close. |
| SI1 | `src/core/cucadiagram/` shared base | todo | A2,A4 (both done — **now unblocked**) | class/state/object/description/component consume one entity/link model | Stops svek types re-diverging; do AFTER their depth passes so behavior is pinned first — that condition is now met. Not urgent vs SI5a (SI5a is preprocessor-layer and adds no entity-model consumer), but **should land before the Phase D types**, each of which would otherwise become another migration. **Concrete evidence it's needed (2026-07-12):** upstream's `-[single]->` add-time link dedup lives in `CucaDiagram.addLink` (`net/atmp/` — note: OUTSIDE `net/sourceforge/plantuml/`), the shared base of class/state/object/description. Our silito-78 fix (`8898572`) is scoped to the **description parser only**, so `-[single]->` in a class or state diagram still won't dedup. Un-triggered by the corpus, so latent — but it is one root cause needing N fixes, which is precisely the divergence SI1 exists to stop. Upstream's base class is the model to mirror. |

## Phase D — New diagram types (breadth, each with a depth gate from birth)

Build the oracle goldens WHILE building the type, not after. Exit bar for each:
renders + (svek types) ≥90% oracle EQUAL, or (bespoke-layout types) an
SVG-structural bar defined at build time. mission-guide.md has Java sources.

| ID | Mission | Status | Blocked-by | Notes |
|----|---------|--------|-----------|-------|
| D1 | Timing `@starttiming` | todo | SI2 | custom vertical-time layout |
| D2 | Mind Map `@startmindmap` | todo | S3 | twopi engine |
| D3 | WBS `@startwbs` | todo | D2 | shares mind-map layout |
| D4 | Gantt `@startgantt` | todo | SI2 | constraint solver |
| D5 | Network nwdiag/rackdiag | todo | — | row-based layout |
| D6 | Git graph `@startgitgraph` | todo | — | lane layout |
| D7 | Salt `@startsalt` | todo | SI4? | grid; eval golem |
| D8 | DITAA `@startditaa` | todo | — | ASCII-art grid → SVG; highest P5 complexity |
| D9 | Chen EER `@startchen` | todo | — | dot layout + EER shapes |
| D10 | EBNF `@startebnf` | todo | SI3 | railroad |
| D11 | Regex `@startregex` | todo | D10 | regex → railroad IR |
| D12 | Wire `@startwire` | todo | SI4? | schematic grid |
| D13 | Flow `@startflow` | todo | SI4 | golem; alpha-doc only |
| D14 | DOT passthrough `@startdot` | todo | — | needs common/{arrows,shapes,htmltable,labels}.c for attrs |
| D15 | C4 | todo | SI5b | macro library over description (10 corpus fixtures; C4-PlantUML is the most likely cleanly-vendorable bundle) |

## Phase G — SVG conformance depth passes ← **THE PRODUCT**

**Why this phase exists (measured 2026-07-12).** Phase A drove *DOT* parity to
97/91/100/98/99.6%. The DOT is an intermediate representation. **The SVG is what
we ship — and it is 1.7% conformant.**

Measured with the deterministic census (`scripts/svg-conformance-census.ts`, the
real metric — the `svg-parity-survey` reports ~0% *by construction* because it
compares production AWT output against a deterministic-mode oracle, the known
D12 gap, and is a triage tool only):

| diffs | fixtures (description, n=355) |
|---|---|
| **0 — conformant** | **6 (1.7%)** |
| 1–3 | 4 |
| 4–10 | 121 |
| 11–30 | 67 |
| 31+ | 156 |

**SVG conformance is NOT gated on S1L sizing** — tested and refuted. 174 fixtures
have provably-correct node sizes (≤0.01in via the oracle's own id-agnostic
`maxSizeDeltaIn`) and produce **zero** conformant SVG, with *more* diffs on
average (64.8) than the size-dirty bucket (54.9). **Every fixture routed through
graphviz→SVG is non-conformant, 100% of the time.** The 6 conformant ones never
reach graphviz. These are independent SVG-assembly bugs.

**Defect queue, ranked by fixture-reach:**
1. **Document dimensions short by exactly 1px** — 327/348 diverging fixtures.
   On the cleanest size-clean fixture it is the *only* defect (jar 190×65, ours
   189×64). This is `docs/svg-conformance.md` F4; needs the `LimitFinder` /
   `UGraphicNo` port. Highest reach in the codebase.
2. **`g[childCount]` mismatch** — 215 fixtures. Structural: we emit a different
   *number* of children. Missing/extra elements, not geometry.
3. **Geometry scatter** — `text@x/y`, `path@d`, `polygon@points`, `rect@x/y`,
   `ellipse@cx/cy`. Deltas scattered (+0.58, −7.29, −29.29, −60.99, −146.0), so
   several distinct bugs, not one global offset.

**Execution rules (maintainer, 2026-07-12):**
- **One diagram type at a time, to conformance, before starting the next.**
- **If the type routes through graphviz-ts, its DOT conformance must be 100%
  first.** 100% = 100% of *comparable* fixtures; `!pragma layout elk` fixtures
  are excluded (no ELK support — see `DIVERGENCES.md`). `smetana`/`vizjs`
  fixtures are **NOT** excluded: re-capture them with the pragma stripped so the
  jar uses real graphviz and emits `svek-N.dot` (see `DIVERGENCES.md`) — this
  moves ~34 fixtures out of oracle-blind and under the bar.
- Harness already exists (`normalize` / `compare` / `census` / `overlay` /
  `ratchet`) but is **description-only**; generalize it per type. Jar SVG cache
  already covers class (718), component (265), state (265), usecase (90),
  object (80).

| ID | Mission | Status | Blocked-by | Exit bar |
|----|---------|--------|-----------|----------|
| G0 | F4 document-dimension port (`LimitFinder`/`UGraphicNo`) + re-capture smetana/vizjs oracle w/ pragma stripped | done | — | doc dims exact on the size-clean tier; oracle-blind drops 42 → 8. **DONE 2026-07-13** — `plans/g0-limitfinder/` (branch `feat/g0-limitfinder`): `MinMax`/`MinMaxMutable`/`UGraphicNo`/`LimitFinder`/`TextBlockUtils.getMinMax` ported faithfully (every extent quirk pinned); description doc sizing cut over to SvekResult's recipe — the actual 1px was `CucaDiagram.getDefaultMargins` (0,5,5,0), and single-leaf diagrams keep the `EntityImageDegenerated` path; F4 fixtures jar-exact (cifaki 190×65, vapalu 290×65, jesibe 212×65); **census 6 → 12 conformant**. Re-capture: 42 smetana/vizjs fixtures comparable, 41 EQUAL on arrival, 39 pinned in goldens (2 state size-backlogged at 0.0556in); component tojitu-03-ruto643 structural-diff recorded (emits 0 clusters vs oracle 5 — description-DOT-100% queue); component kofovu-01 (jar errors) + potatu-55 (jar routes as CLASS) pre-excluded. **NEW PINNED DOT BASELINE: component 253/262 (97%) · usecase 84/90 (93%) · class 708/708 (100%) · object 78/80 (98%) · state 266/267 (99.6%); oracle-blind = elk-only (class 7, component 1, object 1)**. Gates: 7,929 tests (296 files), coverage ≥98/94/98. Mainframe/BigFrame re-deferred (branch (b)): the ink primitive now exists; residual blocker is threading annotations+styles into the klimt pass (layout.ts geo + plugin contract) — DIVERGENCES.md updated. |
| G0b | **`title` / `header` / `footer` / `legend` are not rendered by ANY engine** (= `docs/svg-conformance.md` F2, "largest bucket") | done | — | a titled diagram renders its title; the ~118 affected gating fixtures become SVG-eligible. **DONE 2026-07-13** — `plans/g0b-annotations/` (branch `feat/g0b-annotations`): ported upstream's `DiagramChromeFactory` (the AnnotatedBuilder/AnnotatedWorker refactor) as `src/core/annotations/` — DisplayPositioned model, the 11 command regexes (matcher position mirrors each upstream factory: FIRST for sequence, FALLBACK for class/state), plantuml.skin style defaults + skinparam/`<style>` overrides, DecorateEntityImage geometry (jar-verified incl. the TextBlockBordered +1 and rx/2 emission quirks). Plugins now return RenderFragment; chrome + svgRoot assemble centrally (mirrors getTextBlock→addChrome→exporter). title/caption/legend/header/footer render for ALL engines; json/dot/chart/yaml bespoke title bands removed; buveco-86-tibo673 renders. Gates: 7,837 tests (294 files, +194), coverage 98.27/94.53/98.39, DOT gate EXACT 251/259, 81/87, 680/680, 78/80, 260/261 (denominators unmoved), census conformant 6 (unchanged; its 7 errors pre-date the mission). Residuals: `mainframe` parsed but not drawn (BigFrame needs the G0 LimitFinder port — DIVERGENCES.md TEMPORARY); annotated-description output loses klimt root attrs (G1 note); D10 corrected — upstream @startdot errors on title (port-only feature, ledgered). | **Confirmed empirically 2026-07-13 (SI7 verification): `renderSync` emits NO title for class, sequence, component, or state — the jar emits one for all four.** `title` is in the ignore-patterns of every parser (`state-commands.ts:96`, `description/parser.ts:379`; the class parser drops it silently — no `title` key in its AST or renderer). **This is invisible to the DOT bar** — the title is drawn outside the graph, so class DOT reads 100% while every titled diagram's SVG is wrong. It is precisely the class of defect Phase G exists to catch. **Reach (gating corpus, 1,418 fixtures): `title` 78 (class 46, state 12, component 10, object 7, usecase 3); `header`/`footer`/`legend` 40 (class 23, usecase 5, object 5, state 4, component 3) — ~118 fixtures, ~8%, that CANNOT be conformant until this lands.** Blocks G1–G4 for those fixtures; do it before the per-type passes rather than ledgering ~8% five times over. |
| G1 | description (component/usecase) SVG conformance | todo | G0 (done), DOT 100% — **at max 2026-07-13: component 261/262, usecase 85/90 = 100% of non-SI5b-blocked (plans/description-dot-100/); the remaining 6 are stdlib fixtures. MAINTAINER RULING REQUIRED before G1: SI5b sign-off + bundle-audit extension for bootstrap/cloudogu, OR elk-style exclusion** | ≥90% conformant + every miss ledgered |
| G2 | class SVG conformance | todo | G1 | ≥90% conformant + ledger |
| G3 | object SVG conformance | todo | G2 | ≥90% conformant + ledger |
| G4 | state SVG conformance | todo | G3 | ≥90% conformant + ledger |
| G5 | sequence / activity SVG conformance (non-svek; no DOT gate) | todo | G4, E4 | bar defined by E4 |

## Phase E — Cross-cutting fidelity (fold in as consuming types land)

| ID | Mission | Status | Blocked-by | Exit bar |
|----|---------|--------|-----------|----------|
| E1 | full skinparam → theme wiring (`plans/skinparam/`) | todo | — | skinparam directives reach every renderer; corpus skinparam fixtures match |
| E2 | full Creole + sprite registry (Phase 4h) | todo | SI5b | `<size:>`,`<img:>`,`<$sprite>`,`<U+NNNN>`,`<back:>`,nested markup render (sprite registry needs the bundled-asset ruling; the non-sprite creole markup does not) |
| E3 | CSS class names on SVG (Phase 4i) | todo | — | `puml-*` on every semantic element |
| E4 | non-svek depth oracle (sequence, activity) | spike | — | decide SVG-structural oracle vs eyeball QA |

## Phase F — Ecosystem / packaging

| ID | Mission | Status | Blocked-by | Exit bar |
|----|---------|--------|-----------|----------|
| F1 | Markdown integration (Phase 6) | todo | — | autoload + markdown-it + remark plugins ship |
| F2 | graphviz-ts npm cutover | todo | — | pinned tarball → published release; ratchets re-baselined |
| F3 | GitHub Pages docs site | done | — | **DONE 2026-07-11** (branch `feature/docs-site`): VitePress site at https://sseely.github.io/plantuml-ts/ — hero index, live playground (src-alias import), guide (getting-started + api), parity page regenerated from committed `docs/parity-report.md` (`dot-sync-report --markdown`), divergences mirrored per diagram type, `copy-reports.mjs` pipeline, `.github/workflows/docs.yml` deploy. Perf page deliberately deferred (D4). ONE MANUAL STEP left for maintainer: GitHub → Settings → Pages → Source = GitHub Actions (before first deploy can succeed). Original scope: Site published via GH Pages. Model: `~/git/graphviz-ts/docs-site` (VitePress: hero index + live in-browser playground running the actual library, `guide/` getting-started + API + engines, and dedicated `parity.md` / `conformance.md` / `divergences.md` / `perf.md` pages + a `copy-reports.mjs`-style script folding generated reports into the site). MUST have: **parity status** (per-diagram-type EQUAL/conformance numbers, fed from `dot-sync-report` outputs — keep it regenerable, not hand-maintained) and **divergences organized per diagram type** (maintainer 2026-07-11; source remains `DIVERGENCES.md` — restructure its sections by diagram type, with cross-cutting entries like the preprocessor/!include deferral under a "General" section). OPEN QUESTION (maintainer, 2026-07-10): whether a performance page is even valuable — discuss before building (graphviz-ts has `perf.md` precedent; ours would need honest jar-vs-ts benchmarks to be worth anything). Generator: VitePress recommended over Docusaurus (discussed 2026-07-10 — sister-site reuse of playground + copy-reports pipeline, Vite-native alignment with our build, one SSG across both projects; Docusaurus only wins if release-versioned docs/i18n/React widgets become requirements — revisit post-1.0 if so; the generated parity/divergences markdown is SSG-agnostic either way. Search: non-factor — the graphviz-ts config we'd inherit already enables VitePress's built-in offline MiniSearch, `docs-site/.vitepress/config.ts:18-19`; Docusaurus's canonical search is external Algolia DocSearch). Warrants `/plan-mission` when picked up. Requested by maintainer 2026-07-10 mid-A2 |

---

## Snapshot (update as missions flip — last refreshed 2026-07-13)

- **G0b + G0 CLOSED (2026-07-13).** Annotations (title/caption/legend/header/
  footer) render for every engine; LimitFinder machinery ported; description
  doc dims jar-exact; smetana/vizjs re-captured. **Current DOT baseline:
  component 253/262 · usecase 84/90 · class 708/708 · object 78/80 ·
  state 266/267 (oracle-blind = elk-only). Census: 12/355 conformant.
  7,929 tests.** Description DOT drill CLOSED 2026-07-13 (plans/description-dot-100/):
  component 261/262, usecase 85/90 — 100% of non-SI5b-blocked. Five
  mechanisms ported (set-separator quark nesting, container-scoped identity,
  kermor svek variants, remove-stereotype, [[url]]-label resolution).
  G1 next but BLOCKED on the stdlib ruling.
  Mainframe rendering re-deferred (annotation plumbing into the klimt pass
  — see DIVERGENCES.md).

- **PHASE A IS CLOSED (2026-07-12).** A1–A4 all `done`; A5 stays `spike` on S2.
  Final: description component 251/259 (97%) + usecase 79/87 (91%), class
  680/680 (100%), object 78/80 (98%), state 260/261 (99.6%) — all
  structural-match, zero unledgered misses. Gates green at `1517ac2`: 6,550
  tests, typecheck, lint, build.
- **S4 done (2026-07-12)** — `planning/s4-stdlib-audit.md`. It **inverts SI5**:
  `!include` is rare (69/5688 = 1.2%; priority tupadr3 → c4 → cloudinsight →
  archimate → aws), while the preprocessor/TIM half is ~200 fixtures and
  cross-type. **SI5 split into SI5a (preprocessor — the real mass, unblocked)
  and SI5b (bundling — licensing-gated).** License audit: **all top-5 bundles are
  vendorable**, none excluded. `c4`/`archimate` are MIT pure-macro; `tupadr3`/
  `cloudinsight` need attribution; `aws` is CC BY-ND but §3/§4(a) expressly permit
  verbatim incorporation into a Collective Work without infecting our MIT — the
  binding constraint is **verbatim-only copying**, not exclusion. (A first-pass
  verdict of "AWS NOT vendorable" was published and then corrected the same day
  after reading the license text; see `s4-stdlib-audit.md` § AWS — CORRECTED.)
- **wip: SI5a** (preprocessor / TIM completion) — upstream `tim/` has 76 builtins
  + ~30 `Eater*`; we have 2 builtins + a partial Eater set. Missing: `!function`
  declare/return, `!foreach`/`!while`, `!$var` + scoping model,
  `!startsub`/`!includesub`, `!elseif`, and the builtin library (incl. the
  ledgered `%get_json_keys` TIM-json family). Also owns A1's last open drill,
  **silito-78** (`!definelong` → 3 links vs oracle's 1; stopped without root
  cause per `diagnosis.md`).
- **SI1 is now unblocked** (A2+A4 done — behavior is pinned, which was the
  precondition). Not urgent against SI5a (preprocessor-layer, adds no
  entity-model consumer), but **should land before the Phase D types**, each of
  which would otherwise become another migration.
- **S1L stays parked** (`wip`, plateaued at 62% component / 44% usecase size-
  conformance). It now has a fresh queue: **166 shrink-only size-backlog
  entries** (state 136, object 30). Its own diagnosis says the remaining
  description tier is compounding/near-zero-gain per fix; revisit with a
  tolerance-exclusion policy (~67% conformant-among-sizeable).
- **Still-open spikes:** S2 (json/yaml/hcl oracle — gates A5), S3 (stub-engine
  authenticity — gates D2/mind-map), E4 (non-svek depth oracle).

### Historical — svg-conformance Brief 2 (2026-07-10)

- **svg-conformance Brief 2 COMPLETE (2026-07-10), merged to main.** The
  description engine (component/usecase/deployment) now draws entirely through
  the klimt SVG emitter, with a dual-measurer conformance seam (production
  `jarMeasurer` vs injected `DeterministicMeasurer`) and a 5-fixture SVG
  ratchet gating inside `npm test`. Playwright raster visual-QA retired (T20)
  — **`plans/visual-qa-site/` is superseded; do not execute it.** Follow-ups
  tracked in `docs/svg-conformance.md`: ~~F1~~ spline-clip edge-drop **FIXED**
  post-merge (`e346b87` — faithful `simulateCompound`/`subdivide` port; zero
  dropped edges across 294 goldens); F2 legend/title/header/`<img>`/monospace
  creole (largest bucket); F3 measurer-mode residue (documented, not a
  defect); F4 ~1px document-dimension under-count (needs a
  `LimitFinder`/`UGraphicNo` port); F5 `newpage`. Three cross-engine
  unblockers (named-color→hex table, `transparent` background, `roundCorner`)
  **await maintainer write-set approval**. Final gates: 4640/4640 tests,
  coverage 97.7/93.4/98, DOT parity 357/234/60.
*(The A1/A2 status bullets that stood here are superseded — Phase A closed
2026-07-12; see the current snapshot above.)*

- **shallow (need depth pass):** json/yaml/hcl only. *(class, state, object were
  in this list until A2–A4 closed them.)*
- **done (breadth + at least eyeball depth):** sequence, activity, board,
  chronology, files, packetdiag, chart. (These are `done` for breadth; a
  depth-oracle decision — E4 — determines whether the non-svek ones need more.)
- **next: SI5a (preprocessor / TIM completion)** — largest unblocked tranche
  (~200 fixtures, cross-type), retires A1's last open drill (silito-78) and the
  TIM-json ledger entry. Brief via `/plan-mission` from
  `planning/s4-stdlib-audit.md` Finding 3. SI5b needs a maintainer licensing
  ruling; SI1 should land before Phase D.

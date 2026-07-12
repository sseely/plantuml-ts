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
| A1 | description DOT-sync | wip | — | ≥90% structural-match now (→ conformant after S1L) + every miss ledgered, both corpora | `npx tsx scripts/dot-sync-report.ts component usecase` |
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
| S4 | stdlib include surface audit | spike | — | frequency table of `!include <…>` across pdiff corpus → bundle priority list | Sizes SI-5 |

## Phase C — Shared infrastructure (unblocks multiple types)

| ID | Mission | Status | Blocked-by | Exit bar | Notes |
|----|---------|--------|-----------|----------|-------|
| SI2 | `src/core/datetime.ts` | todo | — | parses PlantUML date formats + relative offsets + working days; unit-tested | Blocks Timing, Gantt |
| SI3 | `src/core/railroad/` | todo | — | terminal/nonterminal/seq/choice/opt/repeat → SVG; unit-tested | Blocks EBNF, Regex |
| SI4 | `src/core/golem/` grid | todo | — | 2D tile grid, edges between tile centers; unit-tested | Blocks Flow; eval Salt/Wire |
| SI5 | preprocessor completion + stdlib bundling | todo | S4 | `!procedure`/`!function`/`!include <bundled>` resolve; C4/AWS smoke fixtures parse | Biggest breadth unblocker; gates C4/AWS/archimate |
| SI1 | `src/core/cucadiagram/` shared base | todo | A2,A4 | class/state/object/description/component consume one entity/link model | Stops svek types re-diverging; do AFTER their depth passes so behavior is pinned first |

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
| D15 | C4 | todo | SI5 | macro library over description |

## Phase E — Cross-cutting fidelity (fold in as consuming types land)

| ID | Mission | Status | Blocked-by | Exit bar |
|----|---------|--------|-----------|----------|
| E1 | full skinparam → theme wiring (`plans/skinparam/`) | todo | — | skinparam directives reach every renderer; corpus skinparam fixtures match |
| E2 | full Creole + sprite registry (Phase 4h) | todo | SI5 | `<size:>`,`<img:>`,`<$sprite>`,`<U+NNNN>`,`<back:>`,nested markup render |
| E3 | CSS class names on SVG (Phase 4i) | todo | — | `puml-*` on every semantic element |
| E4 | non-svek depth oracle (sequence, activity) | spike | — | decide SVG-structural oracle vs eyeball QA |

## Phase F — Ecosystem / packaging

| ID | Mission | Status | Blocked-by | Exit bar |
|----|---------|--------|-----------|----------|
| F1 | Markdown integration (Phase 6) | todo | — | autoload + markdown-it + remark plugins ship |
| F2 | graphviz-ts npm cutover | todo | — | pinned tarball → published release; ratchets re-baselined |
| F3 | GitHub Pages docs site | done | — | **DONE 2026-07-11** (branch `feature/docs-site`): VitePress site at https://sseely.github.io/plantuml-ts/ — hero index, live playground (src-alias import), guide (getting-started + api), parity page regenerated from committed `docs/parity-report.md` (`dot-sync-report --markdown`), divergences mirrored per diagram type, `copy-reports.mjs` pipeline, `.github/workflows/docs.yml` deploy. Perf page deliberately deferred (D4). ONE MANUAL STEP left for maintainer: GitHub → Settings → Pages → Source = GitHub Actions (before first deploy can succeed). Original scope: Site published via GH Pages. Model: `~/git/graphviz-ts/docs-site` (VitePress: hero index + live in-browser playground running the actual library, `guide/` getting-started + API + engines, and dedicated `parity.md` / `conformance.md` / `divergences.md` / `perf.md` pages + a `copy-reports.mjs`-style script folding generated reports into the site). MUST have: **parity status** (per-diagram-type EQUAL/conformance numbers, fed from `dot-sync-report` outputs — keep it regenerable, not hand-maintained) and **divergences organized per diagram type** (maintainer 2026-07-11; source remains `DIVERGENCES.md` — restructure its sections by diagram type, with cross-cutting entries like the preprocessor/!include deferral under a "General" section). OPEN QUESTION (maintainer, 2026-07-10): whether a performance page is even valuable — discuss before building (graphviz-ts has `perf.md` precedent; ours would need honest jar-vs-ts benchmarks to be worth anything). Generator: VitePress recommended over Docusaurus (discussed 2026-07-10 — sister-site reuse of playground + copy-reports pipeline, Vite-native alignment with our build, one SSG across both projects; Docusaurus only wins if release-versioned docs/i18n/React widgets become requirements — revisit post-1.0 if so; the generated parity/divergences markdown is SSG-agnostic either way. Search: non-factor — the graphviz-ts config we'd inherit already enables VitePress's built-in offline MiniSearch, `docs-site/.vitepress/config.ts:18-19`; Docusaurus's canonical search is external Algolia DocSearch). Warrants `/plan-mission` when picked up. Requested by maintainer 2026-07-10 mid-A2 |

---

## Snapshot (update as missions flip — last refreshed 2026-07-10)

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
- **wip:** A1 (description DOT-sync) — structural-match component 234/259
  (90%), usecase 60/87 (69%; ratcheted up from 59 during Brief 2). **S1L
  plateaued** after ~14 passes: size-conformance among structurally-EQUAL
  fixtures **component 136/221 (62%), usecase 18/41 (44%)**, from ~1%.
  Everything cleanly exact is done (all common box symbols, use-case ellipse,
  actor stickman, note 13px, stereotype line, componentStyle both forms,
  width floor, line-height 1.0). The remaining ~38% is the messy/tolerance
  tier — package/folder tab geometry, empty-container margins, interface
  shield, LaTeX/emoji/sprite fixtures (candidates for denominator exclusion),
  wrapWidth — with near-zero per-fix gains. See `planning/s1l-leaf-sizing.md`
  fourteenth pass. **Recommendation adopted: move to A2**; before flipping A1,
  consider a tolerance-exclusion policy to report conformant-among-sizeable
  (~67%).
- **shallow (need depth pass):** class, state, object, json/yaml/hcl.
- **done (breadth + at least eyeball depth):** sequence, activity, board,
  chronology, files, packetdiag, chart. (These are `done` for breadth; a
  depth-oracle decision — E4 — determines whether the non-svek ones need more.)
- **next: A2 (class DOT-sync)** — highest depth ROI; S1L infra (WidthTable
  measurer, deterministic harness, per-symbol patterns) directly enables it.
  Brief via `/plan-mission` from `planning/a2-class-dot-sync.md`. In parallel,
  S2 (json oracle) and S3/S4 remain unblocked spikes worth resolving early.

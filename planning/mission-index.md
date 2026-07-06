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
| A2 | class DOT-sync | shallow | A1, S1L | class ≥90% conformant + ledger | `npx tsx scripts/dot-sync-report.ts class` |
| A3 | object DOT-sync | shallow | A2 | object ≥90% conformant + ledger | `npx tsx scripts/dot-sync-report.ts object` |
| A4 | state DOT-sync | shallow | A2 | state ≥90% conformant + ledger | `npx tsx scripts/dot-sync-report.ts state` |
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
| S1L | description leaf-box sizing port (unlocks `conformant`) | todo | S1i | Port `EntityImageDescription.calculateDimension` + USymbol `asSmall` margins + multi-line text-block height into `measureLeafNode`, then move `width`/`height` tolerant→asserted in `compareStructural`. Exit: ≥90% description `conformant` (≤0.01in) | **Diagnosed 2026-07-05**: box branch `layout-helpers.ts:171-175` has 3 gaps — (1) single-line height 35.6px vs oracle 44px (0.611in); (2) no multi-line term (oracle +14px/line: 1-line 0.611→2-line 0.806); (3) variable/markup `display` measures empty → width falls to `BOX_MIN_WIDTH` vs oracle's real content. Only 4/262 EQUAL fixtures within ±0.01in today. `BOX_HEIGHT_FACTOR`/`EXTRA` are tolerant-era approximations |
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

---

## Snapshot (update as missions flip)

- **wip:** A1 (description — component 90%, usecase 68% structural-match; goldens
  now deterministic). **S1i done** (measurement neutralized). **S1L in progress**
  — leaf-box sizing port landing incrementally: per-symbol USymbol margins +
  multi-line height + Creole line-leading factor + component icon allowance +
  dropped the bogus 80px width floor. Clean-fixture ≤0.05in DOT-size
  conformance now 67/153 (was 4). **Then found the base line-height was
  calibrated against the wrong (AWT) oracle jar** — corrected factor to 1.0,
  which jumped **clean-fixture ≤0.01in (exact) conformance to 72/153 (47%)**
  from ~1. Remaining before sizes can be asserted: width residuals from
  display-strip bugs (color specs left in the label), container/bracket/actor/
  usecase sizing, and the per-symbol lollipop shapes. Also fixed a parser bug
  (gradient color specs `#c1\c2` leaking into the display → inflated width).
  **Tooling hazard RESOLVED:** rebuilt the deterministic oracle jar in
  `oracle/dist` (was AWT; fresh probes trustworthy again). **Next blocker:**
  the componentStyle fix (uml1/rectangle components mis-iconed) is designed +
  oracle-verified but BLOCKED — wiring it needs edits to `layout.ts` (630 lines)
  and `parser.ts` (623), both over the 500-line cap. Next iteration must split
  those files first, then wire componentStyle. **Exact leaf-shape ports landed:**
  use-case ellipse, actor stickman, note (13px font), all common box symbols.
  **Comprehensive size-conformance: component 114/221 (52%), usecase 17/41
  (41%)** of structurally-EQUAL fixtures. The remaining ~half is the hard tier
  (LaTeX label rendering, container/cluster sizing, display-content parser bugs,
  componentStyle) — subsystem-sized, not one-line shape fixes. See
  `planning/s1l-leaf-sizing.md`.
- **shallow (need depth pass):** class, state, object, json/yaml/hcl.
- **done (breadth + at least eyeball depth):** sequence, activity, board,
  chronology, files, packetdiag, chart. (These are `done` for breadth; a
  depth-oracle decision — E4 — determines whether the non-svek ones need more.)
- **next unblocked after A1:** A2 (class DOT-sync) — highest depth ROI. In
  parallel, S1 (text measurement) and S2 (json oracle) are unblocked spikes
  worth resolving early because they gate later work.

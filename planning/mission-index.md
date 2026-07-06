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
breadth alone.** A type is `done` only when its depth gate (oracle EQUAL ≥90%
+ ledger, or the type's defined fidelity bar) is met. Types that render but
are unverified are `shallow`, not `done`.

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
| A1 | description DOT-sync | wip | — | component & usecase ≥90% EQUAL + every miss ledgered | `npx tsx scripts/dot-sync-report.ts component usecase` |
| A2 | class DOT-sync | shallow | A1 | class ≥90% EQUAL + ledger | `npx tsx scripts/dot-sync-report.ts class` |
| A3 | object DOT-sync | shallow | A2 | object ≥90% EQUAL + ledger | `npx tsx scripts/dot-sync-report.ts object` |
| A4 | state DOT-sync | shallow | A2 | state ≥90% EQUAL + ledger | `npx tsx scripts/dot-sync-report.ts state` |
| A5 | json/yaml/hcl depth | spike | S2 | oracle defined + type ≥90% on it | (blocked on S2 decision) |

Note: A2–A4 should assert node sizes (not tolerant) from the start — run **S1i**
first so their goldens are captured under deterministic measurement.

## Phase B — Decisions/spikes that unblock large tranches

Resolve before spending on the missions they gate.

| ID | Mission | Status | Blocked-by | Exit bar | Notes |
|----|---------|--------|-----------|----------|-------|
| S1 | text-measurement fidelity strategy | done | — | ADR-001 accepted: port PlantUML's `UnicodeFontWidthSansSerif` width table + neutralize oracle via `SVG_DETERMINISTIC` | Resolved 2026-07-05 — graphviz-ts neutralization pattern; see `planning/adr/ADR-001-text-measurement.md` |
| S1i | S1-impl: `WidthTableMeasurer` + oracle re-baseline | todo | S1 | width table ported; oracle re-captured under SVG_DETERMINISTIC; `width`/`height` moved tolerant→asserted in `compareStructural`; ratchets re-baselined | Run BEFORE A2–A4 tighten their bars, else they bake tolerant-size goldens |
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

- **wip:** A1 (description — component 90%, usecase 68%).
- **shallow (need depth pass):** class, state, object, json/yaml/hcl.
- **done (breadth + at least eyeball depth):** sequence, activity, board,
  chronology, files, packetdiag, chart. (These are `done` for breadth; a
  depth-oracle decision — E4 — determines whether the non-svek ones need more.)
- **next unblocked after A1:** A2 (class DOT-sync) — highest depth ROI. In
  parallel, S1 (text measurement) and S2 (json oracle) are unblocked spikes
  worth resolving early because they gate later work.

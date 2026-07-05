# plantuml-ts Roadmap — "everything PlantUML does, in TypeScript, SVG-only"

Written 2026-07-05, after ~1 day grinding the DOT-oracle-sync mission
(description parity 7% → 90% component). This is the reflection the grind
earned: where we are, what's left, and the mission list to finish the port.

The end state: a web-friendly TypeScript library that renders every diagram
PlantUML renders, to SVG. No Java, no server round-trip, no raster output.

---

## 1. The two axes of "done" — the lesson of the DOT grind

Progress has two independent dimensions, and we have been measuring only one:

- **Breadth** — how many of PlantUML's ~26 diagram types produce *some* output.
- **Depth** — how *faithfully* each matches upstream (layout, spacing, shapes,
  edge routing, the accumulated special cases that are the actual product).

The catalog lists ~15 types as **Done**. The DOT-oracle-sync mission proved
that "Done" measured only breadth: the consolidated description engine was
**7% faithful** at the DOT level before this week's grind, despite rendering
plausible SVG for months. Twenty-four loop iterations later, component is at
90% and usecase 68% — and each point came from a mechanism that had been
silently wrong.

**Implication:** every "Done" svek-backed type is presumed shallow until an
oracle pass proves otherwise. The DOT-oracle-sync harness is not a
description-specific tool; it is the **depth instrument for the whole port**.
Breadth without a depth gate produces a library that looks finished and
isn't — the exact failure mode the project's CLAUDE.md warns about.

---

## 2. Current state (honest)

### Diagram types that render (breadth)
sequence, class, state, description (component/usecase/deployment), activity,
object, json, yaml, hcl, board, chronology, files, packetdiag, chart. ~15 of
~26.

### Depth verified against the oracle
- **description**: component 90%, usecase 68% (in progress). The *only* type
  with a faithfulness measurement.
- **class, state, object, json**: svek-backed, **zero oracle verification**.
  Presumed 7%-ish until proven otherwise (the description baseline).
- everything else: no oracle exists for non-svek types (sequence, activity,
  and the bespoke-layout types) — depth is eyeball-only today.

### Layout engines
- **dot**: delegated to `graphviz-ts` (external, pinned as a tarball, npm
  pending). This is the right call and is working.
- **neato, fdp, sfdp, circo, twopi, osage**: functional *stubs*, not authentic
  Graphviz ports. Fine for types that only need "a layout"; wrong for anything
  that must match upstream pixel-for-pixel.

### Infrastructure gaps that block whole diagram families
- **preprocessor**: partial. No `!include <stdlib>` (blocks C4, AWS, archimate
  fixtures), `!procedure` macros partial.
- **skinparam → theme wiring**: the module exists; the pipeline wiring does not.
- **Creole**: partial. Missing `<size:>`, `<img:>`, sprites, `<U+NNNN>`, etc.
- **sprites / stdlib**: not built.
- **text measurement**: `FormulaMeasurer` ≠ Java font metrics. This is why DOT
  node sizes are a *tolerant* metric and why byte-identical output is currently
  impossible. It caps depth on every type.

---

## 3. Known knowns — we know we need it AND we know its shape

These are ordinary missions. Ordered roughly by leverage.

### A. Depth passes (apply the oracle harness to every svek type)
The harness, ratchet, and per-type goldens already exist. Each is a
DOT-oracle-sync-style loop.
1. **description → 90%/90% + ledger** (finish current mission). ~5–10 more
   iterations; the fixable remainder is grammar edge cases.
2. **class DOT-sync** — goldens already exist (`oracle/goldens/class/`).
3. **object DOT-sync** — rides the class engine; small delta after class.
4. **state DOT-sync** — pseudostates, composite states, concurrent regions.
5. **json DOT-sync** — probe first: json uses Smetana, not svek DOT; may need a
   Smetana-input oracle (a tooling sub-mission) or a scope decision.

### B. Diagram types not yet built (breadth), in dependency order
Each has a mission-guide.md entry with Java sources and reuse targets.
6. **Timing** (`@starttiming`) — blocked on `datetime.ts` (Track SI-2).
7. **Mind Map** (`@startmindmap`) — reuses twopi engine.
8. **WBS** (`@startwbs`) — reuses mind-map layout.
9. **Gantt** (`@startgantt`) — blocked on `datetime.ts`; constraint solver.
10. **Network / nwdiag / rackdiag** (`@startnwdiag`) — row-based layout.
11. **Git graph** (`@startgitgraph`) — lane layout.
12. **Salt** (`@startsalt`) — grid layout (evaluate golem reuse).
13. **DITAA** (`@startditaa`) — ASCII-art grid → SVG; highest complexity in P5.
14. **Chen EER** (`@startchen`) — dot layout + EER shapes.
15. **EBNF** (`@startebnf`) — railroad renderer (Track SI-3).
16. **Regex** (`@startregex`) — regex → railroad IR (after EBNF).
17. **Wire** (`@startwire`) — schematic grid.
18. **Flow** (`@startflow`) — golem grid (Track SI-4); alpha-doc only.
19. **DOT passthrough** (`@startdot`) — feeds user DOT straight to graphviz-ts;
    needs `common/{arrows,shapes,htmltable,labels}.c` for shape/arrow attrs.

### C. Shared infrastructure tracks (unblock multiple types)
20. **datetime.ts** (SI-2) — blocks Timing + Gantt.
21. **railroad renderer** (SI-3) — blocks EBNF + Regex.
22. **golem grid** (SI-4) — blocks Flow (+ maybe Salt/Wire).
23. **preprocessor completion + stdlib bundling** (SI-5) — blocks C4, AWS,
    archimate, `!procedure`-heavy fixtures. This is the single biggest
    breadth-unblocker; probably the largest infra mission.
24. **cucadiagram shared base** (SI-1) — the entity/link model class, state,
    object, description, activity, component all *should* share. Today they are
    silos; the description consolidation was a first step. Converging them is
    what stops these types from re-diverging as upstream evolves.

### D. Cross-cutting fidelity missions
25. **Full skinparam → theme wiring** (`plans/skinparam/`) — module exists.
26. **Full Creole + sprite registry** (Phase 4h) — `<size:>`, `<img:>`,
    `<$sprite>`, `<U+NNNN>`, `<back:>`, nested markup.
27. **CSS class names on SVG** (Phase 4i) — `puml-*` on every element.
28. **C4** (Phase 4g) — macro library on top of description; needs SI-5.

### E. Ecosystem / packaging
29. **Markdown integration** (Phase 6) — autoload, markdown-it, remark plugins.
30. **graphviz-ts npm cutover** — swap the pinned tarball for the release.

---

## 4. Known unknowns — we know we need it, shape is unclear

These need a spike or a decision before they become missions.

- **Text-measurement fidelity.** The single biggest depth ceiling. Options:
  (a) bundle Java's font metric tables, (b) ship a curated LUT per common font,
  (c) accept a tolerance band forever. Until resolved, no type is byte-faithful
  and node sizes stay a reported-not-asserted metric. **Decision needed:** how
  faithful do sizes need to be, and what's the measurement strategy?
- **Smetana-for-json oracle.** json/yaml/hcl route through Smetana, not svek —
  the current oracle patch can't see them. Do we (a) extend the oracle to tap
  Smetana input, (b) define a different parity oracle for these, or (c) scope
  them out of DOT-parity and verify by SVG only?
- **The stub layout engines (neato/fdp/sfdp/circo/twopi/osage).** Authentic
  ports are 500–16,000 C lines each (neato is the monster). Which types
  *actually* need authenticity vs. "a reasonable layout"? Mind map/WBS use
  twopi; if the stub looks fine against upstream, we may never need the port.
  **Spike:** oracle-diff the stub engines on their consuming types before
  committing to any port.
- **SVG rendering fidelity vs. graphviz-ts.** Once our DOT matches the oracle,
  remaining visual deltas are graphviz-ts's layout output vs. PlantUML's native
  graphviz. graphviz-ts is ~91% conformant on extreme graphs (maintainer's
  number). Unknown how much of the residual visual gap is ours vs. theirs until
  we have a DOT-matched SVG-diff pass.
- **`!include <stdlib>` surface area.** How much of the C4/AWS/archimate/etc.
  stdlib do real users pull? Bundling all of it is large; bundling the common
  20% may cover 95% of fixtures. **Spike:** measure include frequency across the
  pdiff corpus.
- **Non-svek depth measurement.** sequence and activity have no DOT oracle
  because they don't use graphviz. Their faithfulness is unmeasured. Do we build
  an SVG-structural oracle for them, or accept eyeball QA?

---

## 5. Unknown unknowns — what to be ready for

Not predictions; postures.

- **Every "Done" type is probably shallow.** The description 7% result is the
  prior. Budget a depth pass for each before calling the port complete; expect
  each to surface 10–20 mechanisms nobody knew were wrong.
- **Combinatorial layer interactions.** The bugs cluster at *interactions*
  (feature A + skinparam B inside container C), not within features. Per-feature
  tests pass while the diagram is broken. The pdiff corpus (5,600 issue-derived
  fixtures) is the defense — treat it as the work queue, not a validation suite.
- **Upstream drift.** PlantUML ships continuously; the oracle jar is pinned to
  one SHA. Long-lived divergences will appear as upstream changes behavior.
  Re-pin deliberately and re-baseline the ratchets when we do.
- **graphviz-ts is a moving dependency.** It's mid-refactor. Its algorithm
  changes can shift our SVG output without any change on our side. The tarball
  pin is the guard; refreshes must be journaled and re-baselined.
- **Preprocessor is a Turing tarpit.** `!procedure`/`!function`/`%invoke` +
  variables + conditionals is a small language. Bundled stdlib libraries lean on
  it hard. Expect the preprocessor to need more than "partial" before C4/AWS
  work, and expect edge cases indefinitely.
- **The corpus keeps finding new syntax.** Twenty-four iterations in, we are
  still discovering grammar forms (en-dash arrows, `#color;style`, multi-line
  `[…]` bodies, sprite blocks). The tail is long by design — that IS the
  product. Don't model the remaining work as finite-and-known.

---

## 6. Recommended sequencing

The ordering that maximizes learning-per-mission and de-risks the unknowns:

1. **Finish description depth** (current mission) — proves the harness end to
   end and the exit-bar discipline.
2. **class + object + state depth passes** — reuse the harness; convert the
   biggest "Done-but-shallow" types to actually-faithful. Highest depth ROI.
3. **Text-measurement spike** — resolve the ceiling that caps *every* type's
   depth before investing more in per-type fidelity.
4. **Smetana-oracle decision** — unblocks json/yaml/hcl depth or scopes it.
5. **Stub-engine oracle spike** — decide which authentic Graphviz ports are
   actually needed (possibly none for a while).
6. **Preprocessor + stdlib (SI-5)** — the big breadth unblocker; gates C4/AWS.
7. **New diagram types**, in the dependency order of §3.B, each with a depth
   gate from birth (build the oracle goldens as you build the type, not after).
8. **Cross-cutting fidelity** (skinparam, Creole, CSS classes) folded in as the
   types that need them land.
9. **Ecosystem packaging** last.

The through-line: **never add breadth without a depth gate again.** The DOT
grind exists so that "Done" means "faithful," not "renders something."

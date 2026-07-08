# Decision Journal — Mission A3 (class descriptive-element consolidation)

Appended during execution. Newest entries at the bottom of each batch section.

---

## Batch 0 — Investigation (started 2026-07-07)

### Execution plan (logged per autonomous-execution.md — autonomous mode, no user gate)
Batch 0 is investigation only, no `src/` edits. Four sequential tasks (T0.1–T0.4),
handled directly (single-agent — no write-set, no parallel bottleneck; the work is
reading upstream Java + cached oracle DOT). Deliverables: keyword→shape table,
Tier-1 current-output classification, finalized ADR-2 with corpus-safety evidence,
allow_mixing note.

### Context note (from user, mid-Batch-0)
A parallel architecture review is producing docs under `docs/architecture/`. Relevant
because ADR-1 defers a future `cucadiagram` convergence track; watch those docs so this
mission's helper-module placement stays compatible. Does not change Batch 0.

---

### T0.1 — keyword → LeafType → USymbol → svek-shape table  ✅

**Sources read (upstream `~/git/plantuml`):**
- `classdiagram/command/CommandCreateElementFull2.java` — the class-factory element
  command. `regex = "(state|" + CommandCreateElementFull.ALL_TYPES + ")"`. Requires
  `allowmixing` (NORMAL_KEYWORD mode errors unless `diagram.isAllowMixing()`), except
  the `mix_`-prefixed WITH_MIX_PREFIX mode.
- `descdiagram/command/CommandCreateElementFull.java` — `ALL_TYPES` string (line 76) +
  the symbol→LeafType/USymbol deduction (the authority for the mapping).
- Symbol deduction (both commands, executeArg): `()`-prefix code → `interface`;
  first char `(` → `usecase`; `:` → `actor`; `[` → `component`; else the SYMBOL keyword.

**`ALL_TYPES` (upstream verbatim, line 76 of CommandCreateElementFull.java):**
```
person artifact actor/ actor folder card file package rectangle hexagon label
node frame cloud action process database queue stack storage agent usecase/
usecase component boundary control entity interface circle collections
port portin portout
```

**LeafType mapping (executeArg, both commands):**
| symbol | LeafType | USymbol |
|--------|----------|---------|
| port / portin | PORTIN | null |
| portout | PORTOUT | null |
| usecase | USECASE | null |
| usecase/ | USECASE_BUSINESS | null |
| state | STATE | null |
| circle | **CIRCLE** (desc cmd only; class cmd → DESCRIPTION+circle USymbol) | null / USymbol |
| (anything else in ALL_TYPES) | DESCRIPTION | `USymbols.fromString(symbol)` |

**Oracle-verified keyword → svek node shape** (cross-checked against the 18 fixtures'
cached `test-results/dot-cache/class/<full-slug>/svek-1.dot`; oracle is the authority):

| keyword / form | svek shape | evidence fixture |
|----------------|-----------|------------------|
| `class` / `abstract class` | **rect** | all Tier-1, lilura-67 |
| `interface` (plain keyword) | **rect** | conija-14 (dummy), niduni-65 (A1), lilura-67 |
| `enum` | **rect** | lilura-67 (ENUM) |
| `annotation` | **rect** | lilura-67 (ANNOTATION) |
| `entity` | **rect** | lilura-67 (ENTITY), xosiza-60 (Entity) |
| `database` | **rect** | givofi-11 (dummy2), popesa-39 |
| `component` (leaf) | **rect** | cacoma-43 (comp3), lojiga-09 (empty b) |
| `actor` (in class ctx) | **rect** | cacoma-43 (foo3) |
| `usecase` | **ellipse** (LeafType.USECASE) | cacoma-43 (foo2) → ellipse=1 |
| `circle` (element) | **plaintext** (circle table) | niduni-65 (A2) → plaintext=1 |
| `rectangle` (empty leaf) | **rect** | rakuci-96 (YYY), sijisi-94 (foo3) |
| `package` / `rectangle` / `stack` (non-empty) | **cluster** | rakuci-96, lojiga-09, sijisi-94 |
| non-empty container endpoint of an edge | **point** anchor | lojiga-09, sijisi-94 |
| `()` / `--(` lollipop interface | **plaintext** (circle table) | conija-14, niduni-65 (`C2 --( A2`) |
| `::member` port / qualifier | **plaintext** | sijisi-94 |

**Key divergence-trap notes (grounded, not guessed):**
1. A **plain `interface Foo` keyword → rect**, NOT plaintext. Only the `()` / `--(`
   *parenthesis / lollipop* form → plaintext circle. conija-14 proves both in one
   fixture (plaintext=1 from `()`, rect=2 from `class foo` + `interface dummy`).
2. **`circle` the element → plaintext** (niduni-65 A2). But **`hide circle`/`hide empty
   members` are directives**, not elements — xosiza-60 carries `hide circle` yet is
   all-rect (its `circle` keyword-signal is a false positive). The parser must not treat
   `hide circle` as a circle element.
3. `usecase → ellipse` is the only non-rect leaf keyword. `actor`/`component`/`database`
   etc. are all **rect** at the DOT level (the stick-figure/icon is drawn *inside* a
   rect node by svek; the DOT shape is rect).

**Current class-engine state (confirms README crux #2):**
- `layout.ts buildDotNodes` (l.274-286): association→diamond, assoc-circle→circle,
  shielded port/qualifier→plaintext, **else → rect** (shape unset ⇒ rect in emitter).
  So any classifier the parser creates with a non-special kind auto-renders **rect**.
- `class-declaration-parser.ts:47` regex = `^(abstract\s+class|class|interface|enum|
  annotation)\s+(.+)$`. `ClassifierKind` (ast.ts:31) = class/abstract/interface/enum/
  annotation/object/association/assoc-circle.
- **Already handled** (parser creates → auto-rect): class, abstract, interface, enum,
  annotation. **Missing** (parser needs to create): entity, circle, component, database,
  usecase, actor, node, folder, rectangle, package, stack, and the rest of ALL_TYPES.

**Tier→work mapping implied by the table:**
- Tier 2 leaf classifiers: parser must accept `entity` (→rect) and `circle` (→plaintext,
  special). interface/enum/annotation/abstract already work.
- Tier 3 containers: `package`/`rectangle`/`database`/`component`/`stack` — leaf vs
  cluster by emptiness (matches existing namespace/package cluster logic).
- Tier 4 special: `()`/`--(` lollipop → plaintext; `usecase` → ellipse; `::` port →
  plaintext; container-edge → point anchor.

Exit for T0.1: table exists and matches oracle for every element type the 18 exercise. ✅

---

### T0.2 — Tier-1 current class-engine output (force-routed)  ✅

Method: throwaway probe (`scripts/a3-tier1-probe.ts`, deleted before Batch 1) —
`preprocess → extractBlocks → classPlugin.parse → layoutSync` with the layout-input
observer, then `compareStructural(oracle, ours)` against the cached svek DOT. Forces
the class engine past today's declining `accepts()`.

**First: why each is misrouted today (both are false positives, not real desc elements):**
- dudimi-83, duvuti-29, pareli-69, xodopa-41: declare a **class named `Person`** with
  field lines `Person : guid OID` that *start with* the token `person` → trips
  `hasDescriptiveSignal` (`^person(?=\s)`; `person` ∈ ALL_TYPES, not in the
  interface/package/actor exclusions). Keyword-as-classname collision.
- taxemo-34: a note body line `(palegreen)` matches the `(Use Case)` shorthand
  (`matchesElementShorthand`, `/^\(.+\)/`). Parens inside a `note … end note` body.

**Results (force class engine, structural DOT vs oracle):**
| fixture | verdict | nodes o/us | edges o/us | gap |
|---------|---------|-----------|-----------|-----|
| taxemo-34 | **EQUAL** | 3/3 | 2/2 | — flips on routing alone |
| dudimi-83 | DIFF | 5/5 | 7/4 | edges dropped |
| duvuti-29 | DIFF | 5/5 | 6/3 | edges dropped |
| pareli-69 | DIFF | 5/5 | 7/4 | edges dropped |
| xodopa-41 | DIFF | 5/5 | 7/4 | edges dropped |

**Classification:**
- **taxemo-34 → flips-on-routing.** Batch 1 wins it for free.
- **dudimi/duvuti/pareli/xodopa → needs-work.** Node count is already correct; the
  structural gap is **dropped cross-namespace / qualified relationship edges**. All four
  are `namespace { … }` diagrams whose relationships use leading-dot root refs
  (`.BaseClass <|-- Person`) and fully-qualified cross-namespace endpoints
  (`Revelate.Legacy.Base.Biz.BaseClass <|-- Person`). Ours keeps the ~4 in-namespace
  simple links and drops the ~3 qualified/root-ref ones (7 rel lines = oracle's 7 edges;
  we emit 4). **Hypothesis (for a later batch to confirm): qualified/leading-dot
  relationship endpoints don't resolve to an existing classifier and the edge is
  silently dropped.**

**SCOPE IMPLICATION (surface to user):** this namespace qualified-endpoint edge gap is
**orthogonal to descriptive elements** — it's pre-existing class-engine namespace
relationship resolution, not part of the keyword→shape work. So Batch 1's "routing
alone" win on Tier-1 is **~1 fixture (taxemo)**, not 5. The other 4 need a namespace
edge-resolution fix that this mission did not originally scope. Matches the README
recon caveat ("3 EQUAL from forcing class on 57" — the floor). Realistic Tier-1 target
must be reframed: taxemo now; the 4 namespace fixtures only if a namespace-edge task is
added (candidate Batch 1b, or explicitly deferred).

**Pre-existing tree state note (not mine):** IDE diagnostics show TS errors in
`src/diagrams/class/parser.ts` (ParseState vs ClassDiagramAST) and various scratch files
(find-equal.ts, debug-*.ts, size-drill.ts, one-fixture.ts) — present on `main` before
this mission, likely from the parallel architecture review / prior sessions. Batch 1
must confirm `npm run typecheck` baseline on `main` before attributing any failure to
mission work.

---

### T0.3 — Routing discriminator finalized (ADR-2 → Accepted)  ✅

**Upstream factory-selection path (read `PSystemBuilder.java`):**
- Factory registration order (l.133-140): Sequence(135), **Class(136)**, Activity(137),
  **Description(138)**, State(139). Class is tried **before** description.
- `createPSystem` loop (l.256-276): for each factory whose `getDiagramType()` is a
  candidate, call `f.createSystem(...)`; **the first factory that returns a non-error
  diagram wins.** So selection is *trial-parse*, not keyword presence: **class wins iff
  the class factory parses every line.**
- `CommandCreateElementFull2(NORMAL_KEYWORD)` (the descriptive-leaf command in the class
  factory) **errors unless `diagram.isAllowMixing()`** (l.197-198). So a *bare descriptive
  leaf* (`node Foo`, `[Comp]`, `(usecase)`) without `allowmixing` makes the class factory
  fail → description wins. Native class commands need no allowmixing:
  `CommandCreateClass` (class/interface/enum/annotation/abstract/**entity**/**circle**/
  protocol/struct/exception/metaclass/diamond/object/record/dataclass/map — l.87),
  `CommandCreateEntityObject`, `CommandCreateElementParenthesis` (`()` lollipop),
  `CommandPackageWithUSymbol` (package/rectangle/node/component/database/stack/… **as
  containers with a body** — descdiagram/…:77-78, registered in the class factory),
  `CommandLinkClass`/`CommandLinkLollipop`, `CommandDiamondAssociation`.

**Our registration order matches upstream** (`src/index.ts:34-41`): object(34),
**class(35)**, …, **description(41)**. So class `accepts()`=true steals from description.

**FINAL discriminator (mirrors "class factory parses every line" as accepts() heuristics):**
```
classAccepts(lines):
  if allow_mixing/allowmixing present: return true                       # Δ1 class-only cmd
  declLines = lines
     minus relationship lines (REL_DISPATCH_RE)
     minus note-block bodies      (Δ2: `note left|right|top|bottom|over of X` … `end note`,
                                        excluding inline ` : ` single-line notes)
     minus member lines `Id : …`  (Δ3: `Person : guid OID` — keyword-as-classname FP)
     minus native-class decls     (Δ4: class/interface/enum/annotation/abstract/entity/
                                        circle/protocol/struct/exception/metaclass/diamond/
                                        object/record/dataclass/map)
     minus container openings     (Δ4b: `descKw … {` — CommandPackageWithUSymbol natives)
  if hasDescriptiveSignal(declLines): return false                       # pure descriptive
  return hasClassNativeSignal(lines)   # native decl OR class rel OR existing CLASS_ACCEPTS
```

**Corpus-safety evidence (throwaway probe `scripts/a3-corpus-safety.ts`, manifest set
`tests/visual/data/{component,usecase}.json`, filtered to oracle-having):**
- 314 measurable DESCRIPTION fixtures → **flips=1, flip&currently-EQUAL=0.**
- The 1 flip (`component/gutute-00`) uses `protocol` (native class) inside `node {}`
  containers — upstream routes it to **class** too (every line parses in the class
  factory); it is currently NOT equal, so flipping it is *correct*, not a regression.
- **ADR-3 gate satisfied: zero currently-EQUAL DESCRIPTION fixtures pulled into class.**
- All **18/18** target class fixtures route to class under this discriminator.

**Baseline numbers recorded for Batch-1 regression gate:**
- class DOT parity: **274/680 EQUAL (40%)** (README) — reconfirm at Batch-1 start.
- DESCRIPTION parity (the at-risk side): **component 234/259 (90%)**,
  **usecase 59/87 (68%)** → 293 EQUAL. Post-Batch-1 this must not drop.

**Batch-1 implementation boundary notes (important):**
1. Do **not** mutate the shared `hasDescriptiveSignal`/`descriptive-keywords.ts` — the
   sequence guard and description `accepts()` also use it. Apply Δ2–Δ4b as class-plugin
   **pre-filtering of declLines** (or a class-local wrapper) so the change stays inside
   the class engine (ADR-1: new code in class helper modules, not entangled with
   description internals).
2. This is a *design mirror*, not a literal trial-parse. It reproduces upstream's outcome
   for the measured corpus. If a future fixture breaks it, refine toward "does the class
   factory parse every line" (ADR-2), not another ad-hoc `accepts()` pattern.

**Verdict: ADR-2 discriminator is faithful and corpus-safe → PROCEED. No STOP.**

---

### T0.4 — allow_mixing handling  ✅

Upstream `CommandAllowMixing`: regex `^allow_?mixing$` (allow, optional `_`, mixing);
`executeArg` just flips `diagram.setAllowMixing(true)`. The flag gates
`CommandCreateElementFull2` (descriptive-leaf command errors unless set).

**Our handling:** the class parser must accept `^allow_?mixing\s*$` (case-insensitive) as
a recognized **no-op directive** so it is consumed (not treated as a stray declaration).
- **Insertion point:** `src/diagrams/class/parser.ts` — the `COMMANDS` array (l.160),
  a new entry beside the existing no-op ignores (skinparam/title at l.167-171):
  ```ts
  // allow_mixing / allowmixing — upstream CommandAllowMixing flips setAllowMixing(true).
  { pattern: /^allow_?mixing\s*$/i, execute() { /* no-op */ } },
  ```
- **Why no flag needed:** per ADR-4 the class parser accepts the descriptive keyword set
  unconditionally, and the routing discriminator (Δ1) already routes allow_mixing blocks
  to class. A bare descriptive leaf *without* allow_mixing routes to DESCRIPTION (the
  discriminator declines), so the class parser only ever sees descriptive-leaf lines when
  allow_mixing is present or the keyword is native (entity/circle/container). Tracking the
  flag to reproduce upstream's "Use allowmixing" *error* is a possible later bug-for-bug
  refinement, not required for the 18.

---

## Batch 0 — COMPLETE

All four tasks done. Exit criteria met:
- Shape table exists and matches the oracle for every element type in the 18 (T0.1).
- Tier-1 classified: taxemo-34 flips-on-routing; dudimi/duvuti/pareli/xodopa need a
  namespace qualified-endpoint edge fix (orthogonal to descriptive elements) (T0.2).
- ADR-2 Accepted with corpus-safety evidence (flip&EQUAL=0 over 314 fixtures); PROCEED (T0.3).
- allow_mixing insertion point identified (T0.4).

**Key scope update for the user / Batch 1 planning:** the "routing alone" Tier-1 win is
**~1 fixture (taxemo)**, not 5 — the other 4 Tier-1 fixtures share a namespace
qualified-endpoint edge-resolution gap unrelated to descriptive elements. Recommend
either adding a Batch-1b namespace-edge task or explicitly deferring those 4. The Tier
2/3/4 feature work (parser keyword→kind→shape) is unaffected and proceeds as planned.

**Throwaway probes** (`scripts/a3-tier1-probe.ts`, `a3-corpus-safety.ts`, `a3-check18.ts`)
deleted at Batch 0 close — Batch 0 lands no `src/` or `scripts/` code, only docs.

---

## Batch 1 — routing (IMPLEMENTED, then STOPPED at the quality gate)

### T1.1 implementation
- New `src/diagrams/class/class-dispatch.ts` (`classAccepts`, the ADR-2 discriminator,
  Δ1–Δ4b; class-local, does not mutate shared `descriptive-keywords.ts`).
- `src/diagrams/class/index.ts` delegates `accepts` to `classAccepts`.
- `src/diagrams/class/parser.ts` COMMANDS: `allow_?mixing` no-op entry.
- `tests/unit/class/class-dispatch.test.ts` (7 tests, green). Full suite 281 green,
  typecheck green.

### T1.2 dual-corpus gate — MIXED result, STOPPED
Measured via `renderSync` (real preprocess+dispatch) over oracle-having manifest
fixtures, before (stash) vs after, EQUAL-set `comm`:

**DESCRIPTION corpus (the primary hazard): PERFECT — 0 regressed, 0 changed.**
- component 221→221, usecase 41→41. ADR-3's non-negotiable gate is satisfied.

**CLASS corpus: net +1 (267→268), but with a swap:**
- GAINED: taxemo-34 (the intended Tier-1 routing win) + rusuzi-21 (bonus).
- REGRESSED: **cacoma-43** — a *transient, expected* regression. It has
  `allow_mixing`+`usecase`; Batch 1 correctly routes it INTO the class engine, which
  cannot render `usecase→ellipse` until Batch 4. Before, it was *accidentally* EQUAL via
  the description engine (which handles usecase natively). Batch 4 restores it.

**NEW PROBLEM — cross-corpus steals into class (activity +1, sequence +20):**
Measured old-vs-new `classAccepts` on preprocessed manifest lines. The new discriminator
newly routes 1 activity + 20 sequence fixtures to the class engine. These corpora have no
DOT oracle (own layout), so they are outside the measured gate — but routing a sequence/
activity diagram to the class engine is a silent visual regression.
- Trigger causes: Δ4 un-gating (`circle`→gelibo-15 archimate, `struct`→vivate-04,
  `object`-in-note→dasutu-58); and genuine `class X {`/`class X` content in
  sequence-classified fixtures (bavugo-80, coxosa-05, kunazo-59, midisa-57, rizove-01).
- **Root cause: our registry order is INVERTED from upstream.** Upstream
  `PSystemBuilder` tries **Sequence(135) before Class(136)**; our registry has class
  before sequence ("sequence last" by design, `src/index.ts`). Upstream's order lets a
  sequence diagram win even when it contains class-like tokens; our order forces class's
  `accepts()` to stay conservative enough not to steal them. Δ2/Δ4 removed that
  conservatism. A regex guard can't reliably separate a sequence message
  (`Bob -> Alice : hello`) from a labelled class association — it's a trial-parse problem.

### STOP — architectural decision required (logged per autonomous-execution STOP rules)
The measured ADR-3 gate passes (description 0-drop, class net +1). But the steals are a
real silent-regression risk in unmeasured corpora, and the root cause is the registry
order inversion — an architecture-level issue, not a one-batch patch. Options:
  (A) Add a foreign-engine guard to `classAccepts` (decline sequence/activity signal).
      Hard to make reliable/complete by regex; sequence corpus has no oracle to validate.
  (B) Reorder the registry to mirror upstream (sequence before class). Faithful but a
      broad change touching all routing; needs its own regression pass.
  (C) Restructure batches so each tier ROUTES and RENDERS together (route only what the
      class engine can already render), avoiding both the transient regressions and the
      steals. Narrows Batch 1 to allow_mixing/native cases the engine handles today.
  (D) Accept the steals (unmeasured corpora) and proceed; revisit at Batch 5.
Batch 1 code is committed to NOTHING yet — working tree only. Awaiting direction.

---

## T1a — registry reorder (implemented) + the structural finding

Implemented to mirror upstream's Sequence→Class factory order:
- `src/index.ts`: order now object, state, **sequence, class**, description, activity, [data].
- `src/diagrams/sequence/index.ts`: sequence.accepts now (1) claims on a strong
  sequence-exclusive signal (`activate`/`deactivate`/`autonumber`), (2) declines
  `hasDescriptiveElement` (description's own predicate — was the narrower
  `hasDescriptiveSignal`), (3) declines class-native signal. This keeps sequence from
  stealing class/description via its broad `-->` heuristic now that it runs earlier.

### Measured gate (ADR-3) — PASSES
Full before(main)/after `comm` over oracle-having manifest fixtures:
- **DESCRIPTION corpus: component 221→221, usecase 41→41 — zero regressed.** ✓
- **CLASS corpus: 267→268 (+1).** Gained taxemo-34, rusuzi-21; lost cacoma-43 (transient).

### Two test failures, both consequences of the routing change
1. `tests/unit/dispatch/descriptive-guard.test.ts` — asserts `entity Entity {…}` routes
   NOT to class. This is **obsolete**: per T0.1/ADR-4 `entity` is a native class keyword
   (`CommandCreateEntityObjectMultilines`); upstream routes it to class, and xosiza-60
   (entity) is a target. The test encodes the pre-A3 assumption A3 overturns → update it.
2. `tests/oracle/class-dot-parity.test.ts` — cacoma-43 ratchet fails. cacoma has
   `allow_mixing`+`usecase`; Batch 1 correctly routes it to class, which cannot render
   `usecase→ellipse` until Batch 4. It was *accidentally* EQUAL via description before.

### THE STRUCTURAL FINDING (the reason to stop)
The cacoma ratchet failure is not incidental — it exposes that the mission's batch
structure is **route-all-in-Batch-1, render-in-Batches-2–4**, which is **incompatible
with the per-batch "all tests green" quality gate**: routing a fixture into the class
engine before the engine can render its features necessarily breaks that fixture's
parity ratchet. cacoma is the first; conija/sijisi (Tier-4 lollipop/port) would be the
same at Batch 1 if they were pinned. The faithful structure is **route + render each
tier together** (only route what the class engine can already render), which is also what
CLAUDE.md "build deep before wide" prescribes.

### Residual (unmeasured corpora, trial-parse-hard)
~5 genuinely-ambiguous fixtures still misroute to class: entity-as-sequence-participant
without an activate keyword (xutiri-59, lagexo-50, ruxiga-63), activity `struct` inside
an action (vivate-04), archimate `circle` (gelibo-15). These need trial-parse-grade
disambiguation of keywords valid in 3+ diagram types (`entity`/`circle`/`database`);
each heuristic guard attempted traded one misroute for another (zilisi↔xutiri,
xifuza↔rujetu). Not cleanly solvable in the accepts() architecture.

### STOP — mission-structure decision required
The routing work is sound on the measured gate but reveals the batch structure needs to
change (route+render per tier), plus a residual that needs trial-parse routing (separate
effort). This is above single-batch autonomous judgment. Working tree only; nothing
committed. Awaiting direction.

---

## RESOLUTION — restructure to route+render per tier (user sign-off), Batch 1 landed

User chose "route + render per tier." Batch 1 rescoped to the single delta whose
fixtures the class engine already renders:
- Reverted the reorder (src/index.ts), sequence guards (sequence/index.ts), and the
  allow_mixing no-op (class/parser.ts) to Batch-0 HEAD — they move to the batches whose
  routing needs them (reorder+guards → Batch 2 with Δ4; allow_mixing → Batch 4).
- `class-dispatch.ts` reduced to **Δ2 only** (note-body stripping): routes taxemo-34, a
  genuine class diagram misrouted by `(palegreen)` inside a note body. Δ4 (entity/circle),
  Δ4b (containers), Δ1 (allow_mixing) deferred to their render-batches.

**Batch 1 final gate — all green:**
- class 267→268 (+1, GAINED taxemo-34), component 221→221, usecase 41→41. Zero regressed
  on any corpus.
- Δ2 steal check: **0 new steals** in activity/sequence/state (Δ2 only affects the decline
  path and is fully conservative).
- npm test 3630 pass, typecheck green, lint clean, build ok.
- Pre-existing lint errors in `class-assoc-couple.ts` (2 unnecessary `!` assertions,
  present at Batch-0 HEAD, not mine) auto-fixed to unblock the lint gate; noted in commit.

Batch structure updated in README. The full routing machinery (reorder, sequence guards,
Δ4/Δ4b/Δ1) is preserved in this journal (T1a / Batch-1 sections) and re-applied in the
batch whose rendering justifies it. The ~5 ambiguous-keyword misroutes remain a Batch-5
residual for a future trial-parse-dispatch task.

---

## Batch 1b — T1b.1 diagnosis (namespace qualified-endpoint edge drop)

### Instrumentation (dudimi-83, force-parsed through the class engine)
5 classifiers created (node count correct). **4 of 7 source relationships created.**
The 3 dropped are exactly the ones with a **leading-dot endpoint `.BaseClass`**:
`.BaseClass <|-- Revelate.Legacy.Base.Biz.BaseClass`, `.BaseClass <|-- Person`,
`.BaseClass <|- Meeting`. The 4 kept use in-namespace or fully-qualified names.

Probe of `REL_DISPATCH_RE` / `parseRelationshipLine` on each:
- `.BaseClass <|-- Person` → `REL_DISPATCH_RE=false`, `parseRelationshipLine=null`.
- `Revelate.Legacy.Base.Biz.BaseClass <|-- Person` → matches, parses fine.

### Mechanism
`CLASS_ID = \w+(?:\.\w+)*(?:::\w+)?|"[^"]+"` requires an id to **start with `\w`**.
A leading dot (`.BaseClass`) does not match — `(?:\.\w+)*` handles *internal* dots
(fully-qualified names parse) but not a *leading* one. So the relationship regex fails
and the line is dropped.

### Origin
`src/diagrams/class/class-relationship-parser.ts:39` — the `CLASS_ID` fragment (used to
build both `REL_RE` and `REL_DISPATCH_RE`).

### Causal chain
1. `.BaseClass` is PlantUML's leading-dot = root-namespace reference to the top-level
   `class BaseClass` (id `"BaseClass"`).
2. `CLASS_ID` starts with `\w+` → no match for a leading `.`.
3. `REL_DISPATCH_RE` (built from `CLASS_ID`) → the parser.ts relationship command
   (`pattern: REL_DISPATCH_RE`, l.358-372) never fires for these lines.
4. The line matches no COMMAND rule → consumed as a no-op → no relationship created.
5. 3 of 7 edges dropped → structural DIFF vs the 7-edge oracle.

### Ruled out (with evidence)
- NOT a resolution/qualification failure: the endpoint never reaches `resolveReference` —
  it fails at the regex-match stage (`parseRelationshipLine=null`).
- NOT classifier creation: all 5 classifiers exist; node count already matches oracle.
- NOT internal dots: fully-qualified `Revelate.…BaseClass <|-- Person` matches and parses.
  Only the LEADING dot fails.

### The faithful fix (upstream-grounded)
Upstream `net.atmp.CucaDiagram.quarkInContextSafe` (l.261-262):
```java
if (full.startsWith(sep))
    return Failable.ok(this.root.child(full.substring(sep.length())));
```
→ a leading separator resolves from **root**, stripping the dot. So:
1. `CLASS_ID`: allow an optional leading dot — `\.?\w+(?:\.\w+)*(?:::\w+)?|"[^"]+"`.
2. `resolveReference`: when `name` starts with `sep`, strip it and resolve the remainder
   at the ROOT namespace (activeNamespace=null), mirroring `root.child(...)`.

Batch 1b (route+render per tier) = **Δ3 (member-line routing fix, routes the person-named
class fixtures to class) + the leading-dot edge fix (renders their 3 dropped edges)**,
landed together.

### T1b.2 — fix implemented, Batch 1b landed

**Rendering fix (the diagnosed root cause):**
- `class-relationship-parser.ts:39` — `CLASS_ID` now `\.?\w+(?:\.\w+)*(?:::\w+)?|"[^"]+"`
  (optional leading dot).
- `class-namespace.ts resolveReference` — a `name` starting with `sep` strips the leading
  separator and resolves the remainder at root (activeNamespace=null), mirroring upstream
  `CucaDiagram.quarkInContextSafe` `root.child(full.substring(sep.length))`.
- Verified: dudimi-83 now parses all 7 relationships; `.BaseClass` resolves to root
  classifier id `"BaseClass"`. Force-routed, all 4 namespace fixtures are structurally EQUAL.

**Routing fix (Δ3):** `class-dispatch.ts` excludes member lines (`Id : field`) from the
descriptive scan, so a class named `Person` with `Person : guid OID` lines is not read as
a `person` element.

**Batch 1b gate — all green:**
- class 267→**274 (+7)** vs main. GAINED dudimi/duvuti/pareli/xodopa (targets) + taxemo
  (Batch 1) + lujaje-96 + momoba-92 (two bonus class fixtures that also had leading-dot
  edges dropped). ZERO regressed on any corpus. component 221, usecase 41 unchanged.
- Δ3 steal check: 0 steals in activity/sequence/state.
- npm test 3633 pass, typecheck green, lint clean, build ok.

Two Tier-1 fixtures remain for Batch 1b's stated scope? No — all 4 landed. Tier 1 is now
fully EQUAL (taxemo via Batch 1, the 4 namespace fixtures via Batch 1b).

---

## Batch 2 — T2.1 diagnosis (Tier-2 structural gap): SCOPE IS LARGER THAN THE BRIEF

Force-routed lilura/tepazu/xidura/niduni through the class engine today. The brief framed
Batch 2 as "add entity/circle keywords → rect (circle special)". Instrumentation shows the
Tier-2 fixtures each need SEVERAL distinct fixes, most of them general parser/layout work
orthogonal to "leaf classifiers":

**tepazu-23 / xidura-26** (identical: 6 disconnected leaf decls, NO source relationships):
- (a) `entity ENTITY` not parsed → 1 node short. [the actual leaf-classifier work]
- (b) Oracle has 5 edges, **all `style=invis`** — svek packs disconnected leaf nodes into a
  grid via invisible layout edges (`arrowtail=none arrowhead=none minlen=0/1 style=invis`;
  chained minlen=0 within a row, minlen=1 between rows). Our engine emits 0. This is a
  **general svek layout feature** (disconnected-node invisible-edge packing), not entity work.

**lilura-67** (class CLASS { } + 4 rels + 5 leaf decls):
- (a) `entity` missing (as above).
- (b) **CLASS-name collision**: `CLASS *-- f1` is parsed as a class *declaration* named
  `*-- f1` — the case-insensitive `class` keyword matches the class NAMED `CLASS`, and the
  declaration command (parser.ts:269) is tried before the relationship command (:358), and
  dispatch is first-match-wins with an unconditional `break`. Confirmed: `Foo *-- f1`→null
  (relationship), `CLASS *-- f1`→decl. Result: 0 relationships.
- (c) **`o-->` arrow gap**: `CLASS o--> f3` does NOT match `REL_DISPATCH_RE` at all (the
  `o`-prefixed aggregation-with-arrowhead is unrecognized) — a relationship-parser bug
  independent of (b). So even reordering REL before decl would not recover this edge.
- (d) invisible-edge packing likely also applies (oracle edges 8 > 4 explicit).

**niduni-65** (`left to right direction` + class/interface/circle + lollipop):
- (a) `circle A2` parsed as rect; needs **plaintext** (the circle table).
- (b) `C2 --( A2` **lollipop link** (`--(`) not parsed → 1 edge short.
- (c) **rankdir**: `left to right direction` → rankdirOk fails.

### Assessment
Batch 2's real scope = entity keyword (small) + circle→plaintext (small) + FOUR general
fixes: CLASS-name/keyword-collision disambiguation, the `o-->` arrow gap, the `--(`
lollipop link, rankdir, and a **substantial svek layout feature** (invisible-edge packing
for disconnected nodes). Per route+render-per-tier, none of the 4 Tier-2 fixtures reaches
EQUAL from the entity/circle keywords alone — each needs multiple of these. This mirrors
the Batch-1 routing detour: the brief's per-tier estimate was optimistic. STOP for scope
direction before implementing.

### T2.2 — general class-parser fixes (CLASS-name collision + o--> arrow) — LANDED

Two general class-parser bugs (surfaced by Tier-2, affecting the already-routed corpus):
1. **o--> / *--> arrows** (`class-relationship-parser.ts`): `REL_ARROW` enumerated only
   single-decoration arrows; added the decoration+arrowhead combined forms
   (`o-->`,`*-->`,`<--o`,`<--*` + dotted variants, longest-first) and their `ARROW_INFO`
   type mappings (`o->`→aggregation, `*->`→composition, `<-o`/`<-*` swap). Mirrors
   upstream's `HEAD1? BODY HEAD2?` grammar.
2. **CLASS-name collision** (`parser.ts`): moved the relationship command BEFORE the
   classifier-declaration command. `CLASS *-- f1` (a class named `CLASS`) was parsed as a
   declaration named `*-- f1` because the case-insensitive `class` keyword matched and
   dispatch is first-match-wins. Verified every declaration form has `REL_DISPATCH_RE=false`
   (no arrow), so the reorder cannot steal declarations.

**Gate:** class 274→**277 (+3)** vs Batch-1b — GAINED canuti-20, jocapi-44, xexaza-01;
ZERO regressed. component/usecase unchanged (parser fixes on already-routed class
diagrams). npm test 3633 pass, typecheck green, lint clean, build ok.

Note: no Tier-2 fixture landed from T2.2 alone (they still route to description; they need
entity/circle keywords + the invisible-edge packing feature). T2.2 is the general-fix
increment the user prioritized — measurable wins independent of Tier-2 routing.

### T2.3 + T2.4 — entity/circle keywords + Magma invisible-edge packing — LANDED (+45)

**T2.3 entity/circle:** added `entity`/`circle` to `ClassifierKind`, the declaration
regex, and the parser.ts declaration command pattern. `entity`→rect (default);
`circle`→plaintext (buildDotNodes case, the small circle table).

**T2.4 Magma standalone chaining (the critical-path layout feature):** the description
engine already had a faithful port (`SquareMaker`/`Magma`/`MagmaList` →
`applySingleStrategy`). Extracted the GENERIC algorithm to `src/core/magma.ts`
(shared — it is a cucadiagram feature, not description-specific), had description
re-export from it (329 description tests still green), and added `class-magma.ts`
(`buildClassMagmaEdges`) wiring the class AST (root pseudo-group + namespaces, touched =
relationship endpoints) into `buildMagmaEdges`. Verified computeBranch(6)=3 → tepazu's
exact 2×3 grid of 5 invisible edges.

**Gate:** class **277→322 (+45!)**, ZERO regressed. component/usecase unchanged.
Force-routed, 3 of 4 Tier-2 fixtures are now EQUAL (lilura/tepazu/xidura); niduni still
needs `--(` lollipop + rankdir. npm test 3636 pass, typecheck green, lint clean, build ok.

The +45 are already-routed class diagrams with ≥3 disconnected leaves that were missing
the invisible-edge packing entirely — a large general win from one shared feature. The
Tier-2 fixtures themselves land once routed to class (Δ4 + reorder, next).

### T2.5 — Tier-2 routing via scoped Δ4 (NO registry reorder needed) — LANDED (+3)

Key realization vs the Batch-1 detour: the ambiguous steals (xutiri/lagexo/ruxiga) are
PURE `entity`-as-sequence-participant blocks with NO class keyword; the Tier-2 fixtures all
carry a class-forcing keyword (`class`/`interface`/`enum`/`annotation`/`abstract`). So the
scoped Δ4 — exclude entity/circle declarations from the *decline* signal but do NOT add
them to the *accept* signal — routes the Tier-2 fixtures (they match CLASS_ACCEPTS via
their class keyword) without stealing the pure-entity sequence diagrams (no accept signal).
**This avoids the registry reorder + sequence guards entirely.**

Implementation: `ENTITY_CIRCLE_DECL_RE = /^(?:entity|circle)\s+\S/i`, added to the
declLines filter in `class-dispatch.ts` (alongside Δ3 member-line exclusion).

**Gate:** class **322→325 (+3)** — GAINED lilura/tepazu/xidura. ZERO regressed.
component/usecase unchanged. Steal check: activity+0, state+0, sequence+1 = pobato-42
(a mis-bucketed CLASS diagram — `entity … o--> … : authorized`, has a class aggregation
relationship; routing it to class is CORRECT per upstream Sequence→Class order, and it has
no oracle so does not affect the measured gate). niduni routes to class but is not yet
EQUAL (needs `--(` lollipop + rankdir). npm test 3641 pass, typecheck/lint/build green.

T1a (registry reorder) is now NOT needed for Tier 2 — superseded by the scoped Δ4. Keep it
in reserve only if a future tier's un-gating reintroduces genuine steals.

### T2.6 — niduni: rankdir + `--(` lollipop — LANDED (+3), TIER 2 COMPLETE

- **rankdir**: `left to right direction` → `ast.rankdir='LR'` (new AST field + two parser
  direction directives), consumed in `buildDotGraph` (`rankDir: ast.rankdir==='LR'?'LR':'TB'`).
  Mirrors upstream CommandRankDir + the description engine's existing handling.
- **`--(` / `)--` lollipop links** (CommandLinkLollipop): added to REL_ARROW + ARROW_INFO
  (`-(`→association, `)-`→association-swap, dotted variants→usage). Structurally an
  arrowhead-none edge to the interface/circle; the socket glyph is a rendering detail.

**Gate:** class **325→328 (+3)** — GAINED niduni-65 (Tier 2 complete!) + gojofu-46 +
paroxa-83 (bonus, general rankdir/lollipop). ZERO regressed. component/usecase unchanged.
npm test 3644 pass, typecheck/lint/build green.

**Tier 2 fully landed:** lilura, tepazu, xidura, niduni all EQUAL.

### T3a — givofi/popesa: database leaf + allow_mixing routing — LANDED (+2)

- **database leaf → rect**: new `ClassifierKind: 'descriptive'` + `Classifier.usymbol`
  (keeps the keyword; DOT shape is rect). Declaration parser recognises `database X` as
  a descriptive leaf; a SEPARATE parser command placed AFTER the member rule (so
  `Person : field`, a member of a class named after a keyword, is not mis-parsed) — and
  scoped to `database` only, since broadening to `file`/`node`/… collides with `{{…}}`
  creole bodies (moxobo-16/zikabo-17 are pinned 0-graph fixtures those keywords would
  break) and class members. Refactored parseClassifierDecl into extractBody /
  extractDecorations / parseIdDisplay / resolveDeclKind + applyClassifierDecl to stay
  under the complexity caps.
- **allow_mixing no-op** parser command (upstream CommandAllowMixing flips a flag; we
  render descriptive elements unconditionally).
- **Routing**: NOT Δ1 (allow_mixing→class) — that route-before-renders cacoma (usecase,
  Tier 4). Instead a `database` decline-exclusion GATED on allow_mixing: givofi/popesa
  (allowmixing + class + database) route via their class keyword; `class C`+`database X`
  without allowmixing stays description (upstream errors on it); cacoma stays description
  until Tier 4.

**Gate:** class **328→330 (+2)** — givofi, popesa. ZERO regressed (namespace fixtures,
cacoma, moxobo/zikabo ratchet all intact). component/usecase unchanged. Steal check:
sequence +1 = pobato-42 (mis-bucketed class, correct). npm test 3647 pass, typecheck/
lint/build green.

### T3b — descriptive containers (lojiga/xenere) — LANDED (+2); rakuci deferred (nesting)

- **Descriptive-container command** (`rectangle "Y" as Z [[url]] {`, `stack a {`,
  `component b {`): routes through `openNamespaceBlock` (moved to new `class-container.ts`
  with the empty-leaf helper, to keep parser.ts under the 500-line cap). Non-empty →
  cluster; alias + `[[url]]` parsed.
- **Empty descriptive container → rect leaf** (`closeContainer`): on `}` close, an empty
  descriptive container drops its member-less namespace and becomes a `descriptive`
  rect classifier — upstream renders an empty descriptive-element box as a rect, whereas
  an empty `package` vanishes. (component b in lojiga.)
- **Δ4b routing**: container-opening lines (`descKw … {`) excluded from the decline signal
  (native class containers, CommandPackageWithUSymbol) — lojiga/xenere route to class via
  their inner `class`; a pure descriptive container tree (no class) stays description.

**Gate:** class **330→332 (+2)** — lojiga (stack cluster + point anchor + empty component
leaf), xenere (package/rectangle clusters). ZERO regressed. component/usecase unchanged.
Steal check: sequence +1 = pobato-42 (mis-bucketed class, unchanged). npm test 3651 pass,
typecheck/lint/build green.

**rakuci-96 DEFERRED:** it is NESTED (empty `rectangle` + non-empty `rectangle` inside a
`package`). The class parser's `activeNamespace` is FLAT (single value, no stack), so a
`}` closing the inner container does not restore the enclosing one — the inner sibling
opens at root, clustering is wrong, and magma then chains the mis-clustered nodes (4
nodes/3 edges vs oracle 3/0). Fixing it needs a namespace STACK in the parser (touching
the shared namespace/package `}` handling) — a distinct, riskier change best done on its
own. lojiga/xenere (non-nested) land now; rakuci waits for the stack.

### T3c — rakuci: namespace stack + URL/alias parsing — LANDED (+8), TIER 3 COMPLETE

Root cause (rakuci was DIFF: 4 nodes/3 edges vs 3/0):
1. **Flat activeNamespace** couldn't restore the enclosing container on `}` (nested
   `package{rectangle{class}}`).
2. **package command** didn't match `package "XY" as XXY [[url]] {` (the `as`/`[[url]]`
   broke its pattern) → XXY never opened.
3. **class declaration** didn't strip `[[url]]` → `class "AB" as AAB [[url]]` mis-parsed →
   the inner rectangle ended up empty → spurious extra leaf + magma edges.

Fixes:
- `ParseState.namespaceStack` + `openNamespaceBlock` pushes the enclosing container and
  qualifies a bare nested id under it (`XXY.YYY`), reusing the dotted-namespace machinery
  for parentIds; `}` pops the stack to restore the parent. Returns the effective id.
- package command pattern handles `as alias` + `[[url]]`.
- `extractDecorations` strips `[[url]]` off class declarations.

**Gate:** class **332→340 (+8)** — rakuci-96 + 7 bonus (bejusa/dasagu/dopuzi/jinoba/
laluve/vafaka/vofuvu — other nested-container / URL-link fixtures). ZERO regressed.
component/usecase unchanged. Existing namespace fixtures (dudimi/duvuti/pareli/xodopa)
still EQUAL. npm test 3656 pass, typecheck/lint/build green.

**TIER 3 COMPLETE:** givofi, popesa, lojiga, xenere, rakuci all EQUAL.

## Tier 4 — special shapes (branch feature/a3-tier4)

### T4a — `()` interface lollipop + crow's-foot links — LANDED (+6)
- **`() "name"`** (CommandCreateElementParenthesis): new parser command creates a
  classifier with kind `circle` → svek `plaintext` (the interface lollipop circle). Makes
  conija-14 render EQUAL (plaintext=1 rect=2) when routed.
- **Crow's-foot (ER cardinality) links** (`|o--o|`, `||--||`, `}o--o{`, `}|--|{`, `}--`):
  added a crow's-foot alternative to REL_ARROW (a run of `|o}{` with a `|`/`}`/`{` around
  the body) + a resolveArrow fallback (any unknown arrow with `|}{` → association). The
  endpoints auto-create; all render rect.

**Gate:** class **340→346 (+6)** — xosiza-60 (11 rect, 5 crow's-foot edges) + 5 bonus
(dofima/gekope/jireze/lozego/medosa — other `()`/crow's-foot fixtures). ZERO regressed.
component/usecase unchanged. npm test 3659 pass, typecheck/lint/build green.

conija renders EQUAL but does not yet ROUTE to class (its `()` shorthand trips the
decline); it lands with the allow_mixing routing added after cacoma's usecase→ellipse.

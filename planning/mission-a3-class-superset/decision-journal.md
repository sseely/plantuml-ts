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

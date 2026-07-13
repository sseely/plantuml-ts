# Mission G0b — title / caption / header / footer / legend (diagram annotations)

**Objective.** Port upstream's diagram-annotation ("chrome") mechanism so every
engine renders `title`, `caption`, `header`, `footer`, and `legend` (and parses
`mainframe`) faithfully to the jar. Today these directives are parsed-and-ignored
by every engine (three engines have bespoke, non-faithful title bands). Upstream
draws them in ONE place — `DiagramChromeFactory` (the refactor of the old
`AnnotatedBuilder`/`AnnotatedWorker`), applied via `TitledDiagram.addChrome`
after layout, for every diagram type. We mirror that structure.

**Exit bar** (mission-index Phase G / G0b): a titled diagram renders its
title/header/footer/legend/caption; the ~118 gating fixtures carrying these
directives become SVG-eligible; `buveco-86-tibo673` renders its title.
DOT gate stays at baseline **with unchanged denominators**.

- Branch: `feat/g0b-annotations` (from main @ `1445bd9`)
- Merge: **merge commit** (mission-brief branch; do not squash)

## Baseline (verified 2026-07-13, main @ 1445bd9)

```
npm test        7,643 passing (276 files), coverage 98.2 / 94.42 / 98.33
typecheck/lint  clean          npm run build   ok
DOT gate        component 251/259 · usecase 81/87 · class 680/680 · object 78/80 · state 260/261
```

## Quality Gates (run after every batch)

```
- command: npm test
  pass: exit 0, coverage ≥ 90/90/90
  on_fail: fix_and_rerun
- command: npm run typecheck
  pass: exit 0
  on_fail: fix_and_rerun
- command: npm run lint
  pass: exit 0
  on_fail: fix_and_rerun
- command: npm run build
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx tsx scripts/dot-sync-report.ts component usecase class object state
  pass: EXACTLY 251/259, 81/87, 680/680, 78/80, 260/261 (numerator AND denominator)
  on_fail: stop
- command: git diff --name-only <batch-start>..HEAD
  pass: only files in the batch's declared write-sets
  on_fail: stop
```

## Batches

| Batch | Tasks | Status |
|---|---|---|
| [batch-1](batch-1/overview.md) — foundations (parallel) | T1 model+commands, T2 style, T3 render-fragment contract | [x] |
| [batch-2](batch-2/overview.md) — chrome core + parser wiring (parallel) | T4 chrome core, T5 parsers A, T6 parsers B | [x] |
| [batch-3](batch-3/overview.md) — pipeline integration | T7 integration + buveco-86 | [x] |
| [batch-4](batch-4/overview.md) — migrations (parallel) | T8 json/dot/chart migration, T9 mainframe | [x] |
| [batch-5](batch-5/overview.md) — verification + close-out | T10 gates, census, index flip | [x] |

## Key documents

- [decisions.md](decisions.md) — the ten locked architecture decisions (D1–D10)
- [diagrams/component-map.md](diagrams/component-map.md) — what touches what
- [diagrams/data-flow.md](diagrams/data-flow.md) — pipeline before/after
- [decision-journal.md](decision-journal.md) — append every non-trivial call

## Constraints

**Stop conditions (STOP and wait for human):**
- DOT gate numerator OR denominator moves and the cause isn't immediately
  attributable + reverted (Trap 3: erroring fixtures leave both sides).
- A task needs writes outside its declared write-set that no other task owns.
- Two consecutive quality-gate failures on the same check; or the same code
  location changed 3× for the same failing check.
- The klimt fragment/raw-svg mechanism (T4/T7) turns out to require rewriting
  `svg-graphics-core.ts` emission for existing output — journal options, stop.
- Any change to `svek-dot-emit.ts`, `graph-layout*.ts`, or any `layout*` DOT
  path — chrome is post-layout by construction; needing those files means the
  design is wrong.

**Push-forward (decide + journal):**
- Style-default details verified against `plantuml.skin` / jar output.
- Test-file placement, naming, mechanical test updates after the fragment
  contract change.
- Small klimt additions (a raw-svg shape/driver, TextBlockBordered port) —
  faithful to upstream names.

**Standing project rules that bite here:**
- Grep upstream at `~/git/plantuml/src/main/java/net/` — NOT just
  `net/sourceforge/plantuml/`.
- No Node built-ins / `Date.now()` / `Math.random()` in `src/`.
- Do not refactor while porting; preserve upstream names (`DisplayPositioned`,
  `DiagramChromeFactory`, `DecorateEntityImage`, `EntityImageLegend`).
- Chrome text is measured through the injected `StringMeasurer` — never
  creole's 0.6-ratio heuristic (D4).
- Verify agent claims: run the gates yourself; LSP diagnostics are stale after
  agent runs — `npm run typecheck` is the truth.

## Oracle verification

```sh
java -jar oracle/dist/plantuml-oracle.jar -tsvg -pipe < x.puml   # ground truth
npx tsx scripts/svg-conformance-census.ts                        # description SVG metric
```

Jar SVG cache: `test-results/dot-cache/<type>/<slug>/in.svg` (class 718,
component 265, state 265, usecase 90, object 80). `buveco-86-tibo673`:
`tests/corpus/sequence/buveco-86-tibo673.puml` (a TIM-conditional fixture whose
preprocessed content is ONLY `title Test SVG`; jar renders a default CLASS
diagram with that title).

## Out of scope (do not expand)

- `newpage`/multi-page (F5), the warnings banner (`addWarnings` — no warnings
  model exists yet), per-type SVG conformance ≥90% (G1–G4), `LimitFinder`
  document-dimension port (G0), side-placed legends (upstream has none —
  legends are top/bottom bands only).

## Mission summary (T10, 2026-07-13)

- **Tasks: 10 planned, 10 closed** (T9 via its D9 escape hatch — mainframe
  parsed, drawing deferred to G0's LimitFinder port, DIVERGENCES TEMPORARY).
- **Final gates:** 7,837/7,837 tests (294 files; +194 vs baseline), coverage
  98.27 / 94.53 / 98.39, typecheck/lint/build clean.
- **DOT gate:** EXACT — component 251/259, usecase 81/87, class 680/680,
  object 78/80, state 260/261 (numerators AND denominators unmoved).
- **Census:** conformant 6 (unchanged); 7 errors pre-date the mission
  (verified at pre-T7 HEAD via isolated worktree). Distribution moved as
  titled description fixtures gained chrome.
- **Exit bar:** buveco-86-tibo673 renders "Test SVG" as a class diagram;
  spot-rendered annotated corpus fixtures across all six types, zero errors;
  corpus reach: 376 fixtures across the gating types carry annotation
  directives.
- **Decisions:** 23 journal rows; flagged for maintainer skim: decisions.md
  auto-approval, D10 correction (dot), hcl title divergence, batch-1
  worktree-sharing incident (fixed by prompt rule from batch 2 on).
- **Follow-ups:** mainframe drawing (G0), klimt root-attr passthrough for
  annotated description output (G1), board/json Math.random id salts
  (pre-existing rule violation — cleanup PR), multiline-body blank-line
  fidelity (BlocLines semantics, G1+).

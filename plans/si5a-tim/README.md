# SI5a — preprocessor / TIM completion

**Branch:** `feat/si5a-tim` · **Index row:** `planning/mission-index.md` SI5a
**Source of scope:** `planning/s4-stdlib-audit.md` Finding 3

## Objective

Port the remainder of upstream's TIM subsystem
(`~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/`, **13.4k LOC**)
into `src/core/tim/`. Today we have a partial port: `FunctionsSet`,
`EaterDeclareProcedure`, `EaterFunctionCall` (call-site matching only),
`TContext.expandProcedureCalls`, `expression.ts` (a stub), `legacy-define.ts`,
and **2 of upstream's 76 builtins**. `preprocessor.ts` owns `!define` /
`!definelong` / `!ifdef` / `!ifndef` / `!else` / `!endif` / `!undefine` /
`!theme` / skinparam+style blocks as a **flat line-loop**.

~200 corpus fixtures use directives we don't support (`!define` 123,
`!procedure` 50, `!unquoted` 48, `!function` 46, `!definelong` 42,
`!startsub` 7). This mission also **feeds the DOT-100% gate**: it retires the
A1-ledgered TIM-json family and (with SI5b) the stdlib family.

## Architecture decisions (locked)

1. **Rewrite `preprocessor.ts` into a faithful `TContext` + `CodeIterator`
   chain.** Upstream expresses nested `!if` / `!foreach` / `!while` /
   `!procedure` as a **decorator chain of pull-based `CodeIterator`s** over an
   execution-context stack (`iterator/`: If, Foreach, While, Procedure,
   ReturnFunction, Sub, Affectation, LegacyDefine, comments — wrapping
   `CodeIteratorImpl`). Our flat line-loop **structurally cannot** express
   nested loops. Per CLAUDE.md ("upstream architecture is authoritative … it's
   explicitly OK to rewrite from scratch to mirror upstream"), this is a
   sanctioned rewrite, not a refactor-while-porting violation. `preprocess()`
   becomes a thin wrapper; its public signature and `PreprocessorResult` shape
   are preserved so callers (`src/index.ts`) are untouched.

2. **Port all 76 builtins.** The long tail IS the deliverable; an enumerated
   upstream list is not "ambiguous scope" to be trimmed. File-touching builtins
   (`FileExists`, `Filedate`, `Dirpath`, `Getenv`, `GetStdlib`, `GetAllStdlib`)
   resolve through the injected seam or return safe defaults — **never real
   I/O** (browser-safe; see Constraints).

3. **Sync TIM + `IncludeStore`.** The TIM interpreter stays **synchronous**
   (`renderSync` is public API and the browser story; CLAUDE.md forbids async in
   rendering paths). Includes resolve during execution from a sync
   `IncludeStore` (a pre-populated map). `render()` keeps an async prefetch pass
   that walks includes transitively and populates the store; a cache miss throws
   a typed error naming the unresolved path. This fixes today's structural
   divergence — `resolveIncludes` currently runs as a pre-pass **before**
   conditionals, so an `!include` inside a false `!ifdef` is fetched anyway, and
   `!includesub` / var-built include paths are inexpressible. Over-fetching
   (prefetching a file inside a false branch) is the one accepted divergence;
   document it.

4. **Seam only — vendor nothing.** `!include <bundle/thing>` becomes
   *resolvable* (replacing today's silent skip at `include-resolver.ts:205`
   with a typed error), but **no stdlib asset is vendored**. That is SI5b,
   blocked on a maintainer licensing ruling.

## Constraints

- **Browser-safe `src/`:** no `fs`/`path`/`os`/`child_process`, no
  `process.env`, no `require()`, no blocking I/O, no `Date.now()` /
  `Math.random()`. `Now`/`DateFunction`/`RandomFunction` builtins take their
  non-determinism from an injected seam.
- **Preserve upstream names** verbatim — `TContext`, `TMemory`, `Eater*`,
  `CodeIterator*`, `TValue`, `ShuntingYard`. Do not rename for idiom.
- **Do not refactor while porting** (this is distinct from decision 1, which
  re-mirrors upstream's *own* structure). Port awkward branches as-is.
- Every ported symbol carries a JSDoc `@see` to its Java origin.

## Quality gates

```
npm test         # vitest + coverage (90/90/90)  — pass: exit 0
npm run typecheck                                 — pass: exit 0
npm run lint                                      — pass: exit 0
npm run build                                     — pass: exit 0
npx tsx scripts/dot-sync-report.ts component usecase class object state
                 # pass: NO structural regressions vs 1517ac2 baseline
```

Baseline to not regress: component 251/259, usecase 79/87, class 680/680,
object 78/80, state 260/261. 6,550 tests green.

## Exit bar

- `!function` declare+return, `!foreach`/`!while`, `!$var` + scoping,
  `!startsub`/`!includesub`, `!elseif`, and all 76 builtins resolve.
- ~~silito-78 root-caused~~ — **STRUCK 2026-07-12: already fixed on `main` in
  `8898572`, before this mission opened.** The brief inherited a stale "OPEN"
  line from the A1 decision journal. Re-verified from a clean tree: our DOT
  emits 2 edges, matching the oracle. Mechanism (independently re-derived, see
  `.agent-notes/silito-78-definelong.md`): `-[single]->` is not a render style
  but an **add-time dedup flag** — upstream's `CucaDiagram.addLink` drops a
  `single` link when the diagram already connects those two entities.
  `!definelong` was a red herring; it merely produced 3 identical links. Both
  our preprocessor and the jar expand the macro 3×, so **no TIM change was
  needed** and none is in scope here.
  - The prior investigation's blocking claim — "`isSingle` is dead code
    upstream, per a full-tree grep" — was **false**. `CucaDiagram` lives in
    `net.atmp`, outside the `net/sourceforge/plantuml/` tree greps get scoped
    to. CLAUDE.md now warns about this.
  - **Residual, tracked separately (feeds SI1):** upstream's dedup lives in
    `CucaDiagram.addLink`, the shared base that class/state/object/description
    all inherit. Our fix is scoped to the **description parser only**
    (`grep -rn "'single'" src/diagrams/` matches nothing outside
    `description/`). A `-[single]->` link in a **class** or **state** diagram
    still will not dedup. Un-triggered by the corpus today, so not a live
    defect — but it is the same root cause at a second call site, and it is
    exactly the class of divergence SI1 (shared cucadiagram base) exists to
    stop.
- TIM-json ledger entry (zoriso-46, sidame) **retired** — done, both verified
  EQUAL against the DOT oracle 2026-07-13.
- All quality gates green; no DOT structural regressions. — done.

## Batches

| # | Focus | Depends on | Done |
|---|---|---|---|
| [1](batch-1/overview.md) | `expression/` + memory/scoping core | — | [x] |
| [2](batch-2/overview.md) | `iterator/` chain + `Eater*` | 1 | [x] |
| [3](batch-3/overview.md) | `builtin/` — all 76 | 1 | [x] |
| [4](batch-4/overview.md) | `TContext` + `preprocessor.ts` rewrite | 2, 3 | [x] |
| [5](batch-5/overview.md) | include seam, silito-78, ledger, gates | 4 | [x] |

Batches 2 and 3 run in parallel (disjoint write-sets).

## Outcome (batch 5 close-out, 2026-07-13)

**Exit bar: met.**

- **Include seam built** (decision 3, decision 4). `!include` / `!includesub` /
  `!includedef` / `!import` now resolve **inside the interpreter**, where
  upstream resolves them — reading from a synchronous `IncludeStore`
  (`src/core/tim/IncludeStore.ts`, `IncludeExecutor.ts`). `render()` prefetches
  the store asynchronously (`include-resolver.ts#prefetchIncludes`); `renderSync`
  takes one from the caller (`RenderOptions.includeStore`) and, given none,
  behaves exactly as before (error SVG telling the caller to use `render()`).
  `resolveIncludes` — the textual pre-pass that ran *before* conditionals — is
  gone. Its structural bugs go with it: an `!include` in a false `!ifdef` is no
  longer executed, a variable-built include path resolves, `!includesub` works.
  Ported alongside: `Sub#fromFile` (as `fromLines`), `DiagramExtractor` +
  `StartUtils` (an included `@startuml` file contributes only its block's lines;
  the `!suffix` picks which block), `ReadLineReader#readLines`.
- **Angle-bracket stdlib is a typed error, not a silent skip.** `!include
  <bundle/thing>` is *resolvable through the seam* (a host may supply the bundle
  via `options.includeStore`); with nothing supplied it throws
  `StdlibNotBundledError` naming the bundle. **Nothing vendored** — SI5b owns
  that, blocked on the licensing ruling.
- **TIM-json ledger entry retired.** `zoriso-46-vata931` and `sidame-35-cozu078`
  both verified structurally EQUAL against the DOT oracle
  (`dot-sync-report --slug`). They are the +2 that took usecase 79 → 81 at the
  batch-4 cutover. Entry struck in
  `plans/dot-oracle-sync/phase-2-description/ledger.md`.
- **silito-78** — struck before this batch opened (see the exit-bar note above);
  no TIM change was needed or made.
- **Quality gates** (all green): `npm test` **7586 passed / 273 files**
  (baseline 7500 — no test lost, 86 added), coverage 98.15/94.38/98.32;
  `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- **DOT parity — no regression, on every type** (identical to the batch-4
  baseline; the report is byte-for-byte the same):

  | type | baseline | after batch 5 |
  |---|---|---|
  | component | 251/259 | **251/259** |
  | usecase | 81/87 | **81/87** |
  | class | 680/680 | **680/680** |
  | object | 78/80 | **78/80** |
  | state | 260/261 | **260/261** |

  The 6 remaining stdlib-blocked fixtures (5 usecase, 1 component) still fail:
  every one is an angle-bracket `!include` of a real bundle (`awslib`,
  `tupadr3`, `bootstrap`, `cloudogu`), and the seam cannot invent content the
  project does not vendor. They now fail *loudly and by name* instead of
  silently rendering wrong. They unblock the moment SI5b ships the assets — no
  further code change.
- **New divergences recorded** in `DIVERGENCES.md` (`## Preprocessor (TIM)`):
  the sync-store seam and its **over-fetch** (the prefetch is a text scan and
  cannot evaluate an `!ifdef`, so it fetches targets in dead branches too — the
  interpreter still executes only the live one); the angle-bracket typed error;
  `!includedef` reading the store and `!import` registering a lookup prefix.

## Links

- [decisions.md](decisions.md) · [decision-journal.md](decision-journal.md)
- Upstream: `~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/`
- Audit: `planning/s4-stdlib-audit.md`

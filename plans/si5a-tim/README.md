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
- **silito-78 root-caused** (`!definelong` emits 3 identical links vs oracle's
  1) — fixed, or ledgered with a *stated mechanism*. Not papered over.
  Prior work ruled out single-keyword dedup and node-dedup, and confirmed
  `WithLinkType.isSingle` is dead code upstream.
- TIM-json ledger entry (zoriso-46, sidame) **retired**.
- All quality gates green; no DOT structural regressions.

## Batches

| # | Focus | Depends on | Done |
|---|---|---|---|
| [1](batch-1/overview.md) | `expression/` + memory/scoping core | — | [ ] |
| [2](batch-2/overview.md) | `iterator/` chain + `Eater*` | 1 | [ ] |
| [3](batch-3/overview.md) | `builtin/` — all 76 | 1 | [ ] |
| [4](batch-4/overview.md) | `TContext` + `preprocessor.ts` rewrite | 2, 3 | [ ] |
| [5](batch-5/overview.md) | include seam, silito-78, ledger, gates | 4 | [ ] |

Batches 2 and 3 run in parallel (disjoint write-sets).

## Links

- [decisions.md](decisions.md) · [decision-journal.md](decision-journal.md)
- Upstream: `~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/`
- Audit: `planning/s4-stdlib-audit.md`

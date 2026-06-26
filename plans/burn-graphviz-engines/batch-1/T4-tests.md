# T4 — Test fallout: delete engine tests, skip dark-type tests, keep parsers

## Context
T3 deleted the engines, so their tests now reference missing code, and the 6
graph diagram types throw at layout/render. Resolve per the **import-based**
rule (`decisions.md#d5`) so `npm test` is green.

## Task — classify every affected test by what it imports
1. **Delete** any test that imports `src/core/<engine>` internals. This includes
   all of `tests/unit/{circo,fdp,neato,osage,pack,patchwork,pathplan,sfdp,twopi,label}/`,
   the engine-algorithm tests in `tests/unit/dot/` (acyclic, aspect, class1,
   class2, compound, conc, decomp, fastgr, flat, mincross, position, rank,
   sameport, splines, tailport, and any other importing `src/core/dot/*`), and
   `tests/unit/auto-layout.test.ts`. Confirm each by grep before deleting.
2. **Skip** (`describe.skip`, with comment
   `// pending graphviz-ts adapter — see plans/burn-graphviz-engines/handoff-adapter.md`)
   every test that exercises a dark type's **layout, renderer, or full pipeline**:
   `tests/unit/{class,component,state,usecase,dot,json}/{layout,renderer}.test.ts`,
   `tests/unit/json/plugin.test.ts`, `tests/unit/dot/index.test.ts` &
   `cluster.test.ts` (if they drive layout), and
   `tests/integration/{class,component,state,usecase,json-corpus,json-style,json-e2e}.test.ts`.
3. **Keep** untouched any test importing only a diagram's parser
   (`tests/unit/<type>/parser.test.ts`) — parsing is unaffected.
4. **Do not touch** keeper-renderer tests (sequence, packetdiag, yaml, hcl,
   files, chronology). `tests/unit/yaml/highlight-styleclass.test.ts` is a YAML
   test, not a class test — leave it.

Record the exact list of **skipped** files (with their `describe` names) — T6
needs it as the adapter restore-list.

## Write-set
- `tests/unit/**`, `tests/integration/**` (deletions + skips per above)

## Read-set
- `decisions.md#d5`
- grep each candidate's imports before classifying

## Acceptance criteria
- Given `npm test`, when run, then exit 0 with zero failures.
- Given the suite, when summarized, then engine tests are gone, dark-type
  layout/render/integration tests are skipped (not failing), parser tests run.
- Given any kept parser test, when run, then it still passes.
- Given the skip list, when T4 ends, then it is recorded for T6.

## Observability
N/A.

## Rollback
Reversible — `git checkout` restores deleted/edited tests.

## Quality bar
`npm test` green. Commit: `test(layout): drop engine tests, skip dark-type tests
pending graphviz-ts`.

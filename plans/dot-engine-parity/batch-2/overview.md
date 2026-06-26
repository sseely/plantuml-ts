# Batch 2 — Independent Fixes

Six tasks that don't depend on each other or on the dot engine
changes. All six run in parallel after Batch 1 completes.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T6 | acyclic.ts fix per T5 findings | typescript-pro | acyclic.ts, acyclic.test.ts | T5 | [ ] |
| T7 | Per-glyph font width tables | typescript-pro | measurer.ts, measurer.test.ts | — | [ ] |
| T8 | Creole table syntax | typescript-pro | creole.ts, creole.test.ts | — | [ ] |
| T9 | class hide/show directives | typescript-pro | class/{parser,ast,layout,renderer}.ts + tests | — | [ ] |
| T10 | State history pseudostates | typescript-pro | state/{ast,parser,renderer}.ts + tests | — | [ ] |
| T11 | Sequence box/end box | typescript-pro | sequence/{ast,parser,layout,renderer}.ts + tests | — | [ ] |

No write-set conflicts. All six can be launched simultaneously.
T6 requires reading T5's findings report before starting.

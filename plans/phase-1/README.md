# Mission: Phase 1 — Foundation + Sequence Diagrams

## Objective

Build the complete Phase 1 of plantuml-js: a TypeScript-native PlantUML
renderer that turns PlantUML source text into an SVG string in the browser.
Phase 1 ships a working `render()` / `renderSync()` public API supporting
sequence diagrams in full, plus a live demo app and integration test suite.

No existing source code. Every file is a create.

## Branch

`main` (greenfield — no prior commits)

## Stop Conditions

Stop and wait for human input when:
- A task requires files outside its declared write-set and no other task owns them
- Two consecutive quality gate failures on the same check after fix attempts
- A TypeScript strict-mode error cannot be resolved without changing a shared interface
- A dependency's API differs materially from what the task spec assumes

## Push-Forward Conditions

Proceed with judgment when:
- A style choice within a file is purely cosmetic
- A type can be narrowed without affecting any other task's interface contract
- A fixture `.puml` file needs a minor syntax tweak to match real PlantUML
- A dependency needs a patch version bump to resolve a type error

## Quality Gates

Run between every batch. All must pass before starting the next batch.

```
pnpm typecheck          # tsc --noEmit — zero errors
pnpm lint               # eslint — zero errors
pnpm test               # vitest run --coverage
                        # line ≥ 90%, branch ≥ 90%, function ≥ 90%
```

## Batch Status

| Batch | Tasks | Depends On | Done |
|-------|-------|-----------|------|
| 1 | T1: Project bootstrap | — | [x] |
| 2 | T2: Preprocessor · T3: Block extractor + dispatcher · T4: SVG primitives · T5: Creole · T6: Theme + measurer | Batch 1 | [x] |
| 3 | T7: Sequence AST + parser | T2, T3 (Batch 2) | [ ] |
| 4 | T8: Sequence layout | T6 (Batch 2) + T7 (Batch 3) | [ ] |
| 5 | T9: Sequence renderer | T4, T5 (Batch 2) + T7 (Batch 3) + T8 (Batch 4) | [ ] |
| 6 | T10: Public API + integration tests · T11: Demo app | Batch 5 | [ ] |

## Links

- [decisions.md](decisions.md) — six confirmed architecture decisions
- [diagrams/data-flow.md](diagrams/data-flow.md) — render pipeline sequence diagram
- [diagrams/component-map.md](diagrams/component-map.md) — component dependency graph
- [batch-1/overview.md](batch-1/overview.md)
- [batch-2/overview.md](batch-2/overview.md)
- [batch-3/overview.md](batch-3/overview.md)
- [batch-4/overview.md](batch-4/overview.md)
- [batch-5/overview.md](batch-5/overview.md)
- [batch-6/overview.md](batch-6/overview.md)
- [decision-journal.md](decision-journal.md)

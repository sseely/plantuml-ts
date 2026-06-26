# Mission: Phase 2 — Graph Diagrams (Class, Component, State, Use Case)

## Objective

Extend plantuml-js with four graph diagram types — class, component, state,
and use case — all routed through ELK.js for automatic graph layout. Phase 1
(sequence diagrams, public API, demo app) is complete and must not regress.
The `DiagramPlugin` interface is extended to a `SyncPlugin | AsyncPlugin`
union so ELK-backed plugins can be async without polluting the sync interface.

## Branch

`main`

## Stop Conditions

Stop and wait for human input when:
- A task requires files outside its declared write-set and no other task owns them
- Two consecutive quality gate failures on the same check after fix attempts
- A TypeScript strict-mode error cannot be resolved without changing a shared interface
- ELK.js API differs materially from what a task spec assumes (version mismatch, missing option)
- ELK layout produces overlapping nodes for any fixture after 2 fix attempts
- The `SyncPlugin | AsyncPlugin` union requires a breaking change to Phase 1 sequence plugin

## Push-Forward Conditions

Proceed with judgment when:
- A style choice within a file is purely cosmetic
- A fixture `.puml` file needs a minor syntax tweak to match real PlantUML
- A dependency needs a patch version bump to resolve a type error
- ELK spacing options need minor numeric tuning to improve visual output
- A new SVG primitive needs a trivial attribute addition not in the spec


## Standing Rule: Java Source Is the Spec

Before implementing any task in this mission, read the relevant Java source in
`~/git/plantuml`. The upstream code is 15+ years old and encodes accumulated
knowledge as special cases and subtle tweaks that are not documented anywhere
else. The Java code IS the requirement — not a reference. Reproduce every edge
case faithfully.

## Quality Gates

Run between every batch. All must pass before starting the next batch.

```
pnpm typecheck          # tsc --noEmit — zero errors
pnpm lint               # eslint — zero errors
pnpm test               # vitest run --coverage
                        # line ≥ 90%, branch ≥ 90%, function ≥ 90%
pnpm test:e2e           # playwright test — all pass
```

## Batch Status

| Batch | Tasks | Depends On | Done |
|-------|-------|-----------|------|
| 1 | T1: Plugin interface · T2: ELK adapter · T3: SVG + theme | — | [x] |
| 2 | T4: Class parser · T5: Component parser · T6: State parser · T7: Use case parser | Batch 1 | [x] |
| 3 | T8: Class layout · T9: Component layout · T10: State layout · T11: Use case layout | Batch 2 | [x] |
| 4 | T12: Class renderer · T13: Component renderer · T14: State renderer · T15: Use case renderer | Batch 3 | [x] |
| 5 | T16: Public API + integration tests · T17: Demo app | Batch 4 | [x] |
| 6 | T18: Playwright e2e tests | Batch 5 | [x] |

## Links

- [decisions.md](decisions.md) — five confirmed architecture decisions
- [diagrams/data-flow.md](diagrams/data-flow.md) — render pipeline for async plugins
- [diagrams/component-map.md](diagrams/component-map.md) — component dependency graph
- [batch-1/overview.md](batch-1/overview.md)
- [batch-2/overview.md](batch-2/overview.md)
- [batch-3/overview.md](batch-3/overview.md)
- [batch-4/overview.md](batch-4/overview.md)
- [batch-5/overview.md](batch-5/overview.md)
- [batch-6/overview.md](batch-6/overview.md)
- [decision-journal.md](decision-journal.md)

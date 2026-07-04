# Graphviz dot Layout Engine — Port to TypeScript

## Objective

Port the Graphviz `dot` layout algorithm from Smetana (PlantUML's
auto-generated Java translation of Graphviz 2.38.0 C source) into a
clean TypeScript implementation. The result replaces ELK.js as the
layout engine for graph diagram types (class, component, state, use
case) in plantuml-js.

**Why:** ELK produces layouts that differ visibly from PlantUML's output.
PlantUML uses Graphviz dot internally. A faithful dot port gives
pixel-comparable results, eliminates the ELK WASM dependency, and runs
synchronously (enabling `renderSync()` for graph diagrams).

## Reference Source

Smetana lives in `~/git/plantuml/src/smetana/` (Java).

Key algorithm files:
| File | Algorithm stage | Lines |
|------|----------------|-------|
| `smetana/core/dot15/acyclic__c.java` | Acyclic (edge reversal) | 146 |
| `smetana/core/dot15/rank__c.java` | Network simplex ranking | 785 |
| `smetana/core/dot15/mincross__c.java` | Crossing minimization | 2,003 |
| `smetana/core/dot15/position__c.java` | Brandes-Köpf coord assign | 1,954 |
| `smetana/core/dot15/dotsplines__c.java` | Spline edge routing | 2,391 |

**Total:** 7,279 Java lines → ~4,500 TypeScript lines (estimated).

The `smetana/core/` C-runtime emulation layer (3,807 lines) is NOT
ported — we use native TypeScript data structures instead.

## Architecture Decisions

See [decisions.md](decisions.md) for all pre-made decisions.

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| [ ] 1 | Data structures + acyclic + network simplex ranking | not started |
| [ ] 2 | Crossing minimization + Brandes-Köpf coordinate assignment | not started |
| [ ] 3 | Bezier spline edge routing | not started |
| [ ] 4 | Integration with plantuml-js plugin system | not started |

## Quality Gates

Run after every phase:
```
npm test          # all tests pass
npm run typecheck # zero type errors
npm run lint      # zero lint errors
```

Coverage target: 90/90/90 (line/branch/function).

## Detailed Plans

- [decisions.md](decisions.md) — architecture decisions
- [algorithm.md](algorithm.md) — pipeline stages and data flow
- [phase-1.md](phase-1.md) — data structures + acyclic + ranking
- [phase-2.md](phase-2.md) — crossing minimization + coord assignment
- [phase-3.md](phase-3.md) — spline edge routing
- [phase-4.md](phase-4.md) — plantuml-js integration

# Batch 3 — svek layer: registry ∥ decoration ∥ cluster ∥ edges

Four parallel tasks, disjoint write-sets. T10 needs all of Batch 2's
families; T11–T13 need only Brief 1 klimt (+T3 base where noted).

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T10 | USymbols registry (keyword → symbol) | typescript-pro (sonnet) | src/core/decoration/symbol/USymbols.ts, tests/unit/core/decoration/usymbols-registry.test.ts | T5–T9 | [ ] |
| T11 | Entity decoration: DecorateEntityImage → UGroup/UComment wrapper | typescript-pro (sonnet) | src/core/svek/DecorateEntityImage.ts, tests/unit/core/svek/decorate-entity.test.ts | T3 | [ ] |
| T12 | Cluster draw sequence (containers/packages) | typescript-pro (sonnet) | src/core/svek/Cluster.ts (+ splits), tests/unit/core/svek/cluster.test.ts | T3 | [ ] |
| T13 | SvekEdge draw half + extremity factories (parser-reachable decors) | typescript-pro (sonnet) | src/core/svek/SvekEdge.ts (+ splits), src/core/svek/extremity/*.ts, tests/unit/core/svek/svek-edge.test.ts | — | [ ] |

## Quality gates
Mission-level gates from `../README.md`.

## Next
Mark T10–T13 `[x]` here and in `../README.md`, commit (one per task),
proceed to Batch 4.

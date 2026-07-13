# Batch 1 — Foundations (all three tasks parallel)

Independent write-sets, no cross-dependencies. T1/T2 build the annotation
model + style tables; T3 is the pipeline refactor that makes central chrome
possible. Nothing renders chrome yet after this batch.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Annotation model + command regexes (`src/core/annotations/`) | typescript-pro | src/core/annotations/{model,commands,index}.ts, tests/unit/annotations-commands.test.ts | — | [ ] |
| T2 | Style defaults + skinparam/<style> plumbing | typescript-pro | src/core/annotations/style.ts, src/core/skinparam.ts, src/core/style-map-theme.ts, tests/unit/annotations-style.test.ts | — | [ ] |
| T3 | RenderFragment plugin contract + central svgRoot assembly | typescript-pro | src/core/dispatcher.ts, src/index.ts, src/diagrams/{class,state,sequence,activity,json,board,chart,chronology,files,packetdiag,dot,yaml,hcl}/renderer.ts + their index.ts as needed, affected tests | — | [ ] |

Write-set conflict check: T1/T2 share `src/core/annotations/` but write
disjoint files within it; T2 alone owns skinparam.ts/style-map-theme.ts; T3
alone owns dispatcher.ts/index.ts/engine renderers. No overlap.

After the batch: quality gates + DOT gate (exact numerator/denominator) +
verify `git diff --name-only` stays inside the union of write-sets.
One commit per task: `feat(T1): …`, `feat(T2): …`, `refactor(T3): …`.

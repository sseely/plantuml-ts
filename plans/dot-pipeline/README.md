# Mission: dot-pipeline — 100% Graphviz dotgen port

## Objective

Port every file in the Graphviz dotgen pipeline to TypeScript, replacing all
"cut-corner" approximations with authentic algorithms from graphviz 2.38.
Delete the dead `edgelabels.ts` code path. Add pathplan, pack, label, and
common algorithm libraries used by the PlantUML Smetana engine.

Branch: `feat/dot-passthrough`

## Quality Gates

Run after every batch. All must pass before marking batch `[x]`.

```
npm test           # vitest + coverage ≥90/90/90
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # vite library build
```

**Visual QA gate** (after batches C, D, E, F-B only):

```
pnpm visual:compare
```

Then run the `plantuml-visual-qa` agent to evaluate the dot section of
the report. Reference baseline: committed PNGs in `tests/visual/reference/dot/`.
Any new Tier 1 failure in the dot section is a stop condition.

## Stop Conditions

1. Task modifies a file outside its write-set that isn't in any other task's write-set
2. Two consecutive quality gate failures on the same gate
3. Implementation contradicts a decision in `decisions.md`
4. Phase C/D/E/F-B changes cause `npm test` failures on previously-passing dot tests
5. T5 (rank.ts refactor) changes coordinate output for any previously-passing test
6. T10 (cluster integration) requires editing files beyond its declared write-set
7. Any task discovers it needs ≥3 files not in its declared write-set
8. Visual QA: new Tier 1 failure in dot section after batches C, D, E, or F-B

## Push-Forward Conditions

- TypeScript style choices not affecting exported API shape
- Test helper extractions within the task's own test file
- Patch/minor npm version bumps with obvious fixes
- Single-line lint fixes with one correct solution
- Dot QA: "equivalent layout quality, different crossing order" — log in
  decision journal and continue

## Batch Status

| Batch | Description | Tasks | Done |
|-------|-------------|-------|------|
| A | Foundation helpers | T1, T2 | [x] |
| B | Edge classification | T3, T4 | [x] |
| C | Pipeline refactor | T5, T6, T7 | [x] |
| D | Clusters | T8, T9, T10 | [x] |
| E | Routing helpers | T11, T12, T13 | [x] |
| F-A | External libraries | T14, T15, T16, T17 | [x] |
| F-B | Integration | T18, T19 | [x] |

Visual QA gate: after C, D, E, F-B

## Document Index

- [Architecture decisions](decisions.md)
- [Decision journal](decision-journal.md)
- **Batch A** — [overview](batch-a/overview.md) · [T1](batch-a/T1-fastgr.md) · [T2](batch-a/T2-decomp.md)
- **Batch B** — [overview](batch-b/overview.md) · [T3](batch-b/T3-class1.md) · [T4](batch-b/T4-class2.md)
- **Batch C** — [overview](batch-c/overview.md) · [T5](batch-c/T5-rank-refactor.md) · [T6](batch-c/T6-mincross-flat.md) · [T7](batch-c/T7-index-cleanup.md)
- **Batch D** — [overview](batch-d/overview.md) · [T8](batch-d/T8-cluster.md) · [T9](batch-d/T9-compound.md) · [T10](batch-d/T10-cluster-integration.md)
- **Batch E** — [overview](batch-e/overview.md) · [T11](batch-e/T11-sameport-splines.md) · [T12](batch-e/T12-conc-rank.md) · [T13](batch-e/T13-aspect.md)
- **Batch F-A** — [overview](batch-f-a/overview.md) · [T14](batch-f-a/T14-pathplan.md) · [T15](batch-f-a/T15-shapes-routespl.md) · [T16](batch-f-a/T16-pack.md) · [T17](batch-f-a/T17-label.md)
- **Batch F-B** — [overview](batch-f-b/overview.md) · [T18](batch-f-b/T18-splines-pathplan.md) · [T19](batch-f-b/T19-xlabel-wiring.md)
- **Diagrams** — [data-flow](diagrams/data-flow.md) · [component-map](diagrams/component-map.md)

## Reference Locations

- Graphviz C source: `~/git/graphviz/lib/dotgen/` (authoritative, has comments)
- Smetana Java source: `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/`
- Prefer C source over Smetana — C has comments; Smetana has mangled names and no comments

## Recovery After Compaction

1. Re-read this README
2. Re-read `decision-journal.md`
3. Check `[x]` vs `[ ]` in the batch table above
4. Read the current batch's `overview.md`
5. Resume from the first incomplete task

---

## Mission Summary (completed 2026-05-03)

**Tasks completed:** 19/19 (T1–T19 across batches A, B, C, D, E, F-A, F-B)

**Decisions made:** 2 (see decision-journal.md)

### Quality gate results (final)

| Gate | Result |
|------|--------|
| `npm test` | 144/144 passed; branch 90.01% ≥ 90% ✓ |
| `npm run typecheck` | Clean ✓ |
| `npm run lint` | Clean (1 minor fix in xlabels.test.ts) ✓ |
| `npm run build` | dist/plantuml-js.js 439.74 kB ✓ |
| `pnpm visual:compare` | 1 passed; no Tier 1 failures ✓ |

### Deliverables

- **pathplan** (`src/core/pathplan/`) — Graphviz 2.38 shortest-path and spline solver, fully ported
- **common/shapes + routespl** (`src/core/common/`) — node geometry and spline fitting utilities
- **pack** (`src/core/pack/`) — component packing using R-tree bin placement
- **label** (`src/core/label/`) — R-tree-based external label (xlabel) placement
- **splines.ts** — barrier-aware spline routing wired into pathplan; short edges exclude endpoint nodes from obstacle set
- **index.ts** — xlabel positions wired through layout pipeline and surfaced in DotLayoutResult

### Known issues / follow-ups

- **numeric-node-ids collinear routing**: the 1→3 long edge routes through the same x-column as 1→2 and 2→3, making it visually hidden. All 3 edges ARE rendered (3 arrow markers). Root cause: position.ts x-coordinate assignment places the virtual intermediate node at the same x as real node 2. This is a pre-existing regression from position.ts work (not introduced by T18/T19). Follow-up: investigate `assignCoordinates` / `initNodeCoords` to offset virtual nodes in long-edge chains from same-rank real nodes.

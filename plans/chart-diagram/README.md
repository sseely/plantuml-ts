# Mission: Chart Diagrams (Phase 5n)

**Objective:** Implement `@startchart` / `@endchart` support — line, bar, area, and scatter
charts with categorical/numeric axes, secondary Y-axis, legend, annotations, orientation,
and stack modes. Port from `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/`.

**Branch:** `feat/chart-diagram`  
**Java source:** `~/git/plantuml/src/main/java/net/sourceforge/plantuml/chart/`

---

## Quality Gates (run after every batch)

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

All four must pass before any commit lands.

---

## Constraints

### Stop and wait for human input when:
- Any file outside a task's declared write-set needs modification
- Two consecutive quality gate failures on the same check after attempted fixes
- The `ChartGeometry` interface (defined in T2) needs to change after Batch 2 is committed
- Java source shows behavior that contradicts a decision in `decisions.md`
- An upstream fixture reveals behavior not covered by current task specs

### Push forward with judgment when:
- Exact pixel dimensions (margins, padding, default plot size) are unspecified — read
  upstream `ChartRenderer` constants directly and use them
- A test fixture shows minor visual difference not covered by an acceptance criterion —
  log in `decision-journal.md` and continue
- A command has an unspecified edge case (e.g. empty `[]` data) — match Java's behavior
  (silently skip that series)
- TypeScript requires small structural difference from Java (null vs undefined, Map vs
  plain object) — choose idiomatic TypeScript, log the divergence

---

## Batch Status

| Batch | Description | Status |
|-------|-------------|--------|
| [Batch 1](batch-1/overview.md) | AST types + parser + block-extractor | [x] |
| [Batch 2](batch-2/overview.md) | Layout + ChartGeometry contract | [x] |
| [Batch 3](batch-3/overview.md) | Sub-renderers (parallel) | [x] |
| [Batch 4](batch-4/overview.md) | Orchestrator + plugin wiring | [x] |

---

## Key Documents

- [decisions.md](decisions.md) — architecture decisions (pre-made)
- [decision-journal.md](decision-journal.md) — append entries during execution
- [diagrams/component-map.md](diagrams/component-map.md) — component relationships
- [diagrams/data-flow.md](diagrams/data-flow.md) — parse → layout → render flow

# Mission: @startboard Diagram Type (Phase 5i)

## Objective

Add Board/Kanban visualization support to plantuml-js. The feature
renders `@startboard / @endboard` sources as SVG kanban boards: columns
(Activities) containing PostIt-card trees laid out in a 2D grid via
pure arithmetic. No graph engine is involved.

## Branch

`feat/board-diagram` (create from `feat/hcl-diagram` or `main`)

## Quality Gates

Run all four before any commit reaches main:

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit (both tsconfigs)
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

## Pre-flight Baseline (as of mission creation)

- `npm test`: 2610 tests pass ✓
- `npm run typecheck`: **2 pre-existing errors** in `src/index.ts:491,512`
  (`highlightClasses` property missing from theme type). Fix these first or
  confirm they are fixed on the target branch before starting.
- `npm run lint`: **3 pre-existing errors** in `src/index.ts:491,511,512`
  (unsafe argument/assignment — same lines as typecheck). Fix alongside typecheck.
- `npm run build`: not verified at mission creation time.

## Constraints

### Stop and wait for human input when:
- Any task must modify files outside its declared write-set
- Two consecutive quality gate failures on the same check after two fix attempts
- `computeX` DFS produces x values inconsistent with the Java trace
  (root=0, first-child shares root x, second child increments counter)
- `npm test` passes but a rendered fixture shows cards outside the SVG
  viewBox or cards visually overlapping incorrectly

### Push forward with judgment when:
- Shadow implementation detail (use offset rect at +1,+1 in `#AAAAAA`)
- Text vertical alignment (use `dominant-baseline="hanging"`, y=3)
- Exact gray fill for cards (use `#D3D3D3`)
- Import ordering in modified files (match existing style)
- Obvious one-line typecheck fixes

## Batch Status

| Batch | Description | Done |
|-------|-------------|------|
| [Batch 1](batch-1/overview.md) | AST types + block-extractor wiring | [x] |
| [Batch 2](batch-2/overview.md) | Parser + Layout (parallel) | [x] |
| [Batch 3](batch-3/overview.md) | Renderer + board plugin index | [x] |
| [Batch 4](batch-4/overview.md) | Wire into src/index.ts + build-pages | [x] |

## Key Reference Links

- [Architecture decisions](decisions.md)
- [Data flow diagram](diagrams/data-flow.md)
- [Component map](diagrams/component-map.md)
- [Decision journal](decision-journal.md)

## Java Source (authoritative)

`~/git/plantuml/src/main/java/net/sourceforge/plantuml/board/`

- `CommandBoardPlus.java` — regex `^([+]*)(.+)$`, dispatches to `addLine`
- `BoardDiagram.java` — orchestrates activities, draws row separator lines
- `Activity.java` — one column; BNode tree + cursor-walk addRelease + drawMe
- `BNode.java` — DFS `computeX(AtomicInteger)`
- `BArray.java` — sparse (x,stage) → BNode map; tracks maxX, maxY
- `PostIt.java` — constants: height=90, width=170
- `CardBox.java` — 150×70 box, lightgray fill, 1px shadow, 14px sans-serif text

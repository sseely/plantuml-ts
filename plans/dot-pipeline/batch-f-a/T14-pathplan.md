# T14 — pathplan/

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. The pathplan library
routes polyline paths through obstacle polygons. It is used by splines.ts
(T18) to route edges around node bounding boxes.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

Port the 4 Smetana-included pathplan files to `src/core/pathplan/`:

| C source | Output TS file |
|----------|---------------|
| `~/git/graphviz/lib/pathplan/route.c` | `src/core/pathplan/route.ts` |
| `~/git/graphviz/lib/pathplan/shortest.c` | `src/core/pathplan/shortest.ts` |
| `~/git/graphviz/lib/pathplan/solvers.c` | `src/core/pathplan/solvers.ts` |
| `~/git/graphviz/lib/pathplan/util.c` | `src/core/pathplan/util.ts` |

Also create `src/core/pathplan/index.ts` that re-exports the public API.

**Note:** Do NOT port cvt.c, inpoly.c, triang.c, visibility.c — these are
NOT included in Smetana and are not needed.

Key exported function: `routesplines(vconfig, edges)` or equivalent — takes
a visibility graph and a set of edge paths and returns routed polyline points.

## Write-set

- `src/core/pathplan/route.ts` (create)
- `src/core/pathplan/shortest.ts` (create)
- `src/core/pathplan/solvers.ts` (create)
- `src/core/pathplan/util.ts` (create)
- `src/core/pathplan/index.ts` (create)
- `tests/unit/pathplan/*.test.ts` (create — at least one test per file)

## Read-set

- `~/git/graphviz/lib/pathplan/route.c`
- `~/git/graphviz/lib/pathplan/shortest.c`
- `~/git/graphviz/lib/pathplan/solvers.c`
- `~/git/graphviz/lib/pathplan/util.c`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/pathplan/` (all 4 java files)

## Architecture decisions

- D4: pathplan lives in `src/core/pathplan/`, not inside `src/core/dot/`.

## Interface contracts

The main consumer (T18) will import:
```typescript
import { Ppoint, Ppolyline, Ppoly, routesplines } from '../pathplan/index.js';
```

Use the same struct names as the C source (Ppoint, Ppolyline, Ppoly, etc.)
for traceability.

## Acceptance criteria

- Given two obstacle rectangles and a start/end point, when `routesplines`
  runs, then the returned path does not intersect either obstacle.
- Given a straight-line path with no obstacles, when `routesplines` runs,
  then the returned path is the direct line.
- All unit tests pass with ≥90% coverage.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.

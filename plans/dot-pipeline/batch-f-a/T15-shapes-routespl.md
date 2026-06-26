# T15 — common/shapes.ts + routespl.ts

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. `shapes.c` provides
node shape geometry (bounding polygons) used by edge routing. `routespl.c`
converts a routed polyline path into a cubic B-spline.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

Port two files from `~/git/graphviz/lib/common/`:

1. **`src/core/common/shapes.ts`** — port the geometry-relevant parts of
   `shapes.c`. Focus on: `nodeboundingbox`, the polygon/shape outline
   computation functions used to define obstacle regions for edge routing.
   Skip rendering-specific code (SVG/PostScript output) — this is a geometry
   library for layout, not a renderer.

2. **`src/core/common/routespl.ts`** — port `routespl.c`. Key function:
   `routesplines` converts a polyline (list of points from pathplan) into
   cubic B-spline control points suitable for SVG `<path>` elements.

Create `src/core/common/` directory if it doesn't exist.

## Write-set

- `src/core/common/shapes.ts` (create)
- `src/core/common/routespl.ts` (create)
- `tests/unit/common/shapes.test.ts` (create)
- `tests/unit/common/routespl.test.ts` (create)

## Read-set

- `~/git/graphviz/lib/common/shapes.c` — focus on bounding box / polygon sections
- `~/git/graphviz/lib/common/routespl.c`
- `src/core/dot/splines.ts` — understand current spline implementation
- `src/core/pathplan/` (T14 output) — routespl.ts will use Ppoint types

## Interface contracts

```typescript
// shapes.ts
export function nodeboundingbox(node: DotNode): Array<{x: number; y: number}>;

// routespl.ts
export function routesplines(
  points: Array<{x: number; y: number}>,
  startTangent?: {x: number; y: number},
  endTangent?: {x: number; y: number},
): Array<{x: number; y: number}>;
```

## Acceptance criteria

- Given a rectangular node, when `nodeboundingbox` runs, then it returns
  4 corners matching the node's x/y/width/height.
- Given 3 collinear points, when `routesplines` runs, then the resulting
  spline control points approximate a straight line.
- Given 4+ points with a turn, when `routesplines` runs, then the B-spline
  smoothly interpolates through the points.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.

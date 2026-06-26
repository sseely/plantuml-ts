# T16 — Splines: obstacle polygon construction

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js TypeScript port. This is sub-task A of a three-part
full Bezier spline routing implementation (D4). T16 builds the
obstacle representation; T17 routes through free space; T18 fits
Bezier curves.

Porting rules: port dotsplines.c faithfully, preserve function
names, bug-for-bug compat.

## Task

Read Section A of `plans/dot-engine-parity/batch-1/T4-splines-findings.md`
and implement obstacle polygon construction in `src/core/dot/splines.ts`.

This replaces the existing routing functions with the groundwork that
T17 and T18 will build on. Do NOT implement routing or Bezier fitting
yet — only the obstacle data structures and polygon construction.

Key deliverables per findings:
1. `buildObstaclePolygons(nodes)` — converts node bounding boxes into
   axis-aligned rectangular polygons; virtual nodes (width=0) produce
   no polygon
2. `ObstaclePolygon` type — `{ x, y, width, height }` exported for
   T17 to use
3. Port endpoint determination per Section A of findings — where
   exactly on a node boundary the edge starts/ends (replaces current
   `spreadFacePoint` for multi-edge case; keep spread logic but
   anchor it to the polygon boundary)
4. Export `buildObstaclePolygons` and `ObstaclePolygon` type

Keep all existing `routeEdges` behavior intact — T16 only adds
infrastructure, it does not change how edges are routed yet.

## Write-set

- `src/core/dot/splines.ts` (add polygon section; do not change routing)
- `tests/unit/dot/splines.test.ts`

## Read-set

- `plans/dot-engine-parity/batch-1/T4-splines-findings.md` (Section A)
- `src/core/dot/splines.ts`
- `src/core/dot/types.ts`
- `~/git/graphviz/lib/dotgen/dotsplines.c` (if findings ambiguous)

## Interface Contract (for T17)

```typescript
export type ObstaclePolygon = { x: number; y: number; width: number; height: number };
export function buildObstaclePolygons(nodes: DotNode[]): ObstaclePolygon[];
```

## Acceptance Criteria

- Given a node at (10, 20) width=80 height=36, when
  `buildObstaclePolygons()`, then returns one polygon
  `{ x:10, y:20, width:80, height:36 }`
- Given two adjacent non-overlapping nodes, when
  `buildObstaclePolygons()`, then the returned polygons do not
  overlap (precondition for routing)
- Given a virtual node (width=0, height=0), when
  `buildObstaclePolygons()`, then it produces no polygon entry
- Given an empty node array, when `buildObstaclePolygons()`, then
  returns an empty array
- Existing routing behavior (routeEdges) is unchanged — all
  existing splines tests pass

## Quality Bar

`npm test` passes. `npm run typecheck` clean.

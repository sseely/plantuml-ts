# T2 — Tile Base Infrastructure

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

This task builds the foundational tile interfaces and primitives that every
other tile implementation will extend. Nothing uses these files yet — they are
pure definitions with unit tests.

The Java gtile model: every diagram element is a `Gtile` (a self-sizing
object with intrinsic width/height and named hook points). Tiles compose
hierarchically. Coordinates are assigned only after the full tile tree is built.

## Task

### 1. `src/diagrams/activity/tiles/points.ts`

Define:

```typescript
export interface GPoint { x: number; y: number; }

export const NORTH_HOOK  = 'NORTH_HOOK';
export const SOUTH_HOOK  = 'SOUTH_HOOK';
export const EAST_HOOK   = 'EAST_HOOK';
export const WEST_HOOK   = 'WEST_HOOK';
export const NORTH_BORDER = 'NORTH_BORDER';
export const SOUTH_BORDER = 'SOUTH_BORDER';

export type HookName =
  | typeof NORTH_HOOK | typeof SOUTH_HOOK
  | typeof EAST_HOOK  | typeof WEST_HOOK
  | typeof NORTH_BORDER | typeof SOUTH_BORDER;

export function gpoint(x: number, y: number): GPoint { return { x, y }; }
```

### 2. `src/diagrams/activity/tiles/tile.ts`

Define:

```typescript
import type { GPoint, HookName } from './points.js';

export interface StringBounder {
  getDimension(text: string, fontSizePt: number): { width: number; height: number };
}

export interface Tile {
  readonly width: number;
  readonly height: number;
  getCoord(hook: HookName): GPoint;
}

export abstract class TileLeaf implements Tile {
  abstract readonly width: number;
  abstract readonly height: number;
  abstract getCoord(hook: HookName): GPoint;
}

export abstract class TileComposite implements Tile {
  abstract readonly width: number;
  abstract readonly height: number;
  abstract getCoord(hook: HookName): GPoint;
  abstract readonly children: readonly Tile[];
}
```

`StringBounder` is defined here (not imported from measurer.ts) so tile tests
can stub it inline. `measurer.ts` must satisfy this interface — verify with
a compatibility check in `tile.ts` if possible, or document the contract.

### 3. `src/diagrams/activity/tiles/index.ts`

Re-export all public symbols from `points.ts` and `tile.ts`.

### 4. Tests

Write `tests/diagrams/activity/tiles/tile.test.ts` and
`tests/diagrams/activity/tiles/points.test.ts`:

- `gpoint(3, 4)` returns `{ x: 3, y: 4 }`
- All six hook name constants are distinct strings
- A concrete `TileLeaf` subclass with fixed dimensions satisfies the interface
- A concrete `TileComposite` subclass with two children satisfies the interface
- `getCoord(NORTH_HOOK)` on a leaf returns `{ x: width/2, y: 0 }` (top center)
- `getCoord(SOUTH_HOOK)` on a leaf returns `{ x: width/2, y: height }` (bottom center)
- `getCoord(EAST_HOOK)` on a leaf returns `{ x: width, y: height/2 }`
- `getCoord(WEST_HOOK)` on a leaf returns `{ x: 0, y: height/2 }`

## Write-set

- `src/diagrams/activity/tiles/points.ts`
- `src/diagrams/activity/tiles/tile.ts`
- `src/diagrams/activity/tiles/index.ts`
- `tests/diagrams/activity/tiles/tile.test.ts`
- `tests/diagrams/activity/tiles/points.test.ts`

## Read-set

- `src/core/measurer.ts` — verify StringBounder shape compatibility
- `src/diagrams/activity/ast.ts` — understand node types tiles will wrap

## Architecture Decisions

- D1: Tiles are tile-relative (no x/y on tile)
- D3: Sizing at construction time via StringBounder
- D4: One file per concept

## Acceptance Criteria

- Given a `TileLeaf` with `width=100, height=50`, when `getCoord(NORTH_HOOK)`
  is called, then `{ x: 50, y: 0 }` is returned
- Given a `TileComposite` with two children, when `width` is accessed, then
  it returns a value ≥ each child's width
- Given the `StringBounder` interface in `tile.ts`, when the production
  `getMeasurer()` return value is assigned to it, then no TypeScript error occurs
- Given `npm test`, then all new tile tests pass at 90/90/90 coverage for
  the new files

## Quality Bar

`npm run typecheck`, `npm test`, `npm run lint` must all pass before committing.
Commit: `feat(activity): add tile base infrastructure (Tile, TileLeaf, TileComposite, GPoint)`

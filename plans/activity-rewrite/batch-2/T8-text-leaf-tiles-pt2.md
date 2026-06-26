# T8 — Text Leaf Tiles Pt2 (GtileDiamond, GtileSpot, GtileLabel)

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

T2 established `TileLeaf`, `StringBounder`, and `GPoint`. This task builds
three more leaf tiles: the decision diamond (used for if/while conditions),
the spot marker (named intermediate point), and the goto-label marker.

Existing geometry constants (from `layout.ts`):
- `DIAMOND_MIN = 20` — minimum half-width of diamond
- `DIAMOND_LABEL_PAD = 10` — padding between diamond edge and branch label text

## Task

### `src/diagrams/activity/tiles/gtile-diamond.ts`

Decision diamond node. Used as the header for if/while/repeat conditions.

Constructor: `(label: string, bounder: StringBounder, theme: Theme)`

Sizing:
```
const measured = bounder.getDimension(label, theme.fontSize - 2);
const halfW = Math.max(measured.width / 2 + DIAMOND_LABEL_PAD, DIAMOND_MIN);
const halfH = Math.max(measured.height / 2 + 4, DIAMOND_MIN);
this.width  = halfW * 2;
this.height = halfH * 2;
```

Hooks:
- `NORTH_HOOK`  → `{ x: width/2,  y: 0 }`       (top vertex)
- `SOUTH_HOOK`  → `{ x: width/2,  y: height }`   (bottom vertex)
- `EAST_HOOK`   → `{ x: width,    y: height/2 }` (right vertex)
- `WEST_HOOK`   → `{ x: 0,        y: height/2 }` (left vertex)

Expose: `label: string`

### `src/diagrams/activity/tiles/gtile-spot.ts`

Named colored intermediate marker (corresponds to Java `InstructionSpot`).

Constructor: `(node: ActivitySpot, bounder: StringBounder, theme: Theme)`

Sizing: Fixed. `radius = 8`. `width = height = radius * 2`.
If `node.name` is set, measure it and extend width to `max(width, measured.width + 8)`.

Hooks: standard four (top/bottom/left/right center).

Expose: `name: string`, `color: string | undefined`

### `src/diagrams/activity/tiles/gtile-label.ts`

Goto-label marker. Renders as a small anchored arrow/flag or just a named
point (exact rendering is handled by renderer; tile just provides bounding box).

Constructor: `(node: ActivityLabel, bounder: StringBounder, theme: Theme)`

Sizing:
```
const measured = bounder.getDimension(node.name, theme.fontSize - 2);
this.width  = measured.width + 16;
this.height = measured.height + 8;
```

Hooks: standard four.

Expose: `name: string`

### Tests — `tests/diagrams/activity/tiles/gtile-diamond.test.ts`
               and `tests/diagrams/activity/tiles/gtile-spot-label.test.ts`

Diamond tests:
- Short label → `width >= DIAMOND_MIN * 2` (minimum enforced)
- Long label → `width > DIAMOND_MIN * 2`
- `getCoord(NORTH_HOOK)` → `{ x: width/2, y: 0 }`
- `getCoord(SOUTH_HOOK)` → `{ x: width/2, y: height }`
- `getCoord(EAST_HOOK)`  → `{ x: width, y: height/2 }`
- `getCoord(WEST_HOOK)`  → `{ x: 0, y: height/2 }`

Spot tests:
- Fixed-size spot (`radius = 8`) → `width === height === 16`
- Standard hooks correct

Label tests:
- `width >= measured.width + 16`
- `tile.name === node.name`

## Write-set

- `src/diagrams/activity/tiles/gtile-diamond.ts`
- `src/diagrams/activity/tiles/gtile-spot.ts`
- `src/diagrams/activity/tiles/gtile-label.ts`
- `tests/diagrams/activity/tiles/gtile-diamond.test.ts`
- `tests/diagrams/activity/tiles/gtile-spot-label.test.ts`

## Read-set

- `src/diagrams/activity/tiles/tile.ts` — TileLeaf, StringBounder
- `src/diagrams/activity/tiles/points.ts` — GPoint, HookName
- `src/diagrams/activity/ast.ts` — ActivitySpot, ActivityLabel node shapes
  (Note: these may not exist yet if T2's AST extensions aren't done; if absent,
  define minimal local interfaces and note it in the decision journal)
- `src/core/theme.ts` — Theme interface
- `src/diagrams/activity/layout.ts:84-85` — DIAMOND_MIN, DIAMOND_LABEL_PAD

## Architecture Decisions

- D1: Tile-relative coordinates
- D3: Construction-time sizing
- D4: One file per tile

## Acceptance Criteria

- Given a `GtileDiamond` with label "" and minimum enforced, when `width` is
  read, then `width === DIAMOND_MIN * 2`
- Given a `GtileDiamond` with a long label, when `width` is read, then
  `width > DIAMOND_MIN * 2`
- Given `GtileSpot` with no label, when `width` and `height` are read,
  then both equal `16`
- Given `GtileLabel`, when `name` is read, then it matches the input node name
- Given `npm test`, then all new tile tests pass

## Quality Bar

`npm run typecheck`, `npm test`, `npm run lint` must all pass.
Commit: `feat(activity): add GtileDiamond, GtileSpot, GtileLabel leaf tiles`

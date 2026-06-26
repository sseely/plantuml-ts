# T7 — Text Leaf Tiles Pt1 (GtileAction, GtileNote)

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

T2 established `TileLeaf`, `StringBounder`, and `GPoint`. This task builds
the two text-bearing leaf tiles that require measurer-based sizing.

Existing geometry constants (from `layout.ts`):
- `ACTION_HEIGHT = 36` — minimum action box height
- `ACTION_H_PAD = 16` — horizontal padding inside action box
- `NOTE_FOLD = 8` — folded corner size on notes
- `NODE_MARGIN_X = 40`, `NODE_MARGIN_Y = 20` — inter-node spacing (NOT part
  of the tile; tiles carry intrinsic size only, not spacing)

## Task

### `src/diagrams/activity/tiles/gtile-action.ts`

Represents an `ActivityAction` node (rounded-rectangle box with label text).

Constructor: `(node: ActivityAction, bounder: StringBounder, theme: Theme)`

Sizing:
```
const measured = bounder.getDimension(node.label, theme.fontSize);
this.width  = Math.max(measured.width + 2 * ACTION_H_PAD, 120);
this.height = Math.max(measured.height * lineCount + 2 * verticalPad, ACTION_HEIGHT);
```
where `lineCount` = number of `\n` in label + 1, `verticalPad` = 8.

Hooks:
- `NORTH_HOOK` → `{ x: width/2, y: 0 }`
- `SOUTH_HOOK` → `{ x: width/2, y: height }`
- `EAST_HOOK`  → `{ x: width, y: height/2 }`
- `WEST_HOOK`  → `{ x: 0, y: height/2 }`

Expose: `label: string` (for renderer to read)

### `src/diagrams/activity/tiles/gtile-note.ts`

Represents an `ActivityNote` node (folded-corner rectangle).

Constructor: `(node: ActivityNote, bounder: StringBounder, theme: Theme)`

Sizing:
```
const measured = bounder.getDimension(node.text, theme.fontSize - 2);
this.width  = measured.width + 2 * ACTION_H_PAD + NOTE_FOLD;
this.height = measured.height + NOTE_FOLD + 16;
```

Hooks: same four standard hooks (top/bottom/left/right center).

Expose: `text: string`, `side: 'left' | 'right'` (from node.position).

### Tests — `tests/diagrams/activity/tiles/gtile-text-tiles.test.ts`

Use a stub bounder:
```typescript
const stubBounder: StringBounder = {
  getDimension: (text, _size) => ({ width: text.length * 7, height: 14 }),
};
const stubTheme = { fontSize: 13, fontFamily: 'Arial', colors: { ... } };
```

Tests:
- `GtileAction` with short label → `width >= 120` (minimum enforced)
- `GtileAction` with long label → `width > 120` (measured width used)
- `GtileAction.getCoord(NORTH_HOOK).y === 0`
- `GtileAction.getCoord(SOUTH_HOOK).y === tile.height`
- `GtileNote` width includes NOTE_FOLD
- `GtileNote.text` matches the input node text

## Write-set

- `src/diagrams/activity/tiles/gtile-action.ts`
- `src/diagrams/activity/tiles/gtile-note.ts`
- `tests/diagrams/activity/tiles/gtile-text-tiles.test.ts`

## Read-set

- `src/diagrams/activity/tiles/tile.ts` — TileLeaf, StringBounder
- `src/diagrams/activity/tiles/points.ts` — GPoint, HookName
- `src/diagrams/activity/ast.ts` — ActivityAction, ActivityNote node shapes
- `src/core/theme.ts` — Theme interface (for fontSize)
- `src/diagrams/activity/layout.ts:70-85` — geometry constants

## Architecture Decisions

- D1: Tile-relative coordinates
- D3: Construction-time sizing via StringBounder
- D4: One file per tile

## Acceptance Criteria

- Given a `GtileAction` with label "Hello" and a stub bounder returning
  `{width:35, height:14}`, when `width` is read, then `width === 120`
  (minimum enforced, since 35 + 32 pad < 120)
- Given a `GtileAction` with a very long label (200 chars), when `width` is
  read, then `width > 120`
- Given `GtileAction`, when `getCoord(SOUTH_HOOK)` is called, then
  `{ x: width/2, y: height }`
- Given `GtileNote`, when constructed, then `tile.text === node.text`
- Given `npm test`, then all new tile tests pass

## Quality Bar

`npm run typecheck`, `npm test`, `npm run lint` must all pass.
Commit: `feat(activity): add GtileAction and GtileNote text leaf tiles`

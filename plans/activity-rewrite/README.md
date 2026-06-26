# Activity Diagram Tile-Based Reimplementation

## Objective

Replace `src/diagrams/activity/layout.ts` with a tile-based layout framework
that mirrors Java PlantUML's gtile engine. The new framework uses self-sizing
tiles with named hook points, GConnection routing classes, and a two-phase
coordinate assignment pass — enabling correct swimlane composition, back-edge
routing, and future constructs (switch, group, partition, goto/label).

## Branch

`feat/activity-rewrite` (off `main`)

## Quality Gates

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit (both tsconfig.json + tsconfig.node.json)
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

All four must pass before any batch commits land.

## Architecture Decisions

See [decisions.md](decisions.md) for the six pre-made decisions.

## Stop Conditions

**Halt and wait for human when:**
1. Any task requires modifying files outside its declared write-set AND those
   files aren't in any other task's write-set
2. Two consecutive quality gate failures on the same check after fix attempts
3. Implementation contradicts an architecture decision in decisions.md
4. The tile interface design requires extracting shared types from `layout.old.ts`
   — that file's write-set is closed after T1
5. More than 3 files outside the planned write-set need changes to wire tile
   types (signals scope was under-estimated)
6. `npm run typecheck` fails on `tiles/` or `routing/` directories after two
   fix attempts — tile/connection interface contracts need human review
7. T3 (skinparam) would require removing, renaming, or narrowing behavior of
   any existing skinparam key or theme resolver — extensions only

**Push forward when:**
1. A tile file needs fewer named hooks than the task spec lists — implement
   only what the tile's geometry requires
2. A routing class needs minor waypoint tuning not specified — apply
   upstream-matching geometry
3. A TypeScript type error can be resolved by narrowing, assertion, or adding
   a missing interface member — fix it
4. Tests for a new tile need a helper not in `test/helpers/` — create the
   helper within the same task's write-set
5. T3 skinparam extensions need more or fewer keys than listed — implement
   exactly what the tile tests require to pass

## Batches

| Batch | Description | Status |
|-------|-------------|--------|
| [Batch 1](batch-1/overview.md) | Rename + tile base + skinparam | [x] |
| [Batch 2](batch-2/overview.md) | Routing classes + leaf tiles | [x] |
| [Batch 3](batch-3/overview.md) | Composite tiles | [x] |
| [Batch 4](batch-4/overview.md) | Coordinate assignment + wire-up | [x] |

## Documents

- [decisions.md](decisions.md) — pre-made architecture decisions
- [batch-1/overview.md](batch-1/overview.md) — rename, tile base, skinparam
- [batch-2/overview.md](batch-2/overview.md) — routing classes, leaf tiles
- [batch-3/overview.md](batch-3/overview.md) — composite tiles
- [batch-4/overview.md](batch-4/overview.md) — coordinate assignment, wiring
- [diagrams/component-map.md](diagrams/component-map.md) — component graph
- [diagrams/data-flow.md](diagrams/data-flow.md) — layout pipeline flow
- [decision-journal.md](decision-journal.md) — appended during execution

## Mission Complete

**Tasks completed:** 14/14 (T1–T14)

**Decisions logged:** 8 entries in decision-journal.md

**Quality gate results (final):**
- `npm test`: 73 test files, 2134 tests — all passed
- `npm run typecheck`: clean
- `npm run lint`: clean
- `npm run build`: 162.21 kB CJS output, no errors

**Pipeline status:** Tile-based layout is now the active `layoutActivity`
function. `layout.old.ts` is retained for reference (deletion is a cleanup
follow-up). Renderer and index import from `layout/tile-layout.ts`.

**Known gaps for follow-up:**
- `arrow-label` edge labels are not yet propagated to edge geos
- `detach` maps to GtileStop (no distinct visual)
- GtileSwitch, GtileGroup, GtilePartition not yet wired in tileNode (no AST node types)
- Merge diamond (if-merge) always null in GtileIf — elseif chains share the same exit

# Batch 5 — Migrate Diagram Layouts to dot (parallel)

## Description

Replace ELK adapter calls in all four graph diagram layout modules with
calls to the dot layout engine. Each task owns one diagram type and its
integration test. No write-set overlap — all four run in parallel.

ELK is NOT removed yet (that's T10). Both engines coexist until T10.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T6 | Migrate use case layout | typescript-pro | usecase/layout.ts, integration/usecase.test.ts | T5 | [x] |
| T7 | Migrate class layout | typescript-pro | class/layout.ts, integration/class.test.ts | T5 | [x] |
| T8 | Migrate component layout | typescript-pro | component/layout.ts, integration/component.test.ts | T5 | [x] |
| T9 | Migrate state layout | typescript-pro | state/layout.ts, integration/state.test.ts | T5 | [x] |

## Migration pattern

Each layout.ts currently:
1. Builds ElkGraph → calls `await runLayout(elkGraph)` → extracts from ElkLayoutResult

After migration:
1. Builds DotInputGraph → calls `layout(dotGraph)` (sync) → extracts from DotLayoutResult

ELK attribute mapping:
| ELK | dot |
|-----|-----|
| `elk.direction: 'RIGHT'` | `rankDir: 'LR'` |
| `elk.direction: 'DOWN'` | `rankDir: 'TB'` |
| `elk.spacing.nodeNode` | `nodeSep` |
| `elk.layered.spacing.nodeNodeBetweenLayers` | `rankSep` |

Compound nodes (containers): flatten children to root level for Phase 4.
Cluster subgraph support is a future enhancement.

## Quality Gate

```
npm test && npm run typecheck && npm run lint
```

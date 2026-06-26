# Batch 3 — Renderer + Board Plugin Index

Single task (renderer + renderer tests + board plugin index.ts).
All three files share write ownership and are highly coupled.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T5 | Renderer + tests + board plugin index | typescript-pro | `src/diagrams/board/renderer.ts`, `tests/unit/board/renderer.test.ts`, `src/diagrams/board/index.ts` | T1, T3, T4 | [ ] |

## Interface contract produced

```typescript
// renderer.ts exports:
export function renderBoard(geo: BoardGeometry, theme: Theme): string
// Returns a complete SVG string.

// index.ts exports:
export const boardPlugin: SyncPlugin<BoardDiagramAST, BoardGeometry>
```

`boardPlugin.accepts([])` always returns `false` — routing is via
`@startboard` only (block-extractor detects it from the keyword suffix).

# Mission: @startfiles Diagram (Phase 5o)

## Objective

Add files/directory-tree visualization to plantuml-js. `@startfiles` / `@endfiles`
renders a tree of file and directory paths using emoji icons (📂 folders, 📄 files)
with indentation. Notes (`<note>…</note>`) render as yellow rounded-rect boxes.

Branch: `feat/files-diagram` (from `main`).

## Quality Gates

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

## Constraints

### Stop when:
- Any task must modify files outside its declared write-set
- Two consecutive quality gate failures on the same check after two fix attempts
- A new npm package would be required

### Push forward with judgment:
- Note box colors (use `#FEFECE` fill, `#AAAAAA` stroke, `rx=4`)
- Row height (use 22px) and indent (use 20px per depth)
- Emoji font fallback — just emit the emoji, don't wrangle fonts
- Obvious one-line typecheck/lint fixes

## Architecture Decisions

See [decisions.md](decisions.md).

Key: **FormulaMeasurer** for width; **Unicode emoji** icons; **note as rounded rect**.

## Batch Status

| Batch | Description | Status |
|-------|-------------|--------|
| [Batch 1](batch-1/overview.md) | AST type definitions | [x] |
| [Batch 2](batch-2/overview.md) | Parser, layout, renderer (parallel) | [x] |
| [Batch 3](batch-3/overview.md) | Plugin wiring + corpus fixture | [x] |

## Links

- [decisions.md](decisions.md)
- [decision-journal.md](decision-journal.md)
- [diagrams/component-map.md](diagrams/component-map.md)
- [batch-1/T1-ast-types.md](batch-1/T1-ast-types.md)
- [batch-2/T2-parser.md](batch-2/T2-parser.md)
- [batch-2/T3-layout.md](batch-2/T3-layout.md)
- [batch-2/T4-renderer.md](batch-2/T4-renderer.md)
- [batch-3/T5-wiring.md](batch-3/T5-wiring.md)

## Mission Summary

**Completed:** 2026-05-01
**Tasks:** 5/5 completed (T1–T5)
**Commits:** 5 (one per task, all on `feat/files-diagram`)
**Quality gates:** All pass — 2764/2764 tests, typecheck clean, lint clean, build clean

**Notes:**
- T2 (parser) and T3 (layout) ran in parallel; the parser agent fixed an `exactOptionalPropertyTypes` error in layout.ts and committed layout.ts as part of its own commit. layout.test.ts required a separate cleanup commit.
- T5 agent correctly identified that `tests/visual/data/files.json` must be a `[{ slug, markup }]` array (not a bare object) to match the existing manifest format.
- LSP showed a stale `DiagramType` error on files/index.ts after T5 landed; `npm run typecheck` confirmed no actual error.

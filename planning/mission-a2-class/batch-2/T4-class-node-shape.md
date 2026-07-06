# T4 — Class node shape rule (plaintext vs rect)

## Context
The class layout (`src/diagrams/class/layout.ts:310`) builds `DotInputNode` as
`{id, width, height}` with **no shape** → all default to `rect`. Oracle emits
`shape=plaintext` (HTML table) for non-bare classes and `shape=rect` for bare
ones. This is the biggest shape fix (shapeOk fails 227). `DotInputNode` supports
`shape` and `label` (svek-dot-emit `shapeAttr` = `node.shape ?? 'rect'`).

## Task
In the `dotNodes` construction, for each classifier call
`buildClassHtmlLabel(classifier, theme, measurer)` (T3):
- non-null → emit `{ id, shape: 'plaintext', label, width, height }`;
- null (bare) → emit `{ id, shape: 'rect', width, height }` (current behavior).
Determine the exact non-bare condition from upstream (ADR-1) — port it, don't
guess. Verify the shape MULTISET matches oracle (bare→rect, non-bare→plaintext).

## Write-set
- `src/diagrams/class/layout.ts` (modify the dotNodes map only)
- `tests/unit/class/layout.test.ts` (modify — add shape assertions)

## Read-set
- `src/diagrams/class/class-html-label.ts` (T3's `buildClassHtmlLabel`)
- `src/diagrams/class/layout.ts:305-345` (dotNodes/dotEdges construction)
- `src/core/graph-layout.ts` (`DotInputNode` — confirm `shape`/`label` fields)
- `src/core/svek-dot-emit.ts:67-70` (`shapeAttr`)
- `~/git/plantuml/.../svek/image/EntityImageClass.java` +
  `CucaDiagramFileMakerSvek` (the plaintext-vs-rect condition — ADR-1)

## Architecture decisions
ADR-1 (mirror upstream condition), ADR-2 (full table from T3). If the upstream
condition is ambiguous, STOP (per constraints) rather than guess.

## Acceptance criteria
- Given a bare `class X`, then its node is `shape=rect`.
- Given a class with members or a stereotype, then `shape=plaintext` with the
  HTML label.
- Given the class ratchet, then the **9 baseline goldens stay EQUAL** (no
  regression).
- Given `scripts/dot-sync-report.ts class`, then shapeOk failures drop
  materially vs the 227 baseline (log the new number in the decision journal).

## Observability / Rollback
N/A. Reversible.

## Quality bar
Full quality gates + class ratchet green. Log the shapeOk-failure delta.

## Commit
`feat(T4): emit plaintext HTML-table class nodes (rect for bare)`

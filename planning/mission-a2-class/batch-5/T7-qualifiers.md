# T7 — Qualifier ports

## Context
A qualified association `class1 [Qualifier] <-- class2` makes class1 render as a
`shape=plaintext` HTML table with a `PORT` cell, and the edge attaches to that
port (`sh0006:h->sh0007`). Evidence: `baneru-00-kuro607` — oracle sh0006 is
plaintext with `PORT="h"`. The port HTML-table emitter already exists in
`svek-dot-emit.ts` (`appendLabelHtmlSpecialForPort`).

## Task
1. Parse `[Qualifier]` on a relationship endpoint → add a field on
   `Relationship` (e.g. `fromQualifier?/toQualifier?: string`) in `ast.ts` and
   the parse in `parser.ts`.
2. In `layout.ts`: a qualified endpoint forces its class node to `plaintext`
   (even if otherwise bare) with a port cell, and the edge references the port.
   Reuse the existing port HTML-table helper.

## Write-set
- `src/diagrams/class/ast.ts` (add qualifier fields)
- `src/diagrams/class/parser.ts` (parse `[Qualifier]`)
- `src/diagrams/class/layout.ts` (force plaintext+port, port edge)
- `tests/unit/class/parser.test.ts`, `tests/unit/class/layout.test.ts` (modify)

## Read-set
- `src/core/svek-dot-emit.ts:95-135` (port HTML-table + PORT edge helpers)
- `src/diagrams/class/parser.ts` (relationship parsing)
- `~/git/plantuml/.../classdiagram/` qualifier handling;
  `test-results/dot-cache/class/baneru-00-kuro607/svek-1.dot`

## Architecture decisions
ADR-5. Reuse the existing port emitter; don't duplicate HTML-table logic.

## Acceptance criteria
- Given `class1 [Qualifier] <-- class2`, when parsed, then the relationship
  carries the qualifier text.
- Given layout, then class1 is `shape=plaintext` with a `PORT`, and the edge is
  port-qualified.
- Given `baneru-00-kuro607`, then it becomes structurally EQUAL (or its residual
  is ledgered if another cause remains).
- Full gates + ratchet green.

## Observability / Rollback
N/A. Reversible.

## Quality bar
Full gates + ratchet green.

## Commit
`feat(T7): class qualifier ports (plaintext + PORT edge)`

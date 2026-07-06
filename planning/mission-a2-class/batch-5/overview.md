# Batch 5 — Qualifier ports

Niche but in-scope: `class1 [Qualifier] <-- class2` forces class1 to plaintext +
a `PORT` and a port-qualified edge. Owns `layout.ts` (after T5), plus AST/parser.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T7 | Qualifier parsing + plaintext port edges | typescript-pro | `src/diagrams/class/ast.ts`, `src/diagrams/class/parser.ts`, `src/diagrams/class/layout.ts`, `tests/unit/class/*` | T5 | [ ] |

Needs T5 (same `layout.ts`). Gate after: full set + ratchet.

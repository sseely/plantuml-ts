# Batch 2 — Class node shapes

Wire the plaintext/rect shape rule into the class layout, using T3's label
builder. Single task (owns `layout.ts`).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T4 | Class node shape rule (plaintext/rect) | typescript-pro | `src/diagrams/class/layout.ts`, `tests/unit/class/layout.test.ts` | T2, T3 | [ ] |

Needs T3 (`buildClassHtmlLabel`) and T2 (baseline goldens must stay EQUAL).
Gate after: full quality set + the class ratchet (the 9 baselines must remain
EQUAL). Measure shapeOk drop with `scripts/dot-sync-report.ts class`.

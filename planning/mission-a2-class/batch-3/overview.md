# Batch 3 — Relationship-edge topology

Port the edge-emission rules to match oracle edge count/degree, driven by T1's
diagnosis. Single task (owns `layout.ts`).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T5 | Relationship-edge topology | typescript-pro | `src/diagrams/class/layout.ts`, `tests/unit/class/layout.test.ts` | T4, T1 | [ ] |

Needs T4 (same file, sequential) and T1 (diagnosis). This is the largest task;
if a category resists 3 attempts, STOP (consecutive-fix rule). Gate after: full
set + ratchet; measure edgeCount/degree drop.

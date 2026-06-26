# Batch B — Edge classification

Two new files. T3 ports edge type classification (class1.c); T4 ports virtual
chain creation (class2.c). T4 depends on rank being assigned, not on T3, so
both can run in parallel. They do not share any write targets.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | class1.ts — edge type classification, tight tree | typescript-pro | `src/core/dot/class1.ts`, `tests/unit/dot/class1.test.ts` | Batch A | [ ] |
| T4 | class2.ts — virtual chain + label vnode creation | typescript-pro | `src/core/dot/class2.ts`, `tests/unit/dot/class2.test.ts` | Batch A | [ ] |

Run T3 and T4 in parallel (no write-set overlap, both depend only on Batch A).

After both complete: run `npm test && npm run typecheck && npm run lint && npm run build`.

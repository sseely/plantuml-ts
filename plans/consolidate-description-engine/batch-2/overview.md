# Batch 2 — Class + sequence accepts guard (Phase 1)

Applies the shared guard so descriptive diagrams stop being stolen by class /
sequence. **End of Phase 1 — independently shippable PR** (closes the `cocice`
misclassification).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T2 | Negative guard on class+sequence `accepts` + regression tests | typescript-pro | `src/diagrams/class/index.ts`, `src/diagrams/sequence/index.ts`, `tests/unit/dispatch/descriptive-guard.test.ts` | T1 | [ ] |

See [T2-dispatch-guard.md](T2-dispatch-guard.md).

After this batch, consider opening a PR for Phase 1 alone before starting
Batch 3.

# Batch 2 — Wire buildTheme / Usecase renderer / Class renderer fix

T4, T5, and T6 write different files. T4 needs T1+T2; T5 needs T2+T3; T6 is
independent of Batch 1 but runs here for logical grouping. Run in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | Wire StyleMap into buildTheme for element-scoped colors | typescript-pro | index.ts, index.test.ts | T1, T2 | [x] |
| T5 | Usecase renderer — business visuals + fill colors | typescript-pro | renderer.ts (usecase), renderer.test.ts (usecase) | T2, T3 | [x] |
| T6 | Class renderer — interfaceBackground for interface nodes | typescript-pro | renderer.ts (class), renderer.test.ts (class) | — | [x] |

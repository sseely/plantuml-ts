# Batch 1 — Skinparam collection / resolveSkinparam

T1 and T2 write different files and have no dependencies. Run in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Preprocessor skinparam collection | typescript-pro | preprocessor.ts, preprocessor.test.ts | — | [x] |
| T2 | `deepMergeTheme` + `resolveSkinparam` + `parseStyleBlock` | typescript-pro | theme.ts, theme.test.ts, skinparam.ts *(new)*, skinparam.test.ts *(new)* | — | [x] |

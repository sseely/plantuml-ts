# Batch 2 — Parametric macros / Node.js fs fetcher

T2 and T4 write different files and can run in parallel.
Both depend on Batch 1 completing (T2 needs T1's preprocessor.ts; T4 needs T3's stable IncludeFetcher type).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Parametric macros `!define MACRO(args) body` | typescript-pro | preprocessor.ts, preprocessor.test.ts | T1 | [x] |
| T4 | Node.js filesystem fetcher factory | typescript-pro | include-resolver-node.ts *(new)*, include-resolver-node.test.ts *(new)* | T3 | [x] |

# Batch 1 — Hierarchical style parser / Theme fills / Business AST

T1, T2, and T3 write different files and have no dependencies. Run in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Hierarchical `<style>` parser | typescript-pro | skinparam.ts, skinparam.test.ts | — | [x] |
| T2 | Extend Theme with actor/usecase fill colors | typescript-pro | theme.ts, theme.test.ts | — | [x] |
| T3 | Business element AST kinds + usecase parser | typescript-pro | ast.ts, parser.ts, parser.test.ts | — | [x] |

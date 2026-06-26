# Batch 1 — `<style>` + `!else` / Recursive includes

T1 and T3 write different files and have no dependencies. Run in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | `<style>` extraction + `!else` clause | typescript-pro | preprocessor.ts, preprocessor.test.ts | — | [x] |
| T3 | Recursive includes + circular detection | typescript-pro | include-resolver.ts, include-resolver.test.ts | — | [x] |

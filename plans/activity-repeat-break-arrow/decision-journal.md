# Decision Journal

| When | Task | Decision | Rationale |
|------|------|----------|-----------|
| Batch 1 | T1 | LSP diagnostics in parser.test.ts/layout.test.ts showed stale ActivityBreak errors; tsc clean | Confirmed via `npm run typecheck` — compiler is the authority, not the language server cache |
| Batch 3 | T3 | `exactOptionalPropertyTypes` LSP diagnostic on line 299 layout.ts was stale | Code already used conditional spread `...(node.color !== undefined ? { color: node.color } : {})` — tsc reported no errors |

## Completion Summary

| Item | Result |
|------|--------|
| Tasks completed | T1, T2, T3 (3/3) |
| Commits | feat(T1), feat(T2), feat(T3) |
| Final test suite | 54 files, all passed |
| Coverage | ≥90/90/90 thresholds met |
| Typecheck | Clean |
| Lint | Clean |
| Build | dist/plantuml-js.cjs 148.51 kB |
| Known issues | None |

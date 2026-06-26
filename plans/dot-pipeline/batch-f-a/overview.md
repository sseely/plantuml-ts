# Batch F-A — External libraries

Four independent library ports. All can run in parallel — no write-set overlap.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T14 | pathplan/ — polygon path routing (4 files) | typescript-pro | `src/core/pathplan/` (5 files + tests) | Batch E | [ ] |
| T15 | common/shapes + routespl — node shape geometry, route-to-spline | typescript-pro | `src/core/common/shapes.ts`, `src/core/common/routespl.ts` + tests | Batch E | [ ] |
| T16 | pack/ — connected component packing | typescript-pro | `src/core/pack/` (3 files + tests) | Batch E | [ ] |
| T17 | label/ — external label placement (R-tree) | typescript-pro | `src/core/label/` (6 files + tests) | Batch E | [ ] |

Run T14, T15, T16, T17 in parallel.

After all complete: run `npm test && npm run typecheck && npm run lint && npm run build`.
No visual QA gate at F-A (libraries not yet wired in).

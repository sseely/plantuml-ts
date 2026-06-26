# Decision Journal

| Date | Task | Decision | Rationale | Impact |
|------|------|----------|-----------|--------|
| 2026-04-22 | T10 | Used `pnpm install` instead of `npm install` | Project uses pnpm (pnpm-lock.yaml present); `npm install` crashed with arborist null-ref error | No impact — lockfile updated correctly |
| 2026-04-22 | T6–T9 | Stale LSP `await` warnings in layout.test.ts | LSP cache lags file deletions; `tsc --noEmit` confirms zero real errors | No action needed; IDE refreshes on restart |

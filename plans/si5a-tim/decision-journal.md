# SI5a — decision journal

| Date | Event | Decision / finding | Rationale | Status |
|---|---|---|---|---|
| 2026-07-12 | Mission opened | Rewrite `preprocessor.ts` as `TContext` + `CodeIterator` chain rather than bolting directives onto the flat line-loop | The flat loop structurally cannot express nested `!foreach`/`!while`/`!if`; upstream uses a pull-based iterator decorator chain over an execution-context stack. CLAUDE.md sanctions re-mirroring upstream structure. | locked |
| 2026-07-12 | Mission opened | Port all 76 builtins, not a corpus-driven subset | Long tail is the deliverable; an enumerated upstream list is not ambiguous scope. | locked |
| 2026-07-12 | Mission opened | Sync TIM + `IncludeStore`; async prefetch stays in `render()` | `renderSync` is public API + the browser story. Accepted divergence: over-fetch of includes inside false conditional branches. | locked |

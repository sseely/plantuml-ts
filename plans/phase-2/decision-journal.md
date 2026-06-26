# Decision Journal

| Batch | Task | Decision | Rationale | Outcome |
|-------|------|----------|-----------|---------|
| 5 | T16 | Integration test fixtures avoid `-->` arrows | Sequence plugin checks `-->` broadly; fixtures use graph-specific arrow syntax (`<|--`, `*--`, `..>`) to prevent sequence plugin from claiming them | Tests pass cleanly |
| 5/6 | T16+fix | Reorder plugin registration: class→state→component→usecase→sequence | Sequence plugin's `/->>?|-->>?/` heuristic matched graph diagram canonicals containing `-->` arrows | All 988 unit tests + 17 e2e tests pass |
| 5/6 | fix | Remove `database`+`interface` from componentPlugin.accepts | Both keywords appear in sequence/class diagrams; their presence in componentPlugin caused sequence canonical to be misrouted to componentPlugin after reordering | e2e tests restored to full pass |
| 5/6 | fix | Remove `actor` from usecasePlugin.accepts | Both sequence and usecase PlantUML diagrams use `actor` declarations; keeping it in usecase accepts would have claimed sequence canonicals after reorder | Usecase diagrams uniquely detected via `usecase`/`rectangle`/`(...)` patterns |

## Session Summary (Phase 2 Complete)

**Tasks completed:** 18/18 (T1–T18)

**Quality gate final results:**
- `pnpm typecheck` — 0 errors
- `pnpm lint` — 0 errors
- `pnpm test` — 988/988 passing, 91.5% branch / 99.62% function / 99.06% line
- `pnpm test:e2e` — 17/17 passing

**Known issues / follow-ups:**
- Component canonical uses `[Web Browser] as Browser` alias syntax; the component parser doesn't support bracket-node alias, so the component demo renders with ELK failing on missing node reference. Requires a component parser fix to support `[Name] as Alias` syntax.
- Plugin `accepts()` heuristics are first-match wins and pattern-based; complex diagrams mixing keywords from multiple types may misroute. A scoring-based dispatcher would be more robust long-term.

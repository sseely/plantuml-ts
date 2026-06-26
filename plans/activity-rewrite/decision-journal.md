# Decision Journal

| # | Task | Decision | Rationale | Outcome |
|---|------|----------|-----------|---------|
| 1 | T2 | StringBounder.getDimension(text, fontSizePt) intentionally differs from StringMeasurer.measure(text, FontSpec) | Tile interface takes only a size number for simplicity; callers bridge the two | Documented in tile.ts comment; bridge pattern noted for T14 |
| 2 | T3 fix | Added `...defaultTheme.colors` spread to deepMergeTheme test calls | Partial<Theme> requires complete colors object; tests only provided colors.graph | Typecheck clean after fix |
| 3 | T7 worktree merge | T7 agent used different hook name values ('NORTH' vs 'NORTH_HOOK'); fixed in merge resolution | T7 worked from a different points.ts variant; HEAD version is canonical | Both files updated to use NORTH_HOOK/SOUTH_HOOK constants |
| 4 | T9 worktree merge | T9 files copied directly (no git merge) after verifying constant names matched HEAD | Worktree was at older commit; constants matched; no merge conflicts | Files committed directly, all gates passed |
| 5 | T13 Tile interface | Added `kind: string` to Tile interface and abstract classes; fixes needed in 8 stub tile objects in tests | Walker must discriminate on `kind`; push-forward rule #3 permits adding missing interface member | Typecheck clean after fixing all 8 test stubs |
| 6 | T14 arrow-label skip | `arrow-label` AST node returns null from tileNode (excluded from tile tree) | No corresponding tile type; label is edge metadata not a layout element | Tests pass; edge labels deferred to future enhancement |
| 7 | T14 detach mapping | `detach` AST node maps to GtileStop for layout purposes | No GtileDetach exists; detach semantically terminates a branch like stop | Consistent with renderer rendering both as stops |
| 8 | All batches | Tile pipeline live: renderer and index now import layoutActivity from layout/tile-layout.js | D6: layout.old.ts retained for reference; types re-exported via tile-layout.ts to avoid touching layout.old.ts | All 4 quality gates pass; 2134 tests pass |

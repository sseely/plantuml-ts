# Decision Journal

| Batch | Task | Decision | Rationale | Outcome |
|-------|------|----------|-----------|---------|
| 1 | T1 | Single WIDTH table; fontName param kept with _ prefix | Matches Java StringBounderFixed; avoids breaking glyphWidth callers | ✅ All gates pass |
| 2 | T2 | text param carried on getDescent even though unused | Matches Java interface; future CanvasMeasurer canvas wiring needs it | ✅ All gates pass |
| 3 | T3 | Insertion-order Map eviction (not access-order) | JS Map is insertion-ordered; sufficient for cache pressure relief | ✅ All gates pass |

## Mission Summary

- Tasks completed: 3 / 3
- Commits: 3 (one per task)
- Tests: 1564 → 1576 (+12 new tests)
- Quality gates: all pass on all batches
- No stop conditions triggered
- No files modified outside write-set

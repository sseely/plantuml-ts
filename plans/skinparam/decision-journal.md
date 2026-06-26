# Decision Journal

| # | Batch | Task | Decision | Rationale | Outcome |
|---|-------|------|----------|-----------|---------|
| 1 | 1 | T2 | `defaultTheme.colors.noteBackground` kept at `'#FEFECE'` (diverges from upstream `'#FBFB77'` / `HColors.COL_FBFB77`) | Pre-existing divergence; fixing it is a separate correctness task outside T2 scope. Added comment in `theme.ts` next to the value. | Deferred |
| 2 | 1 | T2 | `parseStyleBlock` strips trailing `\r` from each line before processing | CRLF line endings cause the declaration regex `$` anchor to fail. Stripping `\r` is the correct pre-processing step and matches what any real parser should do. No upstream behaviour is lost — upstream Java runs on the JVM which normalises line endings. | Accepted |

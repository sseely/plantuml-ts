# Batch 2 — Copy-reports pipeline, playground

T4 and T5 run in parallel: T4 owns copy-reports.mjs + package.json +
.gitignore; T5 owns the theme/playground files. Both touch
`docs-site/.vitepress/config.ts`? NO — T5 owns config.ts (alias);
T4 must NOT edit it.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T4 | copy-reports pipeline (parity + divergences mirrors) | sonnet | docs-site/copy-reports.mjs, docs-site/parity.md + divergences.md (generated), package.json, .gitignore | T1, T2, T3 | [ ] |
| T5 | Live playground (src-alias import) | sonnet | docs-site/.vitepress/theme/**, docs-site/playground.md, docs-site/.vitepress/config.ts | T3 | [ ] |

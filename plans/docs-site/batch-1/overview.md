# Batch 1 — Report generator, divergences restructure, scaffold

T1–T3 have disjoint write-sets → run in parallel. NOTE: T3 owns
`package.json` in this batch; T4 (batch 2) touches it afterward.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Parity report generator (--markdown → committed docs/parity-report.md) | sonnet | scripts/dot-sync-report.ts, docs/parity-report.md | — | [ ] |
| T2 | DIVERGENCES.md restructure per diagram type | sonnet | DIVERGENCES.md + inbound-anchor files | — | [ ] |
| T3 | VitePress scaffold + guide pages | sonnet | docs-site/.vitepress/config.ts, docs-site/index.md, docs-site/guide/*, package.json, .gitignore | — | [ ] |

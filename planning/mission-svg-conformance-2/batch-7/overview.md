# Batch 7 — Raster retirement ∥ docs

Two parallel tasks, disjoint write-sets. T20 has a hard precondition
(coverage check — see its spec and the mission stop conditions).

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T20 | Retire the raster visual-QA path | typescript-pro (sonnet) | deletions: tests/visual/{compare.spec.ts,playwright-visual.config.ts,capture-reference.ts,reference/**}, scripts/visual-qa-svg.ts; package.json (visual:compare) | T18, T19 | [ ] |
| T21 | Docs: catalog, svg-conformance.md, CHANGELOG, mission summary prep | typescript-pro (sonnet) | .claude/catalog.md, docs/svg-conformance.md, CHANGELOG.md | — | [ ] |

## Quality gates
Mission-level gates. After T20, verify no script/test references the
deleted paths (`grep -r "visual-qa-svg\|capture-reference\|playwright-visual"`).

## Next
Mark T20/T21 `[x]`, run final full gates, write the mission summary in
`../README.md`.

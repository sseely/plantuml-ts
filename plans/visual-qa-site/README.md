# Mission: visual-qa-site

## Objective

Build a static visual QA site at `tests/visual/` that lets reviewers
compare every pdiff corpus fixture rendered by plantuml.com (canonical
PNG) against our TypeScript renderer (live SVG), fixture-by-fixture,
for all implemented diagram types.

**Branch:** `feat/graphviz-dot-layout` (current working branch)

## Status

- [x] Batch 1 — Classify script + package.json (T1, T4)
- [x] Batch 2 — Capture script + page generator (T2, T3)


## Standing Rule: Java Source Is the Spec

Before implementing any task in this mission, read the relevant Java source in
`~/git/plantuml`. The upstream code is 15+ years old and encodes accumulated
knowledge as special cases and subtle tweaks that are not documented anywhere
else. The Java code IS the requirement — not a reference. Reproduce every edge
case faithfully.

## Quality Gates

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit (both tsconfigs)
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

All four must pass before marking a batch done.

## Stop Conditions

- A pdiff fixture uses a format other than JSON-header-then-markup
- `plantuml.com` returns errors on 3+ consecutive requests
- The ESM build path `../../dist/plantuml-js.js` doesn't resolve from `tests/visual/`
- Any script requires modifying files outside its declared write-set

## Push-Forward Conditions

- Malformed fixture markup → classify as unknown, log slug, continue
- Ambiguous body markers → classify as first matching type (priority order)
- `npx serve` unavailable → substitute `python3 -m http.server`
- Zero fixtures for a type → emit empty manifest + empty HTML page

## Batches

| Batch | Description | Tasks | Depends On | Done |
|---|---|---|---|---|
| 1 | Classify + package.json | T1, T4 | — | [ ] |
| 2 | Capture + page generator | T2, T3 | Batch 1 | [ ] |

## Document Index

- [decisions.md](decisions.md) — architecture decisions
- [batch-1/overview.md](batch-1/overview.md) — T1, T4
- [batch-2/overview.md](batch-2/overview.md) — T2, T3
- [diagrams/component-map.md](diagrams/component-map.md) — component relationships
- [decision-journal.md](decision-journal.md) — execution log

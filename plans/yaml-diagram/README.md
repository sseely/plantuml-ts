# Phase 5c — YAML Visualization (@startyaml)

## Objective

Add `@startyaml` / `@endyaml` diagram support. The YAML input is parsed into
the same `JsonDiagramAST` that Phase 5b (JSON) produces, then handed to the
existing `layoutJson` + `renderJson` unchanged. No new renderer.

## Branch

Work on `main` or a feature branch off `main`.

## Pre-existing issue

Baseline branch coverage is **89.99%** (just below the 90% threshold) before
any YAML code is written. The YAML tasks must not make this worse; new code
should achieve ≥90% branch coverage.

## Quality Gates

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

All four must pass before any commit lands.

## Architecture Decisions

See [decisions.md](decisions.md). Key: port Java parser directly (no external
YAML library), reuse JSON renderer, extend JSON layout for wildcard highlights,
alias `yamlDiagram` style selectors to `jsonDiagram` in `src/index.ts`.

## Stop Conditions

- Task needs to modify files outside its declared write-set AND those files
  aren't in any other task's write-set → STOP
- Two consecutive quality gate failures on the same check → STOP
- `MonomorphToJson` produces structurally different JSON than Java for any
  corpus fixture → STOP
- Wildcard highlight extension breaks existing JSON diagram tests → STOP

## Push-Forward Conditions

- `cleanBlockStyle()` is a stub in Java ("Not finished!") — mirror the stub
- `KEY_AND_FOLDED_STYLE` (`>`) is unimplemented in Java — throw or return
  empty string
- Key ordering differences (JS objects vs LinkedHashMap) are cosmetically
  different but structurally identical — accept

## Batches

| Batch | Tasks | Depends On | Status |
|-------|-------|-----------|--------|
| [Batch 1](batch-1/overview.md) | T1 T2 T3 | — | [x] |
| [Batch 2](batch-2/overview.md) | T4 | T3 | [x] |
| [Batch 3](batch-3/overview.md) | T5 | T2 T4 | [x] |
| [Batch 4](batch-4/overview.md) | T6 | T1 T3 T5 | [x] |
| [Batch 5](batch-5/overview.md) | T7–T12 | T6 | [x] |
| [Batch 6](batch-6/overview.md) | T13–T16 | T7–T12 | [x] |
| [Batch 7](batch-7/overview.md) | T17–T20 | T13–T16 | [x] |
| [Batch 8](batch-8/overview.md) | T21 T22 | T17–T20 | [x] |

## Reference Files

- Java source: `~/git/plantuml/src/main/java/net/sourceforge/plantuml/yaml/`
- Corpus fixtures: `~/git/pdiff/input/YAML-*.puml`, `~/git/pdiff/dbhum/`
- Visual test data: `tests/visual/data/yaml.json` (20+ fixtures)
- JSON diagram (model to follow): `src/diagrams/json/`
- JSON layout (to extend for wildcards): `src/diagrams/json/layout.ts`

---

## Mission Complete — 2026-05-01

**Tasks completed:** 22/22 (T1–T22)

**Decisions made:**
- Ported Java YAML parser directly (no external library) — bug-for-bug compatibility, handles PlantUML dialect
- Reused `layoutJson` + `renderJson` from JSON diagram — no new renderer written
- Extended `buildHighlightMap` with recursive `navigate()` for `*`/`**` wildcards (T15)
- `yamlDiagram.*` style selectors aliased to `jsonDiagram.*` fields in `src/index.ts` (T16)
- `KEY_AND_FOLDED_STYLE` degrades to empty string with `console.warn` (mirrors Java stub)
- `yamlPlugin.accepts()` uses YAML-specific markers to avoid stealing `@startuml` content

**Final quality gate results (all pass):**
- `npm test`: 98 test files, 2569 tests, branch coverage ≥90%
- `npm run typecheck`: clean
- `npm run lint`: clean
- `npm run build`: 210.68 kB CJS bundle

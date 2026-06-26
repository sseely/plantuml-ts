# Batch 2 — Plugin Wiring

## Description

Wire the HCL parser into the plugin system, register it in `src/index.ts`,
add `hcldiagram.*` style selectors, write integration tests, create the visual
smoke test page, and document the style divergence. Depends on Batch 1 (T1
must be complete — `src/diagrams/hcl/parser.ts` must exist).

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Plugin + index wiring + style selectors + tests + visual page | typescript-pro | `src/diagrams/hcl/index.ts`, `src/index.ts`, `tests/unit/hcl/plugin.test.ts`, `tests/visual/hcl.html`, `DIVERGENCES.md` | T1 | [x] |

## Notes

- T2 is the only task in this batch.
- After T2 completes, run all four quality gates.
- The `tests/visual/hcl.html` file will be gitignored by the existing
  `tests/visual/*.html` rule — this is expected and correct.

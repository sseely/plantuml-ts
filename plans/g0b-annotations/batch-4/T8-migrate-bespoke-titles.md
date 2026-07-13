# T8 — Migrate json / dot / chart bespoke titles to shared chrome

## Context

Three engines render `title` through private, non-faithful bands
(decisions.md D10): dot (`TITLE_HEIGHT=30` const, renderer.ts:16 +
:277-300), json (`titleOffset = fontSize*1.8+8`, parser.ts:104-105,
layout.ts:76-77,582,643-651, renderer.ts:352-355), chart (parser.ts:140-141,
renderer title path). Upstream draws these types' titles through the same
chrome as everything else. After T7, the shared mechanism is live — the
bespoke bands are now the divergence AND a double-draw risk.

## Task

Per engine: route `title` through the T1 matcher (T6 deliberately left
title with the bespoke parser), delete the bespoke band (parse field,
layout reservation, renderer drawing), and let `applyChrome` draw it.
Remove the now-dead AST title fields ONLY if nothing else reads them
(find_referencing_symbols first; json's title field feeds layout offsets —
remove the whole chain together). Chart's data-series `legend` stays.

Jar-verify one titled fixture per engine: capture
`java -jar oracle/dist/plantuml-oracle.jar -tsvg -pipe` output for a small
titled json/dot/chart diagram and assert our output's title placement
matches the jar's RELATIONS (title above, centered, doc growth). Check
`test-results/dot-cache/json/` and `dot/` for pre-captured titled fixtures
before generating new ones.

Update the engines' existing title tests to the new expectations (they
asserted the bespoke band; list every changed expectation in the commit
body with a one-line justification each — these are DELIBERATE output
changes, decisions.md D5(b)).

## Read-set

- `src/diagrams/dot/{renderer.ts:10-20+270-305, parser.ts:88-98, ast.ts:38-45+95-105}`
- `src/diagrams/json/{parser.ts:100-110, layout.ts:70-80+575-655, renderer.ts:345-360, ast.ts:15-22}`
- `src/diagrams/chart/{parser.ts:135-150, renderer.ts:500-520, ast.ts:38-45}`
- `src/core/annotations/index.ts`; `plans/g0b-annotations/decisions.md#d10`
- Existing titled tests: grep `title` under tests/ scoped to json/dot/chart

## Acceptance criteria

- Given a titled dot/json/chart fixture, the title renders ONCE (no double band), via chrome geometry, jar-relation-verified.
- Given untitled fixtures for all three, output byte-identical to post-T7 main.
- Given the full suite, no test asserts the old TITLE_HEIGHT/titleOffset bands.
- DOT gate exact (json isn't in the gate; dot type isn't either — but run it anyway; Trap 3).

## Quality bar: all gates; deliberate-change inventory in the commit body.
## Observability: N/A. Rollback: Reversible.
## Commit: `feat(T8): json/dot/chart titles through shared chrome`

# Batch 4 — Migrations (both tasks parallel)

Requires batch 3 (chrome must be live before bespoke bands can be removed).
Disjoint write-sets.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T8 | Migrate json/dot/chart bespoke titles to shared chrome | typescript-pro | src/diagrams/json/{parser,layout,renderer,ast}.ts, src/diagrams/dot/{parser,renderer,ast}.ts, src/diagrams/chart/{parser,renderer,ast}.ts, their tests | T7 | [ ] |
| T9 | Mainframe rendering (BigFrame port) | typescript-pro | src/core/annotations/{chrome,blocks}.ts (mainframe additions), tests/unit/annotations-mainframe.test.ts, tests/integration/annotations.e2e.test.ts (append) | T4, T7 | [ ] |

T9 appends to the e2e test file T7 created — T8 must not touch it (T8's
tests live in the engines' own test files).

After the batch: gates + DOT gate exact; json/dot/chart titled output
jar-verified.

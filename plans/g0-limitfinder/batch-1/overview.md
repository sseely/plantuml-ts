# Batch 1 — Foundations (parallel)

Disjoint write-sets: T1 owns src/core/klimt/; T2 owns scripts/ + the
regenerable caches + docs/parity-report.md. No overlap.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Port MinMax/MinMaxMutable/UGraphicNo/LimitFinder/TextBlockUtils.getMinMax | typescript-pro | src/core/klimt/geom/MinMax.ts (+MinMaxMutable), src/core/klimt/drawing/{UGraphicNo,LimitFinder}.ts, src/core/klimt/shape/TextBlockUtils.ts (stub → real), tests/unit/klimt-limitfinder.test.ts | — | [x] |
| T2 | Pragma-strip re-capture: stripLayoutPragma at both jar write sites, elk-only blind guard, re-capture the 42 slugs, regenerate parity report | typescript-pro | scripts/dot-sync-report.ts, docs/parity-report.md, test-results/dot-cache/** (gitignored), tests/visual/data/*.json ONLY if a flag field is needed | — | [x] |

Gate after batch: T1 changes nothing behavioral (stub → real, no callers
yet, full suite byte-stable). T2 moves the DOT gate per D6 — new baseline
recorded in the journal + T2's commit message.

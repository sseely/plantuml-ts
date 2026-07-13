# Batch 3 — Pipeline integration (single task)

Requires batches 1-2. One task because it joins T3's assembly seam, T4's
applyChrome, and T5/T6's parsed annotations in `src/index.ts` — a single
logical unit with one writer.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T7 | renderSync/renderBlock apply chrome; description klimt path; buveco-86 e2e | typescript-pro | src/index.ts, src/diagrams/description/renderer.ts, tests/integration/annotations.e2e.test.ts (new), tests/helpers if needed | T3, T4, T5, T6 | [x] |

After the batch: titles/legends/headers/footers/captions RENDER for all
engines except json/dot/chart's own title (T8). Full gates + DOT gate exact.

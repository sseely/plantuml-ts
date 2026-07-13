# Batch 2 — Chrome core + parser wiring (all three tasks parallel)

Requires batch 1 merged. T4 builds the drawing/geometry core (consumes T1
model + T2 style). T5/T6 wire the T1 matcher into every parser. Disjoint
write-sets: T4 owns `src/core/annotations/chrome*.ts` (+ small klimt
additions); T5 owns class/state/sequence parsers; T6 owns
description/activity + the small engines.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T4 | Chrome geometry + block builders (DecorateEntityImage / DiagramChromeFactory / EntityImageLegend port) | typescript-pro | src/core/annotations/chrome.ts, blocks.ts; src/core/klimt/shape/TextBlockBordered.ts (if missing); tests/unit/annotations-chrome.test.ts | T1, T2 | [x] |
| T5 | Parser wiring A: class, state, sequence | typescript-pro | src/diagrams/class/{parser,class-commands,class-dispatch}.ts, src/diagrams/state/{parser,state-commands}.ts, src/diagrams/sequence/parser.ts, their ast.ts (add `annotations?`), affected tests | T1 | [x] |
| T6 | Parser wiring B: description, activity, board, chronology, files, packetdiag, yaml, hcl, json(parse-side only), dot(parse-side only), chart(parse-side only) | typescript-pro | those engines' parser.ts + ast.ts, src/core/descriptive-keywords.ts, affected tests | T1 | [x] |

After the batch: gates + DOT gate exact; annotations are PARSED everywhere
but only unit-rendered (integration is batch 3) — renderSync output must
still be byte-stable for annotation-free fixtures, and for annotated
fixtures the directives are now consumed by the matcher instead of
ignore-patterns (same visible output until T7).

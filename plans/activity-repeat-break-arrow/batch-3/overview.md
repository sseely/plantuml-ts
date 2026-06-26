# Batch 3 — Arrow labels: AST + parser + layout + renderer

## Description

Add support for `->label ;` and `-><back:color> label ;` arrow-label lines.
These annotate the next edge drawn with a text label and optional colored
background pill.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | arrow labels — AST + parser + layout + renderer | typescript-pro | ast.ts, parser.ts, layout.ts, renderer.ts, parser.test.ts, layout.test.ts, renderer.test.ts | T2 | [x] |

## After this batch

Run all quality gates. If green, mark T3 `[x]` in README.md. Run final
quality gates on the full branch. Write completion summary in
decision-journal.md.

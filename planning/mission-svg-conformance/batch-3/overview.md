# Batch 3 — Serializer (Xml stack + SvgGraphics)

Single task, the heaviest port of the brief: the XML writer and the
`SvgGraphics` document/state machine that every driver calls into.

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T4 | Port XmlWriter/Xml* + SvgGraphics (split per D2′) | typescript-pro (sonnet) | src/core/klimt/drawing/svg/{xml-writer,svg-graphics,svg-graphics-*}.ts, tests/unit/core/klimt/svg-graphics.test.ts | T2, T3 | [x] |

## Quality gates
Mission-level gates from `../README.md`. DOT parity 357/234/59.

## Next
Mark T4 `[x]`, commit, proceed to Batch 4.

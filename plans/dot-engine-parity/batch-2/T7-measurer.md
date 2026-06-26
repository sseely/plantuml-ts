# T7 — Per-glyph font width tables in measurer.ts

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js TypeScript port. `FormulaMeasurer` currently uses
`text.length × fontSize × 0.55` — every character gets the same
width. This causes node boxes to be mis-sized for any text with
wide characters (W, M) or narrow ones (i, l). The fix is a
per-glyph width lookup table for the fonts plantuml uses.

Architecture decision D2: ship tables for both DejaVu Sans
(plantuml.com's font) and Arial/Helvetica (browser default).
`FontSpec` already carries the font name — selection is free.

## Task

Replace `FormulaMeasurer`'s `length × 0.55` formula with per-glyph
width lookup tables for DejaVu Sans and Arial/Helvetica. Fall back
to `0.55em` for unmapped glyphs (CJK, emoji, etc.).

Width tables should be expressed as a fraction of em (fontSize),
derived from standard font metrics for the printable ASCII range
(U+0020–U+007E) plus common extended Latin characters.

Do not touch `CanvasMeasurer` — it already uses actual font metrics.
`FormulaMeasurer` is the fallback when Canvas is unavailable (Node,
jsdom); this fix makes the fallback accurate.

## Write-set

- `src/core/measurer.ts`
- `tests/unit/measurer.test.ts`

## Read-set

- `src/core/measurer.ts` (full file)
- `tests/unit/measurer.test.ts` (existing tests)

## Acceptance Criteria

- Given the string "W" at 14px DejaVu Sans, when measured, then
  `width` > measured width of "i" at same size (proportional)
- Given a bold font spec, when measured, then width ≥ same string
  at regular weight (bold glyphs are typically the same width or
  slightly wider)
- Given jsdom environment where Canvas returns 0, when
  `CanvasMeasurer` falls back to `FormulaMeasurer`, then the
  returned width uses the per-glyph table not `length × 0.55`
- Given an unmapped glyph (CJK character U+4E2D), when measured,
  then width = `fontSize × 0.55` (fallback) without throwing
- Given the string "ill" vs "WWW" at the same font and size, when
  measured, then "WWW".width > "ill".width by a significant margin

## Quality Bar

`npm test` passes. `npm run typecheck` clean. Existing measurer
tests must still pass — this must not break `CanvasMeasurer`.

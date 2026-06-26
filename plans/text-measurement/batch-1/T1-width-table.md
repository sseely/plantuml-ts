# T1 — Port StringBounderFixed WIDTH table + fix height formula

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML. The project is GPL-3.0.
Stack: TypeScript + Vite, tests via Vitest (90/90/90 coverage thresholds).
Linter: ESLint. All quality gates must pass before committing.

The porting discipline: port Java faithfully, including special cases. Do not
simplify or modernise during the port.

## Task

Replace the existing `ARIAL_WIDTHS` and `DEJAVU_SANS_WIDTHS` em-fraction
tables in `src/core/measurer.ts` with the upstream Java `WIDTH[96]` array
from `StringBounderFixed.java`. Fix the height and fallback formulas to match.

### Exact Java source to port

```java
// StringBounderFixed.java — WIDTH array (chars 32–127, raw px at 12px reference)
private static final double[] WIDTH = {
  3.3, 3.3, 4.3, 6.7, 6.7, 10.7, 8.0, 2.3, 4.0, 4.0, 4.7, 7.0, 3.3, 4.0, 3.3, 3.3,
  6.7, 6.7, 6.7, 6.7, 6.7, 6.7, 6.7, 6.7, 6.7, 6.7, 3.3, 3.3, 7.0, 7.0, 7.0, 6.7,
  12.2, 8.0, 8.0, 8.7, 8.7, 8.0, 7.3, 9.3, 8.7, 3.3, 6.0, 8.0, 6.7, 10.0, 8.7, 9.3,
  8.0, 9.3, 8.7, 8.0, 7.3, 8.7, 8.0, 11.3, 8.0, 8.0, 7.3, 3.3, 3.3, 3.3, 5.6, 6.7,
  4.0, 6.7, 6.7, 6.0, 6.7, 6.7, 3.3, 6.7, 6.7, 2.7, 2.7, 6.0, 2.7, 10.0, 6.7, 6.7,
  6.7, 6.7, 4.0, 6.0, 3.3, 6.7, 6.0, 8.7, 6.0, 6.0, 6.0, 4.0, 3.1, 4.0, 7.0, 6.0,
};

// calculateDimensionInternal:
//   factor = size / 12.0
//   height = size               ← NOT size * 1.2
//   width  = sum(getCharWidth) * factor
//
// getCharWidth(char c):
//   if c >= 32 && c <= 127: return WIDTH[c - 32]
//   else:                   return 13   ← then multiply by factor
//
// getDescent:
//   return size / 4.5
```

### Changes to make

1. **Delete** `ARIAL_WIDTHS` and `DEJAVU_SANS_WIDTHS` constants entirely.
2. **Add** `const WIDTH: readonly number[]` with the 96 values above.
3. **Rewrite** `glyphWidth(char, _fontName, size)`:
   - Keep the function signature (3 params) — callers depend on it, font name
     becomes unused but don't remove it
   - `const code = char.charCodeAt(0)`
   - If `code >= 32 && code <= 127`: `return WIDTH[code - 32] * (size / 12.0)`
   - Else: `return 13 * (size / 12.0)`
   - Delete `FALLBACK_EM` constant and `normaliseFontFamily()` helper (both dead)
4. **Fix** `FormulaMeasurer.measure`: `height: font.size` (was `font.size * 1.2`)
5. **Fix** `CanvasMeasurer.measure`: `height: font.size` in the canvas-success path
   (line ~364 in the current file)

## Write-Set

- `src/core/measurer.ts`
- `tests/unit/measurer.test.ts`

## Read-Set

- `src/core/measurer.ts` — read fully before editing
- `tests/unit/measurer.test.ts` — read fully before editing
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/drawing/debug/StringBounderFixed.java`
  — verify WIDTH values before transcribing

## Architecture Decisions

See `plans/text-measurement/decisions.md`:
- D1: single WIDTH table, font name becomes no-op in formula path

## Acceptance Criteria

- Given `' '` (space, code 32) at 12px, `glyphWidth` returns `3.3`
- Given `'A'` (code 65) at 12px, `glyphWidth` returns `8.0`
- Given `'W'` (code 87) at 12px, `glyphWidth` returns `11.3`
- Given char with code 128 at 12px, `glyphWidth` returns `13.0` (fallback)
- Given "Hello" at Arial 14px, `FormulaMeasurer.measure` returns `height = 14.0`
- Given "Hello" at Arial 14px with mock canvas ctx, `CanvasMeasurer.measure`
  returns `height = 14.0`
- The existing test "computes width as sum of per-glyph widths" is updated to
  use the new WIDTH-table values for 'H','e','l','l','o' at 12px scaled to 14px
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all pass

## Quality Bar

Run `npm test && npm run typecheck && npm run lint && npm run build` before
finishing. All must pass. Coverage must remain ≥ 90/90/90.

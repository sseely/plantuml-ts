# Architecture Decisions

## D1: Width table strategy — single table

**Decision:** Replace `ARIAL_WIDTHS` and `DEJAVU_SANS_WIDTHS` with a single
`WIDTH[96]` array matching `StringBounderFixed.java` exactly (raw px at 12px
reference, indexed by `charCode - 32`).

**Rationale:** `FormulaMeasurer` is the Node/fallback path. Matching Java's
table makes its layout arithmetic identical to the server-side PNG renderer.
`CanvasMeasurer` continues using Canvas API (font-aware), which matches
`StringBounderTeaVM`.

**Implementation:** `glyphWidth(char, _fontName, size)` uses
`WIDTH[c - 32] * (size / 12.0)`. Font name parameter is kept (don't break
signature) but becomes a no-op for the formula path.
Out-of-range chars (code < 32 or > 127): `13 * (size / 12.0)`.

---

## D2: getDescent signature — include text parameter

**Decision:** `getDescent(font: FontSpec, text: string): number` on the
`StringMeasurer` interface.

**Rationale:** Matches Java's `StringBounder.getDescent(UFont, String)`.
`StringBounderTeaVM` uses the text to call `getDetailedTextMetrics`
(returns `fontBoundingBoxDescent`). Carrying the parameter now avoids a
breaking interface change when `CanvasMeasurer.getDescent` is later wired
to the Canvas `TextMetrics` API.

**Implementation:** `FormulaMeasurer.getDescent` and `CanvasMeasurer.getDescent`
ignore `text` for now (formula-based: `size / 4.5`).

---

## D3: LRU cache — CanvasMeasurer only

**Decision:** Add an 8192-entry LRU cache to `CanvasMeasurer` only.
`FormulaMeasurer` gets no cache.

**Rationale:** `StringBounderTeaVM` caches because Canvas API calls are
expensive DOM operations. `FormulaMeasurer` is pure arithmetic (~50 ns/call)
and gains nothing from caching. Max size 8192 matches `StringBounderTeaVM`.

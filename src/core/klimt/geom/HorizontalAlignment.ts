/**
 * HorizontalAlignment — the 3-way text/label alignment `USymbol#asSmall`/
 * `asBig` (decoration/symbol/USymbol.java) take for the stereotype and,
 * for `asBig`, the label too (see `USymbolRectangle.java`'s `asBig`,
 * which branches on `labelAlignment`/`stereoAlignment`).
 *
 * Upstream: klimt/geom/HorizontalAlignment.java — a 3-value enum with
 * `fromString`, `getGraphVizValue`, `draw(UGraphic, TextBlock, ...)`,
 * `getPosition`, and `asPlacementStrategy`.
 *
 * Scope reduction (T3 mission brief — port only what `USymbol`/
 * `SymbolContext`/the `TextBlock` seam and `EntityImageDescription`
 * actually exercise): only the 3 enum values are ported. `fromString`
 * (skinparam-string parsing), `getGraphVizValue` (DOT layout), `draw`
 * (needs `ug.getStringBounder()` — this port's `UGraphic`, T2, has no
 * such method) and `asPlacementStrategy` (needs the unported
 * `PlacementStrategy*` family) are NOT exercised by any of `USymbol`,
 * `SymbolContext`, the `TextBlock` seam, or `EntityImageDescription` —
 * deferred to whichever later task first needs them.
 *
 * As-const object, not a TS `enum` (project convention — safer across
 * declaration-file boundaries than `const enum`, see code-principles).
 */
export const HorizontalAlignment = {
  LEFT: 'LEFT',
  CENTER: 'CENTER',
  RIGHT: 'RIGHT',
} as const;

export type HorizontalAlignment = (typeof HorizontalAlignment)[keyof typeof HorizontalAlignment];

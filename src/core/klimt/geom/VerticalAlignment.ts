/**
 * VerticalAlignment — the 3-way alignment `TextBlockHorizontal` uses to
 * position each block within the merged row's height (top/center/bottom).
 *
 * Upstream: klimt/geom/VerticalAlignment.java — a 3-value enum with a
 * `fromString(String)` static parser.
 *
 * Scope reduction (T3b — this task's write-set is `TextBlockUtils.mergeLR`/
 * `TextBlockHorizontal`, not skinparam string parsing): only the 3 enum
 * values are ported. `fromString` has no caller anywhere in this port
 * (no skinparam-value parser reads a `VerticalAlignment` yet); deferred to
 * whichever later task first needs it.
 *
 * As-const object, not a TS `enum` (project convention — see
 * `HorizontalAlignment.ts` for the identical pattern already established).
 */
export const VerticalAlignment = {
  TOP: 'TOP',
  CENTER: 'CENTER',
  BOTTOM: 'BOTTOM',
} as const;

export type VerticalAlignment = (typeof VerticalAlignment)[keyof typeof VerticalAlignment];

/**
 * StripeStyleType — the per-line creole classification
 * `CreoleStripeSimpleParser`'s regex cascade assigns before a line's atoms
 * are built.
 *
 * Upstream: klimt/creole/StripeStyleType.java (a Java `enum`: NORMAL,
 * HEADING, LIST_WITHOUT_NUMBER, LIST_WITH_NUMBER, HORIZONTAL_LINE, TREE).
 * Ported as an as-const string-union object per project convention (no
 * `const enum`).
 *
 * E2r/L1 scope: only NORMAL, HEADING, and HORIZONTAL_LINE are actually
 * DISPATCHED on by this port (`legacy/StripeSimple.ts`). LIST_WITHOUT_NUMBER/
 * LIST_WITH_NUMBER (`*`/`#` bullet lines) and TREE (`+`-prefixed tree lines)
 * are named here for fidelity with the upstream enum, and
 * `legacy/CreoleStripeSimpleParser.ts`'s classifier never PRODUCES them (its
 * FULL-mode-only asterisk/hash branches are not ported — see that module's
 * doc comment) — no L1 acceptance fixture exercises bullet lists inside a
 * descdiagram entity display. Deferred, not stubbed: reaching one of these
 * values from `classifyStripeLine` is impossible today, so no rendering
 * branch exists for them either.
 */
export const StripeStyleType = {
  NORMAL: 'NORMAL',
  HEADING: 'HEADING',
  LIST_WITHOUT_NUMBER: 'LIST_WITHOUT_NUMBER',
  LIST_WITH_NUMBER: 'LIST_WITH_NUMBER',
  HORIZONTAL_LINE: 'HORIZONTAL_LINE',
  TREE: 'TREE',
} as const;
export type StripeStyleType = (typeof StripeStyleType)[keyof typeof StripeStyleType];

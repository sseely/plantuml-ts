/**
 * Stripe — one physical creole display line's built atom sequence.
 *
 * Upstream: klimt/creole/Stripe.java (`getLHeader(): Atom`, `getAtoms():
 * List<Atom>`). Ported in full. `getLHeader` returns `null` for L1: it only
 * ever returns non-null for `LIST_WITHOUT_NUMBER`/`LIST_WITH_NUMBER` lines
 * (`StripeStyle#getHeader`, a bullet/number-glyph atom) — bullet lists are
 * out of L1 scope (`StripeStyleType.ts`'s doc comment).
 */
import type { CreoleAtom } from './atom/Atom.js';

export interface Stripe {
  getLHeader(): CreoleAtom | null;
  getAtoms(): readonly CreoleAtom[];
}

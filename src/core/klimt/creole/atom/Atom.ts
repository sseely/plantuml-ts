/**
 * Atom — one drawable/measurable piece of a creole `Stripe` (one physical
 * display line).
 *
 * Upstream: klimt/creole/atom/Atom.java (`calculateDimensionSlow`,
 * `getStartingAltitude`, `drawU`) plus its many concrete implementations
 * (`legacy/AtomText.java`, `atom/AtomImg.java`, `atom/AtomSprite.java`, ...).
 * This port's `EntityImageDescriptionSupport.ts#buildTextBlock` already
 * carries its OWN measure/draw loop (per-line width sum, height max, a
 * `StringBounder` threaded in at draw time) — re-porting `Atom`'s
 * `calculateDimensionSlow`/`drawU` OOP surface as TS classes would just
 * duplicate that loop one level down. Instead, `CreoleAtom` is a plain,
 * DATA-ONLY discriminated union (per this project's testability rules —
 * pure data over an object-with-methods where the caller already owns the
 * measure/draw loop): `EntityImageDescriptionSupport.ts` (and
 * `leaf-sizing.ts`, the layout-time sizing seam) measure/draw each variant
 * directly.
 *
 * - `'text'`: upstream's `legacy/AtomText.java` — a run of plain text under
 *   ONE resolved `FontConfiguration` (the creole engine's actual unit of
 *   style — see `legacy/StripeSimple.ts`'s doc comment for how nested
 *   `<b>`/`**`/etc. runs collapse into a flat sequence of these).
 * - `'inline'`: SI5b+E2r T6/T7's existing `<img>`/`<$sprite>` atom model
 *   (`core/creole-atoms.ts#InlineAtomToken`) — reused, not duplicated, per
 *   this task's integration charter (see `legacy/StripeSimple.ts`'s doc
 *   comment for the composition order).
 */
import type { FontConfiguration } from '../../shape/UText.js';
import type { InlineAtomToken } from '../../../creole-atoms.js';

export type CreoleAtom =
  | { readonly kind: 'text'; readonly text: string; readonly font: FontConfiguration }
  | { readonly kind: 'inline'; readonly atom: InlineAtomToken };

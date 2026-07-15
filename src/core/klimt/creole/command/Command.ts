/**
 * Command — one inline creole markup recognizer (`**bold**`, `<b>bold</b>`,
 * `<b>bold to end of line`, ...), tried in sequence by
 * `StripeSimple#modifyStripe`'s per-character scan.
 *
 * Upstream: klimt/creole/command/Command.java —
 * `starters(): Collection<String>`, `matchingSize(line, pos): int`,
 * `executeAndAdvance(skinSimple, line, pos, stripe): int`. Ported: the
 * three-method shape, minus the `ISkinSimple skinSimple` parameter — no L1
 * command needs it (`<img>`/`<$sprite>` resolution is handled externally,
 * BEFORE style-run splitting even sees the line — see
 * `legacy/StripeSimple.ts`'s doc comment for the composition order); a
 * future L2 command that genuinely needs skin-param state (e.g. a named
 * skinparam color lookup) can add it back without touching this shape.
 *
 * `executeAndAdvance` receives a `StripeBuilder` (this file), not the
 * concrete `StripeSimple` class upstream's signature names — the same
 * "depend on abstractions" seam `legacy/StripeSimple.ts` implements.
 */
import type { FontConfiguration } from '../../shape/UText.js';

export interface StripeBuilder {
  getActualFontConfiguration(): FontConfiguration;
  setActualFontConfiguration(font: FontConfiguration): void;
  /** Recursion entry for a command's captured inner text (upstream:
   *  `stripe.analyzeAndAdd(value.get(0))`, called from inside
   *  `executeAndAdvance`). NOT the full `StripeSimple#analyzeAndAdd`
   *  (cell-alignment/heading/horizontal-line dispatch runs ONCE, at the
   *  line's top level, before any command ever executes) — this is the
   *  `modifyStripe`-equivalent recursion only, matching every L1 acceptance
   *  fixture's nesting shape (see `legacy/StripeSimple.ts`'s doc comment). */
  analyzeAndAddInline(text: string): void;
  /** E2r/L2: pushes a `<latex>` atom directly (upstream: `stripe.addMath`)
   *  under the CURRENT font's color -- see `atom/Atom.ts`'s `'latex'`
   *  variant doc comment for why color (not the other font attributes)
   *  is the one piece of state a latex atom needs. */
  pushLatexAtom(expr: string): void;
}

export interface Command {
  readonly starters: readonly string[];
  matchingSize(line: string, pos: number): number;
  executeAndAdvance(line: string, pos: number, stripe: StripeBuilder): number;
}

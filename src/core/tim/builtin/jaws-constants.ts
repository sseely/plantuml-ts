/**
 * Local, minimal stand-in for the private-use Unicode sentinels
 * `net.sourceforge.plantuml.jaws.Jaws` defines for its Creole/Display-layer
 * newline and escape handling. That package is out of this batch's write-set
 * (`src/core/tim/builtin/` only) and out of scope entirely -- no file here
 * calls anything on `Jaws` beyond these six `char` constants, following this
 * codebase's established narrow-local-duplicate precedent (see
 * `VariableManager.ts`'s `isLetterOrEmojiOrUnderscoreOrDigit`).
 *
 * `JawsFlags.USE_BLOCK_E1_IN_NEWLINE_FUNCTION` is a hardcoded `true` on the
 * Java side (not a runtime toggle) -- `Newline`/`NewlineShort`/`Breakline`
 * below always take the BLOCK_E1 branch, so the flag itself needs no
 * representation here; only its baked-in effect is ported.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/jaws/Jaws.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/jaws/JawsFlags.java
 */
export const BLOCK_E1_NEWLINE = '';
export const BLOCK_E1_NEWLINE_LEFT_ALIGN = '';
export const BLOCK_E1_NEWLINE_RIGHT_ALIGN = '';
export const BLOCK_E1_BREAKLINE = '';
export const BLOCK_E1_REAL_BACKSLASH = '';
export const BLOCK_E1_REAL_TABULATION = '';

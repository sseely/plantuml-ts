/**
 * Local, minimal stand-in for the private-use Unicode sentinels
 * `net.sourceforge.plantuml.jaws.Jaws` defines for its Creole/Display-layer
 * newline and escape handling. That package is out of this batch's write-set
 * (`src/core/tim/builtin/` only) and out of scope entirely -- no file here
 * calls anything on `Jaws` beyond these six `char` constants, following this
 * codebase's established narrow-local-duplicate precedent (see
 * `VariableManager.ts`'s `isLetterOrEmojiOrUnderscoreOrDigit`).
 *
 * `JawsFlags.USE_BLOCK_E1_IN_NEWLINE_FUNCTION` is a compile-time constant
 * upstream, and `Newline`/`NewlineShort`/`Breakline` each carry BOTH branches
 * (`BLOCK_E1_*` when true, a real `"\n"` when false). Batch SI5a-4 sets it
 * FALSE here -- upstream's own legacy branch -- because the BLOCK_E1 sentinels
 * are only meaningful to the Jaws/Creole display layer, which this port does
 * not have: a sentinel would survive into the SVG as an invisible private-use
 * character instead of a line break. The `false` branch produces a real
 * newline, which `TContext#applyFunctionsAndVariablesInternal` then splits into
 * separate lines -- exactly what the pre-TIM preprocessor did with `%n()`, and
 * what `tests/unit/preprocessor.test.ts` pins.
 *
 * `Jaws.BLOCK_E1_NEWLINE` itself is still used, by `TContext#extractFromResultList`
 * (`%retrieve_procedure`'s multi-line capture), where upstream uses it as an
 * in-line separator that must NOT split the source line.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/jaws/Jaws.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/jaws/JawsFlags.java
 */
/** @see ~/git/plantuml/.../jaws/JawsFlags.java#USE_BLOCK_E1_IN_NEWLINE_FUNCTION */
export const USE_BLOCK_E1_IN_NEWLINE_FUNCTION = false;

export const BLOCK_E1_NEWLINE = '';
export const BLOCK_E1_NEWLINE_LEFT_ALIGN = '';
export const BLOCK_E1_NEWLINE_RIGHT_ALIGN = '';
export const BLOCK_E1_BREAKLINE = '';
export const BLOCK_E1_REAL_BACKSLASH = '';
export const BLOCK_E1_REAL_TABULATION = '';

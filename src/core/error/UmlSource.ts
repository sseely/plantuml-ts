/**
 * The diagram's own lines — `@start…` through `@end…` — sliced out of the raw
 * input. Upstream's `BlockUmlBuilder` does this scan while reading, and hands
 * the slice to `BlockUml`, which is what every `PSystemError` receives as its
 * `UmlSource`.
 *
 * Only one thing reads it here: `PSystemError#getTotalLineCountLessThan5`,
 * which decides whether the Welcome block is stacked on top of the error
 * (live-oracle verified: a 4-line source shows it, a 7-line one does not). So
 * the slice has to be the BLOCK's lines, not the raw split of the source
 * string — a trailing newline alone would otherwise push a 4-line diagram to 5
 * and silently drop the Welcome block.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/BlockUmlBuilder.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/utils/StartUtils.java
 */

import type { StringLocated } from '../tim/StringLocated.js';

/** @see ~/git/plantuml/.../utils/StartUtils.java#isArobaseStartDiagram */
const RE_START = /^\s*@start\w+/iu;
/** @see ~/git/plantuml/.../utils/StartUtils.java#isArobaseEndDiagram */
const RE_END = /^\s*@end\w+/iu;

/**
 * The first `@start…`/`@end…` block of `input`, inclusive of both directives.
 * Falls back to the whole input when the document has no `@start` (an
 * unterminated block keeps everything from `@start` onwards).
 */
export function umlSourceOf(input: readonly StringLocated[]): readonly StringLocated[] {
  const start = input.findIndex((s) => RE_START.test(s.getString()));
  if (start === -1) return input;

  const end = input.findIndex((s, i) => i > start && RE_END.test(s.getString()));
  return input.slice(start, end === -1 ? input.length : end + 1);
}

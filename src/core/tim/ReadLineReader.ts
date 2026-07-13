/**
 * Raw text -> the `StringLocated` list the interpreter executes.
 *
 * `ReadLineReader.java:99-102`: strip a leading BOM and normalize the en-dash
 * (U+2013) to a hyphen on every line, before any parsing. Upstream is a
 * `Reader` decorator pulling one line at a time; this port has the whole string
 * in hand (browser-safe `src/`: no streams, no blocking I/O), so it is a
 * function.
 *
 * Two callers, matching upstream's two `ReadLineReader.create` overloads:
 * `preprocess()` (top-level source, description `"string"` — what upstream's
 * `SourceStringReader` passes to `BlockUmlBuilder` — and no parent) and
 * `IncludeExecutor` (included content, described by the include target and
 * parented on the location of the `!include` line that pulled it in; upstream:
 * `ReadLineReader.create(reader, what, s.getLocation())`).
 *
 * Batch SI6: each produced line now carries a REAL `LineLocationImpl` — a
 * `(description, parent, position)` triple advanced by `oneLineRead()` exactly
 * as upstream's reader advances it — instead of the bare array index (or, for
 * included content, the *parent's* location repeated on every line, which gave
 * an included line no position of its own). The error diagram reads it back to
 * print `[From <description> (line N) ]`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/ReadLineReader.java
 */

import type { LineLocation } from './LineLocation.js';
import { LineLocationImpl } from './LineLocationImpl.js';
import { StringLocated } from './StringLocated.js';

/**
 * The description upstream's `SourceStringReader` gives a diagram read from a
 * string — the text that surfaces in the error diagram's `[From string (line
 * N) ]` header.
 * @see ~/git/plantuml/.../SourceStringReader.java
 */
export const SOURCE_STRING_DESCRIPTION = 'string';

/**
 * @param description the resource the lines came from (defaults to `"string"`,
 *                    upstream's description for source read from a string).
 * @param parent      location of the `!include` line that pulled this resource
 *                    in; omitted at the top level.
 */
export function readLines(
  source: string,
  description: string = SOURCE_STRING_DESCRIPTION,
  parent?: LineLocation,
): StringLocated[] {
  let location = new LineLocationImpl(description, parent);
  return source
    .replace(/\u2013/gu, '-')
    .replace(/^\uFEFF/u, '')
    .split('\n')
    .map((text) => {
      location = location.oneLineRead();
      return new StringLocated(text, location);
    });
}

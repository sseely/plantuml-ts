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
 * `preprocess()` (top-level source, no parent location) and `IncludeExecutor`
 * (included content, which carries the location of the `!include` line that
 * pulled it in -- upstream: `ReadLineReader.create(reader, what,
 * s.getLocation())`).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/ReadLineReader.java
 */

import { StringLocated, type LineLocation } from './StringLocated.js';

/**
 * @param location parent location for every produced line; when omitted, each
 *                 line is located by its own 0-based index in `source`.
 */
export function readLines(source: string, location?: LineLocation): StringLocated[] {
  return source
    .replace(/\u2013/gu, '-')
    .replace(/^\uFEFF/u, '')
    .split('\n')
    .map((text, i) => new StringLocated(text, location === undefined ? i : location));
}

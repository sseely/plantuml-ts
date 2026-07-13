/**
 * The error diagram for a document that parsed but said nothing — the jar's
 * `Empty description`. Live-oracle verified: an `!ifdef` whose condition is
 * false and which is never closed swallows the rest of the document, and the
 * jar reports exactly this (NOT an if-related error — see `CodeIteratorIf`).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/error/PSystemErrorEmpty.java
 */

import type { StringLocated } from '../tim/StringLocated.js';
import type { ErrorUml } from './ErrorUml.js';
import { PSystemError } from './PSystemError.js';

export class PSystemErrorEmpty extends PSystemError {
  constructor(
    source: readonly StringLocated[],
    trace: readonly StringLocated[],
    singleError: ErrorUml,
  ) {
    super(source, trace, singleError);
  }
}

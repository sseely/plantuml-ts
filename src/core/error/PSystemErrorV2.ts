/**
 * The general error diagram: a parser (or any later stage) failed on a line,
 * and the failure is reported against the lines executed so far.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/error/PSystemErrorV2.java
 */

import type { StringLocated } from '../tim/StringLocated.js';
import type { ErrorUml } from './ErrorUml.js';
import { PSystemError } from './PSystemError.js';

export class PSystemErrorV2 extends PSystemError {
  private readonly rootCause: unknown;

  constructor(
    source: readonly StringLocated[],
    trace: readonly StringLocated[],
    singleError: ErrorUml,
    rootCause?: unknown,
  ) {
    super(source, trace, singleError);
    this.rootCause = rootCause;
  }

  /** @see ~/git/plantuml/.../error/PSystemErrorV2.java#getRootCause */
  getRootCause(): unknown {
    return this.rootCause;
  }

  override toString(): string {
    return `PSystemErrorV2 ${this.singleError.toString()}`;
  }
}

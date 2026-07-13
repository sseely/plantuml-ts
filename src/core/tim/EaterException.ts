/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterException.java
 */

import type { LineLocation } from './StringLocated.js';

/**
 * `location`'s type is intentionally the minimal structural shape
 * (`{ getLocation(): LineLocation }`), not the concrete `StringLocated`
 * class (`./StringLocated.js`): this exception is constructed from BOTH
 * `tim/`'s own files (passing a real `StringLocated` instance) and
 * `tim/expression/`'s files (`ShuntingYard`, `TokenStack`,
 * `ReversePolishInterpretor`), which pass their own narrower structural
 * `StringLocated` (see `expression/Knowledge.ts`'s file header for why
 * that package keeps a narrower stand-in) -- including plain duck-typed
 * test doubles. `EaterException` itself never calls anything on `location`
 * beyond storing and returning it, so the narrowest shape that satisfies
 * every caller is also the most correct one here.
 */
interface HasLocation {
  getLocation(): LineLocation;
}

/**
 * Upstream extends the checked `java.lang.Exception`; TS has no checked
 * exceptions, so this is a thrown `Error` subclass per this port's
 * translation table.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterException.java
 */
export class EaterException extends Error {
  private readonly location: HasLocation;

  /**
   * Upstream guards both constructor args with `Objects.requireNonNull`
   * (a deliberate assertion, not incidental null-safety noise) -- ported
   * verbatim rather than dropped, per this port's don't-refactor-while-
   * porting discipline.
   */
  constructor(message: string, location: HasLocation) {
    if (message === null || message === undefined) throw new TypeError('message must not be null/undefined');
    if (location === null || location === undefined) throw new TypeError('location must not be null/undefined');

    super(message);
    this.name = 'EaterException';
    this.location = location;
  }

  getMessage(): string {
    return this.message;
  }

  getLocation(): HasLocation {
    return this.location;
  }
}

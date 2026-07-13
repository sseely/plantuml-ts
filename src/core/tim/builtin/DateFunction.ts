/**
 * `%date([pattern[, epochSeconds[, timeZoneId]]])` -- formats a date/time.
 * With no arguments, returns `new Date(nowMillis).toString()` (matching
 * upstream's `new Date().toString()`, but sourced from the injected clock,
 * never a live read). See `date-format.ts` for the disclosed pattern-letter
 * subset.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/DateFunction.java
 */

import { TValue } from '../expression/TValue.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { TimEnvironment } from './TimEnvironment.js';
import { formatDate } from './date-format.js';

const SIGNATURE = new TFunctionSignature('%date', 3);

export class DateFunction extends SimpleReturnFunction {
  constructor(private readonly env: TimEnvironment) {
    super();
  }

  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 0 || nbArg === 1 || nbArg === 2 || nbArg === 3;
  }

  /** @throws EaterException for an unrecognized time zone or an invalid pattern. */
  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    if (values.length === 0) return TValue.fromString(new Date(this.env.clock.nowMillis()).toString());

    const format = values[0]!.toString();
    const epochMillis = values.length >= 2 ? 1000 * values[1]!.toInt() : this.env.clock.nowMillis();
    const timeZone = values.length === 3 ? values[2]!.toString() : Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      return TValue.fromString(formatDate(epochMillis, format, timeZone));
    } catch {
      throw new EaterException(`Unknown time zone: ${timeZone}`, location);
    }
  }
}

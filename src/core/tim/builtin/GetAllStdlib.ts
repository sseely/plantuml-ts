/**
 * `%get_all_stdlib()` -- JSON array of stdlib folder names; with one
 * (ignored-value) argument, a JSON object mapping folder name to
 * `{name, version, source}`. Upstream marks this `@Deprecated` in favor of
 * `%get_stdlib()`; ported as-is (deprecation preserved as a doc note, not a
 * behavior change).
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/GetAllStdlib.java
 */

import { TValue } from '../expression/TValue.js';
import type { JsonValue } from '../expression/Token.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { TimEnvironment } from './TimEnvironment.js';
import type { JsonObj } from './json-utils.js';

const SIGNATURE = new TFunctionSignature('%get_all_stdlib', 1);

/** @deprecated in favor of `%get_stdlib()` -- ported unchanged. */
export class GetAllStdlib extends SimpleReturnFunction {
  constructor(private readonly env: TimEnvironment) {
    super();
  }

  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 0 || nbArg === 1;
  }

  /** @throws EaterException if called with more than 1 argument (unreachable given `canCover`). */
  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    if (values.length === 0) {
      const result: JsonValue[] = [...this.env.listStdlibFolderNames()];
      return TValue.fromJson(result);
    }
    if (values.length === 1) {
      const result: JsonObj = {};
      for (const name of this.env.listStdlibFolderNames()) {
        const meta = this.env.getStdlibMetadata(name);
        if (meta === undefined) continue;
        result[name] = { name, version: meta.version, source: meta.source };
      }
      return TValue.fromJson(result);
    }

    throw new EaterException('Error on get_all_stdlib: Too many arguments', location);
  }
}

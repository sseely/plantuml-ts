/**
 * `%get_stdlib([folderName[, key]])` -- with no arguments, a JSON object
 * mapping every stdlib folder name to its metadata entries; with one, the
 * metadata entries for that folder; with two, a single metadata value (key
 * lookup falls back to the uppercased key if the lowercase form is absent,
 * matching upstream's "temporary" dual-case check).
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/GetStdlib.java
 */

import { TValue } from '../expression/TValue.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { TimEnvironment } from './TimEnvironment.js';
import type { JsonObj } from './json-utils.js';

const SIGNATURE = new TFunctionSignature('%get_stdlib', 1);

function entriesToJsonObj(entries: ReadonlyMap<string, string>): JsonObj {
  const result: JsonObj = {};
  for (const [k, v] of entries) result[k] = v;
  return result;
}

export class GetStdlib extends SimpleReturnFunction {
  constructor(private readonly env: TimEnvironment) {
    super();
  }

  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 0 || nbArg === 1 || nbArg === 2;
  }

  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    _location: unknown,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    if (values.length === 0) {
      const result: JsonObj = {};
      for (const folderName of this.env.listStdlibFolderNames()) {
        const meta = this.env.getStdlibMetadata(folderName);
        if (meta !== undefined) result[folderName] = entriesToJsonObj(meta.entries);
      }
      return TValue.fromJson(result);
    }

    const folderName = values[0]!.toString();
    const meta = this.env.getStdlibMetadata(folderName);
    if (values.length === 1) return TValue.fromJson(meta === undefined ? {} : entriesToJsonObj(meta.entries));

    const key = values[1]!.toString().toLowerCase();
    const value = meta?.entries.get(key) ?? meta?.entries.get(key.toUpperCase()) ?? '';
    return TValue.fromString(value);
  }
}

/**
 * `%load_json(path[, defaultJson[, charset]])` -- loads JSON from a file,
 * `http(s)://` URL, or (via `<name>`/`>name>` bracket syntax) a stdlib
 * resource, falling back to `defaultJson` (default `"{}"`) when the source
 * is unreachable or empty.
 *
 * All actual I/O (`SFile`/`SURL`/`Stdlib#getJsonResource` upstream) is
 * routed through the injected {@link TimEnvironment} seam -- `src/` must
 * not touch `fs`/`fetch` directly (CLAUDE.md: browser-safe rendering path).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/LoadJson.java
 */

import { TValue } from '../expression/TValue.js';
import type { JsonValue } from '../expression/Token.js';
import type { StringLocated } from '../StringLocated.js';
import { TFunctionSignature } from '../TFunctionSignature.js';
import { EaterException } from '../EaterException.js';
import { SimpleReturnFunction } from './SimpleReturnFunction.js';
import type { TimEnvironment } from './TimEnvironment.js';

const SIGNATURE = new TFunctionSignature('%load_json', 3);
const DEFAULT_CHARSET = 'UTF-8';
const DEFAULT_JSON = '{}';

function getDefaultJson(values: readonly TValue[]): string {
  return values.length > 1 ? values[1]!.toString() : DEFAULT_JSON;
}

function getCharset(values: readonly TValue[]): string {
  return values.length === 3 ? values[2]!.toString() : DEFAULT_CHARSET;
}

export class LoadJson extends SimpleReturnFunction {
  constructor(private readonly env: TimEnvironment) {
    super();
  }

  getSignature(): TFunctionSignature {
    return SIGNATURE;
  }

  canCover(nbArg: number, _namedArguments: ReadonlySet<string>): boolean {
    return nbArg === 1 || nbArg === 2 || nbArg === 3;
  }

  /** @throws EaterException if the resolved source's text is not valid JSON. */
  executeReturnFunction(
    _context: unknown,
    _memory: unknown,
    location: StringLocated,
    values: readonly TValue[],
    _named: ReadonlyMap<string, TValue>,
  ): TValue {
    const path = values[0]!.toString();
    try {
      const data = this.loadJsonData(path, getCharset(values));
      if (data !== undefined) return TValue.fromJson(data);

      return TValue.fromJson(JSON.parse(getDefaultJson(values)) as JsonValue);
    } catch (e) {
      if (e instanceof SyntaxError)
        throw new EaterException(`JSON parse issue in source ${path}: ${e.message}`, location);
      throw e;
    }
  }

  /** `<name>` / `>name>` -> stdlib resource; else file/URL text via the seam. */
  private loadJsonData(path: string, charset: string): JsonValue | undefined {
    if (path.startsWith('<') || path.startsWith('>')) {
      const name = path.substring(1, path.length - 1);
      return this.env.getStdlibJsonResource(name);
    }

    const text = this.env.loadTextResource(path, charset);
    if (text === undefined || text.length === 0) return undefined;

    return JSON.parse(text) as JsonValue;
  }
}

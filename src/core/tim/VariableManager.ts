/**
 * Resolves `$varname` references inline within a source line, including
 * JSON field/index-access suffixes (`$obj.field`, `$arr[0]`).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/VariableManager.java
 */

import type { JsonValue } from './expression/Token.js';
import { StringLocated } from './StringLocated.js';
import type { TMemory } from './TMemory.js';
import type { TContext } from './TFunction.js';
import { EaterException } from './EaterException.js';

/**
 * Local, minimal duplicate of the one `TLineType` predicate this file
 * needs (`isLetterOrEmojiOrUnderscoreOrDigit`). `TLineType`'s home package
 * (`text/`) is out of this batch's scope (see `StringLocated.ts`'s file
 * header); `tim/expression/TokenType.ts` (Batch 1, not in this batch's
 * write-set) independently duplicates the sibling predicates it needs the
 * same way, so this follows established project precedent rather than
 * introducing a new shared module for a 6-line pure function.
 * @see ~/git/plantuml/.../text/TLineType.java#isLetterOrEmojiOrUnderscoreOrDigit
 */
function isLetterOrEmojiOrUnderscoreOrDigit(ch: string): boolean {
  if (ch === '') return false;
  const code = ch.charCodeAt(0);
  const isEmoji = code >= 0xd800 && code <= 0xdfff;
  return /\p{L}/u.test(ch) || ch === '_' || (ch >= '0' && ch <= '9') || isEmoji;
}

export class VariableManager {
  private readonly memory: TMemory;
  private readonly context: TContext;
  private readonly location: StringLocated;

  constructor(context: TContext, memory: TMemory, location: StringLocated) {
    this.memory = memory;
    this.context = context;
    this.location = location;
  }

  /**
   * Upstream mutates a `StringBuilder result` in place; this port takes the
   * same mutable-wrapper adaptation used elsewhere in this codebase for
   * ported `StringBuilder` parameters (a one-field `{ value }` box), since
   * TS has no pass-by-reference primitive/string.
   * @throws EaterException (thrown, not returned) on JSON access errors.
   */
  replaceVariables(str: string, i: number, result: { value: string }): number {
    const presentVariable = this.getVarnameAt(str, i);
    if (presentVariable === undefined) throw new Error('presentVariable must not be null (see getVarnameAt contract)');
    if (result.value.endsWith('##')) result.value = result.value.slice(0, -2);

    const value = this.memory.getVariable(presentVariable);
    if (value === undefined) throw new Error(`Unknown variable: ${presentVariable}`);

    let pos = i + presentVariable.length - 1;
    if (value.isJson()) {
      const json = value.toJson();
      if (typeof json === 'string') {
        result.value += json;
      } else if (typeof json === 'number') {
        result.value += String(json);
      } else {
        pos++;
        pos = this.replaceJson(json, str, pos, result) - 1;
      }
    } else {
      result.value += value.toString();
    }
    if (pos + 2 < str.length && str.charAt(pos + 1) === '#' && str.charAt(pos + 2) === '#') pos += 2;

    return pos;
  }

  /** @throws EaterException (thrown, not returned) on JSON access errors. */
  private replaceJson(jsonValueIn: JsonValue | undefined, str: string, iIn: number, result: { value: string }): number {
    let jsonValue = jsonValueIn;
    let i = iIn;
    while (i < str.length) {
      const n = str.charAt(i);
      if (n === '.') {
        i++;
        let fieldName = '';
        while (i < str.length) {
          if (!/[\p{L}\p{N}_$]/u.test(str.charAt(i))) break;

          fieldName += str.charAt(i);
          i++;
        }
        jsonValue =
          jsonValue !== null && typeof jsonValue === 'object' && !Array.isArray(jsonValue)
            ? jsonValue[fieldName]
            : undefined;
      } else if (n === '[') {
        i++;
        let inBracket = '';
        let level = 0;
        while (true) {
          if (str.charAt(i) === '[') level++;
          if (str.charAt(i) === ']') {
            if (level === 0) break;
            level--;
          }
          inBracket += str.charAt(i);
          i++;
        }
        const nbString = this.context.applyFunctionsAndVariables(
          this.memory,
          new StringLocated(inBracket, this.location.getLocation()),
        ) ?? '';
        if (Array.isArray(jsonValue)) {
          const nb = Number.parseInt(nbString, 10);
          jsonValue = jsonValue[nb];
        } else if (jsonValue !== null && typeof jsonValue === 'object') {
          jsonValue = jsonValue[nbString];
        } else {
          throw new EaterException('Major parsing error', this.location);
        }

        if (jsonValue === undefined) throw new EaterException('Data parsing error', this.location);

        i++;
      } else {
        break;
      }
    }
    if (jsonValue !== undefined) {
      result.value += typeof jsonValue === 'string' ? jsonValue : JSON.stringify(jsonValue);
    }
    return i;
    // #lizard forgives -- faithful port of VariableManager#replaceJson's
    // dot/bracket-access dispatch loop, mirroring upstream verbatim.
  }

  /**
   * Java `null` (no variable name at `pos`) -> `undefined`.
   * @see ~/git/plantuml/.../tim/VariableManager.java#getVarnameAt
   */
  getVarnameAt(s: string, pos: number): string | undefined {
    const justAfterALetter =
      pos > 0 && isLetterOrEmojiOrUnderscoreOrDigit(s.charAt(pos - 1)) && !VariableManager.justAfterBackslashN(s, pos);
    if (justAfterALetter && s.charAt(pos) !== '$') return undefined;

    const varname = this.memory.variablesNames3().getLonguestMatchStartingIn(s, pos);
    if (varname.length === 0) return undefined;

    if (pos + varname.length === s.length || !isLetterOrEmojiOrUnderscoreOrDigit(s.charAt(pos + varname.length)))
      return varname;

    return undefined;
  }

  static justAfterBackslashN(s: string, pos: number): boolean {
    return pos > 1 && s.charAt(pos - 2) === '\\' && s.charAt(pos - 1) === 'n';
  }
}

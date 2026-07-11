/**
 * Parses a `!procedure` / `!unquoted procedure` / `!final procedure`
 * declaration header line into its name, parameter list, and flags. Body
 * collection (buffering lines until `!endprocedure`) is the caller's
 * responsibility (`preprocessor.ts`) since it spans multiple source lines.
 *
 * @see ~/git/plantuml/.../tim/EaterDeclareProcedure.java
 * @see ~/git/plantuml/.../tim/Eater.java#eatDeclareFunction (shared by
 *   declare-procedure and declare-function; procedures pass
 *   `allowNoParenthesis=false`, so `()` is required even for zero-arg
 *   procedures — matches every fixture in this port's corpus).
 */

import type { TProcedureParam } from './FunctionsSet.js';
import { splitTopLevel } from './split-top-level.js';

export interface DeclareProcedureHeader {
  readonly name: string;
  readonly params: readonly TProcedureParam[];
  readonly unquoted: boolean;
  readonly finalFlag: boolean;
}

// `EaterDeclareProcedure#analyze` loops `while (peekUnquoted() || peekFinal())`,
// so `unquoted`/`final` may appear zero or more times, in either order,
// before the required `procedure` keyword.
const RE_HEADER =
  /^!((?:(?:unquoted|final)\s+)*)procedure\s+([$A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*$/i;

export function parseDeclareProcedureHeader(line: string): DeclareProcedureHeader | null {
  const match = RE_HEADER.exec(line.trim());
  if (match === null) return null;

  const flags = match[1]!.toLowerCase();
  return {
    name: match[2]!,
    params: splitTopLevel(match[3]!, ',').map(parseParam),
    unquoted: /\bunquoted\b/.test(flags),
    finalFlag: /\bfinal\b/.test(flags),
  };
}

function parseParam(raw: string): TProcedureParam {
  const eq = raw.indexOf('=');
  if (eq === -1) return { name: raw.trim() };
  return { name: raw.slice(0, eq).trim(), defaultValue: raw.slice(eq + 1).trim() };
}

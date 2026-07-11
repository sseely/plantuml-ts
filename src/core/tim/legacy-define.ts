/**
 * Legacy `!define`/`!definelong` macro table — arity-keyed overload storage
 * and call-site expansion. Extracted from preprocessor.ts (line cap) since
 * these are pure functions over an explicit `activeDefines` map.
 *
 * Mirrors upstream's arity-keyed function registry: `!define`/`!definelong`
 * compile to a `TFunctionImpl` registered in `functionsSet` under
 * `TFunctionSignature(name, nbArg)` (EaterLegacyDefine.java /
 * EaterLegacyDefineLong.java → Eater#eatDeclareFunction, TContext.java:888
 * `isLegacyDefine`) — the SAME arity-keyed registry `!procedure`/`!function`
 * use (`FunctionsSet.ts`), not the flat name-only map the legacy standalone
 * `Defines.java` class used. Two `!define`/`!definelong` blocks sharing a
 * name but differing in parameter COUNT are independent overloads, not
 * redefinitions of one another.
 *
 * @see ~/git/plantuml/.../tim/FunctionsSet.java
 * @see ~/git/plantuml/.../tim/TFunctionSignature.java
 */

import { findCallStart, parseCallArgs } from './EaterFunctionCall.js';
import { dequote } from './split-top-level.js';

export type SimpleDef = { kind: 'simple'; value: string };
export type ParamDef = { kind: 'parametric'; params: string[]; body: string };
export type Define = SimpleDef | ParamDef;

/** Fixed-point cap for nested macro-call expansion in `applyDefines` — see
 *  its doc for why a single pass is not enough. */
const MAX_DEFINE_PASSES = 20;

/**
 * Register a `!define`/`!definelong` under its name, replacing any existing
 * overload of the SAME arity (a simple define's "arity" is the sentinel -1,
 * so a bare `!define NAME value` still fully replaces an earlier bare
 * `!define NAME`), while leaving other-arity overloads of the same name
 * intact.
 */
export function registerDefine(
  activeDefines: Map<string, Define[]>,
  name: string,
  def: Define,
): void {
  const arity = def.kind === 'parametric' ? def.params.length : -1;
  const existing = activeDefines.get(name) ?? [];
  const kept = existing.filter(
    (d) => (d.kind === 'parametric' ? d.params.length : -1) !== arity,
  );
  kept.push(def);
  activeDefines.set(name, kept);
}

/** Split a `!define`/`!definelong` header's raw parenthesized parameter list
 *  on commas, trimming whitespace and dropping empty segments (a bare `()`
 *  is zero params, not one blank param). */
export function splitDefineParams(raw: string): string[] {
  return raw.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Simple defines: whole-word token replacement (word-boundary matching). */
function applySimpleDefines(activeDefines: Map<string, Define[]>, line: string): string {
  let result = line;
  for (const [token, defs] of activeDefines) {
    const def = defs.find((d): d is SimpleDef => d.kind === 'simple');
    if (def === undefined) continue;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), def.value);
  }
  return result;
}

/** Substitute a call's argument values into a matched overload's body. A
 *  param placeholder may appear `##`-decorated on either or both sides
 *  (`##x##`, `##x`, `x##`) or fully bare (`x`) — mirrors upstream's
 *  four-way alternation (`Variables.applyOn`:
 *  `(##x##)|(##x\b)|(\bx##)|(\bx\b)`). The `##` markers, when present, are
 *  CONSUMED by the match (they never appear in output); a bare occurrence
 *  substitutes just the word. Each raw argument is dequoted first —
 *  upstream's call-site capture strips the surrounding quotes before
 *  splicing into the body template, which is why bodies like
 *  `"x" o-up-> "x::y"` re-supply their OWN literal quotes around the bare
 *  placeholder. */
function substituteBody(def: ParamDef, rawArgs: readonly string[]): string {
  let body = def.body;
  for (let i = 0; i < def.params.length; i++) {
    const value = dequote(rawArgs[i] ?? '');
    const p = def.params[i]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`##${p}##|##${p}\\b|\\b${p}##|\\b${p}\\b`, 'g');
    body = body.replace(pattern, () => value);
  }
  return body;
}

/**
 * Parametric defines: replace MACRO(arg1,arg2,...) call-sites with the
 * macro body after substituting param placeholders. Argument lists are
 * parsed with the same quote/paren-balanced scanner the `!procedure` family
 * uses (`findCallStart`/`parseCallArgs`) rather than a naive comma-split, so
 * an argument that itself contains commas or parens inside quotes (e.g. a
 * quoted C++ template type) is captured as ONE argument, not split apart.
 * The overload whose PARAMETER COUNT matches the call site's parsed
 * argument count wins (`registerDefine`'s per-arity overload list); a call
 * matching no declared overload's arity is left as literal text.
 *
 * Scans and rewrites the whole line in one left-to-right pass so multiple
 * call sites on one line are all handled without relying on the outer
 * fixed-point loop (which still matters for a NESTED call appearing inside
 * a just-substituted body — that only becomes findable on the next pass).
 */
function applyParametricDefines(activeDefines: Map<string, Define[]>, line: string): string {
  const names = [...activeDefines.keys()].filter((name) =>
    activeDefines.get(name)!.some((d) => d.kind === 'parametric'),
  );
  if (names.length === 0) return line;

  let out = '';
  let rest = line;
  for (;;) {
    const match = findCallStart(rest, names);
    if (match === null) return out + rest;

    const parsed = parseCallArgs(rest, match.start, match.name);
    if (parsed === null) {
      // Unbalanced parens — treat "name(" as literal text and keep scanning.
      const cut = match.start + match.name.length + 1;
      out += rest.slice(0, cut);
      rest = rest.slice(cut);
      continue;
    }

    out += rest.slice(0, match.start);
    const overloads = activeDefines.get(match.name)!.filter((d): d is ParamDef => d.kind === 'parametric');
    const def = overloads.find((d) => d.params.length === parsed.rawArgs.length);
    out += def === undefined ? rest.slice(match.start, parsed.end) : substituteBody(def, parsed.rawArgs);
    rest = rest.slice(parsed.end);
  }
}

/**
 * Apply all active !define substitutions to a line, to a fixed point: a
 * macro body may itself call another macro (`genClassTypedef`'s body calls
 * `genArrowTypedef(...)`, whose own body calls `assocStereotype(...)`) —
 * upstream's TIM evaluator is a real recursive interpreter, so nested calls
 * resolve to arbitrary depth. `MAX_DEFINE_PASSES` bounds the equivalent here
 * against a runaway self-referential define.
 *
 * Order within one pass matches Java's Defines.applyDefines: simple first,
 * then parametric.
 */
export function applyDefines(activeDefines: Map<string, Define[]>, line: string): string {
  let result = line;
  for (let pass = 0; pass < MAX_DEFINE_PASSES; pass++) {
    const before = result;
    result = applyParametricDefines(activeDefines, applySimpleDefines(activeDefines, result));
    if (result === before) break;
  }
  return result;
}

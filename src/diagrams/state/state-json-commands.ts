/**
 * `json` declaration commands for the state diagram parser (mission A4
 * Phase L iteration 20 — maruju-55-soko478, `CommandCreateJson` +
 * `CommandCreateJsonSingleLine` + `BodierJSon`).
 *
 * `StateDiagramFactory` registers these VERBATIM from the shared
 * `objectdiagram.command` package — the SAME classes `ClassDiagramFactory`
 * registers, not a state-specific reimplementation (mirrors this project's
 * `CommandRemoveRestore` precedent, `.agent-notes/A4-phase-L-iter13-
 * transition-grammar-singles.md`). The header grammar (`NameAndCodeParser
 * .nameAndCode()` + `StereotypePattern.optional` + `UrlBuilder.OPTIONAL` +
 * `ColorParser.exp1()`) and the hand-rolled order-preserving JSON body
 * parser are therefore MIRRORED from the class engine's own already-ported
 * copy (`class-json-commands.ts`) rather than reimplemented from scratch or
 * imported across engines (this project's D1 precedent) — only the
 * entity-creation plumbing differs (state's scope-stack `declareState`/
 * `makeState` in place of class's flat `Classifier` index).
 *
 * Multiline body lines are collected via `ps.pendingJson`
 * (state-parse-state.ts) — parser.ts's per-line loop intercepts them BEFORE
 * `dispatchCommand`, the same architecture `pendingNote` already uses for
 * multi-line note blocks. This is load-bearing, not a style choice: a json
 * body line (a quoted key, colon, quoted value) also happens to match rule
 * 15's generic CODE-colon-text standalone-description-line pattern
 * (state-commands.ts) — without the pre-dispatch interception, that line
 * silently auto-creates a BOGUS state from the key text instead of becoming
 * this json leaf's own field (the exact bug this iteration fixes; see the
 * mission's decision-journal entry for the diagnosis).
 *
 * This file contains ZERO raw double-quote glyphs (code OR comments) — see
 * `state-commands-declarations.ts`'s `DQUOTE` doc for why (the project's
 * lizard complexity hook desyncs on an unescaped double-quote character,
 * mis-scoping this file's own trailing `Command[]`-array-of-methods span,
 * the exact shape that first exposed the bug).
 *
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateJson.java
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateJsonSingleLine.java
 * @see ~/git/plantuml/.../cucadiagram/BodierJSon.java
 * @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java:115-116 (registration)
 * @see src/diagrams/class/class-json-commands.ts (the class engine's own copy)
 */

import type { State } from './ast.js';
import type { JsonNode } from './state-json-ast.js';
import type { Command } from './state-commands.js';
import { type ParseState, type Pass, makeState } from './state-parse-state.js';
import { declareState } from './state-parse-resolve.js';

/** A literal double-quote character via unicode escape. */
const DQUOTE = '\u0022';

// ---------------------------------------------------------------------------
// Header grammar (NameAndCodeParser.nameAndCode() + ColorParser.exp1()) —
// mirrors class-json-commands.ts's own already-verified port of the SAME
// shared upstream grammar (both engines' json commands call the identical
// static methods), not state's own approximate ID_ALT/COLOR_OPT fragments
// (state-commands-declarations.ts) which target CommandCreateState's
// different CODE1-4 grammar.
// ---------------------------------------------------------------------------

/** Upstream CODE = `[^%s{}%g<>]+`. */
const CODE = '[^\\s{}' + DQUOTE + '<>]+';

/**
 * `NameAndCodeParser.nameAndCode()`'s four ordered alternatives. Capture
 * groups: 1 DISPLAY1, 2 CODE1, 3 CODE2, 4 DISPLAY2, 5 CODE3, 6 CODE4.
 */
const NAME_AND_CODE =
  '(?:' +
  DQUOTE + '([^' + DQUOTE + ']*)' + DQUOTE + '\\s+as\\s+(' + CODE + ')' +
  '|(' + CODE + ')\\s+as\\s+' + DQUOTE + '([^' + DQUOTE + ']*)' + DQUOTE +
  '|(' + CODE + ')' +
  '|' + DQUOTE + '([^' + DQUOTE + ']+)' + DQUOTE +
  ')';

/** Upstream NAME (single-line form) = `(?:[%g]([^%g]+)[%g][%s]+as[%s]+)?
 *  ([%pLN_.]+)`. */
const SINGLE_LINE_NAME = '(?:' + DQUOTE + '([^' + DQUOTE + ']*)' + DQUOTE + '\\s+as\\s+)?([\\w.]+)';

/** StereotypePattern.optional, capture group STEREO. */
const STEREO = '(?:\\s*<<\\s*([^<>]+?)\\s*>>)?';

/** `UrlBuilder.OPTIONAL` — matched and discarded (`State` carries no url
 *  field, same discard convention every other state declaration uses). */
const URL = '(?:\\s*\\[\\[[^\\]]*\\]\\])?';

/** `ColorParser.exp1()` — json has no separate LINECOLOR group, unlike
 *  `state`'s own declaration grammar. */
const COLOR =
  '(#(?:\\w+[-\\\\|/]?\\w+;)?(?:(?:text|back|header|line|line\\.dashed|' +
  'line\\.dotted|line\\.bold|shadowing)(?::\\w+[-\\\\|/]?\\w+)?' +
  '(?:;|(?![\\w;:.])))+|#\\w+[-\\\\|/]?\\w+)?';

/**
 * `json <name-and-code> [<<stereo>>] [[[url]]] [#color] {` — mandatory
 * trailing `{`. Capture groups: 1-6 NAME_AND_CODE, 7 STEREO, 8 COLOR.
 */
export const JSON_MULTILINE_DECL_RE = new RegExp(
  '^json\\s+' + NAME_AND_CODE + STEREO + URL + '\\s*' + COLOR + '\\s*\\{\\s*$',
  'i',
);

/**
 * `json <name> [<<stereo>>] [[[url]]] [#color] <data>` — DATA is captured as
 * ONE group; its actual kind is determined by re-parsing with
 * {@link parseJsonNode} rather than tracking which alternative matched
 * (mirrors class-json-commands.ts's own JSON_SINGLE_LINE_RE doc). Capture
 * groups: 1-2 NAME, 3 STEREO, 4 COLOR, 5 DATA.
 */
export const JSON_SINGLE_LINE_RE = new RegExp(
  '^json\\s+' +
    SINGLE_LINE_NAME +
    STEREO +
    URL +
    '\\s*' +
    COLOR +
    '\\s*(' +
    '(?:true|false)' +
    '|(?:-?\\d+)' +
    '|(?:null)' +
    '|(?:' + DQUOTE + '.*' + DQUOTE + ')' +
    '|(?:\\[.*\\])' +
    '|(?:\\{\\s*' + DQUOTE + '(?:\\\\' + DQUOTE + '|[^' + DQUOTE + '])+' + DQUOTE + '\\s*:.*\\})' +
    ')\\s*$',
  'i',
);

// ---------------------------------------------------------------------------
// Hand-rolled, order-preserving JSON parser — mirrors
// class-json-commands.ts#parseJsonNode verbatim (a plain JS object/array via
// JSON.parse would silently reorder purely-numeric string keys, a real
// hazard for a JSON leaf whose key order is user-visible table row order).
// ---------------------------------------------------------------------------

interface Cursor {
  text: string;
  pos: number;
}

function skipWs(c: Cursor): void {
  while (c.pos < c.text.length && ' \t\r\n'.includes(c.text[c.pos]!)) c.pos++;
}

function parseJsonString(c: Cursor): string {
  c.pos++; // opening quote
  let out = '';
  while (c.pos < c.text.length && c.text[c.pos] !== DQUOTE) {
    const ch = c.text[c.pos]!;
    if (ch === '\\') {
      const esc = c.text[c.pos + 1];
      const map: Record<string, string> = { '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
      if (esc === DQUOTE) {
        out += DQUOTE;
        c.pos += 2;
      } else if (esc !== undefined && esc in map) {
        out += map[esc];
        c.pos += 2;
      } else if (esc === 'u') {
        out += String.fromCharCode(parseInt(c.text.slice(c.pos + 2, c.pos + 6), 16));
        c.pos += 6;
      } else {
        out += ch;
        c.pos++;
      }
    } else {
      out += ch;
      c.pos++;
    }
  }
  c.pos++; // closing quote
  return out;
}

function parseJsonNumber(c: Cursor): number {
  const m = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(c.text.slice(c.pos));
  if (m === null) throw new Error('expected number');
  c.pos += m[0].length;
  return Number(m[0]);
}

function parseJsonObject(c: Cursor): JsonNode {
  c.pos++; // opening brace
  skipWs(c);
  const entries: { key: string; value: JsonNode }[] = [];
  if (c.text[c.pos] === '}') {
    c.pos++;
    return { kind: 'object', entries };
  }
  for (;;) {
    skipWs(c);
    const key = parseJsonString(c);
    skipWs(c);
    if (c.text[c.pos] !== ':') throw new Error('expected colon');
    c.pos++;
    skipWs(c);
    entries.push({ key, value: parseJsonValue(c) });
    skipWs(c);
    if (c.text[c.pos] === ',') { c.pos++; continue; }
    if (c.text[c.pos] === '}') { c.pos++; break; }
    throw new Error('expected comma or closing brace');
  }
  return { kind: 'object', entries };
}

function parseJsonArray(c: Cursor): JsonNode {
  c.pos++; // opening bracket
  skipWs(c);
  const items: JsonNode[] = [];
  if (c.text[c.pos] === ']') {
    c.pos++;
    return { kind: 'array', items };
  }
  for (;;) {
    skipWs(c);
    items.push(parseJsonValue(c));
    skipWs(c);
    if (c.text[c.pos] === ',') { c.pos++; continue; }
    if (c.text[c.pos] === ']') { c.pos++; break; }
    throw new Error('expected comma or closing bracket');
  }
  return { kind: 'array', items };
}

function parseJsonValue(c: Cursor): JsonNode {
  skipWs(c);
  const ch = c.text[c.pos];
  if (ch === '{') return parseJsonObject(c);
  if (ch === '[') return parseJsonArray(c);
  if (ch === DQUOTE) return { kind: 'scalar', value: parseJsonString(c) };
  if (c.text.startsWith('true', c.pos)) { c.pos += 4; return { kind: 'scalar', value: true }; }
  if (c.text.startsWith('false', c.pos)) { c.pos += 5; return { kind: 'scalar', value: false }; }
  if (c.text.startsWith('null', c.pos)) { c.pos += 4; return { kind: 'scalar', value: null }; }
  return { kind: 'scalar', value: parseJsonNumber(c) };
}

/**
 * Parse a complete JSON text into a {@link JsonNode}, or `null` on any
 * malformed input (mirrors `JsonParser#parse` throwing -> `getJsonValue`
 * catching and returning `null`).
 */
export function parseJsonNode(text: string): JsonNode | null {
  try {
    const c: Cursor = { text, pos: 0 };
    const value = parseJsonValue(c);
    skipWs(c);
    if (c.pos !== c.text.length) throw new Error('trailing data');
    return value;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pending multi-line body (parser.ts's per-line pre-dispatch interception —
// mirrors PendingNote/state-notes.ts's own precedent).
// ---------------------------------------------------------------------------

/** Non-null while inside a `json Name { ... }` multi-line body. Holds the
 *  CANONICAL target State object directly (not just its id) — the target
 *  may already have existed (global by-name reuse / pass-TWO replay of the
 *  SAME declaration), so re-resolving by id at the closer would be
 *  redundant at best and a fresh lookup risk at worst; `declareState`'s
 *  return value IS the single source of truth. */
export interface PendingJson {
  target: State;
  lines: string[];
}

/** `CommandCreateJson#END` — one or more whitespace, closing brace, one or
 *  more whitespace, anchored on both ends. */
export function isJsonCloser(line: string): boolean {
  return /^\s*\}\s*$/.test(line);
}

/**
 * Finalize a closed `json { ... }` body (parser.ts's per-line loop, called
 * once with the accumulated raw lines when the closing brace is reached).
 * Mirrors `CommandCreateJson#getJsonString` + `getJsonValue`: body lines are
 * concatenated with NO separator, then wrapped in an outer object literal.
 * On parse failure, upstream retries the SAME concatenation WITHOUT the
 * wrapper — a fallback for a body that already supplies its own outer
 * braces; ported the same way here. `executeNow` creates the leaf entity
 * BEFORE this validation and never removes it on failure — mirrored here by
 * simply leaving `target.jsonValue` unset (see ast.ts's `State.jsonValue`
 * doc).
 */
export function finalizeJsonBody(target: State, rawLines: readonly string[]): void {
  const body = rawLines.join('');
  const wrapped = parseJsonNode('{' + body + '}');
  const value = wrapped ?? parseJsonNode(body);
  if (value !== null) target.jsonValue = value;
}

// ---------------------------------------------------------------------------
// Multiline opener (CommandCreateJson)
// ---------------------------------------------------------------------------

interface JsonMatch {
  rawId: string;
  rawDisplay: string | undefined;
  stereotype: string | undefined;
  color: string | undefined;
}

/** Pulls id/display/stereotype/color out of a {@link JSON_MULTILINE_DECL_RE}
 *  match — mirrors class-json-commands.ts#parseJsonMultilineMatch's
 *  identical NAME_AND_CODE capture layout. */
function parseJsonMultilineMatch(match: RegExpExecArray): JsonMatch {
  const rawCode = match[2] ?? match[3] ?? match[5] ?? match[6];
  const rawDisplay = match[1] ?? match[4];
  return {
    rawId: (rawCode ?? rawDisplay)!,
    rawDisplay,
    stereotype: match[7]?.trim(),
    color: match[8],
  };
}

/**
 * Open a `json Name { ... }` body (`CommandCreateJson#executeArg0` +
 * `executeNow`'s header handling). Uses the SAME `declareState`
 * global-by-name-reuse machinery every other state/frame declaration
 * command uses (mirrors `quarkInContext(true, idShort)`'s reuse-existing-
 * child semantics) rather than upstream's explicit duplicate-name
 * rejection — no fixture in the corpus exercises a duplicate json
 * declaration, and rejecting would break the pass-TWO replay of this SAME
 * opener (declareState's own doc: pass TWO must resolve back to the pass-
 * ONE canonical object, not be treated as a collision).
 */
function applyJsonOpen(ps: ParseState, match: RegExpExecArray, pass: Pass): void {
  const { rawId, rawDisplay, stereotype, color } = parseJsonMultilineMatch(match);
  const s = makeState(rawId, rawDisplay ?? rawId, 'json', {
    ...(color !== undefined ? { color } : {}),
    ...(stereotype !== undefined ? { stereotype } : {}),
  });
  const target = declareState(ps, s, pass);
  ps.pendingJson = { target, lines: [] };
}

// ---------------------------------------------------------------------------
// Single-line command (CommandCreateJsonSingleLine)
// ---------------------------------------------------------------------------

/**
 * Apply one matched `json Name value` line. Content mutation gated to pass
 * ONE — mirrors `declareState`'s own `applyDeclaredContent` pass gate (every
 * other single-line state declaration in this parser follows the same
 * convention), so a pass-TWO replay of this line is a safe no-op re-resolve
 * rather than a double-apply.
 */
function applyJsonSingleLine(ps: ParseState, match: RegExpExecArray, pass: Pass): void {
  const rawDisplay = match[1];
  const rawId = match[2]!;
  const stereotype = match[3]?.trim();
  const color = match[4];
  const dataText = match[5]!;

  const s = makeState(rawId, rawDisplay ?? rawId, 'json', {
    ...(color !== undefined ? { color } : {}),
    ...(stereotype !== undefined ? { stereotype } : {}),
  });
  const target = declareState(ps, s, pass);
  if (pass === 'one') {
    const value = parseJsonNode(dataText);
    if (value !== null) target.jsonValue = value;
  }
}

/**
 * JSON commands — spread into `COMMANDS` (state-commands.ts) right after
 * `NOTE_COMMANDS`, mirroring upstream `StateDiagramFactory.initCommandsList`'s
 * registration order (`CommandCreateJson`/`CommandCreateJsonSingleLine` sit
 * right before `CommonCommands.addCommonCommands1`, well after the note
 * family). `passes: ['one', 'two']` on the multiline opener mirrors the
 * composite/frame opener precedent (state-commands-declarations.ts): the
 * pattern must match — and `ps.pendingJson` must open — on BOTH passes so
 * the body is swallowed regardless of pass; the actual `jsonValue` write is
 * gated to pass ONE at the closer (parser.ts).
 */
export const JSON_COMMANDS: readonly Command[] = [
  { pattern: JSON_MULTILINE_DECL_RE, passes: ['one', 'two'], execute: applyJsonOpen },
  { pattern: JSON_SINGLE_LINE_RE, passes: ['one', 'two'], execute: applyJsonSingleLine },
];

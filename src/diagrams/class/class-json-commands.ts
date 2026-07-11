/**
 * `json` declaration commands for the class diagram parser (mission
 * object-dot-sync Phase L — `CommandCreateJson` + `CommandCreateJsonSingleLine`
 * + `BodierJSon`).
 *
 * Upstream has no separate json-diagram engine for this form (the SEPARATE
 * `@startjson` engine — src/diagrams/json/ — is a different upstream package,
 * jsondiagram/, and is NOT touched here): `ClassDiagramFactory` registers
 * `CommandCreateJson` (118) and `CommandCreateJsonSingleLine` (119) directly
 * alongside `CommandCreateMap` (117), so a `json Name { ... }` / `json Name
 * value` line inside `@startuml` is a class-diagram leaf, exactly like `map`.
 *
 * Multiline body lines are collected via `parser.ts#pendingBodyId` (the same
 * mechanism `map`/`object` bodies use) into `state.pendingJsonLines`, then
 * parsed as ONE JSON blob when the closing `}` line is reached
 * (parser.ts#handlePendingBodyLine calls {@link finalizeJsonBody}) — unlike a
 * map/object body, a json body line is not independently parseable (a bare
 * `"name": "component c1",` is not valid JSON on its own), so it cannot be
 * folded in line-by-line the way `applyMapBodyLine`/`parseObjectField` are.
 *
 * Split into its own module (mirrors class-object-commands.ts / class-map-
 * commands.ts's own split precedent) to keep class-commands.ts under the
 * repo's 500-line-per-file cap.
 *
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateJson.java
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateJsonSingleLine.java
 * @see ~/git/plantuml/.../cucadiagram/BodierJSon.java
 * @see ~/git/plantuml/.../objectdiagram/ClassDiagramFactory.java (registration)
 */

import type { Classifier, JsonNode } from './ast.js';
import { resolveReference } from './class-namespace.js';
import { ensureClassifier, type ParseState } from './parser.js';

// ---------------------------------------------------------------------------
// Header grammar (NameAndCodeParser.nameAndCode() + ColorParser.exp1())
// ---------------------------------------------------------------------------

/** Upstream CODE = `[^%s{}%g<>]+` — duplicated from class-object-commands.ts
 *  (not imported — a peer command module, matching class-map-commands.ts's
 *  own duplication-over-cross-import precedent). */
const CODE = '[^\\s{}\x22<>]+';

/**
 * `NameAndCodeParser.nameAndCode()`'s four ordered alternatives — the SAME
 * grammar `object`'s multiline/single-line openers use (upstream calls the
 * identical static method). Capture groups: 1 DISPLAY1, 2 CODE1, 3 CODE2,
 * 4 DISPLAY2, 5 CODE3, 6 CODE4.
 */
const NAME_AND_CODE =
  '(?:' +
  '\x22([^\x22]*)\x22\\s+as\\s+(' + CODE + ')' +
  '|(' + CODE + ')\\s+as\\s+\x22([^\x22]*)\x22' +
  '|(' + CODE + ')' +
  '|\x22([^\x22]+)\x22' +
  ')';

/** Upstream NAME (single-line form) = `(?:[%g]([^%g]+)[%g][%s]+as[%s]+)?
 *  ([%pLN_.]+)` — the SAME two-alternative grammar `map`'s opener uses
 *  (duplicated from class-map-commands.ts, same reasoning as CODE above). */
const SINGLE_LINE_NAME = '(?:\x22([^\x22]*)\x22\\s+as\\s+)?([\\w.]+)';

/** `StereotypePattern.optional("STEREO")` — duplicated per file (see
 *  class-map-commands.ts's own doc for why). */
const STEREO = '(?:\\s*<<\\s*([^<>]+?)\\s*>>)?';

/** `UrlBuilder.OPTIONAL` — matched and discarded. */
const URL = '(?:\\s*\\[\\[[^\\]]*\\]\\])?';

/** `ColorParser.exp1()` — the SAME grammar class-object-commands.ts's COLOR
 *  uses (json has no separate LINECOLOR group, unlike map). */
const COLOR =
  '(#(?:\\w+[-\\\\|/]?\\w+;)?(?:(?:text|back|header|line|line\\.dashed|' +
  'line\\.dotted|line\\.bold|shadowing)(?::\\w+[-\\\\|/]?\\w+)?' +
  '(?:;|(?![\\w;:.])))+|#\\w+[-\\\\|/]?\\w+)?';

/**
 * `json <name-and-code> [<<stereo>>] [[[url]]] [#color] {` — mandatory
 * trailing `{` (upstream `RegexLeaf("\\{")` then `RegexLeaf.end()`, no
 * optional-brace alternative). Capture groups: 1-6 NAME_AND_CODE, 7 STEREO,
 * 8 COLOR.
 */
export const JSON_MULTILINE_DECL_RE = new RegExp(
  '^json\\s+' + NAME_AND_CODE + STEREO + URL + '\\s*' + COLOR + '\\s*\\{\\s*$',
  'i',
);

/**
 * `json <name> [<<stereo>>] [[[url]]] [#color] <data>` — DATA is captured as
 * ONE group spanning whichever of the 6 upstream alternatives
 * (boolean/number/null/string/array/object) matches; the exact match SPAN
 * mirrors upstream's `RegexOr` (alternatives tried in the same order, same
 * greedy sub-patterns), but this parser determines the value's actual kind by
 * re-parsing the captured text with {@link parseJsonNode} rather than tracking
 * which of the 6 branches matched. Capture groups: 1-2 NAME, 3 STEREO,
 * 4 COLOR, 5 DATA. Upstream's DATA_NUMBER is integer-only (`-?\d+`, no
 * decimal point) — ported faithfully, not "fixed".
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
    '|(?:\x22.*\x22)' +
    '|(?:\\[.*\\])' +
    '|(?:\\{\\s*\x22(?:\\\\\x22|[^\x22])+\x22\\s*:.*\\})' +
    ')\\s*$',
  'i',
);

interface Command {
  pattern: RegExp;
  execute(state: ParseState, match: RegExpExecArray): void;
}

// ---------------------------------------------------------------------------
// Hand-rolled, order-preserving JSON parser
// ---------------------------------------------------------------------------
//
// A plain JS object/array (via JSON.parse) would silently reorder purely-
// numeric string keys ahead of non-numeric ones — a real hazard for a JSON
// leaf whose key order is user-visible table row order. This recursive-
// descent parser preserves source order unconditionally by building
// {@link JsonNode} directly instead of round-tripping through a JS object.

interface Cursor {
  text: string;
  pos: number;
}

const QUOTE = '\x22';

function skipWs(c: Cursor): void {
  while (c.pos < c.text.length && ' \t\r\n'.includes(c.text[c.pos]!)) c.pos++;
}

function parseJsonString(c: Cursor): string {
  c.pos++; // opening quote
  let out = '';
  while (c.pos < c.text.length && c.text[c.pos] !== QUOTE) {
    const ch = c.text[c.pos]!;
    if (ch === '\\') {
      const esc = c.text[c.pos + 1];
      const map: Record<string, string> = { '"': QUOTE, '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
      if (esc !== undefined && esc in map) {
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
  c.pos++; // '{'
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
    if (c.text[c.pos] !== ':') throw new Error('expected :');
    c.pos++;
    skipWs(c);
    entries.push({ key, value: parseJsonValue(c) });
    skipWs(c);
    if (c.text[c.pos] === ',') { c.pos++; continue; }
    if (c.text[c.pos] === '}') { c.pos++; break; }
    throw new Error('expected , or }');
  }
  return { kind: 'object', entries };
}

function parseJsonArray(c: Cursor): JsonNode {
  c.pos++; // '['
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
    throw new Error('expected , or ]');
  }
  return { kind: 'array', items };
}

function parseJsonValue(c: Cursor): JsonNode {
  skipWs(c);
  const ch = c.text[c.pos];
  if (ch === '{') return parseJsonObject(c);
  if (ch === '[') return parseJsonArray(c);
  if (ch === QUOTE) return { kind: 'scalar', value: parseJsonString(c) };
  if (c.text.startsWith('true', c.pos)) { c.pos += 4; return { kind: 'scalar', value: true }; }
  if (c.text.startsWith('false', c.pos)) { c.pos += 5; return { kind: 'scalar', value: false }; }
  if (c.text.startsWith('null', c.pos)) { c.pos += 4; return { kind: 'scalar', value: null }; }
  return { kind: 'scalar', value: parseJsonNumber(c) };
}

/**
 * Parse a complete JSON text into a {@link JsonNode}, or `null` on any
 * malformed input (mirrors `JsonParser#parse` throwing -> `getJsonValue`
 * catching and returning `null` — see this file's doc + ast.ts's
 * `Classifier.jsonValue` doc for what happens downstream on `null`).
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
// Multiline opener (CommandCreateJson)
// ---------------------------------------------------------------------------

interface JsonMatch {
  rawId: string;
  rawDisplay: string | undefined;
  stereotype: string | undefined;
  color: string | undefined;
}

/** Pulls id/display/stereotype/color out of a {@link JSON_MULTILINE_DECL_RE}
 *  match — same capture layout as class-object-commands.ts's
 *  `parseObjectMatch` (identical NAME_AND_CODE grammar). */
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
 * `executeNow`'s header handling). `quarkInContext(true, ...)` —
 * `reuseExistingChild=true`, matching `map`'s multiline opener. A duplicate
 * name ("JSON already exists" upstream) is a silent no-op (no error channel —
 * see class-map-commands.ts#applyMapOpen's doc for the identical posture),
 * but the body must still be consumed so its lines do not leak to
 * `dispatchCommand` as bogus top-level commands: `state.pendingBodyId` is set
 * to the same `''` sentinel `applyMapOpen` uses, so
 * `parser.ts#handlePendingBodyLine`'s classifier lookup always misses and
 * every body line up to the closing `}` is silently discarded.
 */
function applyJsonOpen(state: ParseState, match: RegExpExecArray): void {
  const { rawId, rawDisplay, stereotype, color } = parseJsonMultilineMatch(match);

  const { id } = resolveReference({
    namespaces: state.ast.namespaces,
    sep: state.namespaceSeparator,
    activeNamespace: state.activeNamespace,
    name: rawId,
    display: rawDisplay,
    intermediatePackages: state.intermediatePackages,
    classifiers: state.ast.classifiers,
    reuseExistingChild: true,
  });
  if (state.classifierIndex.has(id)) {
    state.pendingBodyId = ''; // "JSON already exists" — consume-and-discard the body
    return;
  }

  const classifier = ensureClassifier(state, rawId, 'json', rawDisplay, true);
  if (stereotype !== undefined) classifier.stereotype = stereotype;
  if (color !== undefined) classifier.color = color;
  state.pendingBodyId = classifier.id;
}

/**
 * Finalize a closed `json { ... }` body (parser.ts#handlePendingBodyLine,
 * called once with the accumulated raw lines when the closing `}` is
 * reached). Mirrors `CommandCreateJson#getJsonString` + `getJsonValue`:
 * the body lines are concatenated with NO separator (upstream:
 * `sb.append(sl.getString())` per line, no added newline/space — a property
 * line's own trailing `,` already separates it from the next), then wrapped
 * in `{`/`}` to reconstruct the object literal. On parse failure, upstream
 * retries the SAME concatenation WITHOUT the `{`/`}` wrapper ("let's see if
 * we could ignore external brackets..." — a fallback for a body that already
 * supplies its own outer braces); ported the same way here. `executeNow`
 * creates the leaf entity BEFORE this validation and never removes it on
 * failure (`CommandExecutionResult.error("Bad data")`, no `setJson` call) —
 * see ast.ts's `Classifier.jsonValue` doc for how this parser represents
 * that outcome (leaf kept, `jsonValue` left `undefined`).
 */
export function finalizeJsonBody(classifier: Classifier, rawLines: readonly string[]): void {
  const body = rawLines.join('');
  const wrapped = parseJsonNode('{' + body + '}');
  const value = wrapped ?? parseJsonNode(body);
  if (value !== null) classifier.jsonValue = value;
}

// ---------------------------------------------------------------------------
// Single-line command (CommandCreateJsonSingleLine)
// ---------------------------------------------------------------------------

/**
 * Apply one matched `json Name value` line. `quarkInContext(false, ...)` —
 * `reuseExistingChild=false` — a DELIBERATE asymmetry from the multiline
 * opener above (upstream: `executeArg0`'s `quarkInContext(false,
 * diagram.cleanId(name))` vs `CommandCreateJson#executeArg0`'s
 * `quarkInContext(true, idShort)`), preserved faithfully rather than
 * normalized to match its multiline sibling — this project's porting
 * discipline treats an upstream quirk as data, not a bug to silently fix.
 * A duplicate name ("JSON already exists") is a silent no-op (single line,
 * no body to consume — unlike the multiline opener's sentinel dance).
 */
function applyJsonSingleLine(state: ParseState, match: RegExpExecArray): void {
  const rawDisplay = match[1];
  const rawId = match[2]!;
  const stereotype = match[3]?.trim();
  const color = match[4];
  const dataText = match[5]!;

  const { id } = resolveReference({
    namespaces: state.ast.namespaces,
    sep: state.namespaceSeparator,
    activeNamespace: state.activeNamespace,
    name: rawId,
    display: rawDisplay,
    intermediatePackages: state.intermediatePackages,
    classifiers: state.ast.classifiers,
    reuseExistingChild: false,
  });
  if (state.classifierIndex.has(id)) return; // "JSON already exists" — no-op

  const classifier = ensureClassifier(state, rawId, 'json', rawDisplay, false);
  if (stereotype !== undefined) classifier.stereotype = stereotype;
  if (color !== undefined) classifier.color = color;
  const value = parseJsonNode(dataText);
  if (value !== null) classifier.jsonValue = value;
}

/**
 * JSON commands, spread into `COMMANDS` (class-commands.ts) immediately after
 * `MAP_COMMANDS` — mirrors upstream `ClassDiagramFactory.initCommandsList`'s
 * registration order: `CommandCreateMap`(117), `CommandCreateJson`(118),
 * `CommandCreateJsonSingleLine`(119). Multiline listed first (never collides
 * with single-line: the multiline pattern requires a trailing `{`, the
 * single-line one requires a DATA_ value instead).
 */
export const JSON_COMMANDS: readonly Command[] = [
  { pattern: JSON_MULTILINE_DECL_RE, execute: applyJsonOpen },
  { pattern: JSON_SINGLE_LINE_RE, execute: applyJsonSingleLine },
];

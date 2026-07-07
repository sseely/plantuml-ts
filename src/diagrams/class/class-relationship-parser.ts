/**
 * Relationship (arrow) line parsing for PlantUML class diagrams.
 *
 * Extracted from parser.ts (pure move, no behavior change) to keep
 * parser.ts under the repo's 500-line-per-file cap.
 */

import type { Relationship, RelationshipType } from './ast.js';

// ---------------------------------------------------------------------------
// Relationship arrow parsing
// ---------------------------------------------------------------------------

/**
 * Direction and type info for a parsed arrow.
 * `swapDirection = true` means the left operand is semantically `to`
 * and the right operand is `from` (i.e. the arrow points left).
 */
interface ArrowInfo {
  type: RelationshipType;
  swapDirection: boolean;
}

/**
 * Recognised arrow tokens, longest-alternative-first within each prefix
 * family so the alternation naturally prefers the more specific token
 * (`<|--` over `<--`, `...>` over `..>` over `.>` over `..`, etc.).
 *
 * Regex groups produced by REL_RE:
 *   1: left identifier (may include `.ns` segments and a `::port` suffix)
 *   2: optional left qualifier (`[Qualifier]`)
 *   3: optional left multiplicity (quoted)
 *   4: the arrow token
 *   5: optional right multiplicity (quoted)
 *   6: optional right qualifier (`[Qualifier]`)
 *   7: right identifier
 *   8: optional label after ':'
 */
const CLASS_ID = String.raw`\w+(?:\.\w+)*(?:::\w+)?|"[^"]+"`;
// Arrow BODY length is arbitrary in upstream PlantUML (any run of `-`
// or `.` characters — see CommandLinkClass's `ARROW_BODY` = `[-=.]+`);
// body length never changes the relationship TYPE, only decor chars do.
// So each alternative below allows a repeated body (DASH / DOT) and
// resolveArrow() canonicalises any run down to a single body char before
// the ARROW_INFO lookup, rather than enumerating every body length.
//
// A body run may embed an optional orientation word (`-left-`, `*-right-`,
// `-down--`), mirroring upstream's ARROW_DIRECTION `left|right|up|down|le?|
// ri?|up?|do?`. It is matched non-capturing (so REL_RE group indices are
// unchanged), stripped by canonicalizeArrow, and recovered post-hoc to set the
// arrow length (LEFT/RIGHT force length 1 → minlen 0; CommandLinkClass:337).
const ARROW_DIR = String.raw`(?:left|right|down|up|le|ri|do|[lrud])`;
const DASH = String.raw`-+(?:${ARROW_DIR}-*)?`;
const DOT = String.raw`\.+(?:${ARROW_DIR}\.*)?`;
const REL_ARROW =
  String.raw`<\|${DASH}|<${DASH}|<\|${DOT}|<${DOT}|${DASH}\|>|${DOT}\|>|` +
  String.raw`${DASH}\*|${DASH}o|\*${DASH}|o${DASH}|${DASH}>|${DOT}>|${DOT}|${DASH}`;

const REL_RE = new RegExp(
  String.raw`^(${CLASS_ID})` +
    String.raw`\s*(?:\[([^[\]]+)\])?` +
    String.raw`\s*(?:"([^"]*)")?` +
    String.raw`\s*(${REL_ARROW})` +
    String.raw`\s*(?:"([^"]*)")?` +
    String.raw`\s*(?:\[([^[\]]+)\])?` +
    String.raw`\s*(${CLASS_ID})` +
    String.raw`\s*(?::\s*(.+))?$`,
);

/**
 * Non-capturing dispatch-only variant of REL_RE, used by the COMMANDS table
 * to decide whether a line is a relationship line before running the full
 * (capturing) parseRelationshipLine.
 */
export const REL_DISPATCH_RE = new RegExp(
  String.raw`^(?:${CLASS_ID})` +
    String.raw`\s*(?:\[[^[\]]+\])?` +
    String.raw`\s*(?:"[^"]*")?` +
    String.raw`\s*(?:${REL_ARROW})` +
    String.raw`\s*(?:"[^"]*")?` +
    String.raw`\s*(?:\[[^[\]]+\])?` +
    String.raw`\s*(?:${CLASS_ID})` +
    String.raw`(?:\s*:\s*.+)?$`,
);

/** A classifier id with an optional `::port` member-name suffix split off. */
function splitEndpointPort(raw: string): { id: string; port?: string } {
  if (raw.startsWith('"')) return { id: stripQuotes(raw) };
  const sepIdx = raw.indexOf('::');
  if (sepIdx === -1) return { id: raw };
  return { id: raw.slice(0, sepIdx), port: raw.slice(sepIdx + 2) };
}

/** Resolve a (from, to) pair given whether the arrow points left. */
function pickDirectional<T>(
  swapDirection: boolean,
  leftVal: T,
  rightVal: T,
): { from: T; to: T } {
  return swapDirection ? { from: rightVal, to: leftVal } : { from: leftVal, to: rightVal };
}

/** Assemble a Relationship, omitting undefined/empty optional fields. */
function withOptionalFields(
  base: Pick<Relationship, 'from' | 'to' | 'type'>,
  optional: {
    fromMultiplicity?: string | undefined;
    toMultiplicity?: string | undefined;
    label?: string | undefined;
    fromPort?: string | undefined;
    toPort?: string | undefined;
    fromQualifier?: string | undefined;
    toQualifier?: string | undefined;
    length?: number | undefined;
  },
): Relationship {
  const rel: Relationship = { ...base };
  if (optional.fromMultiplicity !== undefined) rel.fromMultiplicity = optional.fromMultiplicity;
  if (optional.toMultiplicity !== undefined) rel.toMultiplicity = optional.toMultiplicity;
  if (optional.label !== undefined && optional.label !== '') rel.label = optional.label;
  if (optional.fromPort !== undefined) rel.fromPort = optional.fromPort;
  if (optional.toPort !== undefined) rel.toPort = optional.toPort;
  if (optional.fromQualifier !== undefined) rel.fromQualifier = optional.fromQualifier;
  if (optional.toQualifier !== undefined) rel.toQualifier = optional.toQualifier;
  if (optional.length !== undefined) rel.length = optional.length;
  return rel;
}

export function parseRelationshipLine(line: string): Relationship | null {
  const m = REL_RE.exec(line);
  if (m === null) return null;

  const arrow = m[4]!;
  const info = resolveArrow(arrow);
  if (info === null) return null;

  const left = splitEndpointPort(m[1]!);
  const right = splitEndpointPort(m[7]!);

  const id = pickDirectional(info.swapDirection, left.id, right.id);
  const mult = pickDirectional(info.swapDirection, m[3], m[5]);
  const port = pickDirectional(info.swapDirection, left.port, right.port);
  const qual = pickDirectional(info.swapDirection, m[2], m[6]);
  const label = m[8]?.trim();
  // Arrow length drives dot minlen (length - 1): body char count, or 1 when the
  // arrow is horizontally oriented (`-left-`/`-right-`). See arrowLength.
  const length = arrowLength(arrow);

  return withOptionalFields(
    { from: id.from, to: id.to, type: info.type },
    {
      fromMultiplicity: mult.from,
      toMultiplicity: mult.to,
      label,
      fromPort: port.from,
      toPort: port.to,
      fromQualifier: qual.from,
      toQualifier: qual.to,
      length,
    },
  );
}

export function stripQuotes(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Map a raw arrow token (after body-length canonicalisation — see REL_ARROW's
 * comment) to semantic type and direction. Left-pointing arrows have
 * swapDirection=true (left side = "to"); right-pointing and neutral arrows
 * have swapDirection=false.
 */
const ARROW_INFO: Record<string, ArrowInfo> = {
  // Left-pointing: right side is the "from", left side is the "to"
  '<|-': { type: 'extension',      swapDirection: true },
  '<-':  { type: 'association',    swapDirection: true },
  '<|.': { type: 'implementation', swapDirection: true },
  '<.':  { type: 'dependency',     swapDirection: true },
  // Right-pointing: left side is "from", right side is "to"
  '-|>': { type: 'extension',      swapDirection: false },
  '.|>': { type: 'implementation', swapDirection: false },
  '-*':  { type: 'composition',    swapDirection: false },
  '-o':  { type: 'aggregation',    swapDirection: false },
  // *-- / o--: left side is the "whole" (from), right is part (to)
  '*-':  { type: 'composition',    swapDirection: false },
  'o-':  { type: 'aggregation',    swapDirection: false },
  '->':  { type: 'association',    swapDirection: false },
  '.>':  { type: 'dependency',     swapDirection: false },
  '.':   { type: 'usage',          swapDirection: false },
  // Plain solid connector: a bare association (no arrowheads, no direction).
  '-':   { type: 'association',    swapDirection: false },
};

const ARROW_DIR_RE = new RegExp(ARROW_DIR, 'i');
const ARROW_DIR_RE_G = new RegExp(ARROW_DIR, 'gi');

/** Collapse a run of `-` or `.` body characters to a single char and strip any
 *  orientation word (`-left-` → `-`); neither changes the relationship type.
 *  Only the direction words are stripped — the `o` aggregation head is not. */
function canonicalizeArrow(rawArrow: string): string {
  return rawArrow.replace(ARROW_DIR_RE_G, '').replace(/-+/g, '-').replace(/\.+/g, '.');
}

/**
 * Arrow length (drives dot minlen = length - 1). A LEFT/RIGHT orientation forces
 * length 1 regardless of body length (horizontal, same-rank → minlen 0);
 * otherwise it is the body char count (CommandLinkClass.getQueueLength).
 */
function arrowLength(rawArrow: string): number {
  const dir = ARROW_DIR_RE.exec(rawArrow)?.[0]?.toLowerCase();
  const horizontal = dir !== undefined && (dir[0] === 'l' || dir[0] === 'r');
  return horizontal ? 1 : (rawArrow.match(/[-.=]/g) ?? []).length;
}

function resolveArrow(rawArrow: string): ArrowInfo | null {
  return ARROW_INFO[canonicalizeArrow(rawArrow)] ?? null;
}

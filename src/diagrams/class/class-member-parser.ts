/**
 * Member (attribute/method) line parsing for PlantUML class diagrams.
 *
 * Extracted from parser.ts (pure move, no behavior change) to keep
 * parser.ts under the repo's 500-line-per-file cap.
 */

import type { Member, Visibility } from './ast.js';
import { parseUrlBracket, type UrlInfo } from './class-url.js';

// ---------------------------------------------------------------------------
// Member parsing helpers
// ---------------------------------------------------------------------------

/** Attach `visibilityExplicit: true` only when the raw member line carried
 *  an explicit leading visibility char -- omitted (not `false`) otherwise,
 *  mirroring `class-object-commands.ts#withVisibilityFlag`'s EXACT pattern
 *  (kept as a second, class-member-local copy rather than a shared import:
 *  that module's own version returns `Omit<Member, 'visibilityExplicit'>`
 *  input, a signature difference not worth threading a shared helper
 *  through for one field assignment). Vitest's `toEqual` treats a missing
 *  key and an `undefined`-valued key the same, but NOT a missing key and a
 *  `false`-valued key -- pre-existing member-literal equality assertions
 *  written before this field existed keep passing. */
function withVisibilityFlag(member: Omit<Member, 'visibilityExplicit'>, explicit: boolean): Member {
  return explicit ? { ...member, visibilityExplicit: true } : member;
}

const TRAILING_URL_RE = /\s*(\[{2,3}[^\]]*\]{2,3})\s*$/;

/**
 * G2 N16: strips a trailing `[[url]]`/`[[[url]]]` (optionally `{label}`-
 * suffixed) link suffix from a member line AND parses its bracket content
 * into a real `UrlInfo` (N15 only detected presence via a boolean).
 * Upstream's `Member` constructor does this UNCONDITIONALLY for a
 * class/interface/enum member (`manageModifier=true`, `Member.java`'s own
 * `URL` pattern -- `^(.*?)(?:\[(` + `UrlBuilder`'s own `[[...]]` grammar +
 * `)\])?$`, i.e. member-level url syntax wraps `UrlBuilder`'s normal
 * `[[...]]` bracket in ONE more `[...]` layer, always triple-bracket
 * (`[[[...]]]`) end to end) before ANY display/name decomposition --
 * stripped BEFORE the structured method/attr regexes run so a URL-suffixed
 * method line (e.g. `methods1() [[[url{label}]]]`, `gizini-87-vuve916`)
 * still matches the structured shape instead of falling to the raw-display
 * fallback with the bracket syntax embedded literally (a real DOT
 * node-size regression, caught via `tests/oracle/object-dot-parity.test
 * .ts`). G2 N12. Stripping exactly one outer `[`/`]` layer off the
 * captured suffix recovers the SAME `[[...]]` text `class-url.ts
 * #parseUrlBracket` already parses for classifier-level urls. A bare
 * double-bracket suffix (`[[...]]`, `{2,3}` in the detection regexp also
 * matches it for display-text-stripping purposes) has no outer layer to
 * strip and is not upstream's real member-url grammar -- display text is
 * still stripped either way; only the PARSED url is `undefined`.
 */
function stripUrlSuffix(line: string): { line: string; ownUrl: UrlInfo | undefined } {
  const match = TRAILING_URL_RE.exec(line);
  if (match === null) return { line, ownUrl: undefined };
  const bracket = match[1]!.trim();
  const ownUrl =
    bracket.startsWith('[[[') && bracket.endsWith(']]]')
      ? parseUrlBracket(bracket.slice(1, -1))
      : undefined;
  return { line: line.replace(TRAILING_URL_RE, ''), ownUrl };
}

/** Strips leading `{static}`/`{abstract}` modifier prefixes (repeatable, any
 *  order) -- split out of `parseMemberLine` (G2 N16) to keep that function's
 *  own CCN under the project's complexity cap after adding url PARSING
 *  (was presence-detection only, N15); pure move, no behavior change. */
function stripModifiers(rawLine: string): { line: string; isStatic: boolean; isAbstract: boolean } {
  let line = rawLine;
  let isStatic = false;
  let isAbstract = false;
  const modifierRe = /^\{(static|abstract)\}\s*/i;
  let modMatch = modifierRe.exec(line);
  while (modMatch !== null) {
    const mod = modMatch[1]!.toLowerCase();
    if (mod === 'static') isStatic = true;
    if (mod === 'abstract') isAbstract = true;
    line = line.slice(modMatch[0].length);
    modMatch = modifierRe.exec(line);
  }
  return { line, isStatic, isAbstract };
}

/** Strips a leading visibility char (`+-#~`) -- split out of `parseMemberLine`
 *  for the same CCN-budget reason as {@link stripModifiers}; pure move, no
 *  behavior change. */
function stripVisibility(line: string): { line: string; visibility: Visibility; visibilityExplicit: boolean } {
  if (line.startsWith('+') || line.startsWith('-') || line.startsWith('#') || line.startsWith('~')) {
    return { line: line.slice(1).trimStart(), visibility: line[0] as Visibility, visibilityExplicit: true };
  }
  return { line, visibility: '+', visibilityExplicit: false };
}

interface MemberBase {
  visibility: Visibility;
  isStatic: boolean;
  isAbstract: boolean;
  ownUrl: UrlInfo | undefined;
}

/** Method form: `name(params): ReturnType` or `name(params)` -- split out of
 *  `parseMemberLine` for the same CCN-budget reason as {@link
 *  stripModifiers}; pure move, no behavior change (including the nested
 *  `.map`/`.filter` param-list decomposition). */
function tryParseMethod(line: string, base: MemberBase): Omit<Member, 'visibilityExplicit'> | undefined {
  const methodMatch = /^(\w+)\(([^)]*)\)(?:\s*:\s*(\S+))?$/.exec(line);
  if (methodMatch === null) return undefined;
  const name = methodMatch[1]!;
  const rawParams = methodMatch[2]!.trim();
  const returnType = methodMatch[3];
  const params = rawParams === '' ? [] : rawParams.split(',').map((p) => p.trim()).filter((p) => p !== '');
  return {
    visibility: base.visibility,
    name,
    isStatic: base.isStatic,
    isAbstract: base.isAbstract,
    params,
    ...(returnType !== undefined ? { type: returnType } : {}),
    ...(base.ownUrl !== undefined ? { ownUrl: base.ownUrl } : {}),
  };
}

/** Attribute form: `name: Type` or bare `name` -- split out of
 *  `parseMemberLine` for the same CCN-budget reason as {@link
 *  stripModifiers}; pure move, no behavior change. */
function tryParseAttribute(line: string, base: MemberBase): Omit<Member, 'visibilityExplicit'> | undefined {
  const attrMatch = /^(\w+)(?:\s*:\s*(\S+))?$/.exec(line);
  if (attrMatch === null) return undefined;
  const name = attrMatch[1]!;
  const fieldType = attrMatch[2];
  return {
    visibility: base.visibility,
    name,
    isStatic: base.isStatic,
    isAbstract: base.isAbstract,
    ...(fieldType !== undefined ? { type: fieldType } : {}),
    ...(base.ownUrl !== undefined ? { ownUrl: base.ownUrl } : {}),
  };
}

/**
 * Raw-display fallback -- upstream (`BodierLikeClassOrObject
 * #addFieldOrMethod`/`Member`'s constructor) NEVER rejects a member line: it
 * strips a leading visibility char (already done by the caller) and
 * displays the REMAINDER verbatim, with no name/type decomposition at all
 * -- {@link tryParseMethod}/{@link tryParseAttribute} are this port's OWN
 * reconstruction for the common `[+-#~] name [(params)] [: Type]` cases,
 * not an upstream grammar boundary. Anything that doesn't fit those shapes
 * (Java-style `Type name`, a trailing `;`, ...) falls through to here
 * instead of vanishing from the AST -- jar-verified (`cuxuni-25-doxi736`:
 * `+String a1`/`+Date d;` render as the literal strings "String a1"/"Date
 * d;", semicolon and all). Mirrors `class-object-commands.ts
 * #parseObjectField`'s identical raw-fallback branch for object leaves
 * (same upstream mechanism, ported there first). G2 N12.
 * @see ~/git/plantuml/.../cucadiagram/Member.java (constructor)
 * @see ~/git/plantuml/.../cucadiagram/BodierLikeClassOrObject.java#addFieldOrMethod
 */
function rawDisplayFallback(line: string, base: MemberBase): Omit<Member, 'visibilityExplicit'> {
  return {
    visibility: base.visibility,
    name: line,
    rawDisplay: line,
    isStatic: base.isStatic,
    isAbstract: base.isAbstract,
    ...(base.ownUrl !== undefined ? { ownUrl: base.ownUrl } : {}),
  };
}

/**
 * Parse a raw member string.
 * Returns a Member or null if the string cannot be parsed as a member.
 */
export function parseMemberLine(rawLine: string): Member | null {
  const trimmed = rawLine.trim();
  if (trimmed === '') return null;

  const { line: afterModifiers, isStatic, isAbstract } = stripModifiers(trimmed);
  const { line: afterUrl, ownUrl } = stripUrlSuffix(afterModifiers);
  const { line, visibility, visibilityExplicit } = stripVisibility(afterUrl);
  if (line === '') return null;

  const base: MemberBase = { visibility, isStatic, isAbstract, ownUrl };
  const shape = tryParseMethod(line, base) ?? tryParseAttribute(line, base) ?? rawDisplayFallback(line, base);
  return withVisibilityFlag(shape, visibilityExplicit);
}

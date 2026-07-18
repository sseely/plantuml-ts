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

/** G2 N31: `undefined` capture-group-2 (bare name, no type at all) maps to
 *  `{}` (no field -- `formatMemberText` has nothing to separate); the
 *  CANONICAL `': '` spacing also maps to `{}` (zero behavior change for
 *  the overwhelmingly common case, see `Member.typeSeparator`'s doc
 *  comment); anything else round-trips verbatim. */
const CANONICAL_TYPE_SEPARATOR = ': ';
function typeSeparatorField(rawSeparator: string | undefined): { typeSeparator?: string } {
  if (rawSeparator === undefined || rawSeparator === CANONICAL_TYPE_SEPARATOR) return {};
  return { typeSeparator: rawSeparator };
}

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

/** Strips a leading visibility char (`+-#~*`) -- split out of
 *  `parseMemberLine` for the same CCN-budget reason as {@link
 *  stripModifiers}. G2/N21: `*` (`VisibilityModifier.IE_MANDATORY`,
 *  `VisibilityModifier.java:231/280/299-300`) was missing -- a genuine 5th
 *  visibility char, not a typo/placeholder; jar-verified against
 *  `sufide-66-sanu583`'s `*IE_MANDATORY` field AND method lines (both
 *  strip the `*` and draw the always-filled circle icon, same as every
 *  other explicit visibility char).
 *
 *  G2 N42 (pre-existing bug, unmasked while jar-verifying the enhanced-body
 *  block-separator/tree render path against `foxiki-17-kosa114`/`juxora-90-
 *  fisu720`'s own bold-leading tree cells, `**Bar(Model)**`):
 *  `VisibilityModifier.isVisibilityCharacter` requires the SECOND char to
 *  DIFFER from the first (`VisibilityModifier.java`) -- excludes a `**bold**`
 *  creole run (both leading chars identical) from being misread as an
 *  explicit `*` visibility marker. `class-object-commands.ts
 *  #detectVisibilityChar` already carries this exact guard for object
 *  leaves; this function (class/interface/enum leaves) never did -- a
 *  `**word**`-leading member/tree-cell line lost its OWN leading `*` to a
 *  spurious visibility strip regardless of whether the body is enhanced
 *  (this bug predates G2 N42, but N42's new render path is the first to
 *  visibly exercise it for `**`-leading content, since a `**`-leading line
 *  previously fell into other, differently-wrong rendering). Zero corpus
 *  reach among the class ratchet's own zero-diff-pinned fixtures (verified
 *  via a full grep before landing this fix), so this is additive-safe. */
function stripVisibility(line: string): { line: string; visibility: Visibility; visibilityExplicit: boolean } {
  const c = line.charAt(0);
  const isVisibilityChar = c === '+' || c === '-' || c === '#' || c === '~' || c === '*';
  if (isVisibilityChar && line.charAt(1) !== c) {
    return { line: line.slice(1).trimStart(), visibility: c, visibilityExplicit: true };
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
  const methodMatch = /^(\w+)\(([^)]*)\)(?:(\s*:\s*)(\S+))?$/.exec(line);
  if (methodMatch === null) return undefined;
  const name = methodMatch[1]!;
  const rawParams = methodMatch[2]!.trim();
  const returnType = methodMatch[4];
  const params = rawParams === '' ? [] : rawParams.split(',').map((p) => p.trim()).filter((p) => p !== '');
  return {
    visibility: base.visibility,
    name,
    isStatic: base.isStatic,
    isAbstract: base.isAbstract,
    params,
    ...(returnType !== undefined ? { type: returnType } : {}),
    ...typeSeparatorField(methodMatch[3]),
    ...(base.ownUrl !== undefined ? { ownUrl: base.ownUrl } : {}),
  };
}

/** Attribute form: `name: Type` or bare `name` -- split out of
 *  `parseMemberLine` for the same CCN-budget reason as {@link
 *  stripModifiers}; pure move, no behavior change. */
function tryParseAttribute(line: string, base: MemberBase): Omit<Member, 'visibilityExplicit'> | undefined {
  // G2 N43 (juxora-90-fisu720's `FlatWorks`, jar-verified): the TYPE capture
  // excludes `(`/`)` -- upstream's real field/method split is `isMethod(s)`
  // (`BodierLikeClassOrObject.java`), a PARE-CONTAINMENT scan over the whole
  // raw line, applied BEFORE any structured name/type decomposition even
  // happens (upstream classifies first, decomposes second; this port
  // inverts that -- decomposes first via `tryParseMethod`/`tryParseAttribute`,
  // then derives `isMethodMember` from the result, see `class-member-rows.ts
  // #isMethodMember`'s own doc comment). A garbage/emoticon-shaped line like
  // `prop4 :(` previously matched THIS regex as a well-typed field (type
  // captured as the literal string `"("`), which stole it from
  // `isMethodMember`'s raw-fallback paren-scan entirely (`m.params ===
  // undefined` for a structured-but-non-method attribute, so the member
  // silently misclassified as a FIELD when jar draws it as a METHOD).
  // Excluding parens from the type capture forces this exact shape to fail
  // the match and fall through to `rawDisplayFallback`, where the EXISTING
  // paren-scan already classifies it correctly -- zero corpus reach for a
  // LEGITIMATE type name containing `(`/`)` (UML/Java type grammars don't
  // use parens), so this narrows the match with no other observable change.
  const attrMatch = /^(\w+)(?:(\s*:\s*)([^()\s]+))?$/.exec(line);
  if (attrMatch === null) return undefined;
  const name = attrMatch[1]!;
  const fieldType = attrMatch[3];
  return {
    visibility: base.visibility,
    name,
    isStatic: base.isStatic,
    isAbstract: base.isAbstract,
    ...(fieldType !== undefined ? { type: fieldType } : {}),
    ...typeSeparatorField(attrMatch[2]),
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

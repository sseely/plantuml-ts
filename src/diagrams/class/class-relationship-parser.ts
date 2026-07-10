/**
 * Relationship (arrow) line parsing for PlantUML class diagrams.
 *
 * Extracted from parser.ts (pure move, no behavior change) to keep
 * parser.ts under the repo's 500-line-per-file cap.
 */

import type { Relationship, RelationshipType, LinkDecor } from './ast.js';

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
// The optional leading `\.?` accepts a leading-dot root-namespace reference
// (`.BaseClass` = the classifier `BaseClass` in the root namespace, resolved by
// resolveReference). Without it the endpoint regex rejects the whole line and the
// relationship is silently dropped (mission A3 Batch-1b diagnosis).
// Exported so class-lollipop.ts (CommandLinkLollipop's ENT1/ENT2) reuses the
// exact same identifier grammar rather than a second, drifting copy.
export const CLASS_ID = String.raw`\.?\w+(?:\.\w+)*(?:::\w+)?|"[^"]+"`;
// Arrow BODY length is arbitrary in upstream PlantUML (any run of `-`
// or `.` characters — see CommandLinkClass's `ARROW_BODY` = `[-=.]+`);
// body length never changes the relationship TYPE, only decor chars do.
// resolveArrow() canonicalises any run down to a single body char rather
// than enumerating every body length.
//
// A body run may embed an optional orientation word (`-left-`, `*-right-`,
// `-down--`), mirroring upstream's ARROW_DIRECTION `left|right|up|down|le?|
// ri?|up?|do?`. It is matched non-capturing (so REL_RE group indices are
// unchanged), stripped by canonicalizeArrow, and recovered post-hoc to set the
// arrow length (LEFT/RIGHT force length 1 → minlen 0; CommandLinkClass:337).
const ARROW_DIR = String.raw`(?:left|right|down|up|le|ri|do|[lrud])`;
const DASH = String.raw`-+(?:${ARROW_DIR}-*)?`;
// Inline style bracket (`-[thickness=5]->`, `<-[#green]->`), mirroring
// CommandLinkElement.LINE_STYLE — a comma-separated `#color`/`key=value` list.
// The DOT-parity goal is only that the relationship EXISTS with the right
// type/length (svek always emits `arrowtail=none,arrowhead=none` under the
// SIMPLEST link strategy — LinkType.getSpecificDecorationSvek), so the style
// content is parsed (consumed by the grammar so the arrow still matches) and
// then discarded rather than carried on Relationship; see
// decoration/LinkType.java's `linkStyle` field for where upstream keeps it
// for later SVG rendering.
const ARROW_STYLE = String.raw`\[[^[\]]+\]`;
// Composed body: BODY1(1+) STYLE1? DIRECTION? STYLE2? BODY2(0+), mirroring
// CommandLinkClass's five body-adjacent regex groups in that exact order
// (ARROW_BODY1/ARROW_STYLE1/ARROW_DIRECTION/ARROW_STYLE2/ARROW_BODY2).
const ARROW_BODY =
  String.raw`[-.]+(?:${ARROW_STYLE})?(?:${ARROW_DIR})?(?:${ARROW_STYLE})?[-.]*`;
// Independent head-glyph sets, longest-alternative-first within each shared
// prefix, mirroring LinkDecor.getRegexDecors1()/getRegexDecors2() — each
// decor is looked up independently of the other side (`resolveArrow` below),
// not enumerated as fixed head1+head2 combinations. `<_`/`_>` are the ARROOW
// underscore variants (LinkDecor.ARROW's second decor string); `)`/`(` are
// the lollipop provide/require glyphs (LinkDecor.PARENTHESIS); `x` is
// NOT_NAVIGABLE; `+` is PLUS. `o`/`x` are excluded here — see WORD_HEAD.
const HEAD1_SAFE = String.raw`(?:<\||<_|<|\*|\+|\))?`;
const HEAD2 = String.raw`(?:\|>|_>|>|\*|o|x|\+|\()?`;
const HEAD2_REQUIRED = String.raw`(?:\|>|_>|>|\*|o|x|\+|\()`;
// `o` (AGGREGATION) and `x` (NOT_NAVIGABLE) are word characters, so a BARE
// use (no closing head, single-`.`-only body) is indistinguishable from the
// next segment of a dotted CLASS_ID: `class x.y.Z` would otherwise let "x."
// match as a degenerate arrow, stealing a genuine classifier declaration
// from the classifier-decl command (REL_DISPATCH_RE is checked first in
// COMMANDS — class-commands.ts). `.` is the default namespace separator so
// this is a real collision; `-` is not (CLASS_ID never contains a literal
// dash), so a single bare dash (`o-`) stays unrestricted. Requiring a
// non-empty HEAD2 *or* a body that is not exactly one `.` closes the
// collision without rejecting any real relationship shape (`o--`, `x--`,
// `o->`, `x-->`, `o.d.>`, … all still match).
const ARROW_BODY_SAFE_BARE =
  String.raw`(?:-[-.]*|\.[-.]+)(?:${ARROW_STYLE})?(?:${ARROW_DIR})?(?:${ARROW_STYLE})?[-.]*`;
const WORD_HEAD =
  String.raw`(?:o|x)(?:${ARROW_BODY}${HEAD2_REQUIRED}|${ARROW_BODY_SAFE_BARE}${HEAD2})`;
const REL_ARROW =
  // Crow's-foot (ER cardinality) links — a run of |o}{ with at least one |/}/{
  // around the body (`|o--o|`, `||--||`, `}o--o{`, `}|--|{`, `}--`). Structurally
  // an association edge (resolveArrow's crow's-foot fallback).
  String.raw`[|}{][o|}{]?${DASH}(?:[o|}{]?[|}{])?|${DASH}[o|}{]?[|}{]|` +
  // Decoration-plus-arrowhead combined forms (`o-->`, `*-->`, `<--o`, `<--*`,
  // an inline-styled `<|-[#FF0000,bold]-`, a direction word plus a triangle
  // AND an arrowhead (`<|-u->`), lollipop (`--(`, `)--`), …) all fall out of
  // this single composed `HEAD1? BODY HEAD2?` alternative — upstream's arrow
  // grammar composes independent heads rather than enumerating every
  // head1+head2 combination. `o`/`x` (word-char heads) go through WORD_HEAD
  // instead of the general HEAD1_SAFE alternative (see its comment).
  String.raw`${WORD_HEAD}|${HEAD1_SAFE}${ARROW_BODY}${HEAD2}`;

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

/**
 * A classifier id with an optional `::port` member-name suffix split off.
 * Exported for reuse by class-notes.ts — `note left of Class::member` uses
 * the same entity-ref grammar as a relationship endpoint's `Class::member`
 * (upstream: both ultimately resolve via `CucaDiagram` port-aware lookup).
 */
export function splitEndpointPort(raw: string): { id: string; port?: string } {
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
  const decors = parseArrowDecors(arrow, info.swapDirection);

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
    { from: id.from, to: id.to, type: info.type, ...decors },
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

const ARROW_DIR_RE = new RegExp(ARROW_DIR, 'i');
const ARROW_DIR_RE_G = new RegExp(ARROW_DIR, 'gi');
const ARROW_STYLE_RE_G = new RegExp(ARROW_STYLE, 'g');
// Built from a string (not a regex literal) so the `{`/`}` glyphs do not
// confuse the complexity checker's function-boundary detection.
const CROWS_FOOT_RE = new RegExp('[|}{]');
const BODY_CHAR_RE = new RegExp('[-.]');

/** Strip an inline style bracket (`[thickness=5]`, `[#green]`, …) — it carries
 *  no type/length/direction information (see ARROW_STYLE's comment), and its
 *  content (e.g. the literal `=` in `thickness=5`, or a stray `l`/`r`/`u`/`d`
 *  inside a color/keyword like `bold`) would otherwise corrupt the dash/dot
 *  count and the direction-word search below. */
function stripArrowStyle(rawArrow: string): string {
  return rawArrow.replace(ARROW_STYLE_RE_G, '');
}

/** Collapse a run of `-` or `.` body characters to a single char and strip any
 *  style bracket and orientation word (`-left-` → `-`); none of these change
 *  the relationship type. Only the style/direction-word text is stripped —
 *  the `o`/`x`/`+`/`<_`/`_>` decor glyphs are not. */
function canonicalizeArrow(rawArrow: string): string {
  return stripArrowStyle(rawArrow)
    .replace(ARROW_DIR_RE_G, '')
    .replace(/-+/g, '-')
    .replace(/\.+/g, '.');
}

/**
 * Arrow length (drives dot minlen = length - 1). A LEFT/RIGHT orientation forces
 * length 1 regardless of body length (horizontal, same-rank → minlen 0);
 * otherwise it is the body char count (CommandLinkClass.getQueueLength).
 */
function arrowLength(rawArrow: string): number {
  // #lizard forgives — false positive: arrowLength is CCN 4, but the checker's
  // tokenizer merges it with the following arrow-glyph helpers (the `<`/`>`/
  // `|`/`{`/`}` glyphs in HEAD1_KIND/HEAD2_KIND's string keys and
  // headToDecor's switch cases confuse its brace/angle matching) and reports
  // the combined span. Each real function here is under the limit.
  const stripped = stripArrowStyle(rawArrow);
  const dir = ARROW_DIR_RE.exec(stripped)?.[0]?.toLowerCase();
  const horizontal = dir !== undefined && (dir[0] === 'l' || dir[0] === 'r');
  return horizontal ? 1 : (stripped.match(/[-.=]/g) ?? []).length;
}

/** The two head glyphs surrounding an arrow's body run, split from the
 *  canonicalised token — mirrors upstream's independent ARROW_HEAD1/
 *  ARROW_HEAD2 regex groups (LinkDecor.getRegexDecors1()/getRegexDecors2()).
 *  Shared by resolveArrow (type/direction) and parseArrowDecors (per-end
 *  rendering decor), so both agree on where the body run sits. */
function splitCanonicalHeads(canonical: string): { head1: string; head2: string } {
  const firstBody = canonical.search(BODY_CHAR_RE);
  if (firstBody === -1) return { head1: canonical, head2: '' };
  let lastBody = firstBody;
  for (let i = canonical.length - 1; i > firstBody; i--) {
    const c = canonical[i];
    if (c === '-' || c === '.') {
      lastBody = i;
      break;
    }
  }
  return { head1: canonical.slice(0, firstBody), head2: canonical.slice(lastBody + 1) };
}

/**
 * One arrow head's decoration family, restricted to the decors this parser
 * composes independently (mirrors decoration/LinkDecor.java's enum, one
 * variant per glyph set this grammar recognises). `'unknown'` covers glyphs
 * outside every set here (crow's-foot `|`/`}`/`{`) — resolveArrow falls back
 * to the crow's-foot association default for those instead of picking a kind.
 */
type DecorKind =
  | 'none'
  | 'extends'
  | 'arrow'
  | 'composition'
  | 'aggregation'
  | 'notNavigable'
  | 'plus'
  | 'lollipop'
  | 'unknown';

// LinkDecor.EXTENDS decors1("<|","^")/decors2("|>","^"); ARROW decors1("<",
// "<_")/decors2(">","_>"); COMPOSITION("*"); AGGREGATION("o");
// NOT_NAVIGABLE("x"); PLUS("+"); PARENTHESIS decors1(")")/decors2("(")
// (CommandLinkLollipop's provide/require glyphs).
const HEAD1_KIND: Record<string, DecorKind> = {
  '': 'none', '<|': 'extends', '<_': 'arrow', '<': 'arrow',
  '*': 'composition', 'o': 'aggregation', 'x': 'notNavigable',
  '+': 'plus', ')': 'lollipop',
};
const HEAD2_KIND: Record<string, DecorKind> = {
  '': 'none', '|>': 'extends', '_>': 'arrow', '>': 'arrow',
  '*': 'composition', 'o': 'aggregation', 'x': 'notNavigable',
  '+': 'plus', '(': 'lollipop',
};

/**
 * Whether a decor kind participates in swapDirection (which operand is
 * semantically "to"): an arrowhead or a triangle always does — even when a
 * *different* decor on the other side wins the type (`<-o`'s `<` sets
 * direction while `o` sets the aggregation type); composition/aggregation/
 * notNavigable/plus alone never do (`*--`/`--*` are both swapDirection=false
 * regardless of which side carries the `*`). The lollipop paren is also a
 * direction-kind: `--(` / `)--` are mirror forms of the same link, and the
 * paren-bearing side is always "to" (CommandLinkLollipop).
 */
function isDirectionKind(kind: DecorKind): boolean {
  return kind === 'extends' || kind === 'arrow' || kind === 'lollipop';
}

/**
 * Relationship type from the two decor kinds plus whether the body is
 * dashed, by upstream's significance order (CommandLinkClass#describeRelation):
 * a triangle wins over composition, which wins over aggregation, which wins
 * over a plain arrowhead/no decor at all (association/dependency/usage,
 * split by dashed body + whether an arrowhead is present anywhere).
 */
function resolveType(kind1: DecorKind, kind2: DecorKind, dashed: boolean): RelationshipType {
  if (kind1 === 'extends' || kind2 === 'extends') return dashed ? 'implementation' : 'extension';
  if (kind1 === 'composition' || kind2 === 'composition') return 'composition';
  if (kind1 === 'aggregation' || kind2 === 'aggregation') return 'aggregation';
  if (!dashed) return 'association';
  return kind1 === 'arrow' || kind2 === 'arrow' ? 'dependency' : 'usage';
}

/**
 * Resolve a raw arrow token to semantic type + direction by composing the
 * two independent head decors (mirrors CommandLinkClass's
 * ARROW_HEAD1/ARROW_HEAD2 → LinkDecor.lookupDecors1/2 → LinkType), rather
 * than a flat table of enumerated head1+head2 combinations.
 */
function resolveArrow(rawArrow: string): ArrowInfo | null {
  const canonical = canonicalizeArrow(rawArrow);
  const { head1, head2 } = splitCanonicalHeads(canonical);
  const kind1 = HEAD1_KIND[head1] ?? 'unknown';
  const kind2 = HEAD2_KIND[head2] ?? 'unknown';
  if (kind1 === 'unknown' || kind2 === 'unknown') {
    // Crow's-foot (ER cardinality) arrows carry a `|`/`}`/`{` glyph outside
    // this parser's decor sets; they are structurally a plain association
    // edge. Regex built from a string so the `{`/`}` do not confuse the
    // complexity checker.
    if (CROWS_FOOT_RE.test(rawArrow)) return { type: 'association', swapDirection: false };
    return null;
  }
  const type = resolveType(kind1, kind2, canonical.includes('.'));
  const swapDirection = isDirectionKind(kind1) && !isDirectionKind(kind2);
  return { type, swapDirection };
}

/** Map one arrow head glyph (the run before/after the body) to its decoration. */
function headToDecor(head: string): LinkDecor {
  switch (head) {
    case '<':
    case '>':
    case '<_':
    case '_>':
      return 'open';
    case '<|':
    case '|>':
      return 'triangle';
    case '*':
      return 'filledDiamond';
    case 'o':
      return 'diamond';
    default:
      // '', NOT_NAVIGABLE 'x', PLUS '+', lollipop '('/')', crow's-foot '|}{'
      // → no standard marker (D6 scope: DOT parity only, not SVG rendering).
      return 'none';
  }
}

/**
 * Parse the two head decorations of an arrow token independently (D6, mirroring
 * upstream's per-end LinkDecor). The token is `HEAD1 BODY HEAD2`; HEAD1
 * decorates the left operand's end, HEAD2 the right operand's. `swapDirection`
 * (left operand is `to`) then assigns them to source/target so a plain `--` is
 * undecorated at both ends while `-->` is `open` at the target.
 */
function parseArrowDecors(
  rawArrow: string,
  swapDirection: boolean,
): { sourceDecor: LinkDecor; targetDecor: LinkDecor } {
  const { head1, head2 } = splitCanonicalHeads(canonicalizeArrow(rawArrow));
  const d1 = headToDecor(head1);
  const d2 = headToDecor(head2);
  return swapDirection
    ? { targetDecor: d1, sourceDecor: d2 }
    : { sourceDecor: d1, targetDecor: d2 };
}

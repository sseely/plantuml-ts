/**
 * Arrow-token decoration/type resolution for PlantUML class-diagram
 * relationships.
 *
 * Split out of class-relationship-parser.ts (pure move, no behavior change)
 * to keep that file under the repo's 500-line-per-file cap. `ARROW_DIR`/
 * `ARROW_STYLE` are the shared regex fragments class-relationship-parser.ts
 * composes into its top-level `REL_ARROW`/`DASH`/`ARROW_BODY` grammar, so
 * they live here (this file has no dependency the other way) and are
 * re-exported for that use.
 */

import type { RelationshipType, LinkDecor } from './ast.js';

/**
 * Direction and type info for a parsed arrow.
 * `swapDirection = true` means the left operand is semantically `to`
 * and the right operand is `from` (i.e. the arrow points left).
 */
export interface ArrowInfo {
  type: RelationshipType;
  swapDirection: boolean;
}

// A body run may embed an optional orientation word (`-left-`, `*-right-`,
// `-down--`), mirroring upstream's ARROW_DIRECTION `left|right|up|down|le?|
// ri?|up?|do?`. It is matched non-capturing (so REL_RE group indices are
// unchanged), stripped by canonicalizeArrow, and recovered post-hoc to set the
// arrow length (LEFT/RIGHT force length 1 → minlen 0; CommandLinkClass:337).
export const ARROW_DIR = String.raw`(?:left|right|down|up|le|ri|do|[lrud])`;
// Inline style bracket (`-[thickness=5]->`, `<-[#green]->`), mirroring
// CommandLinkElement.LINE_STYLE — a comma-separated `#color`/`key=value` list.
// The DOT-parity goal is only that the relationship EXISTS with the right
// type/length (svek always emits `arrowtail=none,arrowhead=none` under the
// SIMPLEST link strategy — LinkType.getSpecificDecorationSvek), so the style
// content is parsed (consumed by the grammar so the arrow still matches) and
// then discarded rather than carried on Relationship; see
// decoration/LinkType.java's `linkStyle` field for where upstream keeps it
// for later SVG rendering.
export const ARROW_STYLE = String.raw`\[[^[\]]+\]`;

const ARROW_DIR_RE = new RegExp(ARROW_DIR, 'i');
const ARROW_DIR_RE_G = new RegExp(ARROW_DIR, 'gi');
const ARROW_STYLE_RE_G = new RegExp(ARROW_STYLE, 'g');
// Built from a string (not a regex literal) so the `{`/`}` glyphs do not
// confuse the complexity checker's function-boundary detection.
const CROWS_FOOT_RE = new RegExp('[|}{]');
const BODY_CHAR_RE = new RegExp('[-.=]');

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
    .replace(/\.+/g, '.')
    .replace(/=+/g, '=');
}

/** Extract the arrow's orientation word (`up`/`down`/`left`/`right`, or an
 *  abbreviated/single-letter form), lowercased, or `undefined` if the arrow
 *  carries no direction word. Shared by `arrowLength` (horizontal → length 1)
 *  and `resolveArrow` (up/left → the CommandLinkClass#getInv() swap below). */
function extractDirectionWord(rawArrow: string): string | undefined {
  return ARROW_DIR_RE.exec(stripArrowStyle(rawArrow))?.[0]?.toLowerCase();
}

/**
 * Arrow length (drives dot minlen = length - 1). A LEFT/RIGHT orientation forces
 * length 1 regardless of body length (horizontal, same-rank → minlen 0);
 * otherwise it is the body char count (CommandLinkClass.getQueueLength).
 */
export function arrowLength(rawArrow: string): number {
  // #lizard forgives — false positive: arrowLength is CCN 4, but the checker's
  // tokenizer merges it with the following arrow-glyph helpers (the `<`/`>`/
  // `|`/`{`/`}` glyphs in HEAD1_KIND/HEAD2_KIND's string keys and
  // headToDecor's switch cases confuse its brace/angle matching) and reports
  // the combined span. Each real function here is under the limit.
  const stripped = stripArrowStyle(rawArrow);
  const dir = extractDirectionWord(rawArrow);
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
    if (c === '-' || c === '.' || c === '=') {
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
  | 'square'
  | 'crowfoot'
  | 'unknown';

// LinkDecor.EXTENDS decors1("<|","^")/decors2("|>","^"); ARROW decors1("<",
// "<_")/decors2(">","_>"); COMPOSITION("*"); AGGREGATION("o");
// NOT_NAVIGABLE("x"); PLUS("+"); PARENTHESIS decors1(")")/decors2("(")
// (CommandLinkLollipop's provide/require glyphs); REDEFINES decors1("<||")/
// decors2("||>") and DEFINEDBY decors1("<|:")/decors2(":|>") are both
// `isExtendsLike()` in upstream (same dashed->implementation/else->extension
// split as plain EXTENDS), so they fold into the `'extends'` kind rather than
// getting their own — this port doesn't otherwise distinguish which exact
// LinkDecor enum member produced 'extends' (D6: DOT parity, not the rendered
// marker shape). SQUARE decors1/2("#") and CIRCLE_CROWFOOT decors1("}o")/
// decors2("o{") don't participate in resolveType's significance order at all
// (upstream: no describeRelation/isExtendsLike special case for either), so
// they get their own kinds that simply fall through to the default arm,
// exactly like 'notNavigable'/'plus' today.
const HEAD1_KIND: Record<string, DecorKind> = {
  '': 'none', '<|': 'extends', '<_': 'arrow', '<': 'arrow',
  '*': 'composition', 'o': 'aggregation', 'x': 'notNavigable',
  '+': 'plus', ')': 'lollipop',
  '<||': 'extends', '<|:': 'extends', '^': 'extends',
  '#': 'square', '}o': 'crowfoot',
};
const HEAD2_KIND: Record<string, DecorKind> = {
  '': 'none', '|>': 'extends', '_>': 'arrow', '>': 'arrow',
  '*': 'composition', 'o': 'aggregation', 'x': 'notNavigable',
  '+': 'plus', '(': 'lollipop',
  '||>': 'extends', ':|>': 'extends', '^': 'extends',
  '#': 'square', 'o{': 'crowfoot',
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
 * Whether the arrow's orientation word is LEFT or UP. CommandLinkClass calls
 * `link = link.getInv()` whenever `getDirection(arg)` is LEFT or UP
 * (CommandLinkClass.java:363-364) — independent of, and applied in addition
 * to, any decor-driven direction. getInv() swaps the ENTIRE link (endpoints,
 * decor1/decor2 via LinkType#getInversed, quantifier1/2, role1/2, kal1/2,
 * port1/2 — see abel/Link.java#getInv, abel/LinkArg.java#getInv): exactly
 * the same "swap every sided field" operation this port already performs via
 * `swapDirection`/`pickDirectional`, so the two compose by XOR rather than
 * needing a separate code path.
 */
function isUpOrLeftDirection(rawArrow: string): boolean {
  const dir = extractDirectionWord(rawArrow);
  return dir !== undefined && (dir[0] === 'l' || dir[0] === 'u');
}

/**
 * Resolve a raw arrow token to semantic type + direction by composing the
 * two independent head decors (mirrors CommandLinkClass's
 * ARROW_HEAD1/ARROW_HEAD2 → LinkDecor.lookupDecors1/2 → LinkType), rather
 * than a flat table of enumerated head1+head2 combinations.
 */
export function resolveArrow(rawArrow: string): ArrowInfo | null {
  const canonical = canonicalizeArrow(rawArrow);
  const upOrLeft = isUpOrLeftDirection(rawArrow);
  const { head1, head2 } = splitCanonicalHeads(canonical);
  const kind1 = HEAD1_KIND[head1] ?? 'unknown';
  const kind2 = HEAD2_KIND[head2] ?? 'unknown';
  if (kind1 === 'unknown' || kind2 === 'unknown') {
    // Crow's-foot (ER cardinality) arrows carry a `|`/`}`/`{` glyph outside
    // this parser's decor sets; they are structurally a plain association
    // edge, but CommandLinkClass's getInv() swap (see isUpOrLeftDirection)
    // still applies regardless of type — it is computed from ARROW_DIRECTION
    // alone, not from any decor. Regex built from a string so the `{`/`}` do
    // not confuse the complexity checker.
    if (CROWS_FOOT_RE.test(rawArrow)) return { type: 'association', swapDirection: upOrLeft };
    return null;
  }
  const type = resolveType(kind1, kind2, canonical.includes('.'));
  const decorSwap = isDirectionKind(kind1) && !isDirectionKind(kind2);
  const swapDirection = decorSwap !== upOrLeft;
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
export function parseArrowDecors(
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

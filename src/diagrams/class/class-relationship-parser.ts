/**
 * Relationship (arrow) line parsing for PlantUML class diagrams.
 *
 * Extracted from parser.ts (pure move, no behavior change) to keep
 * parser.ts under the repo's 500-line-per-file cap.
 */

import type { Classifier, Relationship } from './ast.js';
import { firstWithName } from './class-namespace.js';
import { ARROW_DIR, ARROW_STYLE, resolveArrow, parseArrowDecors, arrowLength } from './class-arrow-grammar.js';

// ---------------------------------------------------------------------------
// Relationship arrow parsing
// ---------------------------------------------------------------------------

/**
 * Recognised arrow tokens, longest-alternative-first within each prefix
 * family so the alternation naturally prefers the more specific token
 * (`<|--` over `<--`, `...>` over `..>` over `.>` over `..`, etc.).
 *
 * Regex groups produced by REL_RE:
 *   1: left identifier (may include `.ns` segments and a `::port` suffix)
 *   2: optional left qualifier (`[Qualifier]`)
 *   3: optional left multiplicity (quoted)
 *   4: optional left role (`/roleName`, FIRST_ROLE)
 *   5: the arrow token
 *   6: optional right multiplicity (quoted)
 *   7: optional right role (`/roleName`, SECOND_ROLE)
 *   8: optional right qualifier (`[Qualifier]`)
 *   9: right identifier
 *   10: optional label after ':'
 */
// The optional leading `\.?` accepts a leading-dot root-namespace reference
// (`.BaseClass` = the classifier `BaseClass` in the root namespace, resolved by
// resolveReference). Without it the endpoint regex rejects the whole line and the
// relationship is silently dropped (mission A3 Batch-1b diagnosis).
// Exported so class-lollipop.ts (CommandLinkLollipop's ENT1/ENT2) reuses the
// exact same identifier grammar rather than a second, drifting copy.
// Atom charset is upstream getClassIdentifier()'s `[%pLN_$]+` — Unicode
// letter/number plus underscore and dollar (regex/Pattern2.java:56), NOT
// ASCII \w. Every regex built from this fragment needs the u flag.
const ID_ATOM = String.raw`[\p{L}\p{N}_$]+`;
export const CLASS_ID = String.raw`\.?${ID_ATOM}(?:\.${ID_ATOM})*(?:::${ID_ATOM})?|"[^"]+"`;
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
// ARROW_DIR/ARROW_STYLE are imported from class-arrow-grammar.ts, which also
// hosts arrowLength/resolveArrow/parseArrowDecors (same fragments, shared).
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
// Middle-circle marker (LinkDecor.CIRCLE_CONNECT's "0)"/"(0" plus the plain
// "0"/"(0)" forms), mirroring CommandLinkClass's INSIDE group
// `(0|\(0\)|\(0|0\))(?=[-=.~])` — sits between the two body runs (`-0)-`),
// longest-alternative-first so `0)` isn't shadowed by a bare `0`. This is a
// rendering-only middle marker (LinkType#withMiddleCircle*): it does not
// change relationship type/direction (getLinkType only reads ARROW_HEAD1/2),
// so it is matched and discarded rather than carried on Relationship — same
// posture as ARROW_STYLE.
const ARROW_INSIDE = String.raw`\(0\)|0\)|\(0|0`;
// Composed body: BODY1(1+) STYLE1? DIRECTION? INSIDE? STYLE2? BODY2(0+),
// mirroring CommandLinkClass's six body-adjacent regex groups in that exact
// order (ARROW_BODY1/ARROW_STYLE1/ARROW_DIRECTION/INSIDE/ARROW_STYLE2/
// ARROW_BODY2).
// Body charset is upstream's `[-=.]` (CommandLinkClass.java:133,138) — `=`
// is the bold-line body char, same length/type semantics as `-`.
const ARROW_BODY =
  String.raw`[-.=]+(?:${ARROW_STYLE})?(?:${ARROW_DIR})?(?:${ARROW_INSIDE})?(?:${ARROW_STYLE})?[-.=]*`;
// Independent head-glyph sets, longest-alternative-first within each shared
// prefix, mirroring LinkDecor.getRegexDecors1()/getRegexDecors2() — each
// decor is looked up independently of the other side (`resolveArrow` below),
// not enumerated as fixed head1+head2 combinations. `<_`/`_>` are the ARROOW
// underscore variants (LinkDecor.ARROW's second decor string); `)`/`(` are
// the lollipop provide/require glyphs (LinkDecor.PARENTHESIS); `x` is
// NOT_NAVIGABLE; `+` is PLUS; `<||`/`||>` is REDEFINES; `<|:`/`:|>` is
// DEFINEDBY; `^` is EXTENDS's second decor string (alongside `<|`/`|>`); `#`
// is SQUARE; `}o`/`o{` is CIRCLE_CROWFOOT. `o`/`x` are excluded here — see
// WORD_HEAD.
const HEAD1_SAFE = String.raw`(?:<\|\||<\|:|<\||<_|<|\*|\+|\)|\^|#|\}o)?`;
const HEAD2_CHARS = String.raw`\|\|>|:\|>|\|>|_>|>|\*|o\{|o|x|\+|\^|#|\(`;
const HEAD2 = String.raw`(?:${HEAD2_CHARS})?`;
const HEAD2_REQUIRED = String.raw`(?:${HEAD2_CHARS})`;
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
  String.raw`(?:-[-.=]*|=[-.=]*|\.[-.=]+)(?:${ARROW_STYLE})?(?:${ARROW_DIR})?(?:${ARROW_STYLE})?[-.=]*`;
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
// Inline line-color block after the second endpoint (`A --> B #red;text:blue
// : label`), mirroring CommandLinkClass's `color().getRegex()` position (ENT2,
// then COLOR, then URL/STEREOTYPE, then the label) and ColorParser's grammar
// (`#word[-\|/]?word` or the `#word;attr:word;attr2:word2` multi-attribute
// form, ColorParser.java:43-45). D6 scope is DOT parity, not SVG rendering —
// matched and discarded like ARROW_STYLE, so a line carrying it no longer
// falls through REL_RE entirely (mission A2 iteration 12: `--> B #c;t:v :
// label` was silently dropping the whole relationship, not just the color).
const REL_COLOR = String.raw`#\w+(?:[-./|\\](?:\w+)?)?(?:;\w+(?:\.\w+)*(?::\w+(?:[-./|\\]\w+)?)?)*`;
// FIRST_ROLE/SECOND_ROLE: a `/roleName` (bare or quoted) right after each
// quoted cardinality (CommandLinkClass.java:127,144). Plus the URL/stereotype
// tokens after ENT2 (UrlBuilder.OPTIONAL, StereotypePattern.optional) — like
// REL_COLOR, matched-and-discarded (D6: edge existence, not rendering).
const REL_ROLE = String.raw`(?:/([^\s]+|"[^"]*"))?`;
const REL_URL = String.raw`\[\[[^[\]]*\]\]`;
const REL_STEREO = String.raw`<<[^<>]*>>`;

/**
 * Optional leading `@<weight>` header (CommandLinkClass.java:111,
 * `HEADER = "@([\d.]+)"`, one space-run required after it) — a numeric DOT
 * edge weight (rank-assignment tie-breaker), `link.setWeight(...)` at
 * CommandLinkClass.java:381-383. Non-capturing here; `parseRelationshipLine`
 * strips and parses it itself before running {@link REL_RE} against the
 * remainder, so it need not renumber every other capture group.
 */
const REL_HEADER_RE = /^@([\d.]+)\s+/;
const REL_HEADER = String.raw`(?:@[\d.]+\s+)?`;

const REL_RE = new RegExp(
  String.raw`^(${CLASS_ID})` +
    String.raw`\s*(?:\[([^[\]]+)\])?` +
    String.raw`\s*(?:"([^"]*)")?${REL_ROLE}` +
    String.raw`\s*(${REL_ARROW})` +
    String.raw`\s*(?:"([^"]*)")?${REL_ROLE}` +
    String.raw`\s*(?:\[([^[\]]+)\])?` +
    String.raw`\s*(${CLASS_ID})` +
    String.raw`\s*(?:${REL_COLOR})?` +
    String.raw`\s*(?:${REL_URL})?\s*(?:${REL_STEREO})?` +
    String.raw`\s*(?::\s*(.+))?$`,
  'u',
);

/**
 * Non-capturing dispatch-only variant of REL_RE, used by the COMMANDS table
 * to decide whether a line is a relationship line before running the full
 * (capturing) parseRelationshipLine.
 */
export const REL_DISPATCH_RE = new RegExp(
  String.raw`^${REL_HEADER}(?:${CLASS_ID})` +
    String.raw`\s*(?:\[[^[\]]+\])?` +
    String.raw`\s*(?:"[^"]*")?${REL_ROLE}` +
    String.raw`\s*(?:${REL_ARROW})` +
    String.raw`\s*(?:"[^"]*")?${REL_ROLE}` +
    String.raw`\s*(?:\[[^[\]]+\])?` +
    String.raw`\s*(?:${CLASS_ID})` +
    String.raw`\s*(?:${REL_COLOR})?` +
    String.raw`\s*(?:${REL_URL})?\s*(?:${REL_STEREO})?` +
    String.raw`(?:\s*:\s*.+)?$`,
  'u',
);

/**
 * A classifier id with an optional `::port` member-name suffix split off.
 * Exported for reuse by class-notes.ts — `note left of Class::member` uses
 * the same entity-ref grammar as a relationship endpoint's `Class::member`
 * (upstream: both ultimately resolve via `CucaDiagram` port-aware lookup).
 *
 * `nsSep` is the diagram's CONFIGURED namespace separator (`state
 * .namespaceSeparator`); `classifiers` is every classifier declared so far.
 * Two upstream guards (both in `CommandLinkClass.executeArg`) suppress the
 * `entity::port` split, in order:
 *  - when `nsSep` is itself `::`, `getPortId`/`removePortId` unconditionally
 *    disable the split — a `::` inside a reference is always a namespace
 *    join in that case, never a port marker;
 *  - otherwise, when the WHOLE raw endpoint already matches an existing
 *    classifier's simple/leaf name (`firstWithName(ent1String) != null`,
 *    line 309/314), the reference resolves to that classifier as-is — a
 *    class explicitly DECLARED with a literal `::` in its name (`class
 *    Role::BadPix` under the default `.` separator, where `::` is just
 *    ordinary name characters, not a separator) must resolve as itself when
 *    later referenced, not get mis-split into a port reference.
 * Both default to values that preserve the unconditional split (`null`/`[]`)
 * for the one caller (class-notes.ts) that does not thread the diagram's
 * separator/classifiers through yet.
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:298-316 (removePortId/getPortId)
 * @see ~/git/plantuml/.../classdiagram/command/CommandLinkClass.java:306-317
 */
export function splitEndpointPort(
  raw: string,
  nsSep: string | null = null,
  classifiers: readonly Classifier[] = [],
): { id: string; port?: string } {
  if (raw.startsWith('"')) return { id: stripQuotes(raw) };
  if (nsSep === '::') return { id: raw };
  const sepIdx = raw.indexOf('::');
  if (sepIdx === -1) return { id: raw };
  if (firstWithName(classifiers, nsSep, raw) !== undefined) return { id: raw };
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

interface OptionalRelFields {
  fromMultiplicity?: string | undefined;
  toMultiplicity?: string | undefined;
  fromRole?: string | undefined;
  toRole?: string | undefined;
  label?: string | undefined;
  fromPort?: string | undefined;
  toPort?: string | undefined;
  fromQualifier?: string | undefined;
  toQualifier?: string | undefined;
  length?: number | undefined;
  weight?: number | undefined;
}

/** Assemble a Relationship, omitting undefined optional fields (and an
 *  empty-string `label` — the one field the grammar can capture as ''). */
function withOptionalFields(
  base: Pick<Relationship, 'from' | 'to' | 'type'>,
  optional: OptionalRelFields,
): Relationship {
  const rel = { ...base } as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(optional) as Array<
    [keyof OptionalRelFields, string | number | undefined]
  >) {
    if (value === undefined || (key === 'label' && value === '')) continue;
    rel[key] = value;
  }
  return rel as unknown as Relationship;
}

/**
 * `nsSep`/`classifiers` (the diagram's configured `set namespaceSeparator`
 * and classifiers declared so far) are forwarded to {@link splitEndpointPort}
 * for both endpoints — see its doc for the two guards that suppress
 * `entity::port` splitting.
 */
/** Sided (from/to) fields carried by REL_RE's optional groups: cardinality,
 *  role (FIRST_ROLE/SECOND_ROLE, CommandLinkClass.java:127,144 — bare or
 *  quoted, stripped here), `Class::member` port, and `[Qualifier]`. */
function sidedRelFields(
  m: RegExpExecArray,
  swapDirection: boolean,
  left: { port?: string | undefined },
  right: { port?: string | undefined },
): Pick<
  OptionalRelFields,
  'fromMultiplicity' | 'toMultiplicity' | 'fromRole' | 'toRole' | 'fromPort' | 'toPort' | 'fromQualifier' | 'toQualifier'
> {
  const mult = pickDirectional(swapDirection, m[3], m[6]);
  const role = pickDirectional(swapDirection, m[4] && stripQuotes(m[4]), m[7] && stripQuotes(m[7]));
  const port = pickDirectional(swapDirection, left.port, right.port);
  const qual = pickDirectional(swapDirection, m[2], m[8]);
  return {
    fromMultiplicity: mult.from, toMultiplicity: mult.to,
    fromRole: role.from, toRole: role.to,
    fromPort: port.from, toPort: port.to,
    fromQualifier: qual.from, toQualifier: qual.to,
  };
}

/** Quoted multiplicities INSIDE the free-text label (`: "1" contains "0..*"`),
 *  mirroring Labels#init (descdiagram/command/Labels.java:75-104): when NO
 *  explicit `"m"` group sits beside either endpoint, the label decomposes via
 *  three anchored patterns — BOTH_LABELS / FIRST_LABEL_ONLY /
 *  SECOND_LABEL_ONLY — into firstLabel (left end), the residual middle label
 *  (trimmed, outer quotes stripped), and secondLabel (right end); these feed
 *  taillabel/label/headlabel in the DOT (tilipa-86-suxi130). Returns null
 *  when no pattern matches (label stays whole). */
function decomposeLabel(
  label: string,
): { first?: string | undefined; mid: string; second?: string | undefined } | null {
  const both = /^"([^"]+)"([^"]+)"([^"]+)"$/.exec(label);
  if (both !== null)
    return { first: both[1]!, mid: stripQuotes(both[2]!.trim()).trim(), second: both[3]! };
  const firstOnly = /^"([^"]+)"([^"]+)$/.exec(label);
  if (firstOnly !== null)
    return { first: firstOnly[1]!, mid: stripQuotes(firstOnly[2]!.trim()).trim() };
  const secondOnly = /^([^"]+)"([^"]+)"$/.exec(label);
  if (secondOnly !== null)
    return { mid: stripQuotes(secondOnly[1]!.trim()).trim(), second: secondOnly[2]! };
  return null;
}

export function parseRelationshipLine(line: string, nsSep: string | null = null, classifiers: readonly Classifier[] = []): Relationship | null {
  const header = REL_HEADER_RE.exec(line);
  const weight = header !== null ? Number(header[1]) : undefined;
  const m = REL_RE.exec(header !== null ? line.slice(header[0].length) : line);
  if (m === null) return null;

  const arrow = m[5]!;
  const info = resolveArrow(arrow);
  if (info === null) return null;
  const decors = parseArrowDecors(arrow, info.swapDirection);

  const left = splitEndpointPort(m[1]!, nsSep, classifiers);
  const right = splitEndpointPort(m[9]!, nsSep, classifiers);
  const id = pickDirectional(info.swapDirection, left.id, right.id);
  const sided = sidedRelFields(m, info.swapDirection, left, right);
  let label = m[10]?.trim();
  // Label-embedded multiplicities (Labels#init) — only when neither explicit
  // quantifier group matched (upstream: `firstLabel == null && secondLabel ==
  // null`). Decomposed ends map left→first / right→second, then go through
  // the SAME direction swap as the explicit quoted groups (upstream swaps
  // them via LinkArg#getInv on up/left; svek sides them by decor direction).
  if (label !== undefined && m[3] === undefined && m[6] === undefined) {
    const dec = decomposeLabel(label);
    if (dec !== null) {
      label = dec.mid;
      const mult = pickDirectional(info.swapDirection, dec.first, dec.second);
      sided.fromMultiplicity = mult.from;
      sided.toMultiplicity = mult.to;
    }
  }
  // Arrow length drives dot minlen (length - 1): body char count, or 1 when the
  // arrow is horizontally oriented (`-left-`/`-right-`). See arrowLength.
  const length = arrowLength(arrow);

  return withOptionalFields(
    { from: id.from, to: id.to, type: info.type, ...decors },
    { ...sided, label, length, weight },
  );
}

export function stripQuotes(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}

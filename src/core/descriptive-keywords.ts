/**
 * Shared descriptive-keyword table — single source of truth for the descriptive
 * diagram engine (component / use-case / deployment).
 *
 * Mirrors upstream PlantUML's `CommandCreateElementFull.ALL_TYPES`
 * (`net.sourceforge.plantuml.descdiagram.command`), which keys every descriptive
 * element off one keyword set, each carrying a `USymbol` shape. This module is
 * consumed by the Phase-1 dispatch guard (`class`/`sequence` `accepts()`) and the
 * Phase-2 description engine (AST, parser, layout, renderer).
 *
 * See plans/consolidate-description-engine/decisions.md — D2 (full `ALL_TYPES`),
 * D3 (descriptive-signal guard, exclusions `interface`/`package`/`actor`).
 */

/**
 * Every shape in upstream `ALL_TYPES`, plus `note` — a leaf entity created by
 * `CommandFactoryNote`/`CommandFactoryNoteOnEntity`/`CommandFactoryNoteOnLink`
 * (`net.sourceforge.plantuml.command.note`), never dispatched through the
 * `ALL_TYPES` keyword table (notes have their own `note ...` grammar).
 * Business variants of `actor`/`usecase` (upstream `actor/` / `usecase/`) map
 * to the `-business` symbols. The `port` symbol covers the `port` / `portin` /
 * `portout` keywords.
 */
export type USymbol =
  | 'component'
  | 'interface'
  | 'node'
  | 'package'
  | 'folder'
  | 'frame'
  | 'cloud'
  | 'database'
  | 'storage'
  | 'actor'
  | 'actor-business'
  | 'usecase'
  | 'usecase-business'
  | 'rectangle'
  | 'artifact'
  | 'card'
  | 'file'
  | 'queue'
  | 'stack'
  | 'agent'
  | 'boundary'
  | 'control'
  | 'entity'
  | 'person'
  | 'hexagon'
  | 'label'
  | 'circle'
  | 'collections'
  | 'port'
  | 'action'
  | 'process'
  | 'note';

/**
 * Keyword → `USymbol`, in upstream `ALL_TYPES` declaration order. Business
 * variants (`actor/`, `usecase/`) precede their plain forms, mirroring upstream
 * so the longer token is preferred during alternation. The single source the
 * other exports are derived from — never hand-duplicate this list.
 */
const KEYWORD_SYMBOL_ENTRIES: readonly (readonly [string, USymbol])[] = [
  ['person', 'person'],
  ['artifact', 'artifact'],
  ['actor/', 'actor-business'],
  ['actor', 'actor'],
  ['folder', 'folder'],
  ['card', 'card'],
  ['file', 'file'],
  ['package', 'package'],
  ['rectangle', 'rectangle'],
  ['hexagon', 'hexagon'],
  ['label', 'label'],
  ['node', 'node'],
  ['frame', 'frame'],
  ['cloud', 'cloud'],
  ['action', 'action'],
  ['process', 'process'],
  ['database', 'database'],
  ['queue', 'queue'],
  ['stack', 'stack'],
  ['storage', 'storage'],
  ['agent', 'agent'],
  ['usecase/', 'usecase-business'],
  ['usecase', 'usecase'],
  ['component', 'component'],
  ['boundary', 'boundary'],
  ['control', 'control'],
  ['entity', 'entity'],
  ['interface', 'interface'],
  ['circle', 'circle'],
  ['collections', 'collections'],
  ['port', 'port'],
  ['portin', 'port'],
  ['portout', 'port'],
];

/** The descriptive keyword list (lowercase), in upstream declaration order. */
export const ALL_TYPES: readonly string[] = KEYWORD_SYMBOL_ENTRIES.map(
  ([keyword]) => keyword,
);

/** Keyword → `USymbol` shape lookup. */
export const KEYWORD_TO_SYMBOL: ReadonlyMap<string, USymbol> = new Map(
  KEYWORD_SYMBOL_ENTRIES,
);

/**
 * Keywords `class`/`sequence` legitimately parse, excluded from the descriptive
 * signal per D3: a pure `interface`/`package` block stays a class diagram, and a
 * bare `actor` + messages stays a sequence diagram. The business form `actor/`
 * is *not* excluded — it only appears in descriptive (use-case) diagrams.
 */
const SIGNAL_EXCLUSIONS: ReadonlySet<string> = new Set([
  'interface',
  'package',
  'actor',
]);

/** `ALL_TYPES` minus `interface`, `package`, `actor` (per D3). */
export const DESCRIPTIVE_ONLY_KEYWORDS: ReadonlySet<string> = new Set(
  ALL_TYPES.filter((keyword) => !SIGNAL_EXCLUSIONS.has(keyword)),
);

/** Number of leading lines scanned, matching the existing `accepts()` slice. */
const SCAN_LINE_LIMIT = 20;

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a case-insensitive regex matching a trimmed line that starts with any of
 * `keywords` followed by whitespace or end-of-line (word-boundary). Longest
 * keywords first so `actor/` wins over `actor` and `portin` over `port`. Derived
 * from the keyword set — never hand-duplicated.
 */
function buildKeywordPattern(keywords: readonly string[]): RegExp {
  return new RegExp(
    '^(?:' +
      [...keywords]
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join('|') +
      ')(?=\\s|$)',
    'i',
  );
}

/** Descriptive-only keywords (D3 subset) — for the class/sequence guard. */
const DESCRIPTIVE_KEYWORD_PATTERN = buildKeywordPattern([
  ...DESCRIPTIVE_ONLY_KEYWORDS,
]);

/**
 * Keywords the description plugin claims via `accepts()`: `ALL_TYPES` minus bare
 * `actor` and `interface`. Those two route elsewhere even though the engine can
 * render them — a bare `actor` + messages is a sequence diagram, and a pure
 * `interface` block is a class diagram (both registered ahead of description).
 * `package` IS kept (unlike the D3 guard set) so empty component packages route
 * here; the business forms `actor/`/`usecase/` are kept (unambiguous), and the
 * `:User:` colon actor is handled by ACTOR_COLON_SHORTHAND below.
 */
const DESCRIPTION_ACCEPTS_KEYWORDS = ALL_TYPES.filter(
  (keyword) => keyword !== 'actor' && keyword !== 'interface',
);
const DESCRIPTIVE_ELEMENT_PATTERN = buildKeywordPattern(
  DESCRIPTION_ACCEPTS_KEYWORDS,
);

/**
 * Element shorthands that are themselves descriptive signals, mirroring the
 * existing component/usecase `accepts()` patterns:
 * `[Comp]` (component), `(Use Case)` / `()` (use-case / interface).
 */
const ELEMENT_SHORTHAND_PATTERNS: readonly RegExp[] = [
  /^\[.+\]/, // [Component] bracket notation
  /^\(.+\)/, // (Use Case) parens notation
  /^\(\)/, //   () interface shorthand
];

/**
 * Upstream classdiagram `CommandLinkClass`'s `COUPLE` grammar (NOT
 * descdiagram): `\([%s]*(SINGLE2)[%s]*,[%s]*(SINGLE2)[%s]*\)` — a
 * parenthesized pair of comma-separated identifiers, used only as a
 * relationship endpoint that references an existing association
 * (association-class shorthand, e.g. `(A,B) .. R1`), and — per that same
 * grammar — always immediately followed by the arrow-decor alternation
 * (`ARROW_HEAD1`/`ARROW_BODY1`, `[-=.]+` at minimum) on the same line.
 * Descdiagram's own parens grammar (`CommandCreateElementFull.CODE_CORE`,
 * `\([^()]+\)/?`) is a single opaque phrase with no comma requirement and is
 * never followed by an arrow on the same line (the descdiagram command's
 * regex ends right after the entity + optional decorations). The two
 * grammars are therefore structurally distinguishable by "does a
 * comma-separated pair in parens immediately precede an arrow", which is
 * what this pattern reproduces (decision-journal.md T1 cat. 2 / T5b).
 */
const ASSOCIATION_CLASS_COUPLE = /^\([^(),]+,[^(),]+\)\s*[-.=<>|*o]/;

/**
 * True when `trimmed` matches one of {@link ELEMENT_SHORTHAND_PATTERNS},
 * EXCLUDING the classdiagram association-class couple
 * ({@link ASSOCIATION_CLASS_COUPLE}). A bare `(Use Case)` or `()` always
 * counts as a shorthand; only the comma-pair-plus-arrow association-class
 * form is carved out, so it is not mistaken for the descdiagram
 * use-case/interface shorthand and misrouted away from the class engine.
 */
function matchesElementShorthand(trimmed: string): boolean {
  return (
    ELEMENT_SHORTHAND_PATTERNS.some((pattern) => pattern.test(trimmed)) &&
    !ASSOCIATION_CLASS_COUPLE.test(trimmed)
  );
}

/**
 * `legend` … `endlegend` / `end legend` region markers — upstream registers
 * both the single-line (`CommandLegend`) and multi-line block
 * (`CommandMultilinesLegend`) legend commands as `CommonCommand`s, available
 * to every diagram type (`command/CommonCommands.java:115-116`,
 * `command/UBrexCommonCommands.java:102-103`). A legend's body is
 * `DisplayPositioned` text — display-only, never diagram content — so it
 * must never be read as a descriptive-element declaration during dispatch
 * probing (a salt-widget or shorthand token inside a legend would otherwise
 * misroute the whole block).
 *
 * Block-opener grammar mirrors `CommandMultilinesLegend.getRegexConcat`:
 * `legend` optionally followed by one VALIGN token (`top`|`bottom`) and
 * independently one ALIGN token (`left`|`right`|`center`), end-anchored — a
 * bare `legend`, `legend top`, `legend left`, or `legend top left` all open
 * the block. Any trailing content beyond those optional tokens (e.g.
 * `legend: "text"` or `legend some text`) is the *single-line* `CommandLegend`
 * form instead — a complete one-line command with no body — so the opener
 * pattern is end-anchored to exclude it; single-line legend text is left in
 * place for the descriptive scan (unclaimed by any fixture, and inert if it
 * were — the line itself is a Display string, not a keyword line).
 *
 * Closer grammar mirrors `CommandMultilinesLegend.END`:
 * `^end[%s]?legend$` — `endlegend` (no space) or `end legend` (exactly one
 * whitespace char), case-insensitive.
 *
 * @see ~/git/plantuml/.../command/CommandMultilinesLegend.java:65-77 (opener),
 *   :57 (END pattern)
 * @see ~/git/plantuml/.../command/CommandLegend.java:59-68 (single-line form)
 */
const LEGEND_OPEN_RE =
  /^legend(?:\s+(?:top|bottom))?(?:\s+(?:left|right|center))?\s*$/i;
const LEGEND_CLOSE_RE = /^end\s?legend$/i;

/** True when `trimmed` opens a `legend` … `endlegend` block. */
export function isLegendOpenLine(trimmed: string): boolean {
  return LEGEND_OPEN_RE.test(trimmed);
}

/** True when `trimmed` closes a `legend` … `endlegend` block. */
export function isLegendCloseLine(trimmed: string): boolean {
  return LEGEND_CLOSE_RE.test(trimmed);
}

/**
 * Remove `legend` … `endlegend`/`end legend` block regions (opener, body, and
 * closer lines) from `lines`. Applied before any descriptive-signal or
 * descriptive-element scan so legend body content — which may contain salt
 * widgets, shorthand tokens, or any other display text — is never mistaken
 * for a diagram-content declaration. See {@link isLegendOpenLine} for the
 * grammar this mirrors.
 */
export function stripLegendRegions(lines: readonly string[]): string[] {
  const out: string[] = [];
  let inLegend = false;
  for (const line of lines) {
    const t = line.trim();
    if (inLegend) {
      if (isLegendCloseLine(t)) inLegend = false;
      continue;
    }
    if (isLegendOpenLine(t)) {
      inLegend = true;
      continue;
    }
    out.push(line);
  }
  return out;
}

/**
 * The use-case actor colon shorthand `:Name:` / `:Name:/` (business). Owned only
 * by the description plugin's `accepts()` (not the class/sequence guard). The
 * closing colon distinguishes it from activity's `:action;` and `:opener` forms
 * (activity explicitly excludes `:actor:`), so this is order-independent and
 * reproduces the *effective* old usecase `/^:\w/` claim.
 */
const ACTOR_COLON_SHORTHAND = /^:[^:;]+:/;

/**
 * A bare-id declaration whose DISPLAY (not CODE) carries the decoration —
 * upstream's "CODE3 STEREOTYPE3? as DISPLAY3" alternative
 * (CommandCreateElementFull.getRegexConcat:95-100), e.g. `Admin as :Main
 * Admin:` or `Use as (Use the application)`. Neither `ACTOR_COLON_SHORTHAND`
 * nor `ELEMENT_SHORTHAND_PATTERNS` catch this: the line doesn't *start* with
 * the decoration, it ends with it, after a bare id and `as`. Owned only by the
 * description plugin's `accepts()`, mirroring `ACTOR_COLON_SHORTHAND` above —
 * this is a description-only dispatch signal, not a class/sequence exclusion.
 */
const ALIAS_DECORATED_DISPLAY = /\bas\s+(?::[^:;]+:\/?|\([^)]+\)\/?)\s*$/i;

/**
 * A standalone `"Quoted Display" as code` / `code as "Quoted Display"` line
 * with NO leading type keyword. Upstream `CommandCreateElementFull`'s
 * `SYMBOL` group is OPTIONAL (`(?:(ALL_TYPES|\(\))[%s]+)?`,
 * `descdiagram/command/CommandCreateElementFull.java:84`), so a bare
 * DISPLAY2/CODE2 (or CODE4/DISPLAY4) alias line is a fully valid descdiagram
 * declaration even with zero keyword — it defaults to `LeafType.DESCRIPTION`
 * / `diagram.getSkinParam().actorStyle().toUSymbol()`
 * (CommandCreateElementFull.java:273-275). Neither sequence's `CommandArrow`/
 * `CommandParticipant*` nor class's declaration commands have an equivalent
 * keyword-less alias form, so a bare alias line alone is what makes
 * upstream's SequenceDiagramFactory fail on it and fall through to
 * DescriptionDiagramFactory (xacaxe-43-bupe002: `"Website/Webview" as
 * Website` is the sole non-arrow line in an otherwise all-bare-arrow
 * source — every other line already parses as either a sequence message or
 * a descdiagram link, so this one line alone decides the factory). Owned
 * only by the description plugin's `accepts()`, like
 * {@link ALIAS_DECORATED_DISPLAY} above — a description-only dispatch
 * signal, not a class/sequence exclusion.
 */
const BARE_ALIAS_DECL_RE = /^(?:"[^"]+"\s+as\s+\S+|\S+\s+as\s+"[^"]+")$/;

/**
 * True when any of the first {@link SCAN_LINE_LIMIT} lines, trimmed, carries a
 * descriptive-only keyword or an element shorthand. Used by `class`/`sequence`
 * `accepts()` to decline descriptive blocks (D3) and mirrors upstream's outcome
 * (the class/sequence factories fail on `node`/`cloud`/`usecase`/… lines).
 */
export function hasDescriptiveSignal(lines: readonly string[]): boolean {
  return stripLegendRegions(lines)
    .slice(0, SCAN_LINE_LIMIT)
    .some((line) => {
      const trimmed = line.trim();
      return (
        DESCRIPTIVE_KEYWORD_PATTERN.test(trimmed) ||
        matchesElementShorthand(trimmed)
      );
    });
}

/**
 * A `(Use Case)` decorated TARGET immediately following an arrow body —
 * `CommandLinkElement`'s `LINK_ENT_ALT` (`link-grammar.ts`'s `LINK_ENT_ALT`,
 * the `\((?!\*\))[^)]+\)/?` alternative) — is not a legal sequence-diagram
 * PART2 (`sequencediagram/command/CommandArrow.java`'s `PART2CODE`
 * `([%pLN_.@]+)` / `PART2LONG` requires guillemet quotes; bare parens are
 * never allowed), so `foo --> (Use case)` cannot parse as a sequence message
 * no matter how eagerly `sequencePlugin`'s `isSequenceLine` matches the
 * `-->` token. `matchesElementShorthand` only catches this decoration at the
 * line START (the ENT1/source side, e.g. `(Use Case) --> foo`); this catches
 * it as the ENT2/target side, anywhere after an arrow run — the shape that
 * was falling through every `accepts()` (including `descriptionPlugin`'s
 * own) straight to `sequencePlugin`, the last-registered, most permissive
 * fallback (index.ts's registration-order comment).
 *
 * Deliberately narrow, to avoid firing on arbitrary prose containing a
 * parenthetical remark (e.g. "Fixed the bug. (#130)"):
 *  - the arrow-body run must be at least 2 characters total (dash/dot/tilde/
 *    equals run, optionally plus an arrowhead decor char) — a single `.` or
 *    `=` immediately before a parenthetical is far too common in free text
 *    (a lone sentence-ending period, or a math/label expression) to be a
 *    reliable signal; every real PlantUML arrow token is >= 2 characters.
 *  - `(?!\d+\))` excludes pure-digit content — upstream's arrow-inclination
 *    dressing (`CommandArrow.java`'s `ARROW_DRESSING2`'s trailing `\(\d+\)`),
 *    a legal SEQUENCE token, not a descdiagram endpoint.
 *  - `(?!\*)` excludes content starting with `*` — legacy activity's
 *    `(*)`/`(*1)`/`(*2)` start/stop markers (`activitydiagram/` `(*)` node
 *    syntax), not a descdiagram endpoint.
 *  - no comma in the paren content — mirrors {@link ASSOCIATION_CLASS_COUPLE}
 *    above: a comma-separated pair immediately after an arrow could be the
 *    classdiagram association-class COUPLE form (`(A,B) .. R1`; also
 *    covers the reversed `R1 .. (A,B)` shape this function's caller must
 *    not misroute — verified by the existing association-class-couple
 *    dispatch test).
 *
 * Used only by {@link hasDescriptiveElement} (not {@link hasDescriptiveSignal}):
 * `descriptionPlugin` is registered before `sequencePlugin` (index.ts), so
 * making `descriptionPlugin.accepts()` positively claim these lines is
 * sufficient — `sequencePlugin.accepts()` is never reached for them. Keeping
 * `hasDescriptiveSignal` (the class/sequence decline guard) unchanged avoids
 * widening `class`'s decline surface for a signal only description needs.
 */
const ARROW_BODY_RUN =
  '(?:[-=.~]{2,4}[<>ox^*|{}0@#+\\/]{0,3}|[-=.~][<>ox^*|{}0@#+\\/]{1,3})';
const DECORATED_TARGET_AFTER_ARROW_RE = new RegExp(
  ARROW_BODY_RUN + '\\s*\\((?!\\d+\\))(?!\\*)[^(),]+\\)/?',
);

/** True when `trimmed` carries a {@link DECORATED_TARGET_AFTER_ARROW_RE} match. */
function hasArrowDecoratedTarget(trimmed: string): boolean {
  return DECORATED_TARGET_AFTER_ARROW_RE.test(trimmed);
}

/**
 * True when any of the first {@link SCAN_LINE_LIMIT} lines, trimmed, carries a
 * description-claimable keyword (`ALL_TYPES` minus bare `actor`/`interface`; see
 * {@link DESCRIPTION_ACCEPTS_KEYWORDS}), an element shorthand, the `:User:`
 * colon-actor form, or a bare-id-as-decorated-display alias
 * ({@link ALIAS_DECORATED_DISPLAY}). This is the description plugin's
 * `accepts()` test — broader than {@link hasDescriptiveSignal} (it adds
 * `package`, the colon actor, and the decorated-display alias) but it leaves
 * bare `actor`/`interface` to the sequence/class plugins.
 */
export function hasDescriptiveElement(lines: readonly string[]): boolean {
  return stripLegendRegions(lines)
    .slice(0, SCAN_LINE_LIMIT)
    .some((line) => {
      const trimmed = line.trim();
      return (
        DESCRIPTIVE_ELEMENT_PATTERN.test(trimmed) ||
        ACTOR_COLON_SHORTHAND.test(trimmed) ||
        matchesElementShorthand(trimmed) ||
        ALIAS_DECORATED_DISPLAY.test(trimmed) ||
        hasArrowDecoratedTarget(trimmed) ||
        BARE_ALIAS_DECL_RE.test(trimmed)
      );
    });
}

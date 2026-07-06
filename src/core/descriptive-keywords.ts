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
 * True when any of the first {@link SCAN_LINE_LIMIT} lines, trimmed, carries a
 * descriptive-only keyword or an element shorthand. Used by `class`/`sequence`
 * `accepts()` to decline descriptive blocks (D3) and mirrors upstream's outcome
 * (the class/sequence factories fail on `node`/`cloud`/`usecase`/… lines).
 */
export function hasDescriptiveSignal(lines: readonly string[]): boolean {
  return lines.slice(0, SCAN_LINE_LIMIT).some((line) => {
    const trimmed = line.trim();
    return (
      DESCRIPTIVE_KEYWORD_PATTERN.test(trimmed) ||
      matchesElementShorthand(trimmed)
    );
  });
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
  return lines.slice(0, SCAN_LINE_LIMIT).some((line) => {
    const trimmed = line.trim();
    return (
      DESCRIPTIVE_ELEMENT_PATTERN.test(trimmed) ||
      ACTOR_COLON_SHORTHAND.test(trimmed) ||
      matchesElementShorthand(trimmed) ||
      ALIAS_DECORATED_DISPLAY.test(trimmed)
    );
  });
}

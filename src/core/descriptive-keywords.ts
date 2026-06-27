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
 * Every shape in upstream `ALL_TYPES`. Business variants of `actor`/`usecase`
 * (upstream `actor/` / `usecase/`) map to the `-business` symbols. The `port`
 * symbol covers the `port` / `portin` / `portout` keywords.
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
  | 'process';

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

/** The full `ALL_TYPES` set — for the description plugin's own `accepts()`. */
const DESCRIPTIVE_ELEMENT_PATTERN = buildKeywordPattern(ALL_TYPES);

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
      ELEMENT_SHORTHAND_PATTERNS.some((pattern) => pattern.test(trimmed))
    );
  });
}

/**
 * True when any of the first {@link SCAN_LINE_LIMIT} lines, trimmed, carries any
 * `ALL_TYPES` keyword (the **full** set — including `interface`/`package`/`actor`,
 * which the description engine owns too) or an element shorthand. This is the
 * description plugin's `accepts()` test: a superset of {@link hasDescriptiveSignal}.
 */
export function hasDescriptiveElement(lines: readonly string[]): boolean {
  return lines.slice(0, SCAN_LINE_LIMIT).some((line) => {
    const trimmed = line.trim();
    return (
      DESCRIPTIVE_ELEMENT_PATTERN.test(trimmed) ||
      ELEMENT_SHORTHAND_PATTERNS.some((pattern) => pattern.test(trimmed))
    );
  });
}

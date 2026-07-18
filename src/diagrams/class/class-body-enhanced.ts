/**
 * class-body-enhanced.ts — pure raw-line splitting for a classifier's
 * "enhanced body" (upstream `BodyEnhancedAbstract`/`BodyEnhanced1`): the
 * alternate render strategy upstream uses whenever a classifier body
 * contains a `--`/`==`/`..`/`__` block separator or a `|_` tree-list line,
 * REPLACING the classic two-compartment (fields, methods) split entirely —
 * `BodierLikeClassOrObject#getBody`, `type.isLikeClass() && isBodyEnhanced()`
 * branch: `showMethods || showFields` routes to `BodyFactory.create1`
 * (`Body1`/`BodyEnhanced1`), never `getFieldsToDisplay()`/
 * `getMethodsToDisplay()`.
 *
 * G2 N42 (mission priority 1, carried from N40/N41's own survey —
 * `plans/g2-class-svg/ledger.md` N40 "Priority 2" for the tree-list
 * derivation this file's tree-cell extraction implements).
 *
 * Scope: block separators (labeled/unlabeled `--`/`==`/`..`/`__`) and `|_`
 * tree-list runs — upstream's THIRD `isBodyEnhanced` trigger, a `|...|`
 * table line (`CreoleParser.isTableLine`), has ZERO corpus reach inside a
 * class member body (surveyed: every `|...|` table sample in the class
 * corpus is inside a `legend`/`note`, a different render subsystem) and is
 * NOT ported here — a table-line-only body still falls through
 * `isEnhancedBody` as `false` (classic 2-compartment rendering, matching
 * this port's pre-N42 behavior, not a new regression).
 *
 * @see ~/git/plantuml/.../cucadiagram/BodyEnhancedAbstract.java#isBlockSeparator
 * @see ~/git/plantuml/.../cucadiagram/BodierLikeClassOrObject.java#isBodyEnhanced
 * @see ~/git/plantuml/.../cucadiagram/BodyEnhanced1.java#getArea
 * @see ~/git/plantuml/.../klimt/creole/legacy/StripeTree.java
 */

/** One `--`/`==`/`..`/`__` block-separator line, parsed into its draw
 *  char + optional label. `char` selects the divider's stroke (`class-
 *  body-enhanced-layout.ts#separatorStroke`'s own doc comment); `title` is
 *  `undefined` for a bare separator (`"--"`, <=4 chars — `getTitle`'s own
 *  early-return, upstream `BodyEnhancedAbstract#getTitle`). */
export interface BlockSeparatorSpec {
  readonly char: string;
  readonly title?: string;
}

/** A run of ordinary (non-separator, non-tree) body lines, decorated by an
 *  optional PRECEDING block separator — `undefined` only for the very
 *  first block when the body's first line is neither a separator nor a
 *  tree-start (upstream's `lineFirst`-seeded `separator = '_'` initial
 *  state is represented by `{ char: '_' }`, never `undefined`, so a
 *  genuinely `undefined` separator here only arises after a `sep=0`
 *  trailing flush — `splitEnhancedBlocks`'s own loop comment). */
export interface EnhancedRowsBlock {
  readonly kind: 'rows';
  readonly separator?: BlockSeparatorSpec;
  readonly lines: readonly string[];
}

/** One `|_`-prefixed tree cell, indent already resolved to a 1-based
 *  level and the `|_` marker (plus any leading indent) stripped from
 *  `text` — `StripeTree#computeLevel`/`analyzeAndAdd`'s exact algorithm. */
export interface EnhancedTreeCell {
  readonly level: number;
  readonly text: string;
}

export interface EnhancedTreeBlock {
  readonly kind: 'tree';
  readonly cells: readonly EnhancedTreeCell[];
}

export type EnhancedBodyBlock = EnhancedRowsBlock | EnhancedTreeBlock;

/** `BodyEnhancedAbstract#isBlockSeparator` — verbatim (no trim: upstream
 *  checks the RAW line, so an INDENTED `  --  --` is never recognized as a
 *  separator — zero corpus reach for that shape, not special-cased). */
function isBlockSeparatorLine(s: string): boolean {
  if (s.startsWith('--') && s.endsWith('--')) return true;
  if (s.startsWith('==') && s.endsWith('==')) return true;
  if (s.startsWith('..') && s.endsWith('..') && s !== '...') return true;
  if (s.startsWith('__') && s.endsWith('__')) return true;
  return false;
}

/** `Parser.isTreeStart` — a `|_` marker at the START of the (possibly
 *  trimmed) string; callers trim first when upstream does (`isTreeOrTable`)
 *  and pass the raw string when upstream doesn't (`isBodyEnhanced`'s own
 *  untrimmed top-level trigger scan). */
function isTreeStartLine(s: string): boolean {
  return s.length >= 2 && s.charAt(0) === '|' && s.charAt(1) === '_';
}

/**
 * `BodierLikeClassOrObject#isBodyEnhanced` — true when ANY raw body line is
 * a block separator or a tree-start line (untrimmed, matching upstream's
 * own un-trimmed `Parser.isTreeStart(s.toString())` check here — this is
 * the TRIGGER scan, distinct from `isTreeOrTable`'s trimmed check used
 * inside the block-splitting loop below).
 */
export function isEnhancedBody(rawLines: readonly string[] | undefined): boolean {
  if (rawLines === undefined) return false;
  return rawLines.some((s) => isBlockSeparatorLine(s) || isTreeStartLine(s.trimStart()));
}

/** `BodyEnhancedAbstract#getTitle`: strips the leading+trailing 2-char
 *  separator run and trims the remainder; `undefined` for a bare
 *  separator (`s.length() <= 4`, upstream's own early return). */
function separatorTitle(s: string): string | undefined {
  if (s.length <= 4) return undefined;
  return s.slice(2, -2).trim();
}

function blockSeparatorSpec(s: string): BlockSeparatorSpec {
  const title = separatorTitle(s);
  return title === undefined ? { char: s.charAt(0) } : { char: s.charAt(0), title };
}

/** `StripeTree#computeLevel` (`@JawsStrange`): counts leading 2-space
 *  groups or tab characters BEFORE the `|_` marker (or whatever remains
 *  after {@link buildTreeRun}'s common-prefix purge), starting at level 1. */
function computeTreeLevel(s: string): number {
  let level = 1;
  let rest = s;
  for (;;) {
    if (rest.startsWith('  ')) {
      level++;
      rest = rest.slice(2);
      continue;
    }
    if (rest.startsWith('\t')) {
      level++;
      rest = rest.slice(1);
      continue;
    }
    return level;
  }
}

const LEADING_WHITESPACE_RE = /^(\s+)/;
const TREE_MARKER_RE = /^\s*\|_/;

/**
 * `BodyEnhanced1#buildTreeOrTable`: consumes a contiguous run of tree-start
 * lines beginning at `startIdx` (the caller has already verified that line
 * qualifies), purging the FIRST line's own leading-whitespace prefix off
 * every consumed line (so an indented tree run — `sonoci-68-ciza059`'s
 * 8-space-indented `|_ Tree item 11` — computes levels relative to ITS OWN
 * base indent, not the source file's column 0) before extracting each
 * cell's level + display text.
 */
function buildTreeRun(
  rawLines: readonly string[],
  startIdx: number,
): { cells: EnhancedTreeCell[]; consumed: number } {
  const first = rawLines[startIdx]!;
  const indentMatch = LEADING_WHITESPACE_RE.exec(first);
  const start = indentMatch?.[1] ?? '';
  const cells: EnhancedTreeCell[] = [];
  let i = startIdx;
  for (; i < rawLines.length; i++) {
    const raw = rawLines[i]!;
    if (!isTreeStartLine(raw.trimStart())) break;
    const purged = raw.startsWith(start) ? raw.slice(start.length) : raw;
    cells.push({ level: computeTreeLevel(purged), text: purged.replace(TREE_MARKER_RE, '').trim() });
  }
  return { cells, consumed: i - startIdx };
}

/**
 * `BodyEnhanced1#getArea`'s own block-accumulation loop, ported 1:1: walks
 * `rawLines` once, flushing an `EnhancedRowsBlock` whenever a block
 * separator or a tree run starts, and an `EnhancedTreeBlock` for each
 * contiguous tree run. `lineFirst = true` (every class/interface/enum/…
 * classifier — the OTHER `BodyEnhanced1` ctor, `lineFirst = false`, is
 * usecase/allowmixing-only and unreached from this port's class pipeline)
 * seeds the initial separator state to `{ char: '_' }`, matching upstream's
 * `char separator = lineFirst ? '_' : 0`.
 */
export function splitEnhancedBlocks(rawLines: readonly string[]): EnhancedBodyBlock[] {
  const blocks: EnhancedBodyBlock[] = [];
  let sep: BlockSeparatorSpec | undefined = { char: '_' };
  let lines: string[] | null = null;

  const flushRows = (): void => {
    blocks.push({ kind: 'rows', ...(sep !== undefined ? { separator: sep } : {}), lines: lines ?? [] });
    sep = undefined;
    lines = null;
  };

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]!;
    if (isBlockSeparatorLine(raw)) {
      flushRows();
      sep = blockSeparatorSpec(raw);
      continue;
    }
    if (isTreeStartLine(raw.trimStart())) {
      flushRows();
      const { cells, consumed } = buildTreeRun(rawLines, i);
      blocks.push({ kind: 'tree', cells });
      i += consumed - 1;
      continue;
    }
    (lines ??= []).push(raw);
  }
  flushRows();
  return blocks;
}

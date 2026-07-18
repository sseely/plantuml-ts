/**
 * class-body-enhanced-layout.ts — assembles a classifier's `EnhancedBodyBlock`
 * list (`class-body-enhanced.ts#splitEnhancedBlocks`) into absolute, LOCAL-
 * to-body draw geometry: `ClassifierGeo['rows']`-shaped text rows (reusing
 * the SAME `renderer-classifier-box.ts#renderRowText` render path every
 * OTHER member row uses) plus new divider/tree-connector primitives.
 *
 * G2 N42 (mission priority 1). Every offset formula below is jar-verified
 * byte-exact against `fecolo-08-gepu579` (labeled separator + 1 leading
 * field + tree), `jajebo-21-dada557` (tree only, no separator), and
 * `pacagu-24-nune023` (labeled separator + EMPTY leading content + tree) —
 * see `plans/g2-class-svg/ledger.md` N42 for the full byte-level derivation
 * (`decorate()`/`TextBlockLineBefore`/`UHorizontalLine` arithmetic).
 *
 * NOT verified against a jar sample: a titled OR untitled separator whose
 * OWN content-plus-margin width would exceed the header's width (every
 * target fixture's header dominates) — `rowsBlockWidth`'s own doc comment
 * flags the specific unverified edge case.
 *
 * @see ~/git/plantuml/.../cucadiagram/BodyEnhancedAbstract.java#decorate
 * @see ~/git/plantuml/.../klimt/shape/TextBlockLineBefore.java
 * @see ~/git/plantuml/.../klimt/shape/UHorizontalLine.java
 */
import type { StringMeasurer } from '../../core/measurer.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';
import type { ClassifierGeo } from './layout.js';
import { parseMemberLine } from './class-member-parser.js';
import { buildMemberRow, type MemberRowBuild } from './class-member-creole.js';
import { formatMemberText } from './class-layout-helpers.js';
import { sectionWidth, ROW_TEXT_LEFT_MARGIN } from './class-member-rows.js';
import { splitEnhancedBlocks, type EnhancedBodyBlock, type BlockSeparatorSpec } from './class-body-enhanced.js';
import { measureTreeCells, computeTreeConnectors, type TreeConnector } from './class-body-tree.js';

const ROW_ICON_ZONE_WIDTH = 14;
const ROW_INDENT_WITH_ICON = ROW_TEXT_LEFT_MARGIN + ROW_ICON_ZONE_WIDTH;
/** `AtomWithMargin(tree, 2, 2)` — vertical-only top/bottom margin wrapping
 *  the WHOLE tree block (distinct from `AtomTree`'s own internal
 *  `CELL_TEXT_MARGIN`, see `class-body-tree.ts`'s module doc comment). */
const TREE_BLOCK_MARGIN = 2;
/** `decorate()`'s bottom-margin constant (`4`, both the title and no-title
 *  branches). */
const BLOCK_MARGIN_BOTTOM = 4;
/** `decorate()`'s no-title branch: `withMargin(block, marginX, 4)` (top AND
 *  bottom both 4). */
const PLAIN_DIVIDER_MARGIN_TOP = 4;

/** Shared, per-classifier layout inputs -- bundled to stay inside this
 *  project's per-function param-count cap (mirrors `class-member-rows.ts
 *  #SectionRowContext`'s identical rationale). */
export interface EnhancedLayoutCtx {
  readonly fontSpec: { readonly family: string; readonly size: number };
  readonly measurer: StringMeasurer;
  readonly sprites: SpriteRegistry | undefined;
  readonly baselineOffset: number;
  /** The classifier's own `headerRowHeight` -- every emitted `row.y`/
   *  `part.y`/`title.y` below is relative to `geo.y` DIRECTLY (matching
   *  every other `ClassifierGeo.rows[].y` consumer's convention), so this
   *  offset is added to the internal 0-based `cursor` at the point each
   *  coordinate is EMITTED (not to the returned `EnhancedBodyGeo.height`,
   *  which stays body-only -- `class-layout-helpers.ts`'s own `height:
   *  headerRowHeight + enhancedBody.height` sum would otherwise double
   *  count it). */
  readonly bodyTop: number;
}

/** One rendered divider primitive — a plain horizontal line, optionally
 *  carrying a centered title label that splits the line in two (`class-
 *  body-enhanced.ts#BlockSeparatorSpec`'s own doc comment for `char`'s
 *  render-time meaning, resolved by `separatorStrokeWidth` below). */
export interface EnhancedDividerPart {
  readonly kind: 'divider';
  readonly y: number;
  readonly strokeWidth: number;
  readonly title?: { readonly x: number; readonly y: number; readonly width: number; readonly text: string };
}

export interface EnhancedRowsPart {
  readonly kind: 'rows';
  readonly rows: ClassifierGeo['rows'];
}

export interface EnhancedTreePart {
  readonly kind: 'tree';
  readonly rows: ClassifierGeo['rows'];
  readonly connectors: readonly TreeConnector[];
}

export type EnhancedBodyPart = EnhancedDividerPart | EnhancedRowsPart | EnhancedTreePart;

export interface EnhancedBodyGeo {
  readonly parts: readonly EnhancedBodyPart[];
  /** Member-area width contribution (caller takes `Math.max(headerWidth,
   *  this)`, mirroring the classic path's `memberAreaWidth`). */
  readonly width: number;
  /** Total body height, local to the body's own top (caller adds
   *  `headerRowHeight`, mirroring the classic path's `height` sum). */
  readonly height: number;
}

/** `UHorizontalLine#getStroke`: `'-'`/`'='` -> `UStroke.simple()` (thickness
 *  1); anything else (`'_'`, the synthetic block0/trailing-empty sentinel,
 *  and every OTHER separator char this iteration does not distinguish --
 *  `'.'`/`'='`'s own dash/double-line rendering, zero corpus reach in this
 *  iteration's target fixtures, named NOT ported) falls to `UStroke
 *  .withThickness(defaultThickness)` (0.5, `PName.LineThickness`'s
 *  default). */
function separatorStrokeWidth(char: string): number {
  return char === '-' || char === '=' ? 1 : 0.5;
}

interface RowsBlockResult {
  readonly rows: ClassifierGeo['rows'];
  readonly width: number;
  readonly contentHeight: number;
}

/** Builds one rows-block's member rows (icon-column reservation scanned
 *  over the WHOLE block, mirroring `class-member-rows.ts#sectionWidth`'s
 *  established per-section — here per-block — gating) at a given LOCAL
 *  `contentTop`. */
function buildRowsBlockRows(lines: readonly string[], ctx: EnhancedLayoutCtx, contentTop: number): RowsBlockResult {
  const { fontSpec, measurer, sprites, baselineOffset } = ctx;
  const members = lines.map(parseMemberLine).filter((m) => m !== null);
  const texts = members.map(formatMemberText);
  const builds: MemberRowBuild[] = members.map((m, i) => buildMemberRow(texts[i]!, m, fontSpec, measurer, sprites));
  const hasIcon = members.some((m) => m.visibilityExplicit === true);
  const indent = hasIcon ? ROW_INDENT_WITH_ICON : ROW_TEXT_LEFT_MARGIN;
  const rowHeight = fontSpec.size;
  const rows: ClassifierGeo['rows'] = members.map((m, i) => ({
    text: texts[i]!,
    y: contentTop + i * rowHeight + baselineOffset,
    indent,
    width: builds[i]!.width,
    atoms: builds[i]!.atoms,
    ...(m.visibilityExplicit === true
      ? { visibilityIcon: m.visibility, visibilityIsField: m.params === undefined }
      : {}),
    ...(m.ownUrl !== undefined ? { url: m.ownUrl } : {}),
  }));
  return { rows, width: sectionWidth(builds, hasIcon), contentHeight: members.length * rowHeight };
}

/**
 * `TextBlockLineBefore#calculateDimension`'s `dim.atLeast(dimTitle.width +
 * 8, ...)` floor — a titled separator's OWN label can widen the block past
 * its member content. Unverified against a jar sample where this floor
 * actually binds (see this file's own module doc comment); implemented
 * per the literal upstream formula rather than left out, since it is
 * directly part of the ported `decorate()` algorithm, not a speculative
 * extension.
 */
function rowsBlockWidth(memberAreaWidth: number, titleWidth: number | undefined): number {
  return titleWidth === undefined ? memberAreaWidth : Math.max(memberAreaWidth, titleWidth + 8);
}

interface BlockLayoutResult {
  readonly cursor: number;
  readonly width: number;
}

/** `decorate()`'s `separator === 0` branch: `withMargin(block, marginX, 0)`
 *  -- zero vertical margin, no divider drawn. */
function layoutUndividedRows(
  lines: readonly string[],
  ctx: EnhancedLayoutCtx,
  cursor: number,
  parts: EnhancedBodyPart[],
): BlockLayoutResult {
  const { rows, width, contentHeight } = buildRowsBlockRows(lines, ctx, cursor);
  parts.push({ kind: 'rows', rows });
  return { cursor: cursor + contentHeight, width };
}

/** `decorate()`'s no-title branch: divider FIRST (its own local y = block
 *  start), then content at `+PLAIN_DIVIDER_MARGIN_TOP`, then
 *  `+BLOCK_MARGIN_BOTTOM`. */
function layoutPlainDividerRows(
  lines: readonly string[],
  char: string,
  ctx: EnhancedLayoutCtx,
  cursor: number,
): { rows: EnhancedBodyPart[]; result: BlockLayoutResult } {
  const dividerY = cursor;
  const contentTop = cursor + PLAIN_DIVIDER_MARGIN_TOP;
  const { rows, width, contentHeight } = buildRowsBlockRows(lines, ctx, contentTop);
  const partsOut: EnhancedBodyPart[] = [
    { kind: 'divider', y: dividerY, strokeWidth: separatorStrokeWidth(char) },
    { kind: 'rows', rows },
  ];
  return {
    rows: partsOut,
    result: { cursor: contentTop + contentHeight + BLOCK_MARGIN_BOTTOM, width: rowsBlockWidth(width, undefined) },
  };
}

/** `decorate()`'s title branch: content draws FIRST (at local top =
 *  `dimTitleHeight`, both the outer AND inner top margins stacking to
 *  exactly one title-height), THEN the divider+label AFTER (jar-verified
 *  DOM order — see this file's own module doc comment). */
function layoutTitledDividerRows(
  lines: readonly string[],
  separator: BlockSeparatorSpec,
  ctx: EnhancedLayoutCtx,
  cursor: number,
): { rows: EnhancedBodyPart[]; result: BlockLayoutResult } {
  const { fontSpec, measurer, sprites, baselineOffset } = ctx;
  const titleBuild = buildMemberRow(separator.title!, {}, fontSpec, measurer, sprites);
  const dimTitleHeight = fontSpec.size; // a title is always a single creole line
  const contentTop = cursor + dimTitleHeight;
  const { rows, width, contentHeight } = buildRowsBlockRows(lines, ctx, contentTop);
  const innerHeight = contentHeight + dimTitleHeight / 2 + BLOCK_MARGIN_BOTTOM;
  const rawHeight = Math.max(innerHeight, dimTitleHeight); // TextBlockLineBefore's atLeast height floor
  const dividerY = cursor + dimTitleHeight / 2;
  const titleBaselineY = dividerY - dimTitleHeight / 2 - 0.5 + baselineOffset;
  const partsOut: EnhancedBodyPart[] = [
    { kind: 'rows', rows },
    {
      kind: 'divider',
      y: dividerY,
      strokeWidth: separatorStrokeWidth(separator.char),
      title: { x: 0, y: titleBaselineY, width: titleBuild.width, text: separator.title! },
    },
  ];
  return {
    rows: partsOut,
    result: { cursor: cursor + dimTitleHeight / 2 + rawHeight, width: rowsBlockWidth(width, titleBuild.width) },
  };
}

/** One rows-block (`EnhancedBodyBlock` with `kind: 'rows'`) — dispatches to
 *  one of `decorate()`'s three branches (undivided / plain divider /
 *  titled divider), pushing its part(s) and returning the advanced
 *  cursor. Height formulas are jar-verified byte-exact — see this file's
 *  own module doc comment. */
function layoutRowsBlock(
  lines: readonly string[],
  separator: BlockSeparatorSpec | undefined,
  ctx: EnhancedLayoutCtx,
  cursor: number,
  parts: EnhancedBodyPart[],
): BlockLayoutResult {
  if (separator === undefined) return layoutUndividedRows(lines, ctx, cursor, parts);
  if (separator.title === undefined) {
    const { rows, result } = layoutPlainDividerRows(lines, separator.char, ctx, cursor);
    parts.push(...rows);
    return result;
  }
  const { rows, result } = layoutTitledDividerRows(lines, separator, ctx, cursor);
  parts.push(...rows);
  return result;
}

/** One tree-block (`EnhancedBodyBlock` with `kind: 'tree'`) — the
 *  `AtomTree`/`Skeleton2` geometry (`class-body-tree.ts`), offset by
 *  `TREE_BLOCK_MARGIN` (`AtomWithMargin(tree, 2, 2)`'s top half) and
 *  `cursor`. Text `indent` is `level*8 + 10` (`xEndForLevel(level) +
 *  CELL_TEXT_MARGIN`, `class-body-tree.ts`'s own formula), baked per-row
 *  since level varies cell to cell. */
function layoutTreeBlock(
  block: Extract<EnhancedBodyBlock, { kind: 'tree' }>,
  ctx: EnhancedLayoutCtx,
  cursor: number,
  parts: EnhancedBodyPart[],
): BlockLayoutResult {
  const { fontSpec, measurer, sprites, baselineOffset } = ctx;
  const tree = measureTreeCells(block.cells, fontSpec, measurer, sprites);
  const contentTop = cursor + TREE_BLOCK_MARGIN;
  const rows: ClassifierGeo['rows'] = tree.rows.map((r) => ({
    text: r.build.atoms.length === 1 && r.build.atoms[0]!.kind === 'text' ? r.build.atoms[0]!.text : '',
    y: contentTop + r.localTop + baselineOffset,
    indent: r.level * 8 + 10,
    width: r.build.width,
    atoms: r.build.atoms,
  }));
  const connectors = computeTreeConnectors(tree.rows).map((c) => ({
    bulletX: c.bulletX,
    bulletY: contentTop + c.bulletY,
    hx1: c.hx1,
    hx2: c.hx2,
    hy: contentTop + c.hy,
    vx: c.vx,
    vy1: contentTop + c.vy1,
    vy2: contentTop + c.vy2,
  }));
  parts.push({ kind: 'tree', rows, connectors });
  return { cursor: contentTop + tree.height + TREE_BLOCK_MARGIN, width: tree.width };
}

/**
 * Assembles the full enhanced-body geometry for a classifier's raw member
 * lines. Mirrors `measureGenericClassifier`'s classic-path signature
 * closely enough that `class-layout-helpers.ts` can branch cleanly between
 * the two.
 */
export function measureEnhancedBody(rawLines: readonly string[], ctx: EnhancedLayoutCtx): EnhancedBodyGeo {
  const blocks = splitEnhancedBlocks(rawLines);
  const parts: EnhancedBodyPart[] = [];
  // `cursor` starts at `ctx.bodyTop` (`headerRowHeight`) so every emitted
  // row/divider/title y IS `geo.y`-relative directly -- see `EnhancedLayoutCtx
  // .bodyTop`'s own doc comment for why the returned `height` below
  // subtracts it back out.
  let cursor = ctx.bodyTop;
  let width = 0;
  for (const block of blocks) {
    const result =
      block.kind === 'tree'
        ? layoutTreeBlock(block, ctx, cursor, parts)
        : layoutRowsBlock(block.lines, block.separator, ctx, cursor, parts);
    cursor = result.cursor;
    width = Math.max(width, result.width);
  }
  return { parts, width, height: cursor - ctx.bodyTop };
}

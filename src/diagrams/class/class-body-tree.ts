/**
 * class-body-tree.ts — `AtomTree`/`Skeleton2` port: measures a `|_`
 * tree-list run's cells (one creole text row per cell, indented by level)
 * and computes the bullet/hline/vline tree-connector geometry that draws
 * beside them.
 *
 * G2 N42 (mission priority 1) — full derivation, jar-verified byte-exact
 * against `fecolo-08-gepu579`/`jajebo-21-dada557`/`pacagu-24-nune023`, in
 * `plans/g2-class-svg/ledger.md` N40 ("Priority 2") + this iteration's own
 * entry (independent re-derivation + absolute-coordinate mapping).
 *
 * Coordinate convention: every value below is LOCAL to the tree block's own
 * top-left corner — `(0, 0)` is the block's own origin BEFORE upstream's
 * `AtomWithMargin(tree, 2, 2)` top/bottom margin (a vertical-only margin,
 * `class-body-enhanced-layout.ts#TREE_BLOCK_MARGIN`'s own doc comment for
 * why it is NOT applied inside this file) and before the classifier box's
 * own `geo.x`/`geo.y` placement — callers (`class-body-enhanced-layout.ts`)
 * add both offsets uniformly when assembling the final `ClassifierGeo`.
 *
 * @see ~/git/plantuml/.../klimt/creole/atom/AtomTree.java
 * @see ~/git/plantuml/.../salt/element/Skeleton2.java
 */
import type { StringMeasurer } from '../../core/measurer.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';
import { buildMemberRow, type MemberRowBuild } from './class-member-creole.js';
import type { EnhancedTreeCell } from './class-body-enhanced.js';

/** `Skeleton2.sizeX` — the per-level indent step, in px. */
const SIZE_X = 8;
/** `AtomTree.margin` — px between a cell's own indent zone and its text
 *  (NOT upstream's `AtomWithMargin(tree, 2, 2)` outer wrap, a DIFFERENT,
 *  vertical-only margin applied one layer up — see this file's own
 *  module doc comment). */
const CELL_TEXT_MARGIN = 2;

function xStartForLevel(level: number): number {
  return level * SIZE_X;
}

function xEndForLevel(level: number): number {
  return xStartForLevel(level) + SIZE_X;
}

/** One measured tree cell: its own creole build, LOCAL vertical span
 *  (`localTop`/`height`), and the level driving its indent/connector x. */
export interface TreeCellRow {
  readonly level: number;
  readonly localTop: number;
  readonly height: number;
  readonly build: MemberRowBuild;
}

export interface TreeLayout {
  /** `AtomTree#calculateDimensionSlow`: `max(xEndForLevel(level) +
   *  CELL_TEXT_MARGIN + cell.width)` over every cell. */
  readonly width: number;
  /** Sum of every cell's own height (`fontSpec.size` each — tree cells are
   *  always a single creole text line, mirroring `buildMemberRow`'s own
   *  "member text is always ONE physical display line" scope note; a cell
   *  whose text triggers CREOLE line-wrap is out of this iteration's
   *  scope, zero corpus reach). */
  readonly height: number;
  readonly rows: readonly TreeCellRow[];
}

/** `AtomTree#calculateDimensionSlow`/`#drawU`'s own per-cell loop —
 *  measures each cell's creole build via the SAME shared engine every
 *  other member row uses (`class-member-creole.ts#buildMemberRow`, `member`
 *  argument `{}`: a tree cell carries no visibility/static/abstract
 *  modifier — upstream's `StripeSimple` cell is pure creole text, no
 *  `Member` wrapper). */
export function measureTreeCells(
  cells: readonly EnhancedTreeCell[],
  fontSpec: { readonly family: string; readonly size: number },
  measurer: StringMeasurer,
  sprites?: SpriteRegistry,
): TreeLayout {
  const rowHeight = fontSpec.size;
  let width = 0;
  let localTop = 0;
  const rows: TreeCellRow[] = [];
  for (const cell of cells) {
    const build = buildMemberRow(cell.text, {}, fontSpec, measurer, sprites);
    width = Math.max(width, xEndForLevel(cell.level) + CELL_TEXT_MARGIN + build.width);
    rows.push({ level: cell.level, localTop, height: rowHeight, build });
    localTop += rowHeight;
  }
  return { width, height: localTop, rows };
}

/** One `Skeleton2` connector: a 2x2 bullet `<rect>` + an 8px horizontal
 *  `<line>` (both at the cell's own vertical MIDPOINT) + a vertical `<line>`
 *  from the "mother or sister" entry's midpoint down to this one's. Every
 *  coordinate is LOCAL (see this file's own module doc comment). */
export interface TreeConnector {
  readonly bulletX: number;
  readonly bulletY: number;
  readonly hx1: number;
  readonly hx2: number;
  readonly hy: number;
  readonly vx: number;
  readonly vy1: number;
  readonly vy2: number;
}

/** `Skeleton2#getMotherOrSister`: scans BACKWARDS from `idx - 1` for the
 *  first entry whose level equals `currentLevel` (a sibling) or
 *  `currentLevel - 1` (the parent) — skipping over any deeper-level
 *  subtree entirely, jar-verified (`fecolo-08-gepu579`'s trailing `c()`
 *  root cell connects to `b()`'s own midpoint, not `b2.1`'s). */
function motherOrSisterMidY(rows: readonly TreeCellRow[], midYs: readonly number[], idx: number): number {
  const currentLevel = rows[idx]!.level;
  for (let i = idx - 1; i >= 0; i--) {
    const otherLevel = rows[i]!.level;
    if (otherLevel === currentLevel || otherLevel === currentLevel - 1) return midYs[i]!;
  }
  return 0;
}

/** `Skeleton2#draw` — one connector per cell, in cell order. */
export function computeTreeConnectors(rows: readonly TreeCellRow[]): TreeConnector[] {
  const midYs = rows.map((r) => r.localTop + r.height / 2);
  return rows.map((row, idx) => {
    const xStart = xStartForLevel(row.level);
    const midY = midYs[idx]!;
    const lastY = motherOrSisterMidY(rows, midYs, idx);
    return {
      bulletX: xStart + SIZE_X - 1,
      bulletY: midY - 1,
      hx1: xStart,
      hx2: xStart + SIZE_X,
      hy: midY,
      vx: xStart,
      vy1: lastY,
      vy2: midY,
    };
  });
}

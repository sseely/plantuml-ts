/**
 * Pure, stateless helpers for the description diagram layout engine.
 *
 * Extracted so `layout.ts` stays under 500 lines. Every function here is
 * deterministic: data in, data out, no side effects.
 *
 * Exported symbols used by layout.ts:
 *   DescriptionNodeGeo       — public output type (re-exported from layout.ts)
 *   InnerLayoutResult        — internal container-child layout result
 *   ACTOR_WIDTH, ACTOR_HEIGHT, USECASE_HEIGHT  — sizing constants
 *   CONTAINER_PADDING, CONTAINER_TOP_PAD       — container sizing
 *   EMPTY_CONTAINER_WIDTH, EMPTY_CONTAINER_HEIGHT
 *   LAYOUT_MARGIN            — canvas margin constant
 *   isContainer              — CONTAINER_SYMBOLS membership test
 *   measureLeafNode          — symbol-dispatched node sizing
 *   layoutContainerChildren  — 2-column grid layout for container children
 *   shiftGeoBy               — recursive coordinate translation
 *   buildContainerOwnerMap   — maps node ids to their outermost container id
 *   buildNodeGeoIndex        — flat id→geo index including all descendants
 */

import type { DescriptiveNode } from './ast.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import { measureNodeLabel } from '../../core/latex.js';
import { CONTAINER_SYMBOLS } from './parse-helpers.js';
import type { USymbol } from '../../core/descriptive-keywords.js';

// ---------------------------------------------------------------------------
// Public output node type (also used internally)
// ---------------------------------------------------------------------------

export interface DescriptionNodeGeo {
  id: string;
  /** Upstream USymbol shape — drives render dispatch in T6. */
  symbol: USymbol;
  display: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: DescriptionNodeGeo[];
  stereotype?: string;
}

// ---------------------------------------------------------------------------
// Sizing constants (exported so layout.ts can use them)
// ---------------------------------------------------------------------------

/** Fixed width of an actor stick-figure (upstream ActorStickMan.java). */
export const ACTOR_WIDTH = 50;
/** Fixed height of an actor stick-figure (upstream ActorStickMan.java). */
export const ACTOR_HEIGHT = 70;
/** Fixed height of a use-case ellipse; width is text-driven. */
export const USECASE_HEIGHT = 40;
/** Horizontal padding added to text width when sizing a usecase ellipse. */
const USECASE_ELLIPSE_PAD = 24;
/** Minimum width for box-shaped nodes (component, interface, etc.). */
const BOX_MIN_WIDTH = 80;
/** Horizontal padding added to measured text width for box nodes. */
const BOX_H_PADDING = 20;
/** Vertical size factor for box nodes: fontSize × factor. */
const BOX_HEIGHT_FACTOR = 1.4;
/** Fixed vertical addition to box node height beyond the scaled font size. */
const BOX_HEIGHT_EXTRA = 16;

/** Padding on left / right / bottom inside a container node. */
export const CONTAINER_PADDING = 16;
/** Extra space at the top of a container node for its label. */
export const CONTAINER_TOP_PAD = 28;
/** Width of an empty container (no leaf children). */
export const EMPTY_CONTAINER_WIDTH = 160;
/** Height of an empty container (no leaf children). */
export const EMPTY_CONTAINER_HEIGHT = 80;

/** Margin offset so no content starts exactly at the canvas origin. */
export const LAYOUT_MARGIN = 12;

/** Number of columns in the inner 2-column grid for container children. */
const GRID_COLS = 2;
/** Horizontal gap between grid cells. */
const GRID_H_GAP = 20;
/** Vertical gap between grid rows. */
const GRID_V_GAP = 20;

// ---------------------------------------------------------------------------
// Container membership
// ---------------------------------------------------------------------------

export function isContainer(symbol: USymbol): boolean {
  return CONTAINER_SYMBOLS.has(symbol);
}

// ---------------------------------------------------------------------------
// Leaf node sizing
// ---------------------------------------------------------------------------

/**
 * Measure a leaf node's bounding box.
 *
 * Dispatch order (first match wins):
 * 1. actor / actor-business → fixed ACTOR_WIDTH × ACTOR_HEIGHT.
 * 2. usecase / usecase-business → USECASE_HEIGHT; width from text or LaTeX.
 * 3. Everything else → box: max(BOX_MIN_WIDTH, textWidth + BOX_H_PADDING).
 */
export function measureLeafNode(
  node: DescriptiveNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): { width: number; height: number } {
  if (node.symbol === 'actor' || node.symbol === 'actor-business') {
    return { width: ACTOR_WIDTH, height: ACTOR_HEIGHT };
  }
  if (node.symbol === 'usecase' || node.symbol === 'usecase-business') {
    if (node.display.includes('<latex>')) {
      return measureNodeLabel(node.display, measurer, fontSpec);
    }
    const textWidth = measurer.measure(node.display, fontSpec).width;
    return {
      width: Math.max(textWidth + USECASE_ELLIPSE_PAD, USECASE_HEIGHT),
      height: USECASE_HEIGHT,
    };
  }
  // Default: box sizing (component, interface, and all remaining USymbols).
  const measured = measurer.measure(node.display, fontSpec);
  return {
    width: Math.max(BOX_MIN_WIDTH, measured.width + BOX_H_PADDING),
    height: fontSpec.size * BOX_HEIGHT_FACTOR + BOX_HEIGHT_EXTRA,
  };
}

// ---------------------------------------------------------------------------
// Inner layout for container children (2-column grid)
// ---------------------------------------------------------------------------

export interface InnerLayoutResult {
  childGeos: DescriptionNodeGeo[];
  /** Total inner width, including trailing LAYOUT_MARGIN on the right. */
  innerWidth: number;
  /** Total inner height, including trailing LAYOUT_MARGIN on the bottom. */
  innerHeight: number;
}

interface DimEntry {
  width: number;
  height: number;
  nested: InnerLayoutResult | null;
}

interface GridPositions {
  colX: number[];
  rowY: number[];
}

/** Measure each child's bounding box (recursing into nested containers). */
function measureContainerChildDims(
  children: readonly DescriptiveNode[],
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): DimEntry[] {
  const dims: DimEntry[] = [];
  for (const child of children) {
    if (isContainer(child.symbol)) {
      const nested = layoutContainerChildren(child.children, fontSpec, measurer);
      dims.push({
        width: nested.innerWidth > 0
          ? nested.innerWidth + CONTAINER_PADDING * 2
          : EMPTY_CONTAINER_WIDTH,
        height: nested.innerHeight > 0
          ? nested.innerHeight + CONTAINER_TOP_PAD + CONTAINER_PADDING
          : EMPTY_CONTAINER_HEIGHT,
        nested,
      });
    } else {
      dims.push({ ...measureLeafNode(child, fontSpec, measurer), nested: null });
    }
  }
  return dims;
}

/** Compute the x/y position of each grid column and row from the dim entries. */
function computeGridPositions(
  dims: DimEntry[],
  childCount: number,
): GridPositions {
  const numRows = Math.ceil(childCount / GRID_COLS);
  const colWidths = Array<number>(GRID_COLS).fill(0);
  const rowHeights = Array<number>(numRows).fill(0);

  for (let i = 0; i < childCount; i++) {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    colWidths[col] = Math.max(colWidths[col]!, dims[i]!.width);
    rowHeights[row] = Math.max(rowHeights[row]!, dims[i]!.height);
  }

  const colX: number[] = [];
  let cx = LAYOUT_MARGIN;
  for (let c = 0; c < GRID_COLS; c++) {
    colX[c] = cx;
    cx += colWidths[c]! + GRID_H_GAP;
  }

  const rowY: number[] = [];
  let ry = LAYOUT_MARGIN;
  for (let r = 0; r < numRows; r++) {
    rowY[r] = ry;
    ry += rowHeights[r]! + GRID_V_GAP;
  }

  return { colX, rowY };
}

/** Build a single child's DescriptionNodeGeo including nested children. */
function buildSingleChildGeo(
  child: DescriptiveNode,
  d: DimEntry,
  x: number,
  y: number,
): DescriptionNodeGeo {
  const nestedChildren: DescriptionNodeGeo[] =
    isContainer(child.symbol) && d.nested !== null
      ? d.nested.childGeos.map((g) =>
          shiftGeoBy(
            g,
            x + CONTAINER_PADDING - LAYOUT_MARGIN,
            y + CONTAINER_TOP_PAD - LAYOUT_MARGIN,
          ),
        )
      : [];

  const geo: DescriptionNodeGeo = {
    id: child.id,
    symbol: child.symbol,
    display: child.display,
    x,
    y,
    width: d.width,
    height: d.height,
    children: nestedChildren,
  };
  if (child.stereotype !== undefined) geo.stereotype = child.stereotype;
  return geo;
}

/** Place each child at its grid position and compute the total inner bounds. */
function assembleGridGeos(
  children: readonly DescriptiveNode[],
  dims: DimEntry[],
  positions: GridPositions,
): InnerLayoutResult {
  const { colX, rowY } = positions;
  const childGeos: DescriptionNodeGeo[] = [];

  for (let i = 0; i < children.length; i++) {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    childGeos.push(
      buildSingleChildGeo(
        children[i]!,
        dims[i]!,
        colX[col]!,
        rowY[row]!,
      ),
    );
  }

  let maxX = 0;
  let maxY = 0;
  for (const g of childGeos) {
    maxX = Math.max(maxX, g.x + g.width + LAYOUT_MARGIN);
    maxY = Math.max(maxY, g.y + g.height + LAYOUT_MARGIN);
  }

  return { childGeos, innerWidth: maxX, innerHeight: maxY };
}

/**
 * Lay out the direct children of a container in a 2-column grid (AST order,
 * left-to-right then top-to-bottom).
 *
 * Nested containers are recursed first so their atomic size drives the grid
 * cell. Returns child geos in the inner coordinate space — origin at the
 * content-area top-left, before container padding is applied.
 */
export function layoutContainerChildren(
  children: readonly DescriptiveNode[],
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): InnerLayoutResult {
  if (children.length === 0) {
    return { childGeos: [], innerWidth: 0, innerHeight: 0 };
  }
  const dims = measureContainerChildDims(children, fontSpec, measurer);
  const positions = computeGridPositions(dims, children.length);
  return assembleGridGeos(children, dims, positions);
}

/** Recursively shift a DescriptionNodeGeo and all its descendants by (dx, dy). */
export function shiftGeoBy(
  geo: DescriptionNodeGeo,
  dx: number,
  dy: number,
): DescriptionNodeGeo {
  return {
    ...geo,
    x: geo.x + dx,
    y: geo.y + dy,
    children: geo.children.map((c) => shiftGeoBy(c, dx, dy)),
  };
}

// ---------------------------------------------------------------------------
// Container owner map
// ---------------------------------------------------------------------------

/**
 * Build a map from each node id to the id of the outermost container that owns
 * it, or `undefined` if the node is a top-level entity.
 *
 * Used to re-anchor cross-container edges to the container id in the outer
 * dot graph so the layout engine routes around the full container box.
 */
export function buildContainerOwnerMap(
  astNodes: readonly DescriptiveNode[],
): Map<string, string | undefined> {
  const ownerMap = new Map<string, string | undefined>();

  function visit(node: DescriptiveNode, owningId: string | undefined): void {
    if (isContainer(node.symbol)) {
      ownerMap.set(node.id, undefined);
      const effectiveOwner = owningId !== undefined ? owningId : node.id;
      for (const child of node.children) visit(child, effectiveOwner);
    } else {
      ownerMap.set(node.id, owningId);
    }
  }

  for (const node of astNodes) visit(node, undefined);
  return ownerMap;
}

// ---------------------------------------------------------------------------
// Node-geo index
// ---------------------------------------------------------------------------

/** Build a flat id → DescriptionNodeGeo index including all descendants. */
export function buildNodeGeoIndex(
  geos: readonly DescriptionNodeGeo[],
): Map<string, DescriptionNodeGeo> {
  const map = new Map<string, DescriptionNodeGeo>();

  function index(list: readonly DescriptionNodeGeo[]): void {
    for (const g of list) {
      map.set(g.id, g);
      if (g.children.length > 0) index(g.children);
    }
  }

  index(geos);
  return map;
}

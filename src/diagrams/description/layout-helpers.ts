/**
 * Pure, stateless helpers for the description diagram layout engine.
 *
 * Reduced for the single-pass cluster layout: grid-based inner layout,
 * InnerLayoutResult, and buildContainerOwnerMap are removed. What remains:
 * types, sizing constants, leaf measurement, bbox computation, spline clipping,
 * geo coordinate shift, and the node-geo index.
 */

import type { DescriptiveLink, DescriptiveNode } from './ast.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import { measureNodeLabel } from '../../core/latex.js';
import { CONTAINER_SYMBOLS } from './parse-helpers.js';
import type { USymbol } from '../../core/descriptive-keywords.js';
import type { DotInputEdge } from '../../core/graph-layout.js';

// ---------------------------------------------------------------------------
// Public output node type
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
// Axis-aligned bounding box (internal utility)
// ---------------------------------------------------------------------------

export interface Bbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Sizing constants (exported so layout.ts can use them)
// ---------------------------------------------------------------------------

/** Fixed width of an actor stick-figure (upstream ActorStickMan.java). */
export const ACTOR_WIDTH = 50;
/** Fixed height of an actor stick-figure. */
export const ACTOR_HEIGHT = 70;
/** Fixed height of a use-case ellipse; width is text-driven. */
export const USECASE_HEIGHT = 40;
const USECASE_ELLIPSE_PAD = 24;
const BOX_MIN_WIDTH = 80;
const BOX_H_PADDING = 20;
const BOX_HEIGHT_FACTOR = 1.4;
const BOX_HEIGHT_EXTRA = 16;

/** Padding on left / right / bottom inside a container box. */
export const CONTAINER_PADDING = 16;
/** Extra space at the top of a container box for its label. */
export const CONTAINER_TOP_PAD = 28;
/** Width of an empty container (container symbol with no children). */
export const EMPTY_CONTAINER_WIDTH = 160;
/** Height of an empty container. */
export const EMPTY_CONTAINER_HEIGHT = 80;
/** Margin offset so no content starts exactly at the canvas origin. */
export const LAYOUT_MARGIN = 12;

// ---------------------------------------------------------------------------
// Container membership
// ---------------------------------------------------------------------------

export function isContainer(symbol: USymbol): boolean {
  return CONTAINER_SYMBOLS.has(symbol);
}

/**
 * True when an AST node becomes a graphviz cluster:
 * has a container symbol AND has at least one child.
 */
export function isClusterNode(node: DescriptiveNode): boolean {
  return isContainer(node.symbol) && node.children.length > 0;
}

// ---------------------------------------------------------------------------
// Leaf node sizing
// ---------------------------------------------------------------------------

/**
 * Measure a leaf node's bounding box.
 *
 * 1. actor / actor-business → fixed ACTOR_WIDTH × ACTOR_HEIGHT
 * 2. usecase / usecase-business → USECASE_HEIGHT; width from text or LaTeX
 * 3. Everything else → box: max(BOX_MIN_WIDTH, textWidth + BOX_H_PADDING)
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
  const measured = measurer.measure(node.display, fontSpec);
  return {
    width: Math.max(BOX_MIN_WIDTH, measured.width + BOX_H_PADDING),
    height: fontSpec.size * BOX_HEIGHT_FACTOR + BOX_HEIGHT_EXTRA,
  };
}

// ---------------------------------------------------------------------------
// Container bounding box
// ---------------------------------------------------------------------------

/**
 * Compute a container's bbox as the padded union of its direct children's
 * bboxes (each child may be a leaf geo or a container geo already padded).
 * Returns EMPTY_CONTAINER dimensions when directChildren is empty.
 */
export function computeContainerBbox(directChildren: DescriptionNodeGeo[]): Bbox {
  if (directChildren.length === 0) {
    return { x: 0, y: 0, width: EMPTY_CONTAINER_WIDTH, height: EMPTY_CONTAINER_HEIGHT };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of directChildren) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x + c.width > maxX) maxX = c.x + c.width;
    if (c.y + c.height > maxY) maxY = c.y + c.height;
  }
  return {
    x: minX - CONTAINER_PADDING,
    y: minY - CONTAINER_TOP_PAD,
    width: (maxX - minX) + 2 * CONTAINER_PADDING,
    height: (maxY - minY) + CONTAINER_TOP_PAD + CONTAINER_PADDING,
  };
}

// ---------------------------------------------------------------------------
// Coordinate shift
// ---------------------------------------------------------------------------

/** Recursively shift a DescriptionNodeGeo and all its descendants by (dx, dy). */
export function shiftGeo(geo: DescriptionNodeGeo, dx: number, dy: number): DescriptionNodeGeo {
  return {
    ...geo,
    x: geo.x + dx,
    y: geo.y + dy,
    children: geo.children.map((c) => shiftGeo(c, dx, dy)),
  };
}

// ---------------------------------------------------------------------------
// Spline clipping at bbox boundary
// ---------------------------------------------------------------------------

export function insideBbox(p: { x: number; y: number }, b: Bbox): boolean {
  return p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
}

/** Segment p1→p2 vs segment p3→p4 intersection (Cramer's rule). */
function segIntersect(
  p1: { x: number; y: number }, p2: { x: number; y: number },
  p3: { x: number; y: number }, p4: { x: number; y: number },
): { x: number; y: number } | undefined {
  const dx1 = p2.x - p1.x, dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x, dy2 = p4.y - p3.y;
  const cross = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(cross) < 1e-10) return undefined;
  const dx = p3.x - p1.x, dy = p3.y - p1.y;
  const t = (dx * dy2 - dy * dx2) / cross;
  const u = (dx * dy1 - dy * dx1) / cross;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: p1.x + t * dx1, y: p1.y + t * dy1 };
  }
  return undefined;
}

/** First crossing of segment p1→p2 with any edge of bbox b. */
function bboxCrossing(
  p1: { x: number; y: number }, p2: { x: number; y: number }, b: Bbox,
): { x: number; y: number } | undefined {
  const { x, y, width: w, height: h } = b;
  const sides: [{ x: number; y: number }, { x: number; y: number }][] = [
    [{ x, y }, { x: x + w, y }],
    [{ x, y: y + h }, { x: x + w, y: y + h }],
    [{ x, y }, { x, y: y + h }],
    [{ x: x + w, y }, { x: x + w, y: y + h }],
  ];
  for (const [a, c] of sides) {
    const pt = segIntersect(p1, p2, a, c);
    if (pt !== undefined) return pt;
  }
  return undefined;
}

/**
 * Clip leading points that lie inside bbox (from-endpoint container clipping).
 * Replaces the inside→outside crossing with the bbox boundary intersection.
 */
export function clipSplineStart(
  points: Array<{ x: number; y: number }>,
  bbox: Bbox,
): Array<{ x: number; y: number }> {
  let firstOut = -1;
  for (let i = 0; i < points.length; i++) {
    if (!insideBbox(points[i]!, bbox)) { firstOut = i; break; }
  }
  if (firstOut <= 0) return points;
  const cross = bboxCrossing(points[firstOut - 1]!, points[firstOut]!, bbox);
  return [cross ?? points[firstOut]!, ...points.slice(firstOut)];
}

/**
 * Clip trailing points that lie inside bbox (to-endpoint container clipping).
 * Replaces the outside→inside crossing with the bbox boundary intersection.
 */
export function clipSplineEnd(
  points: Array<{ x: number; y: number }>,
  bbox: Bbox,
): Array<{ x: number; y: number }> {
  let lastOut = -1;
  for (let i = points.length - 1; i >= 0; i--) {
    if (!insideBbox(points[i]!, bbox)) { lastOut = i; break; }
  }
  if (lastOut < 0 || lastOut === points.length - 1) return points;
  const cross = bboxCrossing(points[lastOut]!, points[lastOut + 1]!, bbox);
  return [...points.slice(0, lastOut + 1), cross ?? points[lastOut]!];
}

// ---------------------------------------------------------------------------
// Node-geo index (flat id → geo, including descendants)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Graph spacing (nodesep / ranksep) — DotStringFactory.createDotString +
// SvekEdge.getHorizontalDzeta/getVerticalDzeta
// ---------------------------------------------------------------------------

/** Svek getMinNodeSep() (non-activity diagrams). */
const MIN_NODESEP = 35;
/** Svek getMinRankSep() (non-activity diagrams). */
const MIN_RANKSEP = 60;
/** LinkDecor.java margins: NONE=2, ARROW/ARROW_TRIANGLE=10. */
const DECOR_MARGIN_NONE = 2;
const DECOR_MARGIN_ARROW = 10;

/** Head-decor margin for a link's arrowHead (tail decor is always NONE — we
 *  do not parse tail arrowheads today). */
function headDecorMargin(arrowHead: DescriptiveLink['arrowHead']): number {
  if (arrowHead === 'open' || arrowHead === 'filled') return DECOR_MARGIN_ARROW;
  return DECOR_MARGIN_NONE;
}

interface LinkDzeta {
  horizontal: number;
  vertical: number;
}

/**
 * SvekEdge.getHorizontalDzeta / getVerticalDzeta, in pixels.
 *
 * - Self-loop (from === to): both dzetas equal decorDzeta (label ignored).
 * - length === 1 (SvekEdge.isHorizontal()): horizontal = labelWidth + decor;
 *   vertical = 0.
 * - length > 1: vertical = labelHeight + decor; horizontal = 0.
 *
 * We have no tail/head qualifiers today, so only the label contributes
 * beyond decorDzeta.
 */
function computeLinkDzeta(
  link: DescriptiveLink,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): LinkDzeta {
  const decorDzeta = DECOR_MARGIN_NONE + headDecorMargin(link.arrowHead);

  if (link.from === link.to) {
    return { horizontal: decorDzeta, vertical: decorDzeta };
  }

  if (link.length === 1) {
    const labelWidth = link.label !== undefined
      ? measurer.measure(link.label, fontSpec).width
      : 0;
    return { horizontal: labelWidth + decorDzeta, vertical: 0 };
  }

  const labelHeight = link.label !== undefined
    ? measurer.measure(link.label, fontSpec).height
    : 0;
  return { horizontal: 0, vertical: labelHeight + decorDzeta };
}

/**
 * DotStringFactory.createDotString nodesep/ranksep:
 *   nodesep = max(maxOverEdges(horizontalDzeta) / 10, 35)
 *   ranksep = max(maxOverEdges(verticalDzeta) / 10, 60)
 *
 * (The skinparam nodesep/ranksep override is deferred — Theme has no such
 * fields yet.)
 */
export function computeGraphSpacing(
  links: readonly DescriptiveLink[],
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): { nodeSep: number; rankSep: number } {
  let maxHorizontal = 0;
  let maxVertical = 0;
  for (const link of links) {
    const dzeta = computeLinkDzeta(link, fontSpec, measurer);
    if (dzeta.horizontal > maxHorizontal) maxHorizontal = dzeta.horizontal;
    if (dzeta.vertical > maxVertical) maxVertical = dzeta.vertical;
  }
  return {
    nodeSep: Math.max(maxHorizontal / 10, MIN_NODESEP),
    rankSep: Math.max(maxVertical / 10, MIN_RANKSEP),
  };
}

/**
 * DotInputEdge attributes contributed by a link: minLen (SvekEdge.java:417-427;
 * useRankSame() is hardwired false, so minlen = length - 1), hidden→invis
 * (SvekEdge still emits the edge — a hidden link counts structurally), and
 * tail/head qualifier-label dimensions (CommandLinkElement FIRST_LABEL/
 * SECOND_LABEL) for svek-dot-emit.ts oracle-DOT parity. tailLabelWidth/Height
 * and headLabelWidth/Height are emitter-only — the real layout engine ignores
 * them (see graph-layout.types.ts).
 */
export function buildLinkEdgeAttributes(
  link: DescriptiveLink,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): NonNullable<DotInputEdge['attributes']> {
  const attrs: NonNullable<DotInputEdge['attributes']> = { minLen: link.length - 1 };
  if (link.hidden === true) attrs.invis = true;
  if (link.firstLabel !== undefined) {
    const m = measurer.measure(link.firstLabel, fontSpec);
    attrs.tailLabelWidth = m.width;
    attrs.tailLabelHeight = m.height;
  }
  if (link.secondLabel !== undefined) {
    const m = measurer.measure(link.secondLabel, fontSpec);
    attrs.headLabelWidth = m.width;
    attrs.headLabelHeight = m.height;
  }
  return attrs;
}

// ---------------------------------------------------------------------------
// Link endpoint resolution (moved from layout.ts — file-size limit)
// ---------------------------------------------------------------------------

export interface EdgeContainerEndpoints {
  fromContainerAstId?: string;
  toContainerAstId?: string;
}

export interface ResolvedEndpoint {
  leafId: string;
  containerAstId: string | undefined;
}

function firstDescendantLeaf(
  node: DescriptiveNode,
  leafIdSet: Set<string>,
): string | undefined {
  if (leafIdSet.has(node.id)) return node.id;
  for (const child of node.children) {
    const found = firstDescendantLeaf(child, leafIdSet);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function resolveEndpoint(
  id: string,
  leafIdSet: Set<string>,
  astNodeById: Map<string, DescriptiveNode>,
): ResolvedEndpoint | undefined {
  if (leafIdSet.has(id)) return { leafId: id, containerAstId: undefined };
  const node = astNodeById.get(id);
  if (node === undefined) return undefined;
  const leafId = firstDescendantLeaf(node, leafIdSet);
  if (leafId === undefined) return undefined;
  return { leafId, containerAstId: id };
}

export function containerEndpointsInfo(
  fromRes: ResolvedEndpoint,
  toRes: ResolvedEndpoint,
): EdgeContainerEndpoints | undefined {
  const info: EdgeContainerEndpoints = {};
  if (fromRes.containerAstId !== undefined) info.fromContainerAstId = fromRes.containerAstId;
  if (toRes.containerAstId !== undefined) info.toContainerAstId = toRes.containerAstId;
  if (info.fromContainerAstId === undefined && info.toContainerAstId === undefined) {
    return undefined;
  }
  return info;
}

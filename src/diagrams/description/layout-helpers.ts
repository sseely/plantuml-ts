/**
 * Pure, stateless helpers for the description diagram layout engine.
 *
 * Reduced for the single-pass cluster layout: grid-based inner layout,
 * InnerLayoutResult, and buildContainerOwnerMap are removed. What remains:
 * types, sizing constants, leaf measurement, bbox computation, spline clipping,
 * geo coordinate shift, and the node-geo index.
 */

import type { DescriptionDiagramAST, DescriptiveLink, DescriptiveNode } from './ast.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import { measureNodeLabel } from '../../core/latex.js';
import { CONTAINER_SYMBOLS } from './parse-helpers.js';
import type { USymbol } from '../../core/descriptive-keywords.js';
import type { DotInputNodeShape } from '../../core/graph-layout.js';

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

/** EntityImageNote sizing (approximate — comparator shape/size checks are
 *  tolerant): horizontal text padding, vertical text padding, and the
 *  folded-corner allowance added to the measured max line width. */
const NOTE_H_PADDING = 8;
const NOTE_V_PADDING = 6;
const NOTE_FOLD_ALLOWANCE = 10;
/** Note body line-height factor — matches the box-leaf BOX_HEIGHT_FACTOR
 *  intent (line spacing slightly looser than the raw font size). */
const NOTE_LINE_HEIGHT_FACTOR = 1.4;
/** Width of an empty container (container symbol with no children). */
export const EMPTY_CONTAINER_WIDTH = 160;
/** Height of an empty container. */
export const EMPTY_CONTAINER_HEIGHT = 80;
/** Margin offset so no content starts exactly at the canvas origin. */
export const LAYOUT_MARGIN = 12;
/** Svek group-anchor point size — `width=.01` (inches) in ClusterDotString
 *  .java:149/183, converted to px (0.01in * 72px/in). Height matches width;
 *  our layout engine (unlike real graphviz's `point` shape) always requires
 *  an explicit height. */
export const GROUP_ANCHOR_SIZE = 0.72;
/** EntityPosition.RADIUS * 2 (abel/EntityPosition.java:56) — the fixed
 *  square a `port`/`portin`/`portout` leaf occupies (both the small
 *  `shape=rect` node and, when the label is wide, the PORT="P" table
 *  cell — SvekNode.appendLabelHtmlSpecialForPort). */
export const PORT_SIZE = 12;
/** SvekNode.appendLabelHtmlSpecialForPort's `width2 > 40` threshold: a port
 *  whose display text renders wider than this switches from the plain
 *  small `shape=rect` square to the `shape=plaintext` PORT="P" HTML table. */
const PORT_LABEL_WIDE_THRESHOLD = 40;
/** SvekNode.appendLabelHtmlSpecialForPortHtml's `fullWidth` floor. */
const PORT_TABLE_PAD_FLOOR = 10;
/** Approximate title-bar sizing for the ClusterDotString port placeholder's
 *  reused cluster-title label (`empty()`, ClusterDotString.java:177-184) —
 *  render fidelity is not the DOT-parity bar (the comparator never reads
 *  inside a `label=<...>` value), so nominal padding stands in for Svek's
 *  real `getTitleAndAttributeWidth/Height`. */
const TITLE_LABEL_H_PADDING = 20;
const TITLE_LABEL_HEIGHT = 16;

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
 * 1. note → multi-line body + folded-corner padding (see NOTE_* constants)
 * 2. actor / actor-business → fixed ACTOR_WIDTH × ACTOR_HEIGHT
 * 3. usecase / usecase-business → USECASE_HEIGHT; width from text or LaTeX
 * 4. Everything else → box: max(BOX_MIN_WIDTH, textWidth + BOX_H_PADDING)
 */
export function measureLeafNode(
  node: DescriptiveNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): { width: number; height: number } {
  if (node.symbol === 'port') {
    // EntityImagePort.calculateDimensionSlow: fixed RADIUS*2 square,
    // independent of the display text (the text drives the shape choice
    // instead — see isPortLabelWide/portTablePad below).
    return { width: PORT_SIZE, height: PORT_SIZE };
  }
  if (node.symbol === 'note') {
    // EntityImageNote: multi-line body, folded top-right corner. Width from
    // the widest line + padding + fold allowance; height from line count.
    const lines = node.display.split('\n');
    let maxWidth = 0;
    for (const ln of lines) {
      const w = measurer.measure(ln, fontSpec).width;
      if (w > maxWidth) maxWidth = w;
    }
    return {
      width: maxWidth + NOTE_H_PADDING * 2 + NOTE_FOLD_ALLOWANCE,
      height: lines.length * fontSpec.size * NOTE_LINE_HEIGHT_FACTOR + NOTE_V_PADDING * 2,
    };
  }
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
// Link endpoint resolution (moved from layout.ts — file-size limit)
// ---------------------------------------------------------------------------

export interface EdgeContainerEndpoints {
  fromContainerAstId?: string;
  toContainerAstId?: string;
}

/**
 * DOT node id an edge endpoint resolves to (`dotNodeId`), plus the AST
 * container id when the endpoint targeted a group directly (`containerAstId`
 * — used for spline-clipping to the container's rendered bbox, unchanged by
 * the group-anchor mechanism below).
 */
export interface ResolvedEndpoint {
  dotNodeId: string;
  containerAstId: string | undefined;
}

/**
 * Synthetic DOT node id for a group's shared anchor point — Svek's
 * `Cluster.getSpecialPointId` (`"za" + group.getUid()`), one per group,
 * reused by every edge that targets that group directly (never one per
 * edge). Keyed off our own synthetic `clusterId` (never user-controlled)
 * rather than the AST id, so it can never collide with a user identifier.
 */
export function groupAnchorNodeId(clusterId: string): string {
  return `${clusterId}-anchor`;
}

/**
 * Resolve a link endpoint (`DescriptiveLink.from`/`to`) to the DOT node id
 * an edge should attach to.
 *
 * - A leaf id (including an EMPTY container — GraphvizImageBuilder.java:
 *   416-418 demotes every empty `GroupType.PACKAGE` group, which covers all
 *   description-diagram block groups, to a plain leaf entity) resolves to
 *   itself directly.
 * - A non-empty container id (the only remaining case — every empty
 *   container is already in `leafIdSet`) resolves to that group's shared
 *   anchor point (`Bibliotekon.getNodeUid`'s group fallback), never to one
 *   of its descendants — upstream never anchors a group-edge to a
 *   descendant leaf.
 */
export function resolveEndpoint(
  id: string,
  leafIdSet: Set<string>,
  astNodeById: Map<string, DescriptiveNode>,
  clusterIdByContainerAstId: Map<string, string>,
): ResolvedEndpoint | undefined {
  if (leafIdSet.has(id)) return { dotNodeId: id, containerAstId: undefined };
  const node = astNodeById.get(id);
  if (node === undefined) return undefined;
  const clusterId = clusterIdByContainerAstId.get(id);
  if (clusterId === undefined) return undefined;
  return { dotNodeId: groupAnchorNodeId(clusterId), containerAstId: id };
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

// Node shape: EntityImageDescription/SvekNode ShapeType -> Svek DOT shape.
// See plans/dot-oracle-sync/phase-2-description/shape-mechanism.md.

/** shapeType switch: FOLDER/PACKAGE stay `rect` (folder tab is render-only),
 *  HEXAGON->hexagon, USECASE(_BUSINESS)->ellipse. INTERFACE is resolved by
 *  {@link isInterfaceShielded}; everything else (actor included) is `rect`. */
export function symbolBaseShape(symbol: USymbol): DotInputNodeShape | undefined {
  if (symbol === 'hexagon') return 'hexagon';
  if (symbol === 'usecase' || symbol === 'usecase-business') return 'ellipse';
  return undefined;
}

/** getShield (hasKal1/hasKal2 qualifiers never apply to description
 *  diagrams). Gates the suppressions that zero hideText's shield: (a)
 *  isThereADoubleLink; (b) hasSomeHorizontalLinkVisible (non-hidden length-1
 *  link -- fixCircleLabelOverlapping defaults false, always applies); (c)
 *  hasSomeHorizontalLinkDoubleDecorated (length-1, decor both ends, no
 *  `!hidden` guard). */
export function isInterfaceShielded(
  id: string,
  links: readonly DescriptiveLink[],
  fixCircleLabelOverlapping = false,
): boolean {
  const touching = links.filter((l) => l.from === id || l.to === id);
  const others = new Set<string>();
  for (const l of touching) {
    const other = l.from === id ? l.to : l.from;
    if (others.has(other)) return false; // (a) isThereADoubleLink
    others.add(other);
  }
  // (b) hasSomeHorizontalLinkVisible — non-hidden length-1 link; suppresses
  //     only when fixCircleLabelOverlapping is false.
  if (
    !fixCircleLabelOverlapping &&
    touching.some((l) => l.length === 1 && l.hidden !== true)
  ) {
    return false;
  }
  // (c) hasSomeHorizontalLinkDoubleDecorated — length-1, decor on both ends
  //     (no !hidden guard); always suppresses.
  if (
    touching.some(
      (l) => l.length === 1 && l.tailDecor !== undefined && l.headDecor !== undefined,
    )
  ) {
    return false;
  }
  return true;
}

/** Svek shape for a leaf: ShapeType map + shield/plaintext for `interface`. */
export function shapeForNode(
  node: DescriptiveNode,
  links: readonly DescriptiveLink[],
  fixCircleLabelOverlapping = false,
): DotInputNodeShape | undefined {
  if (node.symbol === 'interface') {
    return isInterfaceShielded(node.id, links, fixCircleLabelOverlapping)
      ? 'plaintext'
      : undefined;
  }
  return symbolBaseShape(node.symbol);
}

// ---------------------------------------------------------------------------
// Port entity shape (EntityPosition PORTIN/PORTOUT — abel/EntityPosition
// .java, SvekNode.appendLabelHtmlSpecialForPort)
// ---------------------------------------------------------------------------

/** SvekNode.appendLabelHtmlSpecialForPort: `getMaxWidthFromLabelForEntryExit
 *  (stringBounder) > 40` switches a port leaf from the plain small
 *  `shape=rect` square to the `shape=plaintext` PORT="P" HTML table. */
export function isPortLabelWide(
  node: DescriptiveNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): boolean {
  return measurer.measure(node.display, fontSpec).width > PORT_LABEL_WIDE_THRESHOLD;
}

/** appendLabelHtmlSpecialForPortHtml's `fullWidth` (`width2 - 40`, floored
 *  at 10) — the blank cell width flanking the PORT="P" cell. Only called
 *  once {@link isPortLabelWide} is true. */
export function portTablePad(
  node: DescriptiveNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): number {
  const width2 = measurer.measure(node.display, fontSpec).width;
  return Math.max(PORT_TABLE_PAD_FLOOR, width2 - PORT_LABEL_WIDE_THRESHOLD);
}

/** Approximate title-bar dims for a cluster's own display name — used only
 *  by the `ClusterDotString.empty()` port placeholder (layout.ts), which
 *  reuses the owning cluster's title as its `label=<TABLE...>` value. */
export function measureTitleLabel(
  display: string,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): { width: number; height: number } {
  return {
    width: measurer.measure(display, fontSpec).width + TITLE_LABEL_H_PADDING,
    height: TITLE_LABEL_HEIGHT,
  };
}


export interface DescriptionEdgeGeo {
  id: string;
  from: string;
  to: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
  stereotype?: string;
  dashed: boolean;
  arrowHead?: 'open' | 'filled' | 'none';
}

export interface DescriptionGeometry {
  totalWidth: number;
  totalHeight: number;
  nodes: DescriptionNodeGeo[];
  edges: DescriptionEdgeGeo[];
}

/**
 * GraphvizImageBuilder.buildImage:211-222: a diagram with zero groups, zero
 * links, and exactly one root leaf (DotData.isDegeneratedWithFewEntities —
 * checked BEFORE empty-group demotion, so a lone empty braced container does
 * NOT qualify) is drawn directly as EntityImageDegenerated; PlantUML never
 * invokes graphviz. We must not either, or the DOT graph counts diverge.
 * Hexagon leaves are excluded upstream and take the normal svek path.
 */
export function degenerateSingleLeaf(
  ast: DescriptionDiagramAST,
  containersCount: number,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): DescriptionGeometry | undefined {
  if (ast.links.length !== 0 || containersCount !== 0) return undefined;
  if (ast.nodes.length !== 1) return undefined;
  const node = ast.nodes[0]!;
  if (node.declaredAsGroup === true || node.symbol === 'hexagon') return undefined;
  const dims = measureLeafNode(node, fontSpec, measurer);
  const geo: DescriptionNodeGeo = {
    id: node.id,
    symbol: node.symbol,
    display: node.display,
    x: LAYOUT_MARGIN,
    y: LAYOUT_MARGIN,
    width: dims.width,
    height: dims.height,
    children: [],
  };
  if (node.stereotype !== undefined) geo.stereotype = node.stereotype;
  return {
    totalWidth: dims.width + 2 * LAYOUT_MARGIN,
    totalHeight: dims.height + 2 * LAYOUT_MARGIN,
    nodes: [geo],
    edges: [],
  };
}

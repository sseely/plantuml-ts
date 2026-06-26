/**
 * Unified layout engine for PlantUML descriptive diagrams
 * (component / use-case / deployment).
 *
 * Merges `src/diagrams/component/layout.ts` and `src/diagrams/usecase/layout.ts`
 * into one module whose per-element sizing switches on the node's `symbol`.
 * Pure helper functions live in `layout-helpers.ts`; only the public types and
 * the top-level `layoutDescription` orchestrator live here.
 *
 * ## Geometry contract — what T6 consumes
 *
 * ### DescriptionNodeGeo
 * Uses `symbol: USymbol` (replaces the `kind` field of both source layouts).
 * Union of both source node shapes; `stereotype?` preserved.
 *
 * ### DescriptionEdgeGeo
 * - `from`/`to`   — present for all edges (from UCEdgeGeo)
 * - `stereotype?` — include / extend (from UCEdgeGeo)
 * - `arrowHead?`  — from ComponentEdgeGeo; absent means use renderer default
 *
 * ### DescriptionGeometry
 * `{ totalWidth, totalHeight, nodes: DescriptionNodeGeo[], edges: DescriptionEdgeGeo[] }`
 *
 * ## Sizing dispatch by `symbol`
 * | Symbol                           | Sizing                          |
 * |----------------------------------|---------------------------------|
 * | `actor` / `actor-business`       | Fixed 50 × 70 stick-figure      |
 * | `usecase` / `usecase-business`   | Ellipse: text-driven w, fixed h |
 * | Container symbols (see below)    | Padded child bounding-box       |
 * | Everything else                  | Box: min-80 text-driven width   |
 *
 * Container symbols (CONTAINER_SYMBOLS in parse-helpers.ts):
 * package, node, folder, frame, cloud, database, storage, rectangle.
 *
 * ## Layout algorithm (D6 — two-level hierarchical dot layout)
 * Phase 1 — Inner 2-column grid layouts for all top-level containers.
 * Phase 2 — Container owner map (node id → outermost container id).
 * Phase 3 — Outer LR dot graph with containers as atomic nodes.
 * Phase 4 — Run outer dot layout.
 * Phase 5 — Build DescriptionNodeGeo tree with absolute child positions.
 * Phase 6 — Route edges centre-to-centre between actual nodes.
 * Phase 7 — Compute total diagram dimensions.
 *
 * No DOM, no SVG, no async. All I/O is plain data.
 */

import type { DescriptionDiagramAST, DescriptiveLink } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import type { DotInputNode, DotInputEdge } from '../../core/graph-layout.js';
import { layoutGraph as layout } from '../../core/graph-layout.js';
import type { USymbol } from '../../core/descriptive-keywords.js';
import {
  type DescriptionNodeGeo,
  type InnerLayoutResult,
  ACTOR_WIDTH,
  CONTAINER_PADDING,
  CONTAINER_TOP_PAD,
  EMPTY_CONTAINER_WIDTH,
  EMPTY_CONTAINER_HEIGHT,
  LAYOUT_MARGIN,
  isContainer,
  measureLeafNode,
  layoutContainerChildren,
  shiftGeoBy,
  buildContainerOwnerMap,
  buildNodeGeoIndex,
} from './layout-helpers.js';

export type { DescriptionNodeGeo } from './layout-helpers.js';

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

export interface DescriptionEdgeGeo {
  id: string;
  /** Source node id — present for all edges. */
  from: string;
  /** Target node id. */
  to: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
  /** Stripped from &lt;&lt;…&gt;&gt; in the link label (include / extend). */
  stereotype?: string;
  dashed: boolean;
  /** Arrow-head style; absent → renderer default. */
  arrowHead?: 'open' | 'filled' | 'none';
}

export interface DescriptionGeometry {
  totalWidth: number;
  totalHeight: number;
  nodes: DescriptionNodeGeo[];
  edges: DescriptionEdgeGeo[];
}

// ---------------------------------------------------------------------------
// Private constants
// ---------------------------------------------------------------------------

/** Pixels the edge label is shifted above the midpoint of the edge. */
const LABEL_Y_OFFSET = 8;

// ---------------------------------------------------------------------------
// Phase helpers — inner layouts and dot graph construction
// ---------------------------------------------------------------------------

function computeInnerLayouts(
  nodes: DescriptionDiagramAST['nodes'],
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): Map<string, InnerLayoutResult> {
  const map = new Map<string, InnerLayoutResult>();
  for (const node of nodes) {
    if (isContainer(node.symbol)) {
      map.set(node.id, layoutContainerChildren(node.children, fontSpec, measurer));
    }
  }
  return map;
}

function buildOuterDotNodes(
  nodes: DescriptionDiagramAST['nodes'],
  innerLayouts: Map<string, InnerLayoutResult>,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): DotInputNode[] {
  const dotNodes: DotInputNode[] = [];
  for (const node of nodes) {
    if (isContainer(node.symbol)) {
      const inner = innerLayouts.get(node.id);
      let w: number;
      let h: number;
      if (inner === undefined || inner.innerWidth === 0) {
        w = EMPTY_CONTAINER_WIDTH;
        h = EMPTY_CONTAINER_HEIGHT;
      } else {
        const labelW = measurer.measure(node.display, fontSpec).width;
        w = Math.max(inner.innerWidth + CONTAINER_PADDING * 2, labelW + CONTAINER_PADDING * 2);
        h = inner.innerHeight + CONTAINER_TOP_PAD + CONTAINER_PADDING;
      }
      dotNodes.push({ id: node.id, width: w, height: h });
    } else {
      const dims = measureLeafNode(node, fontSpec, measurer);
      dotNodes.push({ id: node.id, width: dims.width, height: dims.height });
    }
  }
  return dotNodes;
}

function buildOuterDotEdges(
  links: DescriptionDiagramAST['links'],
  ownerMap: Map<string, string | undefined>,
): DotInputEdge[] {
  const seen = new Set<string>();
  const dotEdges: DotInputEdge[] = [];
  for (const [i, link] of links.entries()) {
    const fromOwner = ownerMap.get(link.from);
    const toOwner = ownerMap.get(link.to);
    const eFrom = fromOwner !== undefined ? fromOwner : link.from;
    const eTo = toOwner !== undefined ? toOwner : link.to;
    if (eFrom === eTo) continue;
    const key = `${eFrom}→${eTo}`;
    if (!seen.has(key)) {
      seen.add(key);
      dotEdges.push({ id: `outer-edge-${i}`, from: eFrom, to: eTo });
    }
  }
  return dotEdges;
}

// ---------------------------------------------------------------------------
// Phase helpers — position normalisation
// ---------------------------------------------------------------------------

/** Maximum left-margin required so actor labels are not clipped. */
function actorLabelMargin(
  nodes: DescriptionDiagramAST['nodes'],
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): number {
  let margin = LAYOUT_MARGIN;
  for (const node of nodes) {
    if (node.symbol === 'actor' || node.symbol === 'actor-business') {
      const labelW = measurer.measure(node.display, fontSpec).width;
      const overhang = Math.ceil(labelW / 2) - ACTOR_WIDTH / 2;
      if (overhang > 0) margin = Math.max(margin, overhang + LAYOUT_MARGIN);
    }
  }
  return margin;
}

type OuterNode = { x: number; y: number; width: number; height: number };

/** Compute (dx, dy) shifts that place the leftmost/topmost node at the margin. */
function computeOuterOffsets(
  outerNodes: OuterNode[],
  minXMargin: number,
): { dx: number; dy: number } {
  let minX = Infinity;
  let minY = Infinity;
  for (const n of outerNodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
  }
  if (!isFinite(minX)) minX = 0;
  if (!isFinite(minY)) minY = 0;
  return { dx: minXMargin - minX, dy: LAYOUT_MARGIN - minY };
}

/** Compute canvas dimensions encompassing all positioned nodes. */
function computeTotalDimensions(
  outerWidth: number,
  outerHeight: number,
  dx: number,
  dy: number,
  nodes: DescriptionNodeGeo[],
): { totalWidth: number; totalHeight: number } {
  let totalWidth = outerWidth + dx + LAYOUT_MARGIN;
  let totalHeight = outerHeight + dy + LAYOUT_MARGIN;
  for (const n of nodes) {
    totalWidth = Math.max(totalWidth, n.x + n.width + LAYOUT_MARGIN);
    totalHeight = Math.max(totalHeight, n.y + n.height + LAYOUT_MARGIN);
  }
  return { totalWidth, totalHeight };
}

// ---------------------------------------------------------------------------
// Phase helpers — node geo tree
// ---------------------------------------------------------------------------

function buildContainerGeo(
  astNode: DescriptionDiagramAST['nodes'][number],
  pos: OuterNode,
  innerLayouts: Map<string, InnerLayoutResult>,
): DescriptionNodeGeo {
  const inner = innerLayouts.get(astNode.id);
  let childGeos: DescriptionNodeGeo[] = [];
  if (inner !== undefined && inner.childGeos.length > 0) {
    const offsetX = pos.x + CONTAINER_PADDING - LAYOUT_MARGIN;
    const offsetY = pos.y + CONTAINER_TOP_PAD - LAYOUT_MARGIN;
    childGeos = inner.childGeos.map((g) => shiftGeoBy(g, offsetX, offsetY));
  }
  const geo: DescriptionNodeGeo = {
    id: astNode.id,
    symbol: astNode.symbol,
    display: astNode.display,
    x: pos.x,
    y: pos.y,
    width: pos.width,
    height: pos.height,
    children: childGeos,
  };
  if (astNode.stereotype !== undefined) geo.stereotype = astNode.stereotype;
  return geo;
}

function buildLeafGeo(
  astNode: DescriptionDiagramAST['nodes'][number],
  pos: OuterNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): DescriptionNodeGeo {
  const dims = measureLeafNode(astNode, fontSpec, measurer);
  const geo: DescriptionNodeGeo = {
    id: astNode.id,
    symbol: astNode.symbol,
    display: astNode.display,
    x: pos.x,
    y: pos.y,
    width: dims.width,
    height: dims.height,
    children: [],
  };
  if (astNode.stereotype !== undefined) geo.stereotype = astNode.stereotype;
  return geo;
}

function buildNodeGeoTree(
  nodes: DescriptionDiagramAST['nodes'],
  outerPosMap: Map<string, OuterNode>,
  innerLayouts: Map<string, InnerLayoutResult>,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): DescriptionNodeGeo[] {
  const geos: DescriptionNodeGeo[] = [];
  for (const astNode of nodes) {
    const pos = outerPosMap.get(astNode.id);
    if (pos === undefined) continue;
    geos.push(
      isContainer(astNode.symbol)
        ? buildContainerGeo(astNode, pos, innerLayouts)
        : buildLeafGeo(astNode, pos, fontSpec, measurer),
    );
  }
  return geos;
}

// ---------------------------------------------------------------------------
// Phase helpers — edge geos
// ---------------------------------------------------------------------------

function buildSingleEdgeGeo(
  i: number,
  link: DescriptiveLink,
  fromGeo: DescriptionNodeGeo,
  toGeo: DescriptionNodeGeo,
): DescriptionEdgeGeo {
  const pts: Array<{ x: number; y: number }> = [
    { x: fromGeo.x + fromGeo.width / 2, y: fromGeo.y + fromGeo.height / 2 },
    { x: toGeo.x + toGeo.width / 2, y: toGeo.y + toGeo.height / 2 },
  ];
  const edge: DescriptionEdgeGeo = {
    id: `edge-${i}`,
    from: link.from,
    to: link.to,
    points: pts,
    dashed: link.style === 'dashed',
  };
  if (link.stereotype !== undefined) edge.stereotype = link.stereotype;
  if (link.arrowHead !== undefined) edge.arrowHead = link.arrowHead;
  if (link.label !== undefined) {
    edge.label = {
      text: link.label,
      x: (pts[0]!.x + pts[1]!.x) / 2,
      y: (pts[0]!.y + pts[1]!.y) / 2 - LABEL_Y_OFFSET,
    };
  }
  return edge;
}

/** Route each link as a centre-to-centre 2-point line between actual nodes. */
function buildEdgeGeos(
  links: DescriptionDiagramAST['links'],
  nodeGeoIndex: Map<string, DescriptionNodeGeo>,
): DescriptionEdgeGeo[] {
  const edges: DescriptionEdgeGeo[] = [];
  for (const [i, link] of links.entries()) {
    const fromGeo = nodeGeoIndex.get(link.from);
    const toGeo = nodeGeoIndex.get(link.to);
    if (fromGeo === undefined || toGeo === undefined) continue;
    edges.push(buildSingleEdgeGeo(i, link, fromGeo, toGeo));
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Disconnected fallback
// ---------------------------------------------------------------------------

/** When there are no links, lay out the whole diagram as a 2-column grid. */
function layoutDisconnected(
  astNodes: DescriptionDiagramAST['nodes'],
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): DescriptionGeometry {
  const gridResult = layoutContainerChildren(astNodes, fontSpec, measurer);

  let leftExtra = 0;
  for (const node of astNodes) {
    if (node.symbol === 'actor' || node.symbol === 'actor-business') {
      const labelW = measurer.measure(node.display, fontSpec).width;
      const overhang = Math.ceil(labelW / 2) - ACTOR_WIDTH / 2;
      if (overhang > 0) leftExtra = Math.max(leftExtra, overhang);
    }
  }

  const nodes: DescriptionNodeGeo[] =
    leftExtra > 0
      ? gridResult.childGeos.map((g) => shiftGeoBy(g, leftExtra, 0))
      : gridResult.childGeos;

  const { totalWidth, totalHeight } = computeTotalDimensions(
    gridResult.innerWidth + leftExtra,
    gridResult.innerHeight,
    0,
    0,
    nodes,
  );
  return { totalWidth, totalHeight, nodes, edges: [] };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lay out a descriptive diagram and return pixel geometry for all nodes and
 * edges.
 *
 * Uses a two-level hierarchical dot layout (D6): inner 2-column grid for
 * container children, outer LR dot graph with containers as atomic nodes.
 * Edges are routed centre-to-centre between the actual source/target nodes.
 *
 * @param ast      - Parsed descriptive diagram AST.
 * @param theme    - Visual theme supplying font family and size.
 * @param measurer - Text measurement implementation.
 * @returns Pixel geometry for all nodes and edges.
 */
export function layoutDescription(
  ast: DescriptionDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): DescriptionGeometry {
  if (ast.nodes.length === 0) {
    return { totalWidth: 0, totalHeight: 0, nodes: [], edges: [] };
  }

  const fontSpec: FontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const innerLayouts = computeInnerLayouts(ast.nodes, fontSpec, measurer);
  const ownerMap = buildContainerOwnerMap(ast.nodes);

  if (ast.links.length === 0) {
    return layoutDisconnected(ast.nodes, fontSpec, measurer);
  }

  const outerDotNodes = buildOuterDotNodes(ast.nodes, innerLayouts, fontSpec, measurer);
  const outerDotEdges = buildOuterDotEdges(ast.links, ownerMap);
  const outerResult = layout({ nodes: outerDotNodes, edges: outerDotEdges, rankDir: 'LR', nodeSep: 60, rankSep: 80 });

  const minXMargin = actorLabelMargin(ast.nodes, fontSpec, measurer);
  const { dx, dy } = computeOuterOffsets(outerResult.nodes, minXMargin);

  const outerPosMap = new Map(
    outerResult.nodes.map((n) => [n.id, { ...n, x: n.x + dx, y: n.y + dy }]),
  );

  const nodes = buildNodeGeoTree(ast.nodes, outerPosMap, innerLayouts, fontSpec, measurer);
  const edges = buildEdgeGeos(ast.links, buildNodeGeoIndex(nodes));
  const { totalWidth, totalHeight } = computeTotalDimensions(
    outerResult.width, outerResult.height, dx, dy, nodes,
  );

  return { totalWidth, totalHeight, nodes, edges };
}

// Re-export USymbol so callers need only one import.
export type { USymbol };

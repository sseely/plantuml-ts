/**
 * Use case diagram layout engine.
 *
 * Synchronous: UseCaseDiagramAST + Theme + StringMeasurer → UseCaseGeometry
 * via the dot layout engine.
 *
 * Architecture decisions:
 *   D3 — Calls layout() from the shared dot engine.
 *   D4 — Nodes are pre-measured; dot engine only routes and positions.
 *   D6 — Two-level hierarchical layout (same pattern as state/layout.ts):
 *         container children are laid out first (inner TB layout), then
 *         containers are placed as atomic nodes in the outer LR layout.
 *         This eliminates the post-hoc sibling-overlap correction.
 *
 * No DOM, no SVG. All I/O is plain data.
 */

import type { UseCaseDiagramAST, UCNode, UCNodeKind } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import { layout } from '../../core/dot/index.js';
import type { DotInputNode, DotInputEdge } from '../../core/dot/types.js';
import { measureNodeLabel } from '../../core/latex.js';

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

export interface UCNodeGeo {
  id: string;
  kind: UCNodeKind;
  display: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: UCNodeGeo[];
  stereotype?: string;
}

export interface UCEdgeGeo {
  id: string;
  from: string;
  to: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
  stereotype?: string;
  dashed: boolean;
}

export interface UseCaseGeometry {
  totalWidth: number;
  totalHeight: number;
  nodes: UCNodeGeo[];
  edges: UCEdgeGeo[];
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const ACTOR_WIDTH = 50;
const ACTOR_HEIGHT = 70;
const USECASE_HEIGHT = 40;

const CONTAINER_KINDS: ReadonlySet<UCNodeKind> = new Set([
  'package',
  'rectangle',
  'node',
  'folder',
  'frame',
  'cloud',
  'database',
]);

// Padding applied around children when computing container bounds
const CONTAINER_PADDING = 16;
const CONTAINER_TOP_PAD = 28; // extra room for the container label

// Minimum dimensions for an empty container node (no leaf children)
const EMPTY_CONTAINER_WIDTH = 160;
const EMPTY_CONTAINER_HEIGHT = 80;

// Margin offset added to all node positions so no node starts at x=0 or y=0.
// The dot engine places the first node at the origin; shifting ensures the
// invariant x > 0, y > 0 for every node in the output.
const LAYOUT_MARGIN = 12;

// ---------------------------------------------------------------------------
// Sizing helpers
// ---------------------------------------------------------------------------

function isContainer(kind: UCNodeKind): boolean {
  return CONTAINER_KINDS.has(kind);
}

function measureLeafNode(
  node: UCNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): { width: number; height: number } {
  if (node.kind === 'actor' || node.kind === 'business-actor') {
    return { width: ACTOR_WIDTH, height: ACTOR_HEIGHT };
  }

  // latex labels carry their own dimensions; plain text gets ellipse padding
  if (node.display.includes('<latex>')) {
    return measureNodeLabel(node.display, measurer, fontSpec);
  }
  const textWidth = measurer.measure(node.display, fontSpec).width;
  return {
    width: Math.max(textWidth + 24, USECASE_HEIGHT),
    height: USECASE_HEIGHT,
  };
}

// ---------------------------------------------------------------------------
// Node ancestry helpers
// ---------------------------------------------------------------------------

/**
 * Build a map from each non-container node id to the id of the top-level
 * container that directly or indirectly owns it, or undefined if it is a
 * top-level node.
 *
 * Only top-level containers (direct children of ast.nodes) are tracked here;
 * nodes that are top-level leaves map to undefined.
 */
function buildContainerOwnerMap(
  astNodes: readonly UCNode[],
): Map<string, string | undefined> {
  const ownerMap = new Map<string, string | undefined>();

  function visit(node: UCNode, owningContainerId: string | undefined): void {
    if (isContainer(node.kind)) {
      // The container itself is a top-level entity; record it as owned by
      // undefined (i.e., it is a top-level node in the outer graph).
      ownerMap.set(node.id, undefined);
      // All descendants are owned by this container's top-level ancestor.
      // Since we only care about the *top-level* container, pass node.id when
      // we are currently at the top level (owningContainerId === undefined).
      const effectiveOwner =
        owningContainerId !== undefined ? owningContainerId : node.id;
      for (const child of node.children) {
        visit(child, effectiveOwner);
      }
    } else {
      ownerMap.set(node.id, owningContainerId);
    }
  }

  for (const node of astNodes) {
    visit(node, undefined);
  }

  return ownerMap;
}

// ---------------------------------------------------------------------------
// Inner layout for container children
// ---------------------------------------------------------------------------

interface InnerLayoutResult {
  /** Geos for direct children (absolute within the inner coordinate space). */
  childGeos: UCNodeGeo[];
  /** Total inner width (including LAYOUT_MARGIN on right). */
  innerWidth: number;
  /** Total inner height (including LAYOUT_MARGIN on bottom). */
  innerHeight: number;
}

const GRID_COLS = 2;
const GRID_H_GAP = 20;
const GRID_V_GAP = 20;

/**
 * Lay out the direct children of a container in a 2-column grid (AST order,
 * left-to-right then top-to-bottom). This matches plantuml.com's own
 * arrangement of use cases inside rectangles/packages and avoids the
 * relative-positioning inversions that arise when intra-container edges
 * drive a dot-based ranking.
 *
 * Returns child geos in the inner coordinate space (origin at the top-left
 * of the container's content area, before container padding is applied).
 */
function layoutContainerChildren(
  children: readonly UCNode[],
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): InnerLayoutResult {
  if (children.length === 0) {
    return { childGeos: [], innerWidth: 0, innerHeight: 0 };
  }

  // Measure each child; recursively lay out nested containers
  const dims: Array<{ width: number; height: number; nested: InnerLayoutResult | null }> = [];
  for (const child of children) {
    if (isContainer(child.kind)) {
      const nested = layoutContainerChildren(child.children, fontSpec, measurer);
      dims.push({
        width:
          nested.innerWidth > 0
            ? nested.innerWidth + CONTAINER_PADDING * 2
            : EMPTY_CONTAINER_WIDTH,
        height:
          nested.innerHeight > 0
            ? nested.innerHeight + CONTAINER_TOP_PAD + CONTAINER_PADDING
            : EMPTY_CONTAINER_HEIGHT,
        nested,
      });
    } else {
      dims.push({ ...measureLeafNode(child, fontSpec, measurer), nested: null });
    }
  }

  const numRows = Math.ceil(children.length / GRID_COLS);

  // Per-column max width and per-row max height
  const colWidths = Array<number>(GRID_COLS).fill(0);
  const rowHeights = Array<number>(numRows).fill(0);
  for (let i = 0; i < children.length; i++) {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    colWidths[col] = Math.max(colWidths[col]!, dims[i]!.width);
    rowHeights[row] = Math.max(rowHeights[row]!, dims[i]!.height);
  }

  // Cumulative column x positions and row y positions (within content area)
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

  // Build child geos
  const childGeos: UCNodeGeo[] = [];
  for (let i = 0; i < children.length; i++) {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    const child = children[i]!;
    const d = dims[i]!;

    let nestedChildren: UCNodeGeo[] = [];
    if (isContainer(child.kind) && d.nested !== null) {
      const offsetX = colX[col]! + CONTAINER_PADDING - LAYOUT_MARGIN;
      const offsetY = rowY[row]! + CONTAINER_TOP_PAD - LAYOUT_MARGIN;
      nestedChildren = d.nested.childGeos.map((g) => shiftGeoBy(g, offsetX, offsetY));
    }

    const geo: UCNodeGeo = {
      id: child.id,
      kind: child.kind,
      display: child.display,
      x: colX[col]!,
      y: rowY[row]!,
      width: d.width,
      height: d.height,
      children: nestedChildren,
    };
    if (child.stereotype !== undefined) geo.stereotype = child.stereotype;
    childGeos.push(geo);
  }

  // Compute total inner bounds
  let maxX = 0;
  let maxY = 0;
  for (const g of childGeos) {
    maxX = Math.max(maxX, g.x + g.width + LAYOUT_MARGIN);
    maxY = Math.max(maxY, g.y + g.height + LAYOUT_MARGIN);
  }

  return { childGeos, innerWidth: maxX, innerHeight: maxY };
}

/**
 * Recursively shift a UCNodeGeo and all its descendants by (dx, dy).
 */
function shiftGeoBy(geo: UCNodeGeo, dx: number, dy: number): UCNodeGeo {
  return {
    ...geo,
    x: geo.x + dx,
    y: geo.y + dy,
    children: geo.children.map((c) => shiftGeoBy(c, dx, dy)),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lay out a use case diagram using a two-level hierarchical dot layout.
 *
 * Step 1: For each container node, run an inner TB layout of its children to
 *         determine the container's atomic size.
 * Step 2: Build an outer LR dot graph where containers appear as single atomic
 *         nodes. Cross-container edges use the container's id as the endpoint
 *         so the dot engine routes around the container box.
 * Step 3: Run the outer layout.
 * Step 4: Compute absolute positions for container children by adding the
 *         outer container position to each child's inner-layout position.
 *
 * @param ast      - Parsed use case diagram AST.
 * @param theme    - Visual theme for font metrics and sizing.
 * @param measurer - Text measurement implementation.
 * @returns        Pixel geometry for all nodes and edges.
 */
export function layoutUseCase(
  ast: UseCaseDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): UseCaseGeometry {
  // Empty diagram — return zero-size result immediately
  if (ast.nodes.length === 0) {
    return { totalWidth: 0, totalHeight: 0, nodes: [], edges: [] };
  }

  const fontSpec: FontSpec = {
    family: theme.fontFamily,
    size: theme.fontSize,
  };

  // ── Step 1: Inner layouts for containers ──────────────────────────────────
  // Map from container id → inner layout result
  const innerLayouts = new Map<string, InnerLayoutResult>();

  function collectInnerLayouts(nodes: readonly UCNode[]): void {
    for (const node of nodes) {
      if (isContainer(node.kind)) {
        const inner = layoutContainerChildren(node.children, fontSpec, measurer);
        innerLayouts.set(node.id, inner);
        // No recursion needed: layoutContainerChildren handles nested containers
      }
    }
  }
  collectInnerLayouts(ast.nodes);

  // ── Step 2: Build the owner map (node id → top-level container id) ────────
  const ownerMap = buildContainerOwnerMap(ast.nodes);

  // ── Step 3: Build outer dot graph ─────────────────────────────────────────
  const outerDotNodes: DotInputNode[] = [];

  for (const node of ast.nodes) {
    if (isContainer(node.kind)) {
      const inner = innerLayouts.get(node.id);
      let containerW: number;
      let containerH: number;
      if (inner === undefined || inner.innerWidth === 0) {
        containerW = EMPTY_CONTAINER_WIDTH;
        containerH = EMPTY_CONTAINER_HEIGHT;
      } else {
        // Measure label width for the container title
        const labelWidth = measurer.measure(node.display, fontSpec).width;
        containerW = Math.max(
          inner.innerWidth + CONTAINER_PADDING * 2,
          labelWidth + CONTAINER_PADDING * 2,
        );
        containerH = inner.innerHeight + CONTAINER_TOP_PAD + CONTAINER_PADDING;
      }
      outerDotNodes.push({ id: node.id, width: containerW, height: containerH });
    } else {
      const dims = measureLeafNode(node, fontSpec, measurer);
      outerDotNodes.push({ id: node.id, width: dims.width, height: dims.height });
    }
  }

  // Build outer edges: for cross-container edges, replace the endpoint with
  // the container's id. Deduplicate by (effectiveFrom, effectiveTo) pair to
  // avoid parallel edges that confuse the dot engine.
  const seenOuterEdgePairs = new Set<string>();
  const outerDotEdges: DotInputEdge[] = [];

  for (const [i, link] of ast.links.entries()) {
    const fromOwner = ownerMap.get(link.from);
    const toOwner = ownerMap.get(link.to);

    // Resolve: if the node is inside a container, use the container id
    const effectiveFrom = fromOwner !== undefined ? fromOwner : link.from;
    const effectiveTo = toOwner !== undefined ? toOwner : link.to;

    // Skip self-loops (container → same container)
    if (effectiveFrom === effectiveTo) continue;

    const pairKey = `${effectiveFrom}→${effectiveTo}`;
    if (!seenOuterEdgePairs.has(pairKey)) {
      seenOuterEdgePairs.add(pairKey);
      outerDotEdges.push({
        id: `outer-edge-${i}`,
        from: effectiveFrom,
        to: effectiveTo,
      });
    }
  }

  // ── Disconnected fallback: 2-column grid ─────────────────────────────────
  // The dot engine places all edgeless nodes in a single LR rank column,
  // producing a vertical stack. Upstream PlantUML uses the same 2-column
  // grid for disconnected top-level nodes that it uses for container children.
  if (ast.links.length === 0) {
    const gridResult = layoutContainerChildren(ast.nodes, fontSpec, measurer);

    // Actor labels are centered on the actor box; shift right if a label
    // would extend past the left edge of the viewport.
    let leftExtra = 0;
    for (const astNode of ast.nodes) {
      if (astNode.kind === 'actor' || astNode.kind === 'business-actor') {
        const labelW = measurer.measure(astNode.display, fontSpec).width;
        const overhang = Math.ceil(labelW / 2) - ACTOR_WIDTH / 2;
        if (overhang > 0) leftExtra = Math.max(leftExtra, overhang);
      }
    }

    const nodes: UCNodeGeo[] =
      leftExtra > 0
        ? gridResult.childGeos.map((g) => shiftGeoBy(g, leftExtra, 0))
        : gridResult.childGeos;

    let totalWidth = gridResult.innerWidth + leftExtra + LAYOUT_MARGIN;
    let totalHeight = gridResult.innerHeight + LAYOUT_MARGIN;
    for (const n of nodes) {
      totalWidth = Math.max(totalWidth, n.x + n.width + LAYOUT_MARGIN);
      totalHeight = Math.max(totalHeight, n.y + n.height + LAYOUT_MARGIN);
    }

    return { totalWidth, totalHeight, nodes, edges: [] };
  }

  // ── Step 4: Run outer layout ───────────────────────────────────────────────
  const outerResult = layout({
    nodes: outerDotNodes,
    edges: outerDotEdges,
    rankDir: 'LR',
    nodeSep: 60,
    rankSep: 80,
  });

  // Normalize outer positions: shift so minimum coordinate is at LAYOUT_MARGIN.
  // Use a larger left margin when actor labels overhang the actor box so that
  // labels are not clipped at the left edge of the viewport.
  let outerMinX = Infinity;
  let outerMinY = Infinity;
  for (const n of outerResult.nodes) {
    if (n.x < outerMinX) outerMinX = n.x;
    if (n.y < outerMinY) outerMinY = n.y;
  }
  if (!isFinite(outerMinX)) outerMinX = 0;
  if (!isFinite(outerMinY)) outerMinY = 0;

  let minXMargin = LAYOUT_MARGIN;
  for (const astNode of ast.nodes) {
    if (astNode.kind === 'actor' || astNode.kind === 'business-actor') {
      const labelW = measurer.measure(astNode.display, fontSpec).width;
      const overhang = Math.ceil(labelW / 2) - ACTOR_WIDTH / 2;
      if (overhang > 0) {
        minXMargin = Math.max(minXMargin, overhang + LAYOUT_MARGIN);
      }
    }
  }

  const outerDx = minXMargin - outerMinX;
  const outerDy = LAYOUT_MARGIN - outerMinY;

  const outerPosMap = new Map(
    outerResult.nodes.map((n) => [
      n.id,
      { ...n, x: n.x + outerDx, y: n.y + outerDy },
    ]),
  );


  // ── Step 5: Build UCNodeGeo tree ──────────────────────────────────────────
  const nodes: UCNodeGeo[] = [];

  for (const astNode of ast.nodes) {
    const pos = outerPosMap.get(astNode.id);
    if (pos === undefined) continue;

    if (isContainer(astNode.kind)) {
      const inner = innerLayouts.get(astNode.id);
      let childGeos: UCNodeGeo[] = [];

      if (inner !== undefined && inner.childGeos.length > 0) {
        // Offset inner children: outer container position + padding offset
        const offsetX = pos.x + CONTAINER_PADDING - LAYOUT_MARGIN;
        const offsetY = pos.y + CONTAINER_TOP_PAD - LAYOUT_MARGIN;
        childGeos = inner.childGeos.map((g) => shiftGeoBy(g, offsetX, offsetY));
      }

      const containerGeo: UCNodeGeo = {
        id: astNode.id,
        kind: astNode.kind,
        display: astNode.display,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        children: childGeos,
      };
      if (astNode.stereotype !== undefined) {
        containerGeo.stereotype = astNode.stereotype;
      }
      nodes.push(containerGeo);
    } else {
      const dims = measureLeafNode(astNode, fontSpec, measurer);
      const leafGeo: UCNodeGeo = {
        id: astNode.id,
        kind: astNode.kind,
        display: astNode.display,
        x: pos.x,
        y: pos.y,
        width: dims.width,
        height: dims.height,
        children: [],
      };
      if (astNode.stereotype !== undefined) {
        leafGeo.stereotype = astNode.stereotype;
      }
      nodes.push(leafGeo);
    }
  }

  // ── Step 6: Build UCEdgeGeo entries ──────────────────────────────────────
  // Build a flat map from node id → UCNodeGeo for edge endpoint lookup
  const nodeGeoMap = new Map<string, UCNodeGeo>();
  function indexGeos(geos: readonly UCNodeGeo[]): void {
    for (const g of geos) {
      nodeGeoMap.set(g.id, g);
      if (g.children.length > 0) indexGeos(g.children);
    }
  }
  indexGeos(nodes);

  // Route every link as a direct 2-point line between actual node centers.
  // Use case associations go directly from actor to use case oval regardless
  // of container boundaries — the rectangle is a visual grouping, not a routing
  // constraint. Direct routing gives individually distinguishable lines where
  // collapsed outer-edge routing bundled all actor→container links onto one path.
  const edges: UCEdgeGeo[] = [];

  for (const [i, link] of ast.links.entries()) {
    const fromGeo = nodeGeoMap.get(link.from);
    const toGeo = nodeGeoMap.get(link.to);
    if (fromGeo === undefined || toGeo === undefined) continue;

    const edgePoints: Array<{ x: number; y: number }> = [
      { x: fromGeo.x + fromGeo.width / 2, y: fromGeo.y + fromGeo.height / 2 },
      { x: toGeo.x + toGeo.width / 2, y: toGeo.y + toGeo.height / 2 },
    ];

    const edgeGeo: UCEdgeGeo = {
      id: `edge-${i}`,
      from: link.from,
      to: link.to,
      points: edgePoints,
      dashed: link.style === 'dashed',
    };

    if (link.stereotype !== undefined) {
      edgeGeo.stereotype = link.stereotype;
    }

    if (link.label !== undefined) {
      edgeGeo.label = {
        text: link.label,
        x: (edgePoints[0]!.x + edgePoints[1]!.x) / 2,
        y: (edgePoints[0]!.y + edgePoints[1]!.y) / 2 - 8,
      };
    }

    edges.push(edgeGeo);
  }

  // ── Step 7: Compute total diagram dimensions ──────────────────────────────
  let totalWidth = outerResult.width + outerDx + LAYOUT_MARGIN;
  let totalHeight = outerResult.height + outerDy + LAYOUT_MARGIN;
  for (const n of nodes) {
    totalWidth = Math.max(totalWidth, n.x + n.width + LAYOUT_MARGIN);
    totalHeight = Math.max(totalHeight, n.y + n.height + LAYOUT_MARGIN);
  }

  return { totalWidth, totalHeight, nodes, edges };
}

/**
 * Layout engine for PlantUML component diagrams.
 *
 * Architecture decisions:
 *   D3 — Delegates to the shared dot layout engine via layout().
 *   D4 — Nodes are pre-measured using StringMeasurer before layout runs.
 *   D5 — Container nodes (package, folder, cloud, etc.) are flattened to
 *         leaf nodes for layout; container bounds are computed post-layout
 *         from the final positions of their leaf descendants.
 *
 * The dot layout engine is synchronous. Container hierarchy is preserved
 * in the returned ComponentNodeGeo tree; each container's x/y/width/height
 * is derived from the bounding box of its children after layout.
 */

import type { ComponentDiagramAST, ComponentNode, ComponentKind } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { DotInputNode, DotInputEdge } from '../../core/graph-layout.js';
import { layoutGraph as layout } from '../../core/graph-layout.js';

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

export interface ComponentNodeGeo {
  id: string;
  kind: ComponentKind;
  display: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: ComponentNodeGeo[];
  stereotype?: string;
}

export interface ComponentEdgeGeo {
  id: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
  dashed: boolean;
  arrowHead: 'open' | 'filled' | 'none';
}

export interface ComponentGeometry {
  totalWidth: number;
  totalHeight: number;
  nodes: ComponentNodeGeo[];
  edges: ComponentEdgeGeo[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTAINER_KINDS = new Set<ComponentKind>([
  'package',
  'node',
  'folder',
  'frame',
  'cloud',
  'database',
  'storage',
]);

const LEAF_MIN_WIDTH = 80;
const LEAF_HORIZONTAL_PADDING = 20;

/** Padding inside a container on the sides and bottom. */
const CONTAINER_PADDING = 24;
/** Extra space at the top of a container for the label. */
const CONTAINER_TOP_PAD = 36;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isContainer(kind: ComponentKind): boolean {
  return CONTAINER_KINDS.has(kind);
}

function measureLeafNode(
  node: ComponentNode,
  theme: Theme,
  measurer: StringMeasurer,
): { width: number; height: number } {
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const measured = measurer.measure(node.display, fontSpec);
  return {
    width: Math.max(LEAF_MIN_WIDTH, measured.width + LEAF_HORIZONTAL_PADDING),
    height: node.kind === 'database'
      ? theme.fontSize * 1.4 + 40
      : theme.fontSize * 1.4 + 16,
  };
}

/**
 * Recursively collect all leaf nodes from the AST into a flat array.
 * Container nodes with children are recursed into; container nodes with no
 * children (e.g. standalone `database "Name"`) are treated as leaves.
 */
function collectLeafNodes(
  nodes: ComponentNode[],
  theme: Theme,
  measurer: StringMeasurer,
  result: DotInputNode[] = [],
): DotInputNode[] {
  for (const node of nodes) {
    if (isContainer(node.kind) && node.children.length > 0) {
      collectLeafNodes(node.children, theme, measurer, result);
    } else {
      const dims = measureLeafNode(node, theme, measurer);
      result.push({ id: node.id, width: dims.width, height: dims.height });
    }
  }
  return result;
}

/**
 * Build a map from node id to ComponentNode for all nodes (including nested).
 */
function buildNodeMap(
  nodes: ComponentNode[],
  map: Map<string, ComponentNode> = new Map(),
): Map<string, ComponentNode> {
  for (const node of nodes) {
    map.set(node.id, node);
    if (node.children.length > 0) {
      buildNodeMap(node.children, map);
    }
  }
  return map;
}

interface LayoutPos {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Build the ComponentNodeGeo tree recursively.
 *
 * For leaf nodes: look up the final position from posMap.
 * For container nodes: compute the bounding box from all leaf descendants,
 * then recurse to build child geos relative to that bounding box.
 */
function buildNodeGeoTree(
  node: ComponentNode,
  posMap: Map<string, LayoutPos>,
  nodeMap: Map<string, ComponentNode>,
): ComponentNodeGeo | null {
  // Leaf: either not a container kind, or a container with no children
  // (e.g. standalone `database "PostgreSQL"`).
  if (!isContainer(node.kind) || node.children.length === 0) {
    const pos = posMap.get(node.id);
    if (pos === undefined) return null;

    const base: ComponentNodeGeo = {
      id: node.id,
      kind: node.kind,
      display: node.display,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      children: [],
    };
    if (node.stereotype !== undefined) {
      return { ...base, stereotype: node.stereotype };
    }
    return base;
  }

  // Container: build children first, then derive bounds from them.
  const children: ComponentNodeGeo[] = [];
  for (const child of node.children) {
    const childGeo = buildNodeGeoTree(child, posMap, nodeMap);
    if (childGeo !== null) {
      children.push(childGeo);
    }
  }

  // Compute bounding box from children.
  if (children.length === 0) {
    // Empty container — place at origin with minimal size.
    const base: ComponentNodeGeo = {
      id: node.id,
      kind: node.kind,
      display: node.display,
      x: 0,
      y: 0,
      width: LEAF_MIN_WIDTH,
      height: CONTAINER_TOP_PAD + CONTAINER_PADDING,
      children: [],
    };
    if (node.stereotype !== undefined) {
      return { ...base, stereotype: node.stereotype };
    }
    return base;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const child of children) {
    minX = Math.min(minX, child.x);
    minY = Math.min(minY, child.y);
    maxX = Math.max(maxX, child.x + child.width);
    maxY = Math.max(maxY, child.y + child.height);
  }

  const containerX = minX - CONTAINER_PADDING;
  const containerY = minY - CONTAINER_TOP_PAD;
  const containerWidth = maxX - minX + CONTAINER_PADDING * 2;
  const containerHeight = maxY - minY + CONTAINER_TOP_PAD + CONTAINER_PADDING;

  const base: ComponentNodeGeo = {
    id: node.id,
    kind: node.kind,
    display: node.display,
    x: containerX,
    y: containerY,
    width: containerWidth,
    height: containerHeight,
    children,
  };

  if (node.stereotype !== undefined) {
    return { ...base, stereotype: node.stereotype };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Coordinate normalization helpers
// ---------------------------------------------------------------------------

const LAYOUT_MARGIN = 12;

/**
 * Bounding box of a set of top-level nodes. Container nodes already
 * encompass their children, so we only need the top-level list.
 */
function computeBounds(nodes: ComponentNodeGeo[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    const rx = n.x + n.width;
    const ry = n.y + n.height;
    if (rx > maxX) maxX = rx;
    if (ry > maxY) maxY = ry;
  }
  return { minX, minY, maxX, maxY };
}

function translateNode(node: ComponentNodeGeo, dx: number, dy: number): void {
  node.x += dx;
  node.y += dy;
  for (const child of node.children) {
    translateNode(child, dx, dy);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lay out a component diagram using the synchronous dot layout engine.
 *
 * Container nodes (package, folder, cloud, etc.) are flattened to leaf nodes
 * for layout (D5). After layout, container bounding boxes are computed from
 * the final positions of their leaf descendants and stored in the returned
 * ComponentNodeGeo tree.
 *
 * A final normalization pass ensures all coordinates are non-negative and
 * that totalWidth/totalHeight include container extents (which extend beyond
 * the leaf-node bounding box used by the dot engine).
 */
export function layoutComponent(
  ast: ComponentDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): ComponentGeometry {
  if (ast.nodes.length === 0) {
    return { totalWidth: 0, totalHeight: 0, nodes: [], edges: [] };
  }

  const dotNodes = collectLeafNodes(ast.nodes, theme, measurer);

  const dotEdges: DotInputEdge[] = ast.links.map((link, i) => ({
    id: `edge-${i}`,
    from: link.from,
    to: link.to,
  }));

  const result = layout({
    nodes: dotNodes,
    edges: dotEdges,
    rankDir: 'TB',
    nodeSep: 60,
    rankSep: 80,
  });

  // Build position map from layout result.
  const posMap = new Map<string, LayoutPos>(
    result.nodes.map((n) => [n.id, { x: n.x, y: n.y, width: n.width, height: n.height }]),
  );

  const nodeMap = buildNodeMap(ast.nodes);

  const nodes: ComponentNodeGeo[] = [];
  for (const astNode of ast.nodes) {
    const geo = buildNodeGeoTree(astNode, posMap, nodeMap);
    if (geo !== null) {
      nodes.push(geo);
    }
  }

  // Build a map from dot edge id ("edge-N") → original link so label/style
  // lookups survive edge reordering or drops (e.g. when a target node is
  // missing from the layout because it was skipped).
  const linkByEdgeId = new Map(
    ast.links.map((link, i) => [`edge-${i}`, link]),
  );

  const edges: ComponentEdgeGeo[] = result.edges.map((dotEdge) => {
    const link = linkByEdgeId.get(dotEdge.id);
    const dashed = link?.style === 'dashed';

    const edgeBase: ComponentEdgeGeo = {
      id: dotEdge.id,
      points: dotEdge.points,
      dashed,
      arrowHead: link?.arrowHead ?? 'open',
    };

    if (link?.label !== undefined) {
      const pts = dotEdge.points;
      if (pts.length >= 2) {
        const n = pts.length;
        const lo = Math.floor((n - 1) / 2);
        const hi = Math.ceil((n - 1) / 2);
        const mid = {
          x: (pts[lo]!.x + pts[hi]!.x) / 2,
          y: (pts[lo]!.y + pts[hi]!.y) / 2,
        };
        const first = pts[0]!;
        const last = pts[n - 1]!;
        const edgeDx = last.x - first.x;
        const edgeDy = last.y - first.y;
        const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1;
        const LABEL_OFFSET = 10;
        return {
          ...edgeBase,
          label: {
            text: link.label,
            x: mid.x + (edgeDy / edgeLen) * LABEL_OFFSET,
            y: mid.y + (-edgeDx / edgeLen) * LABEL_OFFSET,
          },
        };
      }
    }

    return edgeBase;
  });

  // Normalize: container padding can push bounding boxes to negative coords.
  // Translate everything so the top-left of content sits at (MARGIN, MARGIN),
  // then compute totalWidth/totalHeight from actual content extents.
  if (nodes.length > 0) {
    const bounds = computeBounds(nodes);
    const dx = LAYOUT_MARGIN - bounds.minX;
    const dy = LAYOUT_MARGIN - bounds.minY;

    if (dx !== 0 || dy !== 0) {
      for (const node of nodes) {
        translateNode(node, dx, dy);
      }
      for (const edge of edges) {
        for (const pt of edge.points) {
          pt.x += dx;
          pt.y += dy;
        }
        if (edge.label !== undefined) {
          edge.label.x += dx;
          edge.label.y += dy;
        }
      }
    }

    const finalBounds = computeBounds(nodes);
    return {
      totalWidth: finalBounds.maxX + LAYOUT_MARGIN,
      totalHeight: finalBounds.maxY + LAYOUT_MARGIN,
      nodes,
      edges,
    };
  }

  return {
    totalWidth: result.width,
    totalHeight: result.height,
    nodes,
    edges,
  };
}

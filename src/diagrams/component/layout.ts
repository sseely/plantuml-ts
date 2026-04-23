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
import type { DotInputNode, DotInputEdge } from '../../core/dot/index.js';
import { layout } from '../../core/dot/index.js';

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
const CONTAINER_PADDING = 16;
/** Extra space at the top of a container for the label. */
const CONTAINER_TOP_PAD = 28;

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
    height: theme.fontSize * 1.4 + 16,
  };
}

/**
 * Recursively collect all leaf nodes from the AST into a flat array.
 * Container nodes are skipped — only nodes with non-container kinds are
 * included.
 */
function collectLeafNodes(
  nodes: ComponentNode[],
  theme: Theme,
  measurer: StringMeasurer,
  result: DotInputNode[] = [],
): DotInputNode[] {
  for (const node of nodes) {
    if (isContainer(node.kind)) {
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
  if (!isContainer(node.kind)) {
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Lay out a component diagram using the synchronous dot layout engine.
 *
 * Container nodes (package, folder, cloud, etc.) are flattened to leaf nodes
 * for layout (D5). After layout, container bounding boxes are computed from
 * the final positions of their leaf descendants and stored in the returned
 * ComponentNodeGeo tree.
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
    rankDir: 'LR',
    nodeSep: 36,
    rankSep: 48,
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

  const edges: ComponentEdgeGeo[] = result.edges.map((dotEdge, index) => {
    const link = ast.links[index];
    const dashed = link?.style === 'dashed';

    const edgeBase: ComponentEdgeGeo = {
      id: dotEdge.id,
      points: dotEdge.points,
      dashed,
    };

    if (link?.label !== undefined) {
      // The dot engine does not return label positions; place label at
      // the midpoint of the edge points as a reasonable approximation.
      const pts = dotEdge.points;
      const mid = pts[Math.floor(pts.length / 2)];
      if (mid !== undefined) {
        return {
          ...edgeBase,
          label: { text: link.label, x: mid.x, y: mid.y },
        };
      }
    }

    return edgeBase;
  });

  return {
    totalWidth: result.width,
    totalHeight: result.height,
    nodes,
    edges,
  };
}

/**
 * Layout engine for PlantUML component diagrams.
 *
 * Architecture decisions:
 *   D3 — Delegates to the shared ELK adapter via runLayout().
 *   D4 — Nodes are pre-measured using StringMeasurer before ELK runs.
 *   D5 — Container nodes (package, folder, cloud, etc.) are mapped to ELK
 *         compound nodes with children arrays.
 *
 * ELK returns child positions relative to their parent origin. This module
 * converts those to absolute coordinates when building ComponentNodeGeo.
 */

import type { ComponentDiagramAST, ComponentNode, ComponentKind } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { ElkInputNode, ElkInputEdge, ElkOutputNode, ElkOutputEdge } from '../../core/elk-adapter.js';
import { runLayout } from '../../core/elk-adapter.js';

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

const LAYOUT_OPTIONS: Record<string, string> = {
  algorithm: 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '40',
  'elk.spacing.nodeNode': '25',
  'elk.edgeRouting': 'ORTHOGONAL',
};

const CONTAINER_INITIAL_WIDTH = 120;
const CONTAINER_INITIAL_HEIGHT = 80;
const LEAF_MIN_WIDTH = 80;
const LEAF_HORIZONTAL_PADDING = 20;

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

function buildElkNode(
  node: ComponentNode,
  theme: Theme,
  measurer: StringMeasurer,
): ElkInputNode {
  if (isContainer(node.kind)) {
    return {
      id: node.id,
      width: CONTAINER_INITIAL_WIDTH,
      height: CONTAINER_INITIAL_HEIGHT,
      children: node.children.map((child) => buildElkNode(child, theme, measurer)),
    };
  }

  const dims = measureLeafNode(node, theme, measurer);
  return { id: node.id, width: dims.width, height: dims.height };
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

/**
 * Convert an ELK output node tree to ComponentNodeGeo, resolving child
 * positions from parent-relative to absolute coordinates.
 *
 * @param elkNode - The ELK output node.
 * @param nodeMap - Map of id → ComponentNode for metadata lookup.
 * @param parentX - Absolute x of parent origin (0 for root nodes).
 * @param parentY - Absolute y of parent origin (0 for root nodes).
 */
function buildNodeGeo(
  elkNode: ElkOutputNode,
  nodeMap: Map<string, ComponentNode>,
  parentX: number,
  parentY: number,
): ComponentNodeGeo {
  const absX = parentX + elkNode.x;
  const absY = parentY + elkNode.y;

  const astNode = nodeMap.get(elkNode.id);
  const kind: ComponentKind = astNode?.kind ?? 'component';
  const display = astNode?.display ?? elkNode.id;
  const stereotype = astNode?.stereotype;

  const children: ComponentNodeGeo[] = (elkNode.children ?? []).map((child) =>
    buildNodeGeo(child, nodeMap, absX, absY),
  );

  const base: ComponentNodeGeo = {
    id: elkNode.id,
    kind,
    display,
    x: absX,
    y: absY,
    width: elkNode.width,
    height: elkNode.height,
    children,
  };

  if (stereotype !== undefined) {
    return { ...base, stereotype };
  }
  return base;
}

/**
 * Extract a flat list of points from an ELK output edge's sections.
 */
function extractPoints(
  edge: ElkOutputEdge,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (const section of edge.sections) {
    points.push({ x: section.startPoint.x, y: section.startPoint.y });
    for (const bend of section.bendPoints ?? []) {
      points.push({ x: bend.x, y: bend.y });
    }
    points.push({ x: section.endPoint.x, y: section.endPoint.y });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lay out a component diagram using ELK.
 *
 * Nodes are pre-measured before calling ELK (D4). Container nodes are passed
 * as ELK compound nodes with their children arrays (D5). ELK child positions
 * are relative to the parent; this function converts them to absolute
 * coordinates in the returned ComponentNodeGeo tree.
 */
export async function layoutComponent(
  ast: ComponentDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): Promise<ComponentGeometry> {
  if (ast.nodes.length === 0) {
    return { totalWidth: 0, totalHeight: 0, nodes: [], edges: [] };
  }

  const elkNodes: ElkInputNode[] = ast.nodes.map((n) =>
    buildElkNode(n, theme, measurer),
  );

  const elkEdges: ElkInputEdge[] = ast.links.map((link, index) => {
    const edgeBase: ElkInputEdge = {
      id: `edge-${index}`,
      sources: [link.from],
      targets: [link.to],
    };
    if (link.label !== undefined) {
      return {
        ...edgeBase,
        labels: [{ text: link.label }],
      };
    }
    return edgeBase;
  });

  const result = await runLayout({
    nodes: elkNodes,
    edges: elkEdges,
    layoutOptions: LAYOUT_OPTIONS,
  });

  const nodeMap = buildNodeMap(ast.nodes);

  const nodes: ComponentNodeGeo[] = result.nodes.map((n) =>
    buildNodeGeo(n, nodeMap, 0, 0),
  );

  const edges: ComponentEdgeGeo[] = result.edges.map((elkEdge, index) => {
    const link = ast.links[index];
    const dashed = link?.style === 'dashed';
    const points = extractPoints(elkEdge);

    const firstLabel = elkEdge.labels?.[0];
    const edgeBase: ComponentEdgeGeo = {
      id: elkEdge.id,
      points,
      dashed,
    };
    if (firstLabel !== undefined) {
      return {
        ...edgeBase,
        label: { text: firstLabel.text, x: firstLabel.x, y: firstLabel.y },
      };
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

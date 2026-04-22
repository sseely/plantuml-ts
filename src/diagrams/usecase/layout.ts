/**
 * Use case diagram layout engine.
 *
 * Async: UseCaseDiagramAST + Theme + StringMeasurer → UseCaseGeometry via ELK.
 *
 * Architecture decisions:
 *   D3 — Calls runLayout() from the shared elk-adapter.
 *   D4 — Nodes are pre-measured; ELK only routes and positions.
 *   D5 — Container kinds become ELK compound parent nodes with children.
 *
 * No DOM, no SVG. All I/O is plain data.
 */

import type { UseCaseDiagramAST, UCNode, UCNodeKind } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import { runLayout } from '../../core/elk-adapter.js';
import type {
  ElkGraph,
  ElkInputEdge,
  ElkInputNode,
  ElkOutputNode,
  ElkLayoutResult,
} from '../../core/elk-adapter.js';

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

const LAYOUT_OPTIONS: Record<string, string> = {
  'algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '40',
  'elk.layered.spacing.nodeNodeBetweenLayers': '60',
  'elk.edgeRouting': 'POLYLINE',
  // Route edges that cross compound-node boundaries (actor → use case inside
  // a container). Without this, cross-hierarchy edges are silently dropped.
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
};

const ACTOR_WIDTH = 50;
const ACTOR_HEIGHT = 70;
const USECASE_MIN_WIDTH = 120;
const USECASE_HEIGHT = 40;
const CONTAINER_INITIAL_WIDTH = 160;
const CONTAINER_INITIAL_HEIGHT = 100;

const CONTAINER_KINDS: ReadonlySet<UCNodeKind> = new Set([
  'package',
  'rectangle',
  'node',
  'folder',
  'frame',
  'cloud',
  'database',
]);

// ---------------------------------------------------------------------------
// Sizing helpers
// ---------------------------------------------------------------------------

function isContainer(kind: UCNodeKind): boolean {
  return CONTAINER_KINDS.has(kind);
}

function measureNode(
  node: UCNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): { width: number; height: number } {
  if (node.kind === 'actor') {
    return { width: ACTOR_WIDTH, height: ACTOR_HEIGHT };
  }

  if (node.kind === 'usecase') {
    const textWidth = measurer.measure(node.display, fontSpec).width;
    return {
      width: Math.max(USECASE_MIN_WIDTH, textWidth + 20),
      height: USECASE_HEIGHT,
    };
  }

  // Container kinds — ELK will size to fit children
  return { width: CONTAINER_INITIAL_WIDTH, height: CONTAINER_INITIAL_HEIGHT };
}

// ---------------------------------------------------------------------------
// ELK graph builder
// ---------------------------------------------------------------------------

/**
 * Build a flat map from nodeId → parentContainerId (null = root level).
 * Used to determine the LCA of an edge's endpoints for correct ELK ownership.
 */
function buildParentMap(
  nodes: UCNode[],
  parentId: string | null,
  out: Map<string, string | null>,
): void {
  for (const node of nodes) {
    out.set(node.id, parentId);
    if (node.children.length > 0) {
      buildParentMap(node.children, node.id, out);
    }
  }
}

/**
 * Build an ELK input node, injecting container-owned edges when provided.
 * Container-owned edges are those where both endpoints are direct children
 * of this node (LCA = this node).
 */
function buildElkNode(
  node: UCNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  ownedEdges?: ElkInputEdge[],
): ElkInputNode {
  const { width, height } = measureNode(node, fontSpec, measurer);

  if (isContainer(node.kind) && node.children.length > 0) {
    const elkNode: ElkInputNode = {
      id: node.id,
      width,
      height,
      children: node.children.map((child) =>
        buildElkNode(child, fontSpec, measurer),
      ),
      layoutOptions: {
        'algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '20',
      },
    };
    if (ownedEdges !== undefined && ownedEdges.length > 0) {
      elkNode.edges = ownedEdges;
    }
    return elkNode;
  }

  return { id: node.id, width, height };
}

function buildElkGraph(
  ast: UseCaseDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): ElkGraph {
  const fontSpec: FontSpec = {
    family: theme.fontFamily,
    size: theme.fontSize,
  };

  // Map each nodeId to its parent container id (null = root level).
  const parentMap = new Map<string, string | null>();
  buildParentMap(ast.nodes, null, parentMap);

  // Split edges by LCA: intra-container edges go inside the container node,
  // cross-boundary edges stay at the root graph level.
  const containerEdgeMap = new Map<string, ElkInputEdge[]>();
  const rootEdges: ElkInputEdge[] = [];

  for (const [i, link] of ast.links.entries()) {
    const edgeObj: ElkInputEdge = {
      id: `edge-${i}`,
      sources: [link.from],
      targets: [link.to],
      ...(link.label !== undefined
        ? { labels: [{ text: link.label }] }
        : {}),
    };

    const fromParent = parentMap.get(link.from) ?? null;
    const toParent = parentMap.get(link.to) ?? null;

    if (fromParent !== null && fromParent === toParent) {
      // Both endpoints share the same container — edge owned by that container
      const list = containerEdgeMap.get(fromParent) ?? [];
      list.push(edgeObj);
      containerEdgeMap.set(fromParent, list);
    } else {
      rootEdges.push(edgeObj);
    }
  }

  const nodes: ElkInputNode[] = ast.nodes.map((node) =>
    buildElkNode(node, fontSpec, measurer, containerEdgeMap.get(node.id)),
  );

  return { nodes, edges: rootEdges, layoutOptions: LAYOUT_OPTIONS };
}

// ---------------------------------------------------------------------------
// Result extraction helpers
// ---------------------------------------------------------------------------

/**
 * Build a flat map from node id → absolute position, recursing into children.
 * ELK child positions are relative to their parent; we accumulate offsets.
 */
function buildAbsolutePositionMap(
  nodes: ElkOutputNode[],
  parentX = 0,
  parentY = 0,
  out = new Map<string, { x: number; y: number; width: number; height: number }>(),
): Map<string, { x: number; y: number; width: number; height: number }> {
  for (const node of nodes) {
    const absX = parentX + node.x;
    const absY = parentY + node.y;
    out.set(node.id, { x: absX, y: absY, width: node.width, height: node.height });
    if (node.children !== undefined && node.children.length > 0) {
      buildAbsolutePositionMap(node.children, absX, absY, out);
    }
  }
  return out;
}

/**
 * Extract a flat point list from ELK edge sections.
 */
function extractEdgePoints(
  edge: ElkLayoutResult['edges'][number],
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (const section of edge.sections) {
    points.push({ x: section.startPoint.x, y: section.startPoint.y });
    if (section.bendPoints !== undefined) {
      for (const bp of section.bendPoints) {
        points.push({ x: bp.x, y: bp.y });
      }
    }
    points.push({ x: section.endPoint.x, y: section.endPoint.y });
  }
  return points;
}

/**
 * Recursively build UCNodeGeo tree from an AST node, using the absolute
 * position map for coordinates.
 */
function buildNodeGeo(
  node: UCNode,
  posMap: Map<string, { x: number; y: number; width: number; height: number }>,
): UCNodeGeo | undefined {
  const pos = posMap.get(node.id);
  if (pos === undefined) return undefined;

  const children: UCNodeGeo[] = [];
  for (const child of node.children) {
    const childGeo = buildNodeGeo(child, posMap);
    if (childGeo !== undefined) {
      children.push(childGeo);
    }
  }

  const geo: UCNodeGeo = {
    id: node.id,
    kind: node.kind,
    display: node.display,
    x: pos.x,
    y: pos.y,
    width: pos.width,
    height: pos.height,
    children,
  };

  if (node.stereotype !== undefined) {
    geo.stereotype = node.stereotype;
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lay out a use case diagram using ELK.
 *
 * Nodes are pre-measured (D4); ELK handles routing and positioning only.
 * Container kinds become ELK compound nodes with children as nested nodes (D5).
 *
 * @param ast      - Parsed use case diagram AST.
 * @param theme    - Visual theme for font metrics and sizing.
 * @param measurer - Text measurement implementation.
 * @returns        Resolved pixel geometry for all nodes and edges.
 */
export async function layoutUseCase(
  ast: UseCaseDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): Promise<UseCaseGeometry> {
  // Empty diagram — return zero-size result immediately
  if (ast.nodes.length === 0) {
    return {
      totalWidth: 0,
      totalHeight: 0,
      nodes: [],
      edges: [],
    };
  }

  const graph = buildElkGraph(ast, theme, measurer);
  const elkResult = await runLayout(graph);

  // Build absolute position map (handles compound node child offsets)
  const posMap = buildAbsolutePositionMap(elkResult.nodes);

  // Build UCNodeGeo entries preserving tree structure
  const nodes: UCNodeGeo[] = [];
  for (const astNode of ast.nodes) {
    const geo = buildNodeGeo(astNode, posMap);
    if (geo !== undefined) {
      nodes.push(geo);
    }
  }

  // Build a lookup from edge ID → original link.
  // Edges may be at the root level or inside compound nodes; they come back
  // in mixed order from runLayout, so we match by ID rather than index.
  const linkByEdgeId = new Map<string, { link: typeof ast.links[number]; index: number }>();
  for (const [i, link] of ast.links.entries()) {
    linkByEdgeId.set(`edge-${i}`, { link, index: i });
  }

  // Build UCEdgeGeo entries
  const edges: UCEdgeGeo[] = [];
  for (const elkEdge of elkResult.edges) {
    const entry = linkByEdgeId.get(elkEdge.id);
    if (entry === undefined) continue;
    const { link } = entry;

    const points = extractEdgePoints(elkEdge);
    const edgeGeo: UCEdgeGeo = {
      id: elkEdge.id,
      from: link.from,
      to: link.to,
      points,
      dashed: link.style === 'dashed',
    };

    // Attach label if ELK returned one
    if (
      elkEdge.labels !== undefined &&
      elkEdge.labels.length > 0 &&
      elkEdge.labels[0] !== undefined
    ) {
      const lbl = elkEdge.labels[0];
      edgeGeo.label = { text: lbl.text, x: lbl.x, y: lbl.y };
    }

    if (link.stereotype !== undefined) {
      edgeGeo.stereotype = link.stereotype;
    }

    edges.push(edgeGeo);
  }

  return {
    totalWidth: elkResult.width,
    totalHeight: elkResult.height,
    nodes,
    edges,
  };
}

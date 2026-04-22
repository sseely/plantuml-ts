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
  'algorithm': 'stress',
  'elk.spacing.nodeNode': '40',
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
 * Recursively build an ELK input node from a UCNode tree.
 */
function buildElkNode(
  node: UCNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): ElkInputNode {
  const { width, height } = measureNode(node, fontSpec, measurer);

  if (isContainer(node.kind) && node.children.length > 0) {
    return {
      id: node.id,
      width,
      height,
      children: node.children.map((child) =>
        buildElkNode(child, fontSpec, measurer),
      ),
      layoutOptions: { 'algorithm': 'stress', 'elk.spacing.nodeNode': '20' },
    };
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

  const nodes: ElkInputNode[] = ast.nodes.map((node) =>
    buildElkNode(node, fontSpec, measurer),
  );

  const edges = ast.links.map((link, i) => ({
    id: `edge-${i}`,
    sources: [link.from] as [string],
    targets: [link.to] as [string],
    ...(link.label !== undefined
      ? { labels: [{ text: link.label }] }
      : {}),
  }));

  return { nodes, edges, layoutOptions: LAYOUT_OPTIONS };
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

  // Build UCEdgeGeo entries
  const edges: UCEdgeGeo[] = [];
  for (let i = 0; i < ast.links.length; i++) {
    const link = ast.links[i]!;
    const elkEdge = elkResult.edges[i];
    if (elkEdge === undefined) continue;

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

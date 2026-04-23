/**
 * Use case diagram layout engine.
 *
 * Synchronous: UseCaseDiagramAST + Theme + StringMeasurer → UseCaseGeometry
 * via the dot layout engine.
 *
 * Architecture decisions:
 *   D3 — Calls layout() from the shared dot engine.
 *   D4 — Nodes are pre-measured; dot engine only routes and positions.
 *   D5 — Container kinds are flattened for dot input; bounds are derived
 *         post-layout from children's final positions + padding.
 *
 * No DOM, no SVG. All I/O is plain data.
 */

import type { UseCaseDiagramAST, UCNode, UCNodeKind, UCLink } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import { layout } from '../../core/dot/index.js';
import type { DotInputGraph, DotInputNode, DotInputEdge } from '../../core/dot/types.js';

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
const USECASE_MIN_WIDTH = 120;
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
// The dot engine places the first node at the origin; we shift everything by
// this amount to guarantee x > 0 and y > 0 for every node.
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
  if (node.kind === 'actor') {
    return { width: ACTOR_WIDTH, height: ACTOR_HEIGHT };
  }

  // usecase
  const textWidth = measurer.measure(node.display, fontSpec).width;
  return {
    width: Math.max(USECASE_MIN_WIDTH, textWidth + 20),
    height: USECASE_HEIGHT,
  };
}

// ---------------------------------------------------------------------------
// Dot graph builder
// ---------------------------------------------------------------------------

/**
 * Recursively collect all non-container leaf nodes (actor, usecase) into
 * `dotNodes`. Container nodes are skipped; their bounds are derived
 * post-layout from their children.
 */
function collectLeafNodes(
  nodes: UCNode[],
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  dotNodes: DotInputNode[],
): void {
  for (const node of nodes) {
    if (isContainer(node.kind)) {
      collectLeafNodes(node.children, fontSpec, measurer, dotNodes);
    } else {
      const { width, height } = measureLeafNode(node, fontSpec, measurer);
      dotNodes.push({ id: node.id, width, height });
    }
  }
}

function buildDotGraph(
  ast: UseCaseDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): DotInputGraph {
  const fontSpec: FontSpec = {
    family: theme.fontFamily,
    size: theme.fontSize,
  };

  const dotNodes: DotInputNode[] = [];
  collectLeafNodes(ast.nodes, fontSpec, measurer, dotNodes);

  const dotEdges: DotInputEdge[] = ast.links.map((link, i) => ({
    id: `edge-${i}`,
    from: link.from,
    to: link.to,
  }));

  return {
    nodes: dotNodes,
    edges: dotEdges,
    rankDir: 'LR',
    nodeSep: 40,
    rankSep: 60,
  };
}

// ---------------------------------------------------------------------------
// Result extraction helpers
// ---------------------------------------------------------------------------

type PosEntry = { id: string; x: number; y: number; width: number; height: number };

/**
 * Recursively build UCNodeGeo tree from an AST node, using the position map
 * for leaf-node coordinates. Container bounds are derived from their children.
 * Empty containers (no leaf children resolved in posMap) get a default size
 * so they remain visible in the rendered output.
 */
function buildNodeGeo(
  astNode: UCNode,
  posMap: Map<string, PosEntry>,
): UCNodeGeo | undefined {
  if (isContainer(astNode.kind)) {
    const childGeos: UCNodeGeo[] = [];
    for (const child of astNode.children) {
      const geo = buildNodeGeo(child, posMap);
      if (geo !== undefined) {
        childGeos.push(geo);
      }
    }

    // Container with no leaf children — return a placeholder with default size.
    if (childGeos.length === 0) {
      const emptyGeo: UCNodeGeo = {
        id: astNode.id,
        kind: astNode.kind,
        display: astNode.display,
        x: LAYOUT_MARGIN,
        y: LAYOUT_MARGIN,
        width: EMPTY_CONTAINER_WIDTH,
        height: EMPTY_CONTAINER_HEIGHT,
        children: [],
      };
      if (astNode.stereotype !== undefined) {
        emptyGeo.stereotype = astNode.stereotype;
      }
      return emptyGeo;
    }

    const minX = Math.min(...childGeos.map((c) => c.x)) - CONTAINER_PADDING;
    const minY = Math.min(...childGeos.map((c) => c.y)) - CONTAINER_TOP_PAD;
    const maxX = Math.max(...childGeos.map((c) => c.x + c.width)) + CONTAINER_PADDING;
    const maxY = Math.max(...childGeos.map((c) => c.y + c.height)) + CONTAINER_PADDING;

    const containerGeo: UCNodeGeo = {
      id: astNode.id,
      kind: astNode.kind,
      display: astNode.display,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      children: childGeos,
    };
    if (astNode.stereotype !== undefined) {
      containerGeo.stereotype = astNode.stereotype;
    }
    return containerGeo;
  }

  const pos = posMap.get(astNode.id);
  if (pos === undefined) return undefined;

  const leafGeo: UCNodeGeo = {
    id: astNode.id,
    kind: astNode.kind,
    display: astNode.display,
    x: pos.x,
    y: pos.y,
    width: pos.width,
    height: pos.height,
    children: [],
  };
  if (astNode.stereotype !== undefined) {
    leafGeo.stereotype = astNode.stereotype;
  }
  return leafGeo;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lay out a use case diagram using the synchronous dot layout engine.
 *
 * Container nodes are flattened into a leaf-only dot graph (D5). After
 * layout, container bounds are computed as the bounding box of their
 * children's final positions plus padding.
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

  const dotGraph = buildDotGraph(ast, theme, measurer);
  const result = layout(dotGraph);

  // Shift all node positions by LAYOUT_MARGIN so no node starts at x=0 or y=0.
  // The dot engine starts the first node at the origin; shifting ensures the
  // invariant x > 0, y > 0 for every node in the output.
  const shiftedNodes = result.nodes.map((n) => ({
    ...n,
    x: n.x + LAYOUT_MARGIN,
    y: n.y + LAYOUT_MARGIN,
  }));

  const posMap = new Map(shiftedNodes.map((n) => [n.id, n]));

  // Apply the same margin shift to all edge points so edges remain consistent
  // with their endpoint node positions.
  const shiftedEdges = result.edges.map((e) => ({
    ...e,
    points: e.points.map((p) => ({
      x: p.x + LAYOUT_MARGIN,
      y: p.y + LAYOUT_MARGIN,
    })),
  }));

  // Build UCNodeGeo tree, preserving container hierarchy
  const nodes: UCNodeGeo[] = [];
  for (const astNode of ast.nodes) {
    const geo = buildNodeGeo(astNode, posMap);
    if (geo !== undefined) {
      nodes.push(geo);
    }
  }

  // Build lookup: edge ID → original link
  const linkByEdgeId = new Map<string, UCLink>();
  for (const [i, link] of ast.links.entries()) {
    linkByEdgeId.set(`edge-${i}`, link);
  }

  // Build UCEdgeGeo entries
  const edges: UCEdgeGeo[] = [];
  for (const edgeResult of shiftedEdges) {
    const link = linkByEdgeId.get(edgeResult.id);
    if (link === undefined) continue;

    const edgeGeo: UCEdgeGeo = {
      id: edgeResult.id,
      from: link.from,
      to: link.to,
      points: edgeResult.points,
      dashed: link.style === 'dashed',
    };

    if (link.stereotype !== undefined) {
      edgeGeo.stereotype = link.stereotype;
    }

    if (link.label !== undefined) {
      const mid = edgeResult.points[Math.floor(edgeResult.points.length / 2)];
      if (mid !== undefined) {
        edgeGeo.label = { text: link.label, x: mid.x, y: mid.y - 8 };
      }
    }

    edges.push(edgeGeo);
  }

  return {
    totalWidth: result.width,
    totalHeight: result.height,
    nodes,
    edges,
  };
}

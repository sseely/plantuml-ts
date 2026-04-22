/**
 * Shared ELK.js adapter for plantuml-js layout engines.
 *
 * Architecture decisions:
 *   D3 — Single shared adapter: each diagram's layout.ts builds the ELK input
 *         and calls runLayout().
 *   D4 — Nodes arrive pre-measured: width and height are fixed ELK node sizes;
 *         ELK only handles routing.
 *   D5 — Compound/parent nodes for packages and namespaces: children arrays
 *         are passed through to ELK.
 *
 * No DOM, no SVG. All I/O is plain data.
 */

import ELK from 'elkjs/lib/elk.bundled.js';
import type { ELK as ELKInstance, ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk-api.js';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ElkInputNode {
  id: string;
  width: number;
  height: number;
  children?: ElkInputNode[];
  /**
   * Edges that are "owned" by this compound node — i.e., both source and
   * target are direct children of this node (LCA = this node). ELK requires
   * that edges are owned at the LCA level; placing them at the root when both
   * endpoints are inside the same compound node causes degenerate routing.
   */
  edges?: ElkInputEdge[];
  layoutOptions?: Record<string, string>;
}

export interface ElkInputEdge {
  id: string;
  sources: [string];
  targets: [string];
  labels?: Array<{ text: string; width?: number; height?: number }>;
}

export interface ElkGraph {
  nodes: ElkInputNode[];
  edges: ElkInputEdge[];
  layoutOptions?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ElkPoint {
  x: number;
  y: number;
}

export interface ElkOutputNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children?: ElkOutputNode[];
}

export interface ElkEdgeSection {
  startPoint: ElkPoint;
  endPoint: ElkPoint;
  bendPoints?: ElkPoint[];
}

export interface ElkOutputEdge {
  id: string;
  sections: ElkEdgeSection[];
  labels?: Array<{ text: string; x: number; y: number }>;
}

export interface ElkLayoutResult {
  nodes: ElkOutputNode[];
  edges: ElkOutputEdge[];
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// ELK instance (module-level; ELK is stateless between layout() calls)
// ---------------------------------------------------------------------------

// ELK's bundled build exports a constructor; the .d.ts types it as the
// constructor shape so `new ELK()` is valid without further casting.
const elk: ELKInstance = new ELK();

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/**
 * Convert an ElkInputNode to the ElkNode format expected by elkjs.
 */
function toElkNode(node: ElkInputNode): ElkNode {
  const result: ElkNode = {
    id: node.id,
    width: node.width,
    height: node.height,
    ...(node.layoutOptions !== undefined
      ? { layoutOptions: node.layoutOptions }
      : {}),
  };

  if (node.children !== undefined && node.children.length > 0) {
    result.children = node.children.map(toElkNode);
  }

  if (node.edges !== undefined && node.edges.length > 0) {
    result.edges = node.edges.map(toElkEdge);
  }

  return result;
}

/**
 * Convert an ElkInputEdge to the ElkExtendedEdge format expected by elkjs.
 */
function toElkEdge(edge: ElkInputEdge): ElkExtendedEdge {
  const result: ElkExtendedEdge = {
    id: edge.id,
    sources: [edge.sources[0]],
    targets: [edge.targets[0]],
  };

  if (edge.labels !== undefined && edge.labels.length > 0) {
    result.labels = edge.labels.map((l) => ({
      id: `${edge.id}-label-${l.text}`,
      text: l.text,
      ...(l.width !== undefined ? { width: l.width } : {}),
      ...(l.height !== undefined ? { height: l.height } : {}),
    }));
  }

  return result;
}

/**
 * Extract ElkOutputNode geometry from an elkjs result node.
 * Recurses into children for compound nodes.
 */
function extractNode(node: ElkNode): ElkOutputNode {
  const result: ElkOutputNode = {
    id: node.id,
    x: node.x ?? 0,
    y: node.y ?? 0,
    width: node.width ?? 0,
    height: node.height ?? 0,
  };

  if (node.children !== undefined && node.children.length > 0) {
    result.children = node.children.map(extractNode);
  }

  return result;
}

/**
 * Extract ElkOutputEdge routing sections from an elkjs result edge.
 */
function extractEdge(edge: ElkExtendedEdge): ElkOutputEdge {
  const sections: ElkEdgeSection[] = (edge.sections ?? []).map((s) => {
    const section: ElkEdgeSection = {
      startPoint: { x: s.startPoint.x, y: s.startPoint.y },
      endPoint: { x: s.endPoint.x, y: s.endPoint.y },
    };
    if (s.bendPoints !== undefined && s.bendPoints.length > 0) {
      section.bendPoints = s.bendPoints.map((p) => ({ x: p.x, y: p.y }));
    }
    return section;
  });

  const result: ElkOutputEdge = { id: edge.id, sections };

  if (edge.labels !== undefined && edge.labels.length > 0) {
    result.labels = edge.labels
      .filter((l) => l.text !== undefined)
      .map((l) => ({
        text: l.text ?? '',
        x: l.x ?? 0,
        y: l.y ?? 0,
      }));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Compound edge extraction
// ---------------------------------------------------------------------------

/**
 * Translate all coordinate points in an extracted edge by (dx, dy).
 * Used to convert compound-node-local edge coordinates to global space.
 */
function offsetEdge(edge: ElkOutputEdge, dx: number, dy: number): ElkOutputEdge {
  return {
    id: edge.id,
    sections: edge.sections.map((s) => ({
      startPoint: { x: s.startPoint.x + dx, y: s.startPoint.y + dy },
      endPoint: { x: s.endPoint.x + dx, y: s.endPoint.y + dy },
      ...(s.bendPoints !== undefined
        ? {
            bendPoints: s.bendPoints.map((p) => ({
              x: p.x + dx,
              y: p.y + dy,
            })),
          }
        : {}),
    })),
    ...(edge.labels !== undefined
      ? {
          labels: edge.labels.map((l) => ({
            ...l,
            x: l.x + dx,
            y: l.y + dy,
          })),
        }
      : {}),
  };
}

/**
 * Recursively collect edges owned by compound nodes, translating their
 * local coordinates to global space by accumulating parent offsets.
 */
function collectCompoundEdges(
  node: ElkNode,
  absX: number,
  absY: number,
  out: ElkOutputEdge[],
): void {
  if (node.edges !== undefined && node.edges.length > 0) {
    for (const e of node.edges) {
      out.push(offsetEdge(extractEdge(e), absX, absY));
    }
  }
  if (node.children !== undefined) {
    for (const child of node.children) {
      collectCompoundEdges(
        child,
        absX + (child.x ?? 0),
        absY + (child.y ?? 0),
        out,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run ELK layout on a pre-measured graph.
 *
 * Nodes must arrive with fixed width and height — ELK only routes edges and
 * positions nodes, it does not resize them.
 *
 * Edges owned by a compound node (both endpoints are direct children) must be
 * placed in that node's `edges` array — not at the root — so ELK routes them
 * within the compound node's local coordinate space. `runLayout` merges root
 * and compound-node edges into a single flat list, translating compound-node
 * edge coordinates to global space.
 *
 * @param graph - The graph to lay out, with pre-measured node dimensions.
 * @returns Resolved positions and edge routing for all nodes and edges.
 */
export async function runLayout(graph: ElkGraph): Promise<ElkLayoutResult> {
  if (graph.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const elkGraph: ElkNode = {
    id: 'root',
    children: graph.nodes.map(toElkNode),
    edges: graph.edges.map(toElkEdge),
    ...(graph.layoutOptions !== undefined
      ? { layoutOptions: graph.layoutOptions }
      : {}),
  };

  const result = await elk.layout(elkGraph);

  const nodes = (result.children ?? []).map(extractNode);

  // Collect root-level edges (already in global coordinates)
  const edges: ElkOutputEdge[] = (result.edges ?? []).map((e) =>
    extractEdge(e),
  );
  // Collect compound-node edges (translate from local → global coordinates)
  for (const child of result.children ?? []) {
    collectCompoundEdges(child, child.x ?? 0, child.y ?? 0, edges);
  }

  return {
    nodes,
    edges,
    width: result.width ?? 0,
    height: result.height ?? 0,
  };
}

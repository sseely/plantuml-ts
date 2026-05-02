/**
 * Layout step for @startdot diagrams.
 *
 * Converts a parsed DotDiagramAST into a DotGeometry by:
 *  1. Measuring each node's label using the provided StringMeasurer.
 *  2. Building a DotInputGraph (nodes + edges).
 *  3. Calling the shared dot layout engine.
 *  4. Mapping the DotLayoutResult back to DotGeometry types.
 *
 * Architecture decisions:
 *   D8 — Undirected graphs feed BOTH directions of each edge into the layout
 *         engine (forward + reverse with _r suffix) so the engine gets
 *         bidirectional information.  Only forward edges are kept in the
 *         returned DotGeometry.
 */

import type { DotDiagramAST, DotEdgeDef, DotGeometry, DotEdgeGeo, DotNodeGeo } from './ast.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { Theme } from '../../core/theme.js';
import type { DotInputNode, DotInputEdge, DotInputGraph } from '../../core/dot/types.js';
import { layout } from '../../core/dot/index.js';

// 72 px per inch — DOT uses inches for width/height attributes.
const PX_PER_INCH = 72;

// Padding added to measured label dimensions.
const HORIZONTAL_PAD = 16;
const VERTICAL_PAD = 12;

/**
 * Measure a single node, returning pixel width and height.
 *
 * If the node declares explicit inch-based dimensions, those are converted
 * directly to pixels.  Otherwise the label is measured and padding is added.
 * Circle nodes are squared so that width === height.
 */
function measureNode(
  node: { label: string; shape: string; widthIn: number | null; heightIn: number | null },
  measurer: StringMeasurer,
  theme: Theme,
): { width: number; height: number } {
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const measured = measurer.measure(node.label, fontSpec);

  let width: number;
  let height: number;

  if (node.widthIn !== null) {
    width = node.widthIn * PX_PER_INCH;
  } else {
    width = measured.width + HORIZONTAL_PAD;
  }

  if (node.heightIn !== null) {
    height = node.heightIn * PX_PER_INCH;
  } else {
    height = measured.height + VERTICAL_PAD;
  }

  // Circle nodes must be square.
  if (node.shape === 'circle') {
    const side = Math.max(width, height);
    width = side;
    height = side;
  }

  return { width, height };
}

export function layoutDot(
  ast: DotDiagramAST,
  measurer: StringMeasurer,
  theme: Theme,
): DotGeometry {
  // --- Step 1: measure each node ---
  // Both maps below are indexed by node id.  Every ast.node gets an entry here,
  // so measuredDims.get(n.id)! is safe in Step 2.
  const measuredDims = new Map<string, { width: number; height: number }>();
  for (const node of ast.nodes) {
    measuredDims.set(node.id, measureNode(node, measurer, theme));
  }

  // --- Step 2: build DotInputNodes ---
  const inputNodes: DotInputNode[] = ast.nodes.map((n) => {
    const dims = measuredDims.get(n.id)!;
    const base: DotInputNode = {
      id: n.id,
      width: dims.width,
      height: dims.height,
    };
    if (n.rank !== null) {
      return { ...base, attributes: { rank: n.rank } };
    }
    return base;
  });

  // --- Step 3: build DotInputEdges (D8 — undirected handling) ---
  const inputEdges: DotInputEdge[] = [];
  const isDirected = ast.graphType === 'digraph';

  for (const edgeDef of ast.edges) {
    const edgeAttrs: DotInputEdge['attributes'] = {};
    if (edgeDef.weight !== null) edgeAttrs.weight = edgeDef.weight;
    if (edgeDef.minLen !== null) edgeAttrs.minLen = edgeDef.minLen;

    const hasAttrs = Object.keys(edgeAttrs).length > 0;

    const forwardEdge: DotInputEdge = {
      id: edgeDef.id,
      from: edgeDef.from,
      to: edgeDef.to,
      ...(hasAttrs ? { attributes: edgeAttrs } : {}),
    };
    inputEdges.push(forwardEdge);

    if (!isDirected) {
      // Add reverse edge so the layout engine gets bidirectional information.
      const reverseEdge: DotInputEdge = {
        id: edgeDef.id + '_r',
        from: edgeDef.to,
        to: edgeDef.from,
        ...(hasAttrs ? { attributes: edgeAttrs } : {}),
      };
      inputEdges.push(reverseEdge);
    }
  }

  // --- Step 4: call layout engine ---
  // Build the input graph using conditional spreading to avoid setting
  // optional properties to undefined (exactOptionalPropertyTypes is enabled).
  const inputGraph: DotInputGraph = { nodes: inputNodes, edges: inputEdges };
  if (ast.rankDir !== null) inputGraph.rankDir = ast.rankDir;
  if (ast.nodeSep !== null) inputGraph.nodeSep = ast.nodeSep;
  if (ast.rankSep !== null) inputGraph.rankSep = ast.rankSep;

  const result = layout(inputGraph);

  // --- Step 5: map DotLayoutResult → DotGeometry ---

  // Both maps below are built from ast.nodes/ast.edges — the same ids that were
  // passed to the layout engine — so every lookup is guaranteed to succeed.
  const nodeDefById = new Map(ast.nodes.map((n) => [n.id, n]));
  const edgeDefById = new Map<string, DotEdgeDef>(ast.edges.map((e) => [e.id, e]));

  const nodeGeos: DotNodeGeo[] = result.nodes.map((rn) => {
    const def = nodeDefById.get(rn.id)!;
    return {
      id: rn.id,
      label: def.label,
      shape: def.shape,
      x: rn.x,
      y: rn.y,
      width: rn.width,
      height: rn.height,
    };
  });

  const edgeGeos: DotEdgeGeo[] = result.edges
    // For undirected graphs, filter out the reverse edges (_r suffix).
    .filter((re) => isDirected || !re.id.endsWith('_r'))
    .map((re) => {
      const def = edgeDefById.get(re.id)!;
      return {
        id: re.id,
        from: def.from,
        to: def.to,
        label: def.label,
        points: re.points,
        directed: isDirected,
      };
    });

  // --- Step 6: return DotGeometry ---
  return {
    nodes: nodeGeos,
    edges: edgeGeos,
    title: ast.title,
    totalWidth: result.width,
    totalHeight: result.height,
  };
}

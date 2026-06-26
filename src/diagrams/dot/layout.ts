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

import type { DotDiagramAST, DotClusterGeo, DotEdgeDef, DotGeometry, DotEdgeGeo, DotNodeGeo } from './ast.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { Theme } from '../../core/theme.js';
import type { DotInputNode, DotInputEdge, DotInputGraph } from '../../core/graph-layout.js';
import { layoutGraph as layout } from '../../core/graph-layout.js';

// 72 px per inch — DOT uses inches for width/height attributes.
const PX_PER_INCH = 72;

// Padding added to measured label dimensions.
const HORIZONTAL_PAD = 16;
const VERTICAL_PAD = 12;

// Padding added to measured edge label dimensions.
const EDGE_LABEL_H_PAD = 8;
const EDGE_LABEL_V_PAD = 4;

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

  // Diamond (4-sided polygon at 45°): the bounding box must be 2× the padded
  // label size so the label fits inside the inscribed rectangle.
  // Graphviz poly_init: bb × SQRT2 / cos(π/4) = bb × SQRT2 × SQRT2 = bb × 2.
  if (node.shape === 'diamond') {
    width *= 2;
    height *= 2;
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

  // Font spec used for edge label measurement (renderer uses fontSize - 2).
  const edgeLabelFontSpec = { family: theme.fontFamily, size: theme.fontSize - 2 };

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

    // Measure edge label and pass dimensions to the layout engine so the
    // label virtual node can participate in horizontal constraint solving.
    if (edgeDef.label !== null) {
      const measured = measurer.measure(edgeDef.label, edgeLabelFontSpec);
      edgeAttrs.label = edgeDef.label;
      edgeAttrs.labelWidth = measured.width + EDGE_LABEL_H_PAD;
      edgeAttrs.labelHeight = measured.height + EDGE_LABEL_V_PAD;
    }

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
    const geo: DotNodeGeo = {
      id: rn.id,
      label: def.label,
      shape: def.shape,
      x: rn.x,
      y: rn.y,
      width: rn.width,
      height: rn.height,
    };
    if (def.nodeColor !== undefined) geo.nodeColor = def.nodeColor;
    if (def.fillColor !== undefined) geo.fillColor = def.fillColor;
    if (def.styleFilled === true) geo.styleFilled = true;
    return geo;
  });

  // Build the set of all edge IDs that survived the layout pass (after acyclic
  // merging some edges may have been removed, leaving only the _r counterpart).
  const resultEdgeIds = new Set(result.edges.map((re) => re.id));

  const edgeGeos: DotEdgeGeo[] = result.edges
    // For undirected graphs, suppress _r edges ONLY when the matching forward
    // edge also survived.  If removeAcyclic merged the forward edge into its _r
    // counterpart (the c--a triangle case), the _r edge is the sole surviving
    // representative of that connection and must be kept.
    .filter((re) => {
      if (isDirected) return true;
      if (!re.id.endsWith('_r')) return true;
      const forwardId = re.id.slice(0, -2);
      return !resultEdgeIds.has(forwardId);
    })
    .map((re) => {
      // _r edges that survived don't have their own def entry — look up the
      // base id to get the original edge definition.
      const baseId = re.id.endsWith('_r') ? re.id.slice(0, -2) : re.id;
      const def = edgeDefById.get(baseId)!;
      const geo: DotEdgeGeo = {
        id: baseId,
        from: def.from,
        to: def.to,
        label: def.label,
        points: re.points,
        directed: isDirected,
      };
      if (def.dir !== undefined) geo.dir = def.dir;
      if (def.edgeStyle !== undefined) geo.edgeStyle = def.edgeStyle;
      if (re.labelX !== undefined) geo.labelX = re.labelX;
      if (re.labelY !== undefined) geo.labelY = re.labelY;
      if (re.labelWidth !== undefined) geo.labelWidth = re.labelWidth;
      if (re.labelHeight !== undefined) geo.labelHeight = re.labelHeight;
      if (re.spline === true) geo.spline = true;
      return geo;
    });

  // --- Step 6: compute cluster bounding boxes ---
  // C: dot_compute_bb() / rec_bb() in position.c — union of member node bboxes
  // + CL_OFFSET=8 padding on all sides. Drawn by emit_clusters() before nodes.
  const nodeGeoById = new Map(nodeGeos.map((n) => [n.id, n]));
  const CL_OFFSET = 8;
  // C: const.h GAP=4; input.c PAD(dimen) adds 2*GAP=8 to label height.
  // That padded height becomes GD_border(g)[TOP_IX].y, which is added to GD_ht2
  // (position.c), expanding the cluster bounding box upward by that amount.
  const CLUSTER_LABEL_GAP = 8; // 2 * GAP
  const clusterFontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const clusterGeos: DotClusterGeo[] = (ast.clusters ?? []).flatMap((cl) => {
    const members = cl.nodeIds.map((id) => nodeGeoById.get(id)).filter((n) => n !== undefined);
    if (members.length === 0) return [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of members) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    // Base bbox: node union + CL_OFFSET on all sides.
    const clY = minY - CL_OFFSET;
    const clHeight = maxY - minY + 2 * CL_OFFSET;
    const geo: DotClusterGeo = {
      id: cl.id,
      label: cl.label,
      x: minX - CL_OFFSET,
      y: clY,
      width: maxX - minX + 2 * CL_OFFSET,
      height: clHeight,
    };
    // Extend top of bbox to accommodate the label (C: ht2 += GD_border[TOP_IX].y).
    // Also enforce minimum width for label clearance (C: make_lrvn constrains width
    // to fmax(GD_border[BOTTOM_IX].x, GD_border[TOP_IX].x) = labelWidth + XPAD = labelWidth + 4*GAP).
    if (cl.label !== null) {
      const measured = measurer.measure(cl.label, clusterFontSpec);
      const labelBorderHeight = measured.height + CLUSTER_LABEL_GAP;
      geo.y -= labelBorderHeight;
      geo.height += labelBorderHeight;
      geo.labelHeight = measured.height;
      geo.labelWidth = measured.width;
      // XPAD = 4*GAP = 16 — minimum horizontal padding on each side of the label.
      const CLUSTER_LABEL_HPAD = 16;
      const minWidth = measured.width + CLUSTER_LABEL_HPAD;
      if (geo.width < minWidth) {
        const extra = minWidth - geo.width;
        geo.x -= Math.floor(extra / 2);
        geo.width = minWidth;
      }
    }
    return [geo];
  });

  // --- Step 7: resolve overlapping cluster bounding boxes ---
  // C does this by expanding rank heights (position.c makeClusters → rank[minrank].ht2 +=
  // GD_border[TOP_IX].y), which shifts all subordinate nodes downward.  We replicate
  // that effect post-layout: sort clusters top-to-bottom, then for each pair that
  // overlaps, shift the lower cluster's nodes and relevant edge points down.
  if (clusterGeos.length > 1) {
    const CLUSTER_GAP = 4; // minimum gap between cluster boxes
    // Map cluster id → its member node id set (from the AST definition)
    const clusterNodeIds = new Map<string, Set<string>>(
      (ast.clusters ?? []).map((cl) => [cl.id, new Set(cl.nodeIds)]),
    );

    const sortedClusters = [...clusterGeos].sort((a, b) => a.y - b.y);

    for (let ci = 1; ci < sortedClusters.length; ci++) {
      const upper = sortedClusters[ci - 1]!;
      const lower = sortedClusters[ci]!;
      const overlap = upper.y + upper.height + CLUSTER_GAP - lower.y;
      if (overlap <= 0) continue;

      const lowerIds = clusterNodeIds.get(lower.id) ?? new Set<string>();
      // threshold: the pre-shift y below which we shift edge points
      const threshold = lower.y;

      // Shift nodes in the lower cluster
      for (const n of nodeGeos) {
        if (lowerIds.has(n.id)) n.y += overlap;
      }

      // Shift edge points that are at or below the lower cluster's pre-shift top.
      // For cross-cluster edges (e.g. api→ui) this extends the edge to reach the
      // shifted destination; for intra-cluster edges this moves them entirely.
      for (const e of edgeGeos) {
        const fromInLower = lowerIds.has(e.from);
        const toInLower = lowerIds.has(e.to);
        if (!fromInLower && !toInLower) continue;
        for (const pt of e.points) {
          if (pt.y >= threshold) pt.y += overlap;
        }
        if (e.labelY !== undefined && e.labelY >= threshold) e.labelY += overlap;
      }

      lower.y += overlap;
    }
  }

  // Recompute total dimensions after any node/cluster shifts.
  // Clusters may extend beyond the layout engine's own bounds.
  let adjustedTotalHeight = result.height;
  let adjustedTotalWidth = result.width;
  for (const n of nodeGeos) {
    adjustedTotalHeight = Math.max(adjustedTotalHeight, n.y + n.height);
  }
  for (const cl of clusterGeos) {
    adjustedTotalHeight = Math.max(adjustedTotalHeight, cl.y + cl.height);
    // cl.x may be negative when the cluster expanded left for label clearance;
    // the right edge is still cl.x + cl.width regardless.
    adjustedTotalWidth = Math.max(adjustedTotalWidth, cl.x + cl.width);
  }

  // --- Step 8: return DotGeometry ---
  // Measure the title so the renderer can enforce a minimum canvas width.
  // The renderer draws the title at fontSize+2 — use the same spec here.
  let titleWidth: number | undefined;
  if (ast.title !== null) {
    const titleSpec = { family: theme.fontFamily, size: theme.fontSize + 2 };
    titleWidth = measurer.measure(ast.title, titleSpec).width;
  }

  return {
    nodes: nodeGeos,
    edges: edgeGeos,
    clusters: clusterGeos,
    title: ast.title,
    totalWidth: adjustedTotalWidth,
    totalHeight: adjustedTotalHeight,
    ...(titleWidth !== undefined ? { titleWidth } : {}),
  };
}

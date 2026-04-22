/**
 * Class diagram layout engine.
 *
 * Async: ClassDiagramAST + Theme + StringMeasurer → ClassGeometry via ELK.
 *
 * Architecture decisions:
 *   D3 — Calls runLayout() from the shared elk-adapter.
 *   D4 — Nodes are pre-measured; ELK only routes and positions.
 *   D5 — Namespaces become ELK compound parent nodes with classifier children.
 *
 * No DOM, no SVG. All I/O is plain data.
 */

import type {
  ClassDiagramAST,
  Classifier,
  Relationship,
  RelationshipType,
} from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import { runLayout } from '../../core/elk-adapter.js';
import type { ElkGraph, ElkInputNode, ElkLayoutResult, ElkOutputNode } from '../../core/elk-adapter.js';

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

export interface ClassifierGeo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** y-offsets of section dividers within the box (relative to box top) */
  dividerYs: number[];
  /** Text rows to render: [header display, ...member strings] with y offset from box top */
  rows: Array<{ text: string; y: number; indent: number }>;
}

export interface EdgeGeo {
  id: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
  /** Arrow decoration at the target end */
  targetDecor: 'triangle' | 'open' | 'diamond' | 'filledDiamond' | 'none';
  /** Arrow decoration at the source end */
  sourceDecor: 'diamond' | 'filledDiamond' | 'none';
  dashed: boolean;
}

export interface NamespaceGeo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface ClassGeometry {
  totalWidth: number;
  totalHeight: number;
  classifiers: ClassifierGeo[];
  edges: EdgeGeo[];
  namespaces: NamespaceGeo[];
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const LAYOUT_OPTIONS: Record<string, string> = {
  'algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '50',
  'elk.spacing.nodeNode': '30',
  'elk.edgeRouting': 'ORTHOGONAL',
};

// ---------------------------------------------------------------------------
// Sizing helpers
// ---------------------------------------------------------------------------

/** Format a member text string for measurement and rendering. */
function formatMemberText(member: {
  visibility: string;
  name: string;
  type?: string;
  params?: string[];
}): string {
  if (member.params !== undefined) {
    // Method
    return `${member.visibility}${member.name}(): ${member.type ?? ''}`;
  }
  // Field
  return `${member.visibility}${member.name}: ${member.type ?? ''}`;
}

/**
 * Compute the pre-measured dimensions and row/divider layout for a classifier.
 * Returns the width, height, rows, and dividerYs without any ELK coordinates.
 */
function measureClassifier(
  classifier: Classifier,
  theme: Theme,
  measurer: StringMeasurer,
): {
  width: number;
  height: number;
  rows: ClassifierGeo['rows'];
  dividerYs: number[];
} {
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const headerRowHeight = theme.fontSize * 1.4 + 8;
  const memberRowHeight = theme.fontSize * 1.4;

  // Build the header display string with kind prefix for interface/enum
  let headerText: string;
  if (classifier.kind === 'interface') {
    headerText = `«interface» ${classifier.display}`;
  } else if (classifier.kind === 'enum') {
    headerText = `«enum» ${classifier.display}`;
  } else if (classifier.kind === 'abstract') {
    headerText = `{abstract} ${classifier.display}`;
  } else if (classifier.kind === 'annotation') {
    headerText = `@${classifier.display}`;
  } else {
    headerText = classifier.display;
  }

  // Measure all text strings to find the widest
  const memberTexts = classifier.members.map(formatMemberText);
  const allTexts = [headerText, ...memberTexts];
  let longestWidth = 0;
  for (const text of allTexts) {
    const measured = measurer.measure(text, fontSpec);
    if (measured.width > longestWidth) {
      longestWidth = measured.width;
    }
  }

  const width = Math.max(100, longestWidth + 20);
  const height =
    headerRowHeight +
    classifier.members.length * memberRowHeight +
    8; // bottom padding

  // Build rows: header first, then members
  const rows: ClassifierGeo['rows'] = [];
  // Header row: vertically centered within the header area
  const headerTextY = headerRowHeight / 2;
  rows.push({ text: headerText, y: headerTextY, indent: 0 });

  for (let i = 0; i < classifier.members.length; i++) {
    const text = memberTexts[i]!;
    const y = headerRowHeight + i * memberRowHeight + memberRowHeight / 2;
    rows.push({ text, y, indent: 4 });
  }

  // dividerYs: one after the header row, always
  const dividerYs: number[] = [headerRowHeight];

  return { width, height, rows, dividerYs };
}

// ---------------------------------------------------------------------------
// Edge decoration map
// ---------------------------------------------------------------------------

interface EdgeDecoration {
  targetDecor: EdgeGeo['targetDecor'];
  sourceDecor: EdgeGeo['sourceDecor'];
  dashed: boolean;
}

const EDGE_DECORATION_MAP: Record<RelationshipType, EdgeDecoration> = {
  extension:      { targetDecor: 'triangle',     sourceDecor: 'none',         dashed: false },
  implementation: { targetDecor: 'triangle',     sourceDecor: 'none',         dashed: true  },
  composition:    { targetDecor: 'none',          sourceDecor: 'filledDiamond', dashed: false },
  aggregation:    { targetDecor: 'none',          sourceDecor: 'diamond',      dashed: false },
  dependency:     { targetDecor: 'open',          sourceDecor: 'none',         dashed: true  },
  association:    { targetDecor: 'open',          sourceDecor: 'none',         dashed: false },
  usage:          { targetDecor: 'none',          sourceDecor: 'none',         dashed: true  },
};

// ---------------------------------------------------------------------------
// ELK graph builder
// ---------------------------------------------------------------------------

/**
 * Build a map from classifier id → pre-measured data for post-layout use.
 */
interface ClassifierMeasured {
  width: number;
  height: number;
  rows: ClassifierGeo['rows'];
  dividerYs: number[];
}

function buildElkGraph(
  ast: ClassDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): {
  graph: ElkGraph;
  measuredMap: Map<string, ClassifierMeasured>;
  namespaceClassifierIds: Map<string, Set<string>>;
} {
  const measuredMap = new Map<string, ClassifierMeasured>();

  // Pre-measure all classifiers
  for (const classifier of ast.classifiers) {
    measuredMap.set(classifier.id, measureClassifier(classifier, theme, measurer));
  }

  // Build namespace → classifier id sets
  const namespaceClassifierIds = new Map<string, Set<string>>();
  for (const ns of ast.namespaces) {
    namespaceClassifierIds.set(ns.id, new Set(ns.classifiers));
  }

  // Build set of classifier ids that belong to some namespace
  const classifiersInNamespace = new Set<string>();
  for (const ns of ast.namespaces) {
    for (const cid of ns.classifiers) {
      classifiersInNamespace.add(cid);
    }
  }

  const nodes: ElkInputNode[] = [];

  // Namespace compound nodes (D5)
  for (const ns of ast.namespaces) {
    const children: ElkInputNode[] = [];
    for (const cid of ns.classifiers) {
      const measured = measuredMap.get(cid);
      if (measured === undefined) continue;
      children.push({ id: cid, width: measured.width, height: measured.height });
    }
    // Use generous padding so ELK has room to lay out children
    const compoundNode: ElkInputNode = {
      id: ns.id,
      // Width/height are hints; ELK will resize the compound node to fit children
      width: 200,
      height: 200,
      children,
      layoutOptions: { 'algorithm': 'layered', 'elk.direction': 'DOWN' },
    };
    nodes.push(compoundNode);
  }

  // Top-level classifiers (not in any namespace)
  for (const classifier of ast.classifiers) {
    if (classifiersInNamespace.has(classifier.id)) continue;
    const measured = measuredMap.get(classifier.id)!;
    nodes.push({ id: classifier.id, width: measured.width, height: measured.height });
  }

  // Edges
  const edges = ast.relationships.map((rel: Relationship, i: number) => ({
    id: `edge-${i}`,
    sources: [rel.from] as [string],
    targets: [rel.to] as [string],
    ...(rel.label !== undefined
      ? { labels: [{ text: rel.label }] }
      : {}),
  }));

  const graph: ElkGraph = {
    nodes,
    edges,
    layoutOptions: LAYOUT_OPTIONS,
  };

  return { graph, measuredMap, namespaceClassifierIds };
}

// ---------------------------------------------------------------------------
// Result extraction helpers
// ---------------------------------------------------------------------------

/**
 * Build a flat map from node id → absolute position from the ELK result tree.
 * For children of compound nodes, coordinates from ELK are relative to the
 * parent, so we accumulate parent offsets as we recurse.
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
 * Convert ELK edge sections to a flat list of points.
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lay out a class diagram using ELK.
 *
 * Nodes are pre-measured (D4); ELK handles routing and positioning only.
 * Namespaces become ELK compound nodes with classifiers as children (D5).
 *
 * @param ast      - Parsed class diagram AST.
 * @param theme    - Visual theme for font metrics and sizing.
 * @param measurer - Text measurement implementation.
 * @returns        Resolved pixel geometry for all classifiers, edges, and namespaces.
 */
export async function layoutClass(
  ast: ClassDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): Promise<ClassGeometry> {
  // Empty diagram — return zero-size result immediately
  if (ast.classifiers.length === 0 && ast.namespaces.length === 0) {
    return {
      totalWidth: 0,
      totalHeight: 0,
      classifiers: [],
      edges: [],
      namespaces: [],
    };
  }

  const { graph, measuredMap, namespaceClassifierIds } = buildElkGraph(
    ast,
    theme,
    measurer,
  );

  const elkResult = await runLayout(graph);

  // Build absolute position map (handles compound node child offsets)
  const posMap = buildAbsolutePositionMap(elkResult.nodes);

  // Build ClassifierGeo entries
  const classifiers: ClassifierGeo[] = [];
  for (const classifier of ast.classifiers) {
    const pos = posMap.get(classifier.id);
    const measured = measuredMap.get(classifier.id);
    if (pos === undefined || measured === undefined) continue;

    classifiers.push({
      id: classifier.id,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      dividerYs: measured.dividerYs,
      rows: measured.rows,
    });
  }

  // Build NamespaceGeo entries
  const namespaces: NamespaceGeo[] = [];
  for (const ns of ast.namespaces) {
    const pos = posMap.get(ns.id);
    if (pos === undefined) continue;

    namespaces.push({
      id: ns.id,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      label: ns.display,
    });
  }

  // Build EdgeGeo entries
  const edges: EdgeGeo[] = [];
  for (let i = 0; i < ast.relationships.length; i++) {
    const rel = ast.relationships[i]!;
    const elkEdge = elkResult.edges[i];
    if (elkEdge === undefined) continue;

    const decor = EDGE_DECORATION_MAP[rel.type];
    const points = extractEdgePoints(elkEdge);
    const edgeGeo: EdgeGeo = {
      id: elkEdge.id,
      points,
      targetDecor: decor.targetDecor,
      sourceDecor: decor.sourceDecor,
      dashed: decor.dashed,
    };

    // Attach label if present
    if (
      elkEdge.labels !== undefined &&
      elkEdge.labels.length > 0 &&
      elkEdge.labels[0] !== undefined
    ) {
      const lbl = elkEdge.labels[0];
      edgeGeo.label = { text: lbl.text, x: lbl.x, y: lbl.y };
    }

    edges.push(edgeGeo);
  }

  // If we reach here, namespaceClassifierIds is used only for compound-node
  // construction; we still need to silence the unused-variable checker.
  void namespaceClassifierIds;

  return {
    totalWidth: elkResult.width,
    totalHeight: elkResult.height,
    classifiers,
    edges,
    namespaces,
  };
}

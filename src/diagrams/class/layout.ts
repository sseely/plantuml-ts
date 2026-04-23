/**
 * Class diagram layout engine.
 *
 * Synchronous: ClassDiagramAST + Theme + StringMeasurer → ClassGeometry
 * via the dot layout engine.
 *
 * Architecture decisions:
 *   D3 — Calls layout() from the shared dot engine.
 *   D4 — Nodes are pre-measured; dot only routes and positions.
 *   D5 — Namespaces are flattened into the root graph; namespace bounds
 *         are derived from classifier positions after layout.
 *
 * No DOM, no SVG. All I/O is plain data.
 */

import type {
  ClassDiagramAST,
  Classifier,
  ClassifierKind,
  Relationship,
  RelationshipType,
  Visibility,
} from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import { autoLayout as layout } from '../../core/auto-layout.js';
import type { DotInputGraph, DotInputNode, DotInputEdge } from '../../core/dot/types.js';

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

export interface ClassifierGeo {
  id: string;
  kind: ClassifierKind;
  x: number;
  y: number;
  width: number;
  height: number;
  /** y-offsets of section dividers within the box (relative to box top) */
  dividerYs: number[];
  /** Text rows to render: [header display, ...member strings] with y offset from box top */
  rows: Array<{
    text: string;
    y: number;
    indent: number;
    /** true for abstract/interface header names — rendered in italic */
    italic?: boolean;
    /** colored visibility icon to render to the left of member text */
    visibilityIcon?: Visibility;
  }>;
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
// Sizing helpers
// ---------------------------------------------------------------------------

/** Extra horizontal space reserved for the visibility icon to the left of member text. */
const ICON_WIDTH = 18;

/** Format a member text string for measurement and rendering (without visibility prefix). */
function formatMemberText(member: {
  visibility: string;
  name: string;
  type?: string;
  params?: string[];
}): string {
  if (member.params !== undefined) {
    // Method — include params
    return `${member.name}(${member.params.join(', ')}): ${member.type ?? ''}`;
  }
  // Field
  return `${member.name}: ${member.type ?? ''}`;
}

/**
 * Compute the pre-measured dimensions and row/divider layout for a classifier.
 * Returns the width, height, rows, and dividerYs without any layout coordinates.
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

  // Build the header display string — just the name (kind shown via badge + italic)
  const headerText =
    classifier.kind === 'annotation'
      ? `@${classifier.display}`
      : classifier.display;
  const headerItalic =
    classifier.kind === 'interface' || classifier.kind === 'abstract';

  // Measure all text strings to find the widest
  // Member texts get ICON_WIDTH added to their measured width to account for the icon
  const memberTexts = classifier.members.map(formatMemberText);
  const allTexts = [headerText, ...memberTexts];
  let longestWidth = 0;
  for (let i = 0; i < allTexts.length; i++) {
    const measured = measurer.measure(allTexts[i]!, fontSpec);
    const w = measured.width + (i > 0 ? ICON_WIDTH : 0);
    if (w > longestWidth) longestWidth = w;
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
  rows.push({ text: headerText, y: headerTextY, indent: 0, italic: headerItalic });

  for (let i = 0; i < classifier.members.length; i++) {
    const text = memberTexts[i]!;
    const y = headerRowHeight + i * memberRowHeight + memberRowHeight / 2;
    rows.push({
      text,
      y,
      indent: ICON_WIDTH + 4,
      visibilityIcon: classifier.members[i]!.visibility,
    });
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
// Measured classifier data
// ---------------------------------------------------------------------------

interface ClassifierMeasured {
  width: number;
  height: number;
  rows: ClassifierGeo['rows'];
  dividerYs: number[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lay out a class diagram using the dot layout engine (synchronous).
 *
 * Nodes are pre-measured (D4); the dot engine handles routing and positioning.
 * Namespaces are flattened into the root graph (D5); their bounding boxes are
 * computed from classifier positions after layout.
 *
 * @param ast      - Parsed class diagram AST.
 * @param theme    - Visual theme for font metrics and sizing.
 * @param measurer - Text measurement implementation.
 * @returns        Pixel geometry for all classifiers, edges, and namespaces.
 */
export function layoutClass(
  ast: ClassDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): ClassGeometry {
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

  // Pre-measure all classifiers
  const measuredMap = new Map<string, ClassifierMeasured>();
  for (const classifier of ast.classifiers) {
    measuredMap.set(classifier.id, measureClassifier(classifier, theme, measurer));
  }

  // Build dot nodes — all classifiers flattened into root graph (D5)
  const dotNodes: DotInputNode[] = ast.classifiers.map((classifier) => {
    const measured = measuredMap.get(classifier.id)!;
    return { id: classifier.id, width: measured.width, height: measured.height };
  });

  // For hierarchical relationships the parent must rank above the child in the
  // TB layout, so we swap from/to in the dot graph.  The edge points returned
  // by dot are then reversed so the rendered arrow still flows child → parent
  // with the triangle arrowhead at the parent end.
  const HIERARCHICAL = new Set<RelationshipType>(['extension', 'implementation']);

  const dotEdges: DotInputEdge[] = ast.relationships.map(
    (rel: Relationship, i: number) => {
      const swap = HIERARCHICAL.has(rel.type);
      return {
        id: `edge-${i}`,
        from: swap ? rel.to : rel.from,
        to: swap ? rel.from : rel.to,
      };
    },
  );

  const swappedEdges = new Set(
    ast.relationships
      .map((rel, i) => (HIERARCHICAL.has(rel.type) ? i : -1))
      .filter((i) => i >= 0),
  );

  const dotGraph: DotInputGraph = {
    nodes: dotNodes,
    edges: dotEdges,
    rankDir: 'TB',
    nodeSep: 40,
    rankSep: 60,
  };

  const result = layout(dotGraph);

  // Build position map from dot layout result
  const posMap = new Map(result.nodes.map((n) => [n.id, n]));

  // Build ClassifierGeo entries
  const classifiers: ClassifierGeo[] = [];
  for (const classifier of ast.classifiers) {
    const pos = posMap.get(classifier.id);
    const measured = measuredMap.get(classifier.id);
    if (pos === undefined || measured === undefined) continue;

    classifiers.push({
      id: classifier.id,
      kind: classifier.kind,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      dividerYs: measured.dividerYs,
      rows: measured.rows,
    });
  }

  // Build NamespaceGeo entries by computing bounds from member classifier positions
  const namespaces: NamespaceGeo[] = [];
  for (const ns of ast.namespaces) {
    const memberPositions = ns.classifiers
      .map((id) => posMap.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (memberPositions.length === 0) continue;

    const padding = 16;
    const topPad = 28;
    const minX = Math.min(...memberPositions.map((p) => p.x)) - padding;
    const minY = Math.min(...memberPositions.map((p) => p.y)) - topPad;
    const maxX = Math.max(...memberPositions.map((p) => p.x + p.width)) + padding;
    const maxY = Math.max(...memberPositions.map((p) => p.y + p.height)) + padding;

    namespaces.push({
      id: ns.id,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      label: ns.display,
    });
  }

  // Build EdgeGeo entries
  const edges: EdgeGeo[] = [];
  for (let i = 0; i < ast.relationships.length; i++) {
    const rel = ast.relationships[i]!;
    const edgeResult = result.edges.find((e) => e.id === `edge-${i}`);
    if (edgeResult === undefined) continue;

    const decor = EDGE_DECORATION_MAP[rel.type];
    // Reverse points for hierarchical edges so the visual arrow flows child →
    // parent with the triangle at the parent end (dot routes parent → child).
    const rawPts = edgeResult.points;
    const pts = swappedEdges.has(i) ? [...rawPts].reverse() : rawPts;
    const edgeGeo: EdgeGeo = {
      id: edgeResult.id,
      points: pts,
      targetDecor: decor.targetDecor,
      sourceDecor: decor.sourceDecor,
      dashed: decor.dashed,
    };

    // Attach label if present: midpoint of edge with a small upward offset so
    // it doesn't sit on the line itself.
    if (rel.label !== undefined) {
      const mid = pts[Math.floor(pts.length / 2)] ?? pts[0];
      if (mid !== undefined) {
        edgeGeo.label = { text: rel.label, x: mid.x + 2, y: mid.y - 8 };
      }
    }

    edges.push(edgeGeo);
  }

  return {
    totalWidth: result.width,
    totalHeight: result.height,
    classifiers,
    edges,
    namespaces,
  };
}

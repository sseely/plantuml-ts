/**
 * Class diagram layout engine.
 *
 * Synchronous: ClassDiagramAST + Theme + StringMeasurer → ClassGeometry
 * via the dot layout engine.
 *
 * Architecture decisions:
 *   D3 — Calls layout() from the shared dot engine.
 *   D4 — Nodes are pre-measured; dot only routes and positions.
 *   D5 — Namespaces are flattened into the root graph (D5 refers to
 *         ranking only now — see buildDotClusters); namespace bounds are
 *         derived from classifier positions after layout.
 *
 * No DOM, no SVG. All I/O is plain data.
 *
 * Classifier sizing/measurement is implemented in ./class-layout-helpers.ts
 * (split out to keep every function under the project's per-function
 * complexity/size caps; this file re-exports `formatMemberText` from there).
 */

import type {
  ClassDiagramAST,
  ClassifierKind,
  HideTarget,
  Namespace,
  Relationship,
  RelationshipType,
  Visibility,
} from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import { layoutGraph as layout } from '../../core/graph-layout.js';
import type {
  DotInputCluster,
  DotInputGraph,
  DotInputNode,
  DotInputEdge,
  DotLayoutResult,
} from '../../core/graph-layout.js';
import { buildNoteGraphParts, mapNoteGeos, type NoteGeo } from './note-layout.js';
import { measureClassifier, type MeasuredClassifier } from './class-layout-helpers.js';

export { formatMemberText } from './class-layout-helpers.js';

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
  /** When true the circle badge is suppressed in the renderer */
  hideCircle?: boolean;
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
  notes: NoteGeo[];
}

// ---------------------------------------------------------------------------
// Directive resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the final effective action for each hide/show target.
 * Later directives in the array override earlier ones (last writer wins).
 */
function resolveEffectiveActions(
  ast: ClassDiagramAST,
): Map<HideTarget, 'hide' | 'show'> {
  const effectiveAction = new Map<HideTarget, 'hide' | 'show'>();
  for (const directive of ast.directives) {
    effectiveAction.set(directive.target, directive.action);
  }
  return effectiveAction;
}

/** Pre-measure every classifier, honoring "hide members" / "hide empty members". */
function preMeasureClassifiers(
  ast: ClassDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
  effectiveActions: Map<HideTarget, 'hide' | 'show'>,
): Map<string, MeasuredClassifier> {
  const hideMembers  = effectiveActions.get('members')       === 'hide';
  const hideEmptyMem = effectiveActions.get('empty members') === 'hide';

  const measuredMap = new Map<string, MeasuredClassifier>();
  for (const classifier of ast.classifiers) {
    // suppressMemberSection when:
    //   - "hide members" is active (all members hidden for every classifier), OR
    //   - "hide empty members" is active AND this classifier has no visible members
    const visibleCount = classifier.members.filter((m) => m.hidden !== true).length;
    const suppressMemberSection = hideMembers || (hideEmptyMem && visibleCount === 0);
    measuredMap.set(
      classifier.id,
      measureClassifier(classifier, theme, measurer, suppressMemberSection),
    );
  }
  return measuredMap;
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

// For hierarchical relationships the parent must rank above the child in the
// TB layout, so the dot graph swaps from/to. The edge points returned by dot
// are then reversed so the rendered arrow still flows child → parent with the
// triangle arrowhead at the parent end.
const HIERARCHICAL = new Set<RelationshipType>(['extension', 'implementation']);

interface DotGraphParts {
  dotGraph: DotInputGraph;
  swappedEdges: Set<number>;
  noteParts: ReturnType<typeof buildNoteGraphParts>;
}

/**
 * The set of namespace ids that must emit a cluster: any namespace whose
 * subtree contains at least one direct member classifier. A namespace with no
 * direct members is still kept when a descendant has members (it is a real
 * ancestor cluster and its members bubble up in the oracle); a namespace whose
 * entire subtree is empty is dropped — the oracle omits member-less subgraphs
 * (verified against mujopi-30-zadi566: two empty packages produce no cluster).
 */
function nonEmptyNamespaceIds(ast: ClassDiagramAST): Set<string> {
  const byId = new Map(ast.namespaces.map((n) => [n.id, n] as const));
  const keep = new Set<string>();
  for (const ns of ast.namespaces) {
    if (ns.classifiers.length === 0) continue;
    let cur: Namespace | undefined = ns;
    while (cur !== undefined && !keep.has(cur.id)) {
      keep.add(cur.id);
      cur = cur.parentId !== undefined ? byId.get(cur.parentId) : undefined;
    }
  }
  return keep;
}

/**
 * Build one `DotInputCluster` per non-empty package/namespace, nesting via
 * `parentId` for dotted/nested names (mirrors the description engine's
 * `buildDotClusters` in ../description/layout.ts). `id` is a synthetic
 * `clusterN` token — NOT `ns.id` — because the comparator's `parseClusters`
 * (tests/oracle/svek-dot.ts:109) only recognizes subgraphs named exactly
 * `^cluster\d+$`; the description engine's `clusterId` generator
 * (`cluster${counter.n++}`, description/layout.ts:108) uses the same scheme.
 * Only direct member classifiers go in `nodeIds`; descendants' members bubble
 * up through the nesting, matching the oracle's cluster-membership counting.
 */
function buildDotClusters(ast: ClassDiagramAST): DotInputCluster[] | undefined {
  const keep = nonEmptyNamespaceIds(ast);
  if (keep.size === 0) return undefined;
  const kept = ast.namespaces.filter((ns) => keep.has(ns.id));
  const clusterIdByNs = new Map(kept.map((ns, i) => [ns.id, `cluster${i}`] as const));
  return kept.map((ns, i) => {
    const cluster: DotInputCluster = { id: `cluster${i}`, nodeIds: ns.classifiers };
    if (ns.display.length > 0) cluster.label = ns.display;
    const parentClusterId =
      ns.parentId !== undefined ? clusterIdByNs.get(ns.parentId) : undefined;
    if (parentClusterId !== undefined) cluster.parentId = parentClusterId;
    return cluster;
  });
}

/**
 * Build the dot input graph — all classifiers + notes flattened into the
 * root graph (D5) — plus the set of hierarchical edge indices that were
 * swapped from/to for ranking (see HIERARCHICAL above).
 */
function buildDotGraph(
  ast: ClassDiagramAST,
  measuredMap: Map<string, MeasuredClassifier>,
  theme: Theme,
  measurer: StringMeasurer,
): DotGraphParts {
  const dotNodes: DotInputNode[] = ast.classifiers.map((classifier) => {
    const measured = measuredMap.get(classifier.id)!;
    return { id: classifier.id, width: measured.width, height: measured.height };
  });

  const dotEdges: DotInputEdge[] = ast.relationships.map(
    (rel: Relationship, i: number) => {
      const swap = HIERARCHICAL.has(rel.type);
      // dot minlen = arrow length - 1 (CommandLinkClass/SvekEdge): `->` → 0,
      // `-->` → 1, `--->` → 2. Absent length ⇒ the default association (2 → 1).
      return {
        id: `edge-${i}`,
        from: swap ? rel.to : rel.from,
        to: swap ? rel.from : rel.to,
        attributes: { minLen: (rel.length ?? 2) - 1 },
      };
    },
  );

  const swappedEdges = new Set(
    ast.relationships
      .map((rel, i) => (HIERARCHICAL.has(rel.type) ? i : -1))
      .filter((i) => i >= 0),
  );

  // Notes lay out as their own nodes + connector edges (Svek note-on-entity).
  const noteParts = buildNoteGraphParts(ast.notes, theme, measurer);
  dotNodes.push(...noteParts.nodes);
  dotEdges.push(...noteParts.edges);

  const clusters = buildDotClusters(ast);

  const dotGraph: DotInputGraph = {
    nodes: dotNodes,
    edges: dotEdges,
    rankDir: 'TB',
    // Oracle (graphviz-for-plantuml default) emits nodesep=0.486111in (35px) and
    // ranksep=0.833333in (60px); mirror both exactly so the svek DOT nodesep/
    // ranksep attrs match. See ADR-6 (graph-attr parity).
    nodeSep: 35,
    rankSep: 60,
    ...(clusters !== undefined ? { clusters } : {}),
  };

  return { dotGraph, swappedEdges, noteParts };
}

/** Build ClassifierGeo entries from pre-measured sizes + dot-assigned positions. */
function buildClassifierGeos(
  ast: ClassDiagramAST,
  measuredMap: Map<string, MeasuredClassifier>,
  posMap: Map<string, DotLayoutResult['nodes'][number]>,
): ClassifierGeo[] {
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
      ...(classifier.hideCircle === true ? { hideCircle: true } : {}),
    });
  }
  return classifiers;
}

/** Build NamespaceGeo entries by computing bounds from member classifier positions. */
function buildNamespaceGeos(
  ast: ClassDiagramAST,
  posMap: Map<string, DotLayoutResult['nodes'][number]>,
): NamespaceGeo[] {
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
  return namespaces;
}

/** Attach the edge label (geometric midpoint, offset right-perpendicular) if present. */
function attachEdgeLabel(
  edgeGeo: EdgeGeo,
  rel: Relationship,
  pts: Array<{ x: number; y: number }>,
): void {
  if (rel.label === undefined) return;

  const n = pts.length;
  const lo = Math.floor((n - 1) / 2);
  const hi = Math.ceil((n - 1) / 2);
  const mid = {
    x: (pts[lo]!.x + pts[hi]!.x) / 2,
    y: (pts[lo]!.y + pts[hi]!.y) / 2,
  };
  const first = pts[0]!;
  const last = pts[n - 1]!;
  const edgeDx = last.x - first.x;
  const edgeDy = last.y - first.y;
  const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1;
  const LABEL_OFFSET = 10;
  edgeGeo.label = {
    text: rel.label,
    x: mid.x + (edgeDy / edgeLen) * LABEL_OFFSET,
    y: mid.y + (-edgeDx / edgeLen) * LABEL_OFFSET,
  };
}

/** Build EdgeGeo entries from the dot layout result, reversing hierarchical edges. */
function buildEdgeGeos(
  ast: ClassDiagramAST,
  result: DotLayoutResult,
  swappedEdges: Set<number>,
): EdgeGeo[] {
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

    attachEdgeLabel(edgeGeo, rel, pts);
    edges.push(edgeGeo);
  }
  return edges;
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
    return { totalWidth: 0, totalHeight: 0, classifiers: [], edges: [], namespaces: [], notes: [] };
  }

  // Resolve effective hide/show directive actions (last writer wins per target)
  const effectiveActions = resolveEffectiveActions(ast);
  // Pre-measure all classifiers
  const measuredMap = preMeasureClassifiers(ast, theme, measurer, effectiveActions);
  // Build dot graph (classifiers + notes flattened into root graph, D5)
  const { dotGraph, swappedEdges, noteParts } = buildDotGraph(ast, measuredMap, theme, measurer);

  const result = layout(dotGraph);

  // Build position map from dot layout result
  const posMap = new Map(result.nodes.map((n) => [n.id, n]));
  const notes: NoteGeo[] = mapNoteGeos(ast.notes, noteParts.lines, posMap, result);
  const classifiers = buildClassifierGeos(ast, measuredMap, posMap);
  const namespaces = buildNamespaceGeos(ast, posMap);
  const edges = buildEdgeGeos(ast, result, swappedEdges);

  return { totalWidth: result.width, totalHeight: result.height, classifiers, edges, namespaces, notes };
}

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
  LinkDecor,
  Relationship,
  Visibility,
} from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import { layoutGraph as layout } from '../../core/graph-layout.js';
import type { DotLayoutResult } from '../../core/graph-layout.js';
import { mapNoteGeos, type NoteGeo } from './note-layout.js';
import {
  measureClassifier,
  type MeasuredClassifier,
} from './class-layout-helpers.js';
import { buildDotGraph, EDGE_DECORATION_MAP } from './class-dot-graph.js';

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
  /** Text rows to render: [header display, ...member strings] with y offset. */
  rows: Array<{
    text: string;
    y: number;
    indent: number;
    italic?: boolean; // abstract/interface header names — rendered in italic
    visibilityIcon?: Visibility; // colored icon left of member text
  }>;
  hideCircle?: boolean; // suppress the circle badge (hide circle directive)
  usymbol?: string; // for kind 'descriptive': the keyword whose USymbol icon renders
}

export interface EdgeGeo {
  id: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
  /** Arrow decoration at the target end (from the arrow's target-side head). */
  targetDecor: LinkDecor;
  /** Arrow decoration at the source end (from the arrow's source-side head). */
  sourceDecor: LinkDecor;
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
      ...(classifier.usymbol !== undefined ? { usymbol: classifier.usymbol } : {}),
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
      targetDecor: rel.targetDecor ?? decor.targetDecor,
      sourceDecor: rel.sourceDecor ?? decor.sourceDecor,
      dashed: decor.dashed,
    };

    attachEdgeLabel(edgeGeo, rel, pts);
    edges.push(edgeGeo);
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Degenerate-diagram skip (0-1 entities -> no DOT graph)
// ---------------------------------------------------------------------------

/**
 * `GraphvizImageBuilder.buildImage:211-223` gates graphviz entirely on
 * `dotData.isDegeneratedWithFewEntities(nb)` (`dot/DotData.java:69-71`):
 * `entityFactory.groups().size() == 0 && getLinks().size() == 0 &&
 * getLeafs().size() == nb`. "Groups" means ANY declared namespace/package —
 * even an empty one still creates a group entity, so `ast.namespaces` (never
 * filtered for emptiness — see `Namespace` in ast.ts) is the exact raw-group
 * proxy; no "non-empty namespace" filtering like `buildDotClusters` applies
 * here. "Leafs" (`CucaDiagram#leafs()`) counts every non-group entity,
 * INCLUDING notes (`LeafType.NOTE` created via `reallyCreateLeaf`) — so a
 * class with one attached or floating note is NOT degenerate (2 leafs).
 *
 * We only special-case the single-*classifier* leaf here (the `nb === 1`
 * path: `createEntityImageBlock` + the hexagon guard at
 * `GraphvizImageBuilder.java:217`, `single.getUSymbol() instanceof
 * USymbolHexagon == false`). A lone freestanding note (zero classifiers, one
 * note) falls through to the normal dot path — out of scope for this port;
 * see the T5 task report for the rationale.
 */
function degenerateSingleClassifier(
  ast: ClassDiagramAST,
  measuredMap: Map<string, MeasuredClassifier>,
): ClassGeometry | undefined {
  if (ast.namespaces.length !== 0) return undefined;
  if (ast.relationships.length !== 0) return undefined;
  if (ast.classifiers.length !== 1 || ast.notes.length !== 0) return undefined;
  const classifier = ast.classifiers[0]!;
  if (classifier.kind === 'descriptive' && classifier.usymbol === 'hexagon') return undefined;
  const measured = measuredMap.get(classifier.id)!;

  // Mirrors core/graph-layout.ts's own single-node placement (shiftToOrigin
  // puts the lone node at (0,0); canvasSize adds that module's own
  // MARGIN=12, graph-layout.ts:40) — NOT description's
  // LAYOUT_MARGIN/LAYOUT_MARGIN_LEADING, which belongs to that other module.
  const GRAPH_MARGIN = 12;
  const geo: ClassifierGeo = {
    id: classifier.id,
    kind: classifier.kind,
    x: 0,
    y: 0,
    width: measured.width,
    height: measured.height,
    dividerYs: measured.dividerYs,
    rows: measured.rows,
    ...(classifier.hideCircle === true ? { hideCircle: true } : {}),
    ...(classifier.usymbol !== undefined ? { usymbol: classifier.usymbol } : {}),
  };
  return {
    totalWidth: measured.width + GRAPH_MARGIN,
    totalHeight: measured.height + GRAPH_MARGIN,
    classifiers: [geo],
    edges: [],
    namespaces: [],
    notes: [],
  };
  // #lizard forgives — flat chain of early-return guards encoding upstream's
  // single conjunctive predicate (isDegeneratedWithFewEntities) plus the
  // hexagon exclusion, mirroring description's degenerateSingleLeaf; not
  // reducible without splitting one upstream check across functions.
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
  // Empty diagram (isDegeneratedWithFewEntities(0): 0 groups, 0 links, 0
  // leafs — leafs includes notes, so a lone freestanding note must NOT hit
  // this shortcut or it would be silently dropped) — zero-size result.
  if (
    ast.namespaces.length === 0 &&
    ast.relationships.length === 0 &&
    ast.classifiers.length === 0 &&
    ast.notes.length === 0
  ) {
    return { totalWidth: 0, totalHeight: 0, classifiers: [], edges: [], namespaces: [], notes: [] };
  }

  // Resolve effective hide/show directive actions (last writer wins per target)
  const effectiveActions = resolveEffectiveActions(ast);
  // Pre-measure all classifiers
  const measuredMap = preMeasureClassifiers(ast, theme, measurer, effectiveActions);

  // Degenerate diagram (0-1 entities, no relationships) — skip graphviz
  // entirely, mirroring GraphvizImageBuilder.buildImage:211-223.
  const degenerate = degenerateSingleClassifier(ast, measuredMap);
  if (degenerate !== undefined) return degenerate;

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

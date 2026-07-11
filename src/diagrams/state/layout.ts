/**
 * State diagram layout engine.
 *
 * Dispatches to one of two pipelines (mission A4 state-dot-sync, D1):
 *   - FLAT diagrams (no composite/concurrent states anywhere) route through
 *     the svek-faithful pipeline: ./state-dot-graph.ts builds a DotInputGraph
 *     with per-kind shapes/sizes (./state-sizing.ts) + minlen/labels, the
 *     shared dot layout engine positions it, and this file maps positions
 *     back to StateNodeGeo/TransitionGeo.
 *   - Diagrams containing ANY composite (`children.length > 0`) or
 *     concurrent-region (`concurrentRegions.length > 0`) state anywhere keep
 *     the PRE-EXISTING recursive `layoutLevel` pipeline verbatim (LEGACY
 *     section below) — T4's mission task replaces this with autonom child
 *     passes + cluster envelopes (mechanisms.md §2/§3). Mixing pipelines
 *     within one diagram is deliberately avoided: a top-level composite
 *     check decides the WHOLE diagram's pipeline (see `hasAnyComposite`).
 */

import type { StateDiagramAST, State, Transition, StateKind } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { FontSpec, StringMeasurer } from '../../core/measurer.js';
import { layoutGraph as layout } from '../../core/graph-layout.js';
import type { DotInputNode, DotInputEdge, DotLayoutResult } from '../../core/graph-layout.js';
import { buildDotGraph, transitionLabelText, INITIAL_ID, FINAL_ID } from './state-dot-graph.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StateNodeGeo {
  id: string;
  kind: StateKind;
  display: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: StateNodeGeo[];
}

export interface TransitionGeo {
  from: string;
  to: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
}

export interface StateGeometry {
  totalWidth: number;
  totalHeight: number;
  states: StateNodeGeo[];
  transitions: TransitionGeo[];
}

/** A state (or top-level ast) is composite-free iff no state anywhere carries
 *  children or concurrent regions — since both only ever appear as entries
 *  inside a parent's children/regions arrays, a clean top-level scan is
 *  sufficient (no deeper state can exist without a composite ancestor). */
function hasAnyComposite(states: readonly State[]): boolean {
  return states.some((s) => s.children.length > 0 || s.concurrentRegions.length > 0);
}

/** Label offset perpendicular to the edge direction, shared by both
 *  pipelines so antiparallel transitions don't overlap their labels. */
const LABEL_PERP = 12;

/** Attach a transition's label (guard/action/plain) at the edge's geometric
 *  midpoint, offset perpendicular to the edge direction. Shared by both the
 *  flat and legacy pipelines — pure function of the routed points. */
function attachTransitionLabel(t: Transition, points: ReadonlyArray<{ x: number; y: number }>): TransitionGeo['label'] {
  const labelText = transitionLabelText(t);
  if (labelText === undefined || points.length < 2) return undefined;
  let mid: { x: number; y: number };
  if (points.length === 2) {
    const p0 = points[0]!;
    const p1 = points[1]!;
    mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  } else {
    mid = points[Math.floor(points.length / 2)]!;
  }
  const p0 = points[0]!;
  const pLast = points[points.length - 1]!;
  const eDx = pLast.x - p0.x;
  const eDy = pLast.y - p0.y;
  const eLen = Math.sqrt(eDx * eDx + eDy * eDy) || 1;
  return {
    text: labelText,
    x: mid.x + (eDy / eLen) * LABEL_PERP,
    y: mid.y + (-eDx / eLen) * LABEL_PERP - 4,
  };
}

// ===========================================================================
// FLAT pipeline (svek-faithful — T3)
// ===========================================================================

/** initial/final StateNodeGeo entries, if the shared anchors were used. */
function buildPseudoNodeGeos(posMap: Map<string, DotLayoutResult['nodes'][number]>): StateNodeGeo[] {
  const geos: StateNodeGeo[] = [];
  const initial = posMap.get(INITIAL_ID);
  if (initial !== undefined) {
    geos.push({ id: INITIAL_ID, kind: 'initial', display: '', x: initial.x, y: initial.y, width: initial.width, height: initial.height, children: [] });
  }
  const final = posMap.get(FINAL_ID);
  if (final !== undefined) {
    geos.push({ id: FINAL_ID, kind: 'final', display: '', x: final.x, y: final.y, width: final.width, height: final.height, children: [] });
  }
  return geos;
}

function buildFlatStateGeos(ast: StateDiagramAST, posMap: Map<string, DotLayoutResult['nodes'][number]>): StateNodeGeo[] {
  const geos: StateNodeGeo[] = [];
  for (const s of ast.states) {
    const pos = posMap.get(s.id);
    if (pos === undefined) continue;
    geos.push({ id: s.id, kind: s.kind, display: s.display, x: pos.x, y: pos.y, width: pos.width, height: pos.height, children: [] });
  }
  geos.push(...buildPseudoNodeGeos(posMap));
  return geos;
}

function buildFlatTransitionGeos(ast: StateDiagramAST, result: DotLayoutResult): TransitionGeo[] {
  const edgePosMap = new Map(result.edges.map((e) => [e.id, e]));
  const geos: TransitionGeo[] = [];
  for (let i = 0; i < ast.transitions.length; i++) {
    const t = ast.transitions[i]!;
    const edgeResult = edgePosMap.get(`edge-${i}`);
    if (edgeResult === undefined) continue;
    const label = attachTransitionLabel(t, edgeResult.points);
    geos.push({ from: t.from, to: t.to, points: edgeResult.points, ...(label !== undefined ? { label } : {}) });
  }
  return geos;
}

/** Flat (composite-free) pipeline: AST → DotInputGraph (state-dot-graph.ts)
 *  → shared dot layout engine → geometry. */
function layoutFlat(ast: StateDiagramAST, theme: Theme, measurer: StringMeasurer): StateGeometry {
  const dotGraph = buildDotGraph(ast, theme, measurer);
  if (dotGraph.nodes.length === 0) {
    return { totalWidth: 0, totalHeight: 0, states: [], transitions: [] };
  }
  const result = layout(dotGraph);
  const posMap = new Map(result.nodes.map((n) => [n.id, n]));
  return {
    totalWidth: result.width,
    totalHeight: result.height,
    states: buildFlatStateGeos(ast, posMap),
    transitions: buildFlatTransitionGeos(ast, result),
  };
}

// ===========================================================================
// LEGACY pipeline (pre-existing recursive layout — T4 replaces this section)
//
// Verbatim behavior for any diagram containing a composite/concurrent-region
// state anywhere: pre-measures each composite recursively, places it as one
// atomic node in the outer layout. [*] pseudostates are scoped per level.
// Sizing here intentionally still uses the OLD (non-svek) formulas — T4 owns
// the real autonom/cluster rewrite (mechanisms.md §2/§3); T3's scope is flat
// diagrams only (mission brief T3 task, batch-2/overview.md).
// ===========================================================================

const LEGACY_PSEUDOSTATE_SIZES: Readonly<
  Record<Exclude<StateKind, 'normal'>, { width: number; height: number }>
> = {
  initial: { width: 20, height: 20 },
  final: { width: 24, height: 24 },
  fork: { width: 60, height: 8 },
  join: { width: 60, height: 8 },
  choice: { width: 20, height: 20 },
  junction: { width: 20, height: 20 },
  history: { width: 24, height: 24 },
  deepHistory: { width: 24, height: 24 },
  syncBar: { width: 60, height: 8 },
};

const LEGACY_COMPOSITE_PAD = 20;
const LEGACY_COMPOSITE_TOP_PAD = 32;
const LEGACY_NODE_SEP = 36;
const LEGACY_RANK_SEP = 48;
const LEGACY_LAYOUT_MARGIN = 12;

function legacyMeasureState(
  state: State,
  theme: Theme,
  measurer: StringMeasurer,
): { width: number; height: number } {
  if (state.kind !== 'normal') {
    return LEGACY_PSEUDOSTATE_SIZES[state.kind];
  }
  const fontSpec: FontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const measured = measurer.measure(state.display, fontSpec);
  return {
    width: Math.max(80, measured.width + 24),
    height: theme.fontSize * 1.4 + 20,
  };
}

function legacyShiftGeo(geo: StateNodeGeo, dx: number, dy: number): StateNodeGeo {
  return {
    ...geo,
    x: geo.x + dx,
    y: geo.y + dy,
    children: geo.children.map((c) => legacyShiftGeo(c, dx, dy)),
  };
}

function legacyShiftTransition(t: TransitionGeo, dx: number, dy: number): TransitionGeo {
  return {
    ...t,
    points: t.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    ...(t.label !== undefined
      ? { label: { ...t.label, x: t.label.x + dx, y: t.label.y + dy } }
      : {}),
  };
}

interface LegacyLevelResult {
  nodeGeos: StateNodeGeo[];
  transitionGeos: TransitionGeo[];
  width: number;
  height: number;
}

/** One dot node for a composite state: pre-measured recursive inner layout
 *  padded on all sides, floored by the composite's own label width. */
function legacyBuildCompositeNode(
  s: State,
  theme: Theme,
  measurer: StringMeasurer,
  inner: LegacyLevelResult,
): DotInputNode {
  const fontSpec: FontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const measured = measurer.measure(s.display, fontSpec);
  return {
    id: s.id,
    width: Math.max(inner.width + LEGACY_COMPOSITE_PAD * 2, measured.width + LEGACY_COMPOSITE_PAD * 2),
    height: inner.height + LEGACY_COMPOSITE_TOP_PAD + LEGACY_COMPOSITE_PAD,
  };
}

interface LegacyLevelNodesParams {
  states: readonly State[];
  transitions: readonly Transition[];
  theme: Theme;
  measurer: StringMeasurer;
  innerResults: Map<string, LegacyLevelResult>;
  initialId: string;
  finalId: string;
}

/** Build dot nodes for one legacy level: composites (pre-measured via a
 *  recursive inner layout) + leaves + scope-local [*] pseudostates. */
function legacyBuildLevelNodes(params: LegacyLevelNodesParams): DotInputNode[] {
  const { states, transitions, theme, measurer, innerResults, initialId, finalId } = params;
  const dotNodes: DotInputNode[] = states.map((s) =>
    s.children.length > 0
      ? legacyBuildCompositeNode(s, theme, measurer, innerResults.get(s.id)!)
      : { id: s.id, ...legacyMeasureState(s, theme, measurer) },
  );
  if (transitions.some((t) => t.from === '[*]')) dotNodes.push({ id: initialId, ...LEGACY_PSEUDOSTATE_SIZES.initial });
  if (transitions.some((t) => t.to === '[*]')) dotNodes.push({ id: finalId, ...LEGACY_PSEUDOSTATE_SIZES.final });
  return dotNodes;
}

/** dot edges for one legacy level's own (non-inner) transitions, redirecting
 *  the anonymous `[*]` token to this level's scoped initial/final anchor. */
function legacyBuildLevelEdges(
  transitions: readonly Transition[],
  scopeId: string,
  initialId: string,
  finalId: string,
): DotInputEdge[] {
  return transitions.map((t, i) => ({
    id: `edge-${scopeId}-${i}`,
    from: t.from === '[*]' ? initialId : t.from,
    to: t.to === '[*]' ? finalId : t.to,
  }));
}

/** Recursively lay out every composite child BEFORE this level (their
 *  pre-measured dims are needed to size the composite's own dot node). */
function legacyComputeInnerResults(
  states: readonly State[],
  theme: Theme,
  measurer: StringMeasurer,
): Map<string, LegacyLevelResult> {
  const innerResults = new Map<string, LegacyLevelResult>();
  for (const s of states) {
    if (s.children.length > 0) {
      innerResults.set(s.id, legacyLayoutLevel(s.children, s.transitions, theme, measurer, s.id));
    }
  }
  return innerResults;
}

/** Smallest x/y across a set of dot-layout nodes; (0,0) when empty. */
function legacyMinCoords(nodes: DotLayoutResult['nodes']): { x: number; y: number } {
  let minX = Infinity;
  let minY = Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
  }
  return { x: isFinite(minX) ? minX : 0, y: isFinite(minY) ? minY : 0 };
}

/** Shift every node and edge waypoint in a dot-layout result by (dx, dy). */
function legacyShiftResult(result: DotLayoutResult, dx: number, dy: number): void {
  for (const n of result.nodes) {
    n.x += dx;
    n.y += dy;
  }
  for (const e of result.edges) {
    for (const p of e.points) {
      p.x += dx;
      p.y += dy;
    }
  }
}

/** Normalize dot-engine coordinates to non-negative, LEGACY_LAYOUT_MARGIN-padded. */
function legacyNormalizeCoords(result: DotLayoutResult): void {
  const min = legacyMinCoords(result.nodes);
  const normDx = LEGACY_LAYOUT_MARGIN - min.x;
  const normDy = LEGACY_LAYOUT_MARGIN - min.y;
  if (normDx === 0 && normDy === 0) return;
  legacyShiftResult(result, normDx, normDy);
}

interface LegacyNodeGeoParams {
  states: readonly State[];
  posMap: Map<string, DotLayoutResult['nodes'][number]>;
  innerResults: Map<string, LegacyLevelResult>;
  innerTransitionGeos: TransitionGeo[];
}

/** Build composite/leaf StateNodeGeo entries for one legacy level (excludes
 *  the scope-local [*] pseudostate entries, appended separately). */
function legacyBuildNodeGeos(params: LegacyNodeGeoParams): StateNodeGeo[] {
  const { states, posMap, innerResults, innerTransitionGeos } = params;
  const nodeGeos: StateNodeGeo[] = [];
  for (const s of states) {
    const pos = posMap.get(s.id);
    if (pos === undefined) continue;
    if (s.children.length > 0) {
      const inner = innerResults.get(s.id)!;
      const offsetX = pos.x + LEGACY_COMPOSITE_PAD - LEGACY_LAYOUT_MARGIN;
      const offsetY = pos.y + LEGACY_COMPOSITE_TOP_PAD - LEGACY_LAYOUT_MARGIN;
      const shiftedChildren = inner.nodeGeos.map((g) => legacyShiftGeo(g, offsetX, offsetY));
      for (const t of inner.transitionGeos) innerTransitionGeos.push(legacyShiftTransition(t, offsetX, offsetY));
      nodeGeos.push({ id: s.id, kind: s.kind, display: s.display, x: pos.x, y: pos.y, width: pos.width, height: pos.height, children: shiftedChildren });
    } else {
      nodeGeos.push({ id: s.id, kind: s.kind, display: s.display, x: pos.x, y: pos.y, width: pos.width, height: pos.height, children: [] });
    }
  }
  return nodeGeos;
}

/** Scope-local [*] pseudostate StateNodeGeo entries, if used at this level. */
function legacyBuildPseudoNodeGeos(
  posMap: Map<string, DotLayoutResult['nodes'][number]>,
  initialId: string,
  finalId: string,
): StateNodeGeo[] {
  const geos: StateNodeGeo[] = [];
  const initialPos = posMap.get(initialId);
  if (initialPos !== undefined) {
    geos.push({ id: initialId, kind: 'initial', display: '', x: initialPos.x, y: initialPos.y, width: initialPos.width, height: initialPos.height, children: [] });
  }
  const finalPos = posMap.get(finalId);
  if (finalPos !== undefined) {
    geos.push({ id: finalId, kind: 'final', display: '', x: finalPos.x, y: finalPos.y, width: finalPos.width, height: finalPos.height, children: [] });
  }
  return geos;
}

/** Build TransitionGeo entries for one legacy level's own (non-inner) transitions. */
function legacyBuildTransitionGeos(
  transitions: readonly Transition[],
  scopeId: string,
  result: DotLayoutResult,
): TransitionGeo[] {
  const edgePosMap = new Map(result.edges.map((e) => [e.id, e]));
  const transitionGeos: TransitionGeo[] = [];
  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i]!;
    const edgeResult = edgePosMap.get(`edge-${scopeId}-${i}`);
    if (edgeResult === undefined) continue;
    const label = attachTransitionLabel(t, edgeResult.points);
    transitionGeos.push({ from: t.from, to: t.to, points: edgeResult.points, ...(label !== undefined ? { label } : {}) });
  }
  return transitionGeos;
}

/** Compute total level bounds — dot-engine size plus any node/edge/label
 *  extent beyond it (waypoints and labels can overhang the packed layout). */
function legacyComputeBounds(nodeGeos: StateNodeGeo[], transitionGeos: TransitionGeo[], result: DotLayoutResult): { width: number; height: number } {
  let maxX = result.width;
  let maxY = result.height;
  for (const g of nodeGeos) {
    maxX = Math.max(maxX, g.x + g.width + LEGACY_LAYOUT_MARGIN);
    maxY = Math.max(maxY, g.y + g.height + LEGACY_LAYOUT_MARGIN);
  }
  for (const t of transitionGeos) {
    for (const p of t.points) {
      maxX = Math.max(maxX, p.x + LEGACY_LAYOUT_MARGIN);
      maxY = Math.max(maxY, p.y + LEGACY_LAYOUT_MARGIN);
    }
    if (t.label !== undefined) {
      const estLabelW = t.label.text.length * 7;
      maxX = Math.max(maxX, t.label.x + estLabelW + LEGACY_LAYOUT_MARGIN);
      maxY = Math.max(maxY, t.label.y + 16 + LEGACY_LAYOUT_MARGIN);
    }
  }
  return { width: maxX, height: maxY };
}

/**
 * Lay out one level of the state hierarchy (legacy pipeline).
 *
 * @param states      - States at this level (may include composites).
 * @param transitions - Transitions at this level (not inner ones).
 * @param theme       - Theme for measurement.
 * @param measurer    - Text measurer.
 * @param scopeId     - Unique prefix for pseudostate ids; '' for top level.
 */
function legacyLayoutLevel(
  states: readonly State[],
  transitions: readonly Transition[],
  theme: Theme,
  measurer: StringMeasurer,
  scopeId: string,
): LegacyLevelResult {
  const initialId = scopeId !== '' ? `__init_${scopeId}` : '__initial__';
  const finalId = scopeId !== '' ? `__final_${scopeId}` : '__final__';

  const innerResults = legacyComputeInnerResults(states, theme, measurer);
  const dotNodes = legacyBuildLevelNodes({ states, transitions, theme, measurer, innerResults, initialId, finalId });
  const dotEdges = legacyBuildLevelEdges(transitions, scopeId, initialId, finalId);

  if (dotNodes.length === 0) {
    return { nodeGeos: [], transitionGeos: [], width: 0, height: 0 };
  }

  const result = layout({ nodes: dotNodes, edges: dotEdges, rankDir: 'TB', nodeSep: LEGACY_NODE_SEP, rankSep: LEGACY_RANK_SEP });
  legacyNormalizeCoords(result);
  const posMap = new Map(result.nodes.map((n) => [n.id, n]));

  const innerTransitionGeos: TransitionGeo[] = [];
  const nodeGeos = [
    ...legacyBuildNodeGeos({ states, posMap, innerResults, innerTransitionGeos }),
    ...legacyBuildPseudoNodeGeos(posMap, initialId, finalId),
  ];
  const transitionGeos = [...legacyBuildTransitionGeos(transitions, scopeId, result), ...innerTransitionGeos];
  const bounds = legacyComputeBounds(nodeGeos, transitionGeos, result);

  return { nodeGeos, transitionGeos, width: bounds.width, height: bounds.height };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function layoutState(
  ast: StateDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): StateGeometry {
  if (ast.states.length === 0 && ast.transitions.length === 0) {
    return { totalWidth: 0, totalHeight: 0, states: [], transitions: [] };
  }

  if (!hasAnyComposite(ast.states)) {
    return layoutFlat(ast, theme, measurer);
  }

  const levelResult = legacyLayoutLevel(ast.states, ast.transitions, theme, measurer, '');
  return {
    totalWidth: levelResult.width,
    totalHeight: levelResult.height,
    states: levelResult.nodeGeos,
    transitions: levelResult.transitionGeos,
  };
}

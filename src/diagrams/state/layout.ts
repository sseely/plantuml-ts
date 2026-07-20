/**
 * State diagram layout engine.
 *
 * Dispatches to one of two pipelines (mission A4 state-dot-sync, D1/D2):
 *   - FLAT diagrams (no composite/concurrent states anywhere) route through
 *     the svek-faithful pipeline: ./state-dot-graph.ts builds a DotInputGraph
 *     with per-kind shapes/sizes (./state-sizing.ts) + minlen/labels, the
 *     shared dot layout engine positions it, and this file maps positions
 *     back to StateNodeGeo/TransitionGeo.
 *   - Diagrams containing ANY composite (`children.length > 0`) or
 *     concurrent-region (`concurrentRegions.length > 0`) state anywhere
 *     route through the composite pipeline (T4, mechanisms.md §2/§3):
 *     ./state-composite-pass.ts classifies every composite as autonom (its
 *     own child svek pass, dumped bottom-up before its container, flattened
 *     to a fixed-size leaf) or non-autonom (stays a nested `Cluster` inside
 *     whichever pass reaches it), and ./state-composite-geo.ts maps the
 *     resulting passes' positions back to StateNodeGeo/TransitionGeo.
 * Mixing pipelines within one diagram is deliberately avoided: a top-level
 * composite check decides the WHOLE diagram's pipeline (`hasAnyComposite`).
 */

import type { StateDiagramAST, State } from './ast.js';
import { hasLocalContent } from './state-composite-detect.js';
import { filterRemovedEntities } from './state-directives.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import { layoutGraph as layout } from '../../core/graph-layout.js';
import type { DotLayoutResult } from '../../core/graph-layout.js';
import { buildDotGraph, INITIAL_ID, FINAL_ID } from './state-dot-graph.js';
import { layoutComposite } from './state-composite-geo.js';
import { attachTransitionLabel } from './state-transition-label.js';
import type { StateNodeGeo, TransitionGeo, StateGeometry } from './state-geo-types.js';

export type { StateNodeGeo, TransitionGeo, StateGeometry } from './state-geo-types.js';
import { computeStateDocumentDims, computeStateInkShift } from './layout-ink-extent.js';

/** A state (or top-level ast) is composite-free iff no state anywhere has
 *  local content (`hasLocalContent`, state-composite-detect.ts) OR its OWN
 *  scope-declared transitions — since every real composite is always an
 *  entry inside a parent's children/regions arrays, a clean top-level scan
 *  is sufficient (no deeper state can exist without a composite ancestor,
 *  and no deeper state's `.transitions` can be non-empty without that same
 *  ancestor already having `children.length > 0`). Plain `children.length >
 *  0` alone is NOT sufficient (mission A4 Phase L iter 5): a `'[*]'`-only
 *  inner scope produces zero AST children (see `hasLocalContent`'s doc for
 *  the full mechanism and the fixtures that first exposed it). `s.transitions
 *  .length > 0` alone (mission A4 Phase L iter 6, link-hoisting doc) catches
 *  a further gap: a state whose ONLY content is a REGULAR (non-`'[*]'`)
 *  transition to/from an entity declared elsewhere (`state A { A --> B }`,
 *  zageca-24-zino008, where BOTH `A` and `B` also collapse to plain leaves
 *  via `hasLocalContent`) still needs the composite pipeline's
 *  `sweepOrphanEdges` (state-composite-pass.ts) to reattribute that
 *  transition to its true home pass — the FLAT pipeline's
 *  `buildFlatTransitionGeos` only ever reads `ast.transitions` (the
 *  diagram's own top scope), so a transition trapped in a leaf-fallback
 *  state's OWN `.transitions` array is invisible to it entirely. */
function hasAnyComposite(states: readonly State[]): boolean {
  return states.some((s) => hasLocalContent(s) || s.transitions.length > 0);
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** mission G4 S1, mechanism 4: shifts EVERY state/transition position by
 *  a uniform `(dx, dy)` (`layout-ink-extent.ts#computeStateInkShift`, the
 *  SAME `SvekResult#calculateDimension` `moveDelta` mechanism `class/
 *  layout.ts#shiftClassifierGeo`'s own precedent already ports for class)
 *  so the diagram's own ink extent lands at jar's `(6, 6)` origin, and
 *  replaces the raw dot-layout `totalWidth`/`totalHeight` with the real
 *  `SvekResult`/`TextBlockExporter`/`SvgGraphics` document-dimension
 *  formula (`computeStateDocumentDims`) instead of dot's own unrelated
 *  layout-margin convention. */
function shiftStateNode(g: StateNodeGeo, dx: number, dy: number): StateNodeGeo {
  return { ...g, x: g.x + dx, y: g.y + dy, children: g.children.map((c) => shiftStateNode(c, dx, dy)) };
}

function shiftStateTransition(t: TransitionGeo, dx: number, dy: number): TransitionGeo {
  return {
    ...t,
    points: t.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    ...(t.label !== undefined ? { label: { ...t.label, x: t.label.x + dx, y: t.label.y + dy } } : {}),
  };
}

function applyStateDocumentMargin(geo: StateGeometry): StateGeometry {
  const dims = computeStateDocumentDims(geo.states, geo.transitions);
  const shift = computeStateInkShift(geo.states, geo.transitions);
  return {
    totalWidth: dims.width,
    totalHeight: dims.height,
    states: geo.states.map((n) => shiftStateNode(n, shift.dx, shift.dy)),
    transitions: geo.transitions.map((t) => shiftStateTransition(t, shift.dx, shift.dy)),
  };
}

export function layoutState(
  ast: StateDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): StateGeometry {
  // remove/restore exclusion at the layout-input boundary -- the port's
  // equivalent of upstream's export-time isRemoved() skips. Same object
  // back when no remove directives exist (the common path); everything
  // below sees only the surviving entities.
  const effAst = filterRemovedEntities(ast);

  if (effAst.states.length === 0 && effAst.transitions.length === 0) {
    return { totalWidth: 0, totalHeight: 0, states: [], transitions: [] };
  }

  const raw = !hasAnyComposite(effAst.states)
    ? layoutFlat(effAst, theme, measurer)
    : layoutComposite(effAst, theme, measurer);

  return applyStateDocumentMargin(raw);
}

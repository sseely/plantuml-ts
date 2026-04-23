/**
 * State diagram layout engine.
 *
 * Converts a StateDiagramAST into absolute pixel coordinates using the
 * synchronous dot layout engine for node placement and edge routing.
 *
 * Architecture:
 *   D3 — Uses the shared dot layout engine (layout) for placement.
 *   D4 — Nodes are pre-measured before calling layout.
 *   D5 — Composite states are flattened; bounds are computed from children.
 */

import type { StateDiagramAST, State, Transition, StateKind } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { FontSpec, StringMeasurer } from '../../core/measurer.js';
import { layout } from '../../core/dot/index.js';
import type { DotInputNode, DotInputEdge } from '../../core/dot/types.js';

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

// ---------------------------------------------------------------------------
// Node sizing constants
// ---------------------------------------------------------------------------

/** Fixed dimensions for pseudostates that don't require text measurement. */
const PSEUDOSTATE_SIZES: Readonly<
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
};

/** Padding around children inside a composite state. */
const COMPOSITE_PAD = 16;
/** Extra top padding inside a composite state (for the title bar). */
const COMPOSITE_TOP_PAD = 28;

// ---------------------------------------------------------------------------
// Synthetic node ids for [*] pseudostates
// ---------------------------------------------------------------------------

const INITIAL_ID = '__initial__';
const FINAL_ID = '__final__';

// ---------------------------------------------------------------------------
// Helpers: node sizing
// ---------------------------------------------------------------------------

/**
 * Compute the dot node dimensions for a state given the theme and measurer.
 * Pseudostates use fixed sizes; normal states are measured from their display
 * label.
 */
function measureState(
  state: State,
  theme: Theme,
  measurer: StringMeasurer,
): { width: number; height: number } {
  if (state.kind !== 'normal') {
    return PSEUDOSTATE_SIZES[state.kind];
  }
  const fontSpec: FontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const measured = measurer.measure(state.display, fontSpec);
  return {
    width: Math.max(80, measured.width + 20),
    height: theme.fontSize * 1.4 + 16,
  };
}

// ---------------------------------------------------------------------------
// Helpers: [*] pseudostate handling
// ---------------------------------------------------------------------------

/**
 * Determine which synthetic pseudostate ids are needed based on transitions
 * that reference '[*]'. Returns the effective source/target id to use in the
 * dot edge.
 *
 * Logic:
 *  - Transitions with from='[*]' → initial pseudostate (INITIAL_ID)
 *  - Transitions with to='[*]'   → final pseudostate (FINAL_ID)
 */
function resolvePseudostateIds(transitions: readonly Transition[]): {
  needsInitial: boolean;
  needsFinal: boolean;
} {
  let needsInitial = false;
  let needsFinal = false;
  for (const t of transitions) {
    if (t.from === '[*]') needsInitial = true;
    if (t.to === '[*]') needsFinal = true;
  }
  return { needsInitial, needsFinal };
}

/**
 * Resolve '[*]' in a transition endpoint to the appropriate synthetic id.
 */
function resolveEndpoint(
  id: string,
  context: 'from' | 'to',
): string {
  if (id !== '[*]') return id;
  return context === 'from' ? INITIAL_ID : FINAL_ID;
}

// ---------------------------------------------------------------------------
// Helpers: transition label
// ---------------------------------------------------------------------------

/**
 * Build the effective label text from a Transition (may be undefined).
 */
function transitionLabelText(t: Transition): string | undefined {
  if (t.label !== undefined) return t.label;
  if (t.guard !== undefined && t.action !== undefined) {
    return `[${t.guard}] / ${t.action}`;
  }
  if (t.guard !== undefined) return `[${t.guard}]`;
  if (t.action !== undefined) return `/ ${t.action}`;
  return undefined;
}

// ---------------------------------------------------------------------------
// Helpers: collect leaf states for layout
// ---------------------------------------------------------------------------

/**
 * Collect all leaf states (states with no children) as flat DotInputNodes.
 * Composite states are NOT added as nodes; their bounds are derived from
 * their children after layout.
 */
function collectLeafNodes(
  states: readonly State[],
  theme: Theme,
  measurer: StringMeasurer,
  result: DotInputNode[],
): void {
  for (const s of states) {
    if (s.children.length === 0) {
      const { width, height } = measureState(s, theme, measurer);
      result.push({ id: s.id, width, height });
    } else {
      // Composite: recurse into children only.
      collectLeafNodes(s.children, theme, measurer, result);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers: build StateNodeGeo tree from layout result
// ---------------------------------------------------------------------------

type PosMap = Map<string, { x: number; y: number; width: number; height: number }>;

/**
 * Build a StateNodeGeo for a leaf state from the position map.
 */
function buildLeafGeo(
  state: State,
  posMap: PosMap,
): StateNodeGeo | null {
  const pos = posMap.get(state.id);
  if (pos === undefined) return null;
  return {
    id: state.id,
    kind: state.kind,
    display: state.display,
    x: pos.x,
    y: pos.y,
    width: pos.width,
    height: pos.height,
    children: [],
  };
}

/**
 * Build StateNodeGeo for a composite state by computing bounding box from
 * children positions, then recursively building child geos.
 */
function buildCompositeGeo(
  state: State,
  posMap: PosMap,
): StateNodeGeo | null {
  // Recursively build child geos first.
  const childGeos: StateNodeGeo[] = [];
  for (const child of state.children) {
    const childGeo =
      child.children.length === 0
        ? buildLeafGeo(child, posMap)
        : buildCompositeGeo(child, posMap);
    if (childGeo !== null) {
      childGeos.push(childGeo);
    }
  }

  if (childGeos.length === 0) {
    // No children resolved — fall back to a default position.
    return {
      id: state.id,
      kind: state.kind,
      display: state.display,
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      children: [],
    };
  }

  // Compute bounding box of children.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cg of childGeos) {
    minX = Math.min(minX, cg.x);
    minY = Math.min(minY, cg.y);
    maxX = Math.max(maxX, cg.x + cg.width);
    maxY = Math.max(maxY, cg.y + cg.height);
  }

  const x = minX - COMPOSITE_PAD;
  const y = minY - COMPOSITE_TOP_PAD;
  const width = maxX - minX + COMPOSITE_PAD * 2;
  const height = maxY - minY + COMPOSITE_TOP_PAD + COMPOSITE_PAD;

  return {
    id: state.id,
    kind: state.kind,
    display: state.display,
    x,
    y,
    width,
    height,
    children: childGeos,
  };
}

/**
 * Build a StateNodeGeo from either a leaf or composite state.
 */
function buildStateNodeGeo(
  state: State,
  posMap: PosMap,
): StateNodeGeo | null {
  if (state.children.length === 0) {
    return buildLeafGeo(state, posMap);
  }
  return buildCompositeGeo(state, posMap);
}

/**
 * Build StateNodeGeo for a synthetic pseudostate (INITIAL_ID / FINAL_ID).
 */
function buildSyntheticGeo(
  id: string,
  posMap: PosMap,
): StateNodeGeo | null {
  const pos = posMap.get(id);
  if (pos === undefined) return null;
  const kind: StateKind = id === INITIAL_ID ? 'initial' : 'final';
  return {
    id,
    kind,
    display: '',
    x: pos.x,
    y: pos.y,
    width: pos.width,
    height: pos.height,
    children: [],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lay out a StateDiagramAST using the dot layout engine, returning absolute
 * pixel coordinates for all states and transitions.
 *
 * Composite states are flattened for layout purposes; their bounds are
 * computed from child positions after layout completes.
 *
 * @param ast      - Parsed state diagram AST.
 * @param theme    - Visual theme for font/sizing values.
 * @param measurer - Text measurement strategy.
 */
export function layoutState(
  ast: StateDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): StateGeometry {
  // Empty diagram fast-path.
  if (ast.states.length === 0 && ast.transitions.length === 0) {
    return { totalWidth: 0, totalHeight: 0, states: [], transitions: [] };
  }

  // -------------------------------------------------------------------------
  // Step 1: Collect leaf DotInputNodes from AST states
  // -------------------------------------------------------------------------

  const dotNodes: DotInputNode[] = [];
  collectLeafNodes(ast.states, theme, measurer, dotNodes);

  // -------------------------------------------------------------------------
  // Step 2: Inject synthetic nodes for [*] pseudostates
  // -------------------------------------------------------------------------

  const { needsInitial, needsFinal } = resolvePseudostateIds(ast.transitions);

  if (needsInitial) {
    const { width, height } = PSEUDOSTATE_SIZES.initial;
    dotNodes.push({ id: INITIAL_ID, width, height });
  }

  if (needsFinal) {
    const { width, height } = PSEUDOSTATE_SIZES.final;
    dotNodes.push({ id: FINAL_ID, width, height });
  }

  // -------------------------------------------------------------------------
  // Step 3: Build dot edges from AST transitions
  // -------------------------------------------------------------------------

  const dotEdges: DotInputEdge[] = ast.transitions.map((t, i) => ({
    id: `edge-${i.toString()}`,
    from: resolveEndpoint(t.from, 'from'),
    to: resolveEndpoint(t.to, 'to'),
  }));

  // -------------------------------------------------------------------------
  // Step 4: Run dot layout (synchronous)
  // -------------------------------------------------------------------------

  const result = layout({
    nodes: dotNodes,
    edges: dotEdges,
    rankDir: 'TB',
    nodeSep: 36,
    rankSep: 48,
  });

  // -------------------------------------------------------------------------
  // Step 5: Build position map from layout result
  // -------------------------------------------------------------------------

  const posMap: PosMap = new Map(result.nodes.map((n) => [n.id, n]));

  // -------------------------------------------------------------------------
  // Step 6: Convert layout output to StateNodeGeo tree
  // -------------------------------------------------------------------------

  const states: StateNodeGeo[] = [];

  // Root-level AST states (non-synthetic).
  for (const s of ast.states) {
    const geo = buildStateNodeGeo(s, posMap);
    if (geo !== null) {
      states.push(geo);
    }
  }

  // Synthetic pseudostate nodes (initial / final).
  if (needsInitial) {
    const geo = buildSyntheticGeo(INITIAL_ID, posMap);
    if (geo !== null) states.push(geo);
  }
  if (needsFinal) {
    const geo = buildSyntheticGeo(FINAL_ID, posMap);
    if (geo !== null) states.push(geo);
  }

  // -------------------------------------------------------------------------
  // Step 7: Build TransitionGeo list from dot edge output
  // -------------------------------------------------------------------------

  const edgePosMap = new Map(result.edges.map((e) => [e.id, e]));

  const transitions: TransitionGeo[] = ast.transitions
    .map((t, i) => {
      const edgeResult = edgePosMap.get(`edge-${i.toString()}`);
      if (edgeResult === undefined) return null;

      const geo: TransitionGeo = {
        from: t.from,
        to: t.to,
        points: edgeResult.points,
      };

      const labelText = transitionLabelText(t);
      if (labelText !== undefined && edgeResult.points.length > 0) {
        // Place label at midpoint of the edge path.
        const mid = Math.floor(edgeResult.points.length / 2);
        const midPt = edgeResult.points[mid] ?? edgeResult.points[0];
        if (midPt !== undefined) {
          geo.label = { text: labelText, x: midPt.x, y: midPt.y };
        }
      }

      return geo;
    })
    .filter((t): t is TransitionGeo => t !== null);

  // -------------------------------------------------------------------------
  // Step 8: Compute total bounds
  // -------------------------------------------------------------------------

  // For composite states, the layout result width/height may not account for
  // their expanded bounding boxes. Recompute total bounds from all state geos.
  let totalWidth = result.width;
  let totalHeight = result.height;

  for (const s of states) {
    totalWidth = Math.max(totalWidth, s.x + s.width + 12);
    totalHeight = Math.max(totalHeight, s.y + s.height + 12);
  }

  return {
    totalWidth,
    totalHeight,
    states,
    transitions,
  };
}

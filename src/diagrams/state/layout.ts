/**
 * State diagram layout engine.
 *
 * Converts a StateDiagramAST into absolute pixel coordinates using ELK for
 * node placement and edge routing.
 *
 * Architecture:
 *   D3 — Uses the shared ELK adapter (runLayout) for layout.
 *   D4 — Nodes are pre-measured before calling ELK.
 *   D5 — Composite states map to ELK compound/parent nodes.
 */

import type { StateDiagramAST, State, Transition, StateKind } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { FontSpec, StringMeasurer } from '../../core/measurer.js';
import {
  runLayout,
  type ElkInputNode,
  type ElkInputEdge,
  type ElkOutputNode,
  type ElkOutputEdge,
} from '../../core/elk-adapter.js';

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
// ELK layout options
// ---------------------------------------------------------------------------

const LAYOUT_OPTIONS: Record<string, string> = {
  algorithm: 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '40',
  'elk.spacing.nodeNode': '25',
  'elk.edgeRouting': 'POLYLINE',
};

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

// ---------------------------------------------------------------------------
// Synthetic node ids for [*] pseudostates
// ---------------------------------------------------------------------------

const INITIAL_ID = '__initial__';
const FINAL_ID = '__final__';

// ---------------------------------------------------------------------------
// Helpers: node sizing
// ---------------------------------------------------------------------------

/**
 * Compute the ELK node dimensions for a state given the theme and measurer.
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

/**
 * Build an ElkInputNode (possibly with children for composite states).
 */
function buildElkNode(
  state: State,
  theme: Theme,
  measurer: StringMeasurer,
): ElkInputNode {
  const { width, height } = measureState(state, theme, measurer);
  const node: ElkInputNode = { id: state.id, width, height };

  if (state.children.length > 0) {
    node.children = state.children.map((child) =>
      buildElkNode(child, theme, measurer),
    );
  }

  return node;
}

// ---------------------------------------------------------------------------
// Helpers: [*] pseudostate handling
// ---------------------------------------------------------------------------

/**
 * Determine which synthetic pseudostate ids are needed based on transitions
 * that reference '[*]'. Returns the effective source/target id to use in the
 * ELK edge.
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
// Helpers: ELK output → StateNodeGeo
// ---------------------------------------------------------------------------

/**
 * Build a flat id → State map from the AST for quick lookup.
 */
function buildStateMap(states: readonly State[]): Map<string, State> {
  const map = new Map<string, State>();
  for (const s of states) {
    map.set(s.id, s);
    for (const [, child] of buildStateMap(s.children)) {
      map.set(child.id, child);
    }
  }
  return map;
}

/**
 * Convert an ElkOutputNode into a StateNodeGeo, resolving absolute
 * coordinates by adding the parent's absolute position.
 *
 * @param node    - ELK output node (child positions are relative to parent).
 * @param stateMap - Map from id to the original AST State.
 * @param offsetX  - Absolute x offset (parent's absolute x for children).
 * @param offsetY  - Absolute y offset (parent's absolute y for children).
 */
function buildStateNodeGeo(
  node: ElkOutputNode,
  stateMap: Map<string, State>,
  offsetX: number,
  offsetY: number,
): StateNodeGeo {
  const absX = offsetX + node.x;
  const absY = offsetY + node.y;

  // Resolve kind/display from the state map, or fall back to synthetic nodes.
  const astState = stateMap.get(node.id);
  let kind: StateKind;
  let display: string;

  if (astState !== undefined) {
    kind = astState.kind;
    display = astState.display;
  } else if (node.id === INITIAL_ID) {
    kind = 'initial';
    display = '';
  } else {
    // FINAL_ID or unknown
    kind = 'final';
    display = '';
  }

  const children: StateNodeGeo[] = (node.children ?? []).map((child) =>
    buildStateNodeGeo(child, stateMap, absX, absY),
  );

  return { id: node.id, kind, display, x: absX, y: absY, width: node.width, height: node.height, children };
}

// ---------------------------------------------------------------------------
// Helpers: ELK edge output → TransitionGeo
// ---------------------------------------------------------------------------

/**
 * Extract ordered waypoints from all sections of an ELK output edge.
 */
function extractPoints(
  edge: ElkOutputEdge,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (const section of edge.sections) {
    points.push(section.startPoint);
    if (section.bendPoints !== undefined) {
      for (const bp of section.bendPoints) {
        points.push(bp);
      }
    }
    points.push(section.endPoint);
  }
  return points;
}

/**
 * Build a TransitionGeo from an ELK output edge and the original Transition.
 */
function buildTransitionGeo(
  elkEdge: ElkOutputEdge,
  transition: Transition,
): TransitionGeo {
  const points = extractPoints(elkEdge);

  const geo: TransitionGeo = {
    from: transition.from,
    to: transition.to,
    points,
  };

  // Apply edge label position if ELK placed one.
  const firstLabel = elkEdge.labels?.[0];
  if (firstLabel !== undefined) {
    const labelText = transitionLabelText(transition) ?? firstLabel.text;
    geo.label = { text: labelText, x: firstLabel.x, y: firstLabel.y };
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lay out a StateDiagramAST using ELK, returning absolute pixel coordinates
 * for all states and transitions.
 *
 * @param ast      - Parsed state diagram AST.
 * @param theme    - Visual theme for font/sizing values.
 * @param measurer - Text measurement strategy.
 */
export async function layoutState(
  ast: StateDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): Promise<StateGeometry> {
  // Empty diagram fast-path.
  if (ast.states.length === 0 && ast.transitions.length === 0) {
    return { totalWidth: 0, totalHeight: 0, states: [], transitions: [] };
  }

  const fontSpec: FontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const stateMap = buildStateMap(ast.states);

  // -------------------------------------------------------------------------
  // Step 1: Build ELK nodes from AST states
  // -------------------------------------------------------------------------

  const elkNodes: ElkInputNode[] = ast.states.map((s) =>
    buildElkNode(s, theme, measurer),
  );

  // -------------------------------------------------------------------------
  // Step 2: Inject synthetic nodes for [*] pseudostates
  // -------------------------------------------------------------------------

  const { needsInitial, needsFinal } = resolvePseudostateIds(ast.transitions);

  if (needsInitial) {
    const { width, height } = PSEUDOSTATE_SIZES.initial;
    elkNodes.push({ id: INITIAL_ID, width, height });
  }

  if (needsFinal) {
    const { width, height } = PSEUDOSTATE_SIZES.final;
    elkNodes.push({ id: FINAL_ID, width, height });
  }

  // -------------------------------------------------------------------------
  // Step 3: Build ELK edges from AST transitions
  // -------------------------------------------------------------------------

  const elkEdges: ElkInputEdge[] = ast.transitions.map((t, i) => {
    const sourceId = resolveEndpoint(t.from, 'from');
    const targetId = resolveEndpoint(t.to, 'to');
    const labelText = transitionLabelText(t);

    const edge: ElkInputEdge = {
      id: `edge-${i.toString()}`,
      sources: [sourceId],
      targets: [targetId],
    };

    if (labelText !== undefined) {
      const measured = measurer.measure(labelText, fontSpec);
      edge.labels = [
        {
          text: labelText,
          width: measured.width,
          height: theme.fontSize * 1.4,
        },
      ];
    }

    return edge;
  });

  // -------------------------------------------------------------------------
  // Step 4: Run ELK layout
  // -------------------------------------------------------------------------

  const result = await runLayout({
    nodes: elkNodes,
    edges: elkEdges,
    layoutOptions: LAYOUT_OPTIONS,
  });

  // -------------------------------------------------------------------------
  // Step 5: Convert ELK output to StateGeometry
  // -------------------------------------------------------------------------

  const states: StateNodeGeo[] = result.nodes.map((n) =>
    buildStateNodeGeo(n, stateMap, 0, 0),
  );

  const transitions: TransitionGeo[] = result.edges
    .map((elkEdge, i) => {
      const transition = ast.transitions[i];
      if (transition === undefined) return null;
      return buildTransitionGeo(elkEdge, transition);
    })
    .filter((t): t is TransitionGeo => t !== null);

  return {
    totalWidth: result.width,
    totalHeight: result.height,
    states,
    transitions,
  };
}

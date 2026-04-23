/**
 * State diagram layout engine.
 *
 * Each composite state is pre-measured via a recursive inner layout, then
 * placed as a single atomic node in the outer layout. [*] pseudostates are
 * scoped to each layout level, preventing inner pseudostates from merging
 * with outer ones.
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
// Constants
// ---------------------------------------------------------------------------

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

const COMPOSITE_PAD = 20;
const COMPOSITE_TOP_PAD = 32;
const NODE_SEP = 36;
const RANK_SEP = 48;
const LAYOUT_MARGIN = 12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    width: Math.max(80, measured.width + 24),
    height: theme.fontSize * 1.4 + 20,
  };
}

function transitionLabelText(t: Transition): string | undefined {
  if (t.label !== undefined) return t.label;
  if (t.guard !== undefined && t.action !== undefined) {
    return `[${t.guard}] / ${t.action}`;
  }
  if (t.guard !== undefined) return `[${t.guard}]`;
  if (t.action !== undefined) return `/ ${t.action}`;
  return undefined;
}

function shiftGeo(geo: StateNodeGeo, dx: number, dy: number): StateNodeGeo {
  return {
    ...geo,
    x: geo.x + dx,
    y: geo.y + dy,
    children: geo.children.map((c) => shiftGeo(c, dx, dy)),
  };
}

function shiftTransition(t: TransitionGeo, dx: number, dy: number): TransitionGeo {
  return {
    ...t,
    points: t.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    ...(t.label !== undefined
      ? { label: { ...t.label, x: t.label.x + dx, y: t.label.y + dy } }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Recursive level layout
// ---------------------------------------------------------------------------

interface LevelResult {
  nodeGeos: StateNodeGeo[];
  transitionGeos: TransitionGeo[];
  width: number;
  height: number;
}

/**
 * Lay out one level of the state hierarchy.
 *
 * @param states      - States at this level (may include composites).
 * @param transitions - Transitions at this level (not inner ones).
 * @param theme       - Theme for measurement.
 * @param measurer    - Text measurer.
 * @param scopeId     - Unique prefix for pseudostate ids; '' for top level.
 */
function layoutLevel(
  states: readonly State[],
  transitions: readonly Transition[],
  theme: Theme,
  measurer: StringMeasurer,
  scopeId: string,
): LevelResult {
  const initialId = scopeId !== '' ? `__init_${scopeId}` : '__initial__';
  const finalId = scopeId !== '' ? `__final_${scopeId}` : '__final__';

  // ── Step 1: Recursively lay out composites to get their intrinsic dimensions ──
  const innerResults = new Map<string, LevelResult>();
  for (const s of states) {
    if (s.children.length > 0) {
      const inner = layoutLevel(s.children, s.transitions, theme, measurer, s.id);
      innerResults.set(s.id, inner);
    }
  }

  // ── Step 2: Build dot nodes ──
  const dotNodes: DotInputNode[] = [];
  for (const s of states) {
    if (s.children.length > 0) {
      const inner = innerResults.get(s.id)!;
      dotNodes.push({
        id: s.id,
        width: inner.width + COMPOSITE_PAD * 2,
        height: inner.height + COMPOSITE_TOP_PAD + COMPOSITE_PAD,
      });
    } else {
      const dims = measureState(s, theme, measurer);
      dotNodes.push({ id: s.id, ...dims });
    }
  }

  // ── Step 3: Scope-local [*] pseudostates ──
  let needsInitial = false;
  let needsFinal = false;
  for (const t of transitions) {
    if (t.from === '[*]') needsInitial = true;
    if (t.to === '[*]') needsFinal = true;
  }
  if (needsInitial) {
    dotNodes.push({ id: initialId, ...PSEUDOSTATE_SIZES.initial });
  }
  if (needsFinal) {
    dotNodes.push({ id: finalId, ...PSEUDOSTATE_SIZES.final });
  }

  // ── Step 4: Dot edges ──
  const dotEdges: DotInputEdge[] = transitions.map((t, i) => ({
    id: `edge-${scopeId}-${i}`,
    from: t.from === '[*]' ? initialId : t.from,
    to: t.to === '[*]' ? finalId : t.to,
  }));

  // ── Step 5: Run layout ──
  if (dotNodes.length === 0) {
    return { nodeGeos: [], transitionGeos: [], width: 0, height: 0 };
  }

  const result = layout({
    nodes: dotNodes,
    edges: dotEdges,
    rankDir: 'TB',
    nodeSep: NODE_SEP,
    rankSep: RANK_SEP,
  });

  const posMap = new Map(result.nodes.map((n) => [n.id, n]));

  // ── Step 6: Normalize coordinates (non-negative) ──
  let minX = Infinity;
  let minY = Infinity;
  for (const n of result.nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
  }
  if (!isFinite(minX)) minX = 0;
  if (!isFinite(minY)) minY = 0;
  const normDx = LAYOUT_MARGIN - minX;
  const normDy = LAYOUT_MARGIN - minY;
  if (normDx !== 0 || normDy !== 0) {
    for (const n of result.nodes) {
      n.x += normDx;
      n.y += normDy;
    }
    for (const e of result.edges) {
      for (const p of e.points) {
        p.x += normDx;
        p.y += normDy;
      }
    }
  }

  // ── Step 7: Build node geos ──
  const nodeGeos: StateNodeGeo[] = [];
  // Accumulate inner transitions separately — never stored on nodeGeos
  const innerTransitionGeos: TransitionGeo[] = [];

  for (const s of states) {
    const pos = posMap.get(s.id);
    if (pos === undefined) continue;

    if (s.children.length > 0) {
      const inner = innerResults.get(s.id)!;
      const offsetX = pos.x + COMPOSITE_PAD;
      const offsetY = pos.y + COMPOSITE_TOP_PAD;

      const shiftedChildren = inner.nodeGeos.map((g) => shiftGeo(g, offsetX, offsetY));

      for (const t of inner.transitionGeos) {
        innerTransitionGeos.push(shiftTransition(t, offsetX, offsetY));
      }

      nodeGeos.push({
        id: s.id,
        kind: s.kind,
        display: s.display,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        children: shiftedChildren,
      });
    } else {
      nodeGeos.push({
        id: s.id,
        kind: s.kind,
        display: s.display,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        children: [],
      });
    }
  }

  // Pseudostate nodes
  if (needsInitial) {
    const pos = posMap.get(initialId);
    if (pos !== undefined) {
      nodeGeos.push({
        id: initialId,
        kind: 'initial',
        display: '',
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        children: [],
      });
    }
  }
  if (needsFinal) {
    const pos = posMap.get(finalId);
    if (pos !== undefined) {
      nodeGeos.push({
        id: finalId,
        kind: 'final',
        display: '',
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        children: [],
      });
    }
  }

  // ── Step 8: Build transition geos for this level ──
  const edgePosMap = new Map(result.edges.map((e) => [e.id, e]));
  const transitionGeos: TransitionGeo[] = [];

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i]!;
    const edgeResult = edgePosMap.get(`edge-${scopeId}-${i}`);
    if (edgeResult === undefined) continue;

    const geo: TransitionGeo = {
      from: t.from,
      to: t.to,
      points: edgeResult.points,
    };

    const labelText = transitionLabelText(t);
    if (labelText !== undefined && edgeResult.points.length >= 2) {
      const p0 = edgeResult.points[0]!;
      const p1 = edgeResult.points[edgeResult.points.length - 1]!;
      geo.label = {
        text: labelText,
        x: p0.x + (p1.x - p0.x) * 0.4,
        y: p0.y + (p1.y - p0.y) * 0.4,
      };
    }

    transitionGeos.push(geo);
  }

  // Merge in already-shifted inner transitions
  for (const t of innerTransitionGeos) {
    transitionGeos.push(t);
  }

  // Compute total bounds
  let maxX = result.width;
  let maxY = result.height;
  for (const g of nodeGeos) {
    maxX = Math.max(maxX, g.x + g.width + LAYOUT_MARGIN);
    maxY = Math.max(maxY, g.y + g.height + LAYOUT_MARGIN);
  }

  return { nodeGeos, transitionGeos, width: maxX, height: maxY };
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

  const levelResult = layoutLevel(ast.states, ast.transitions, theme, measurer, '');

  return {
    totalWidth: levelResult.width,
    totalHeight: levelResult.height,
    states: levelResult.nodeGeos,
    transitions: levelResult.transitionGeos,
  };
}

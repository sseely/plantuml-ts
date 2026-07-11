/**
 * Flat state-diagram DOT-graph construction.
 *
 * Builds the `DotInputGraph` (nodes + edges — no clusters; composites are
 * T4's concern) consumed by the shared dot layout engine from a
 * `StateDiagramAST` whose states carry no children/concurrentRegions
 * anywhere (verified by the caller, ./layout.ts's `hasAnyComposite` guard).
 * Split out of ./layout.ts to keep both files under the project's per-file
 * size cap — mirrors class engine's class-dot-graph.ts (D1, duplicate
 * consciously, do not extract a shared base).
 *
 * @see ~/git/plantuml/.../svek/GeneralImageBuilder.java (per-kind image dispatch)
 * @see ~/git/plantuml/.../statediagram/StateDiagram.java#getStart/getEnd (per-scope shared [*] anchor)
 * @see ~/git/plantuml/.../svek/SvekEdge.java (minlen = arrow length - 1)
 * @see ~/git/plantuml/.../svek/DotStringFactory.java (nodesep/ranksep floors + rankdir)
 */

import type { State, StateDiagramAST, Transition } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { DotInputGraph, DotInputNode, DotInputEdge } from '../../core/graph-layout.js';
import { measureState, CIRCLE_START_SIZE, CIRCLE_END_SIZE } from './state-sizing.js';

// ---------------------------------------------------------------------------
// [*] pseudostate anchors — one shared start/end node per (flat) diagram,
// mirroring StateDiagram#getStart/getEnd's per-scope quark caching.
// ---------------------------------------------------------------------------

export const INITIAL_ID = '__initial__';
export const FINAL_ID = '__final__';

/** Resolve a transition endpoint id, redirecting the anonymous `[*]` token
 *  to the shared start (`from` position) or end (`to` position) anchor. */
function endpointId(raw: string, isFrom: boolean): string {
  if (raw !== '[*]') return raw;
  return isFrom ? INITIAL_ID : FINAL_ID;
}

function usesInitial(transitions: readonly Transition[]): boolean {
  return transitions.some((t) => t.from === '[*]');
}

function usesFinal(transitions: readonly Transition[]): boolean {
  return transitions.some((t) => t.to === '[*]');
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

function buildStateNode(
  state: State,
  hideEmptyDescription: boolean,
  theme: Theme,
  measurer: StringMeasurer,
  rankdir: 'TB' | 'LR',
): DotInputNode {
  const measured = measureState(state, hideEmptyDescription, theme, measurer, rankdir);
  return { id: state.id, width: measured.width, height: measured.height, shape: measured.shape };
}

function buildDotNodes(
  ast: StateDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
  rankdir: 'TB' | 'LR',
): DotInputNode[] {
  const hideEmptyDescription = ast.hideEmptyDescription ?? false;
  const nodes = ast.states.map((s) => buildStateNode(s, hideEmptyDescription, theme, measurer, rankdir));
  if (usesInitial(ast.transitions)) {
    nodes.push({ id: INITIAL_ID, width: CIRCLE_START_SIZE, height: CIRCLE_START_SIZE, shape: 'circle' });
  }
  if (usesFinal(ast.transitions)) {
    nodes.push({ id: FINAL_ID, width: CIRCLE_END_SIZE, height: CIRCLE_END_SIZE, shape: 'circle' });
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

/** Guard/action/plain label text for a transition — same precedence as the
 *  legacy layout code (kept here so both the flat and composite paths agree
 *  on label text derivation; ./layout.ts re-exports it for the legacy path). */
export function transitionLabelText(t: Transition): string | undefined {
  if (t.label !== undefined) return t.label;
  if (t.guard !== undefined && t.action !== undefined) return `[${t.guard}] / ${t.action}`;
  if (t.guard !== undefined) return `[${t.guard}]`;
  if (t.action !== undefined) return `/ ${t.action}`;
  return undefined;
}

/** Edge label attrs (HTML-table label, svek convention — mirrors class
 *  engine's edgeLabelAttrs). Widths/heights are measured but tolerant: the
 *  DOT-parity comparator only checks label PRESENCE, not pixel size. */
function edgeLabelAttrs(
  t: Transition,
  font: { family: string; size: number },
  measurer: StringMeasurer,
): NonNullable<DotInputEdge['attributes']> {
  const text = transitionLabelText(t);
  if (text === undefined) return {};
  const m = measurer.measure(text, font);
  return { label: text, labelWidth: m.width, labelHeight: m.height };
}

function buildDotEdges(
  ast: StateDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): DotInputEdge[] {
  const font = { family: theme.fontFamily, size: theme.fontSize };
  return ast.transitions.map((t, i) => ({
    id: `edge-${i}`,
    from: endpointId(t.from, true),
    to: endpointId(t.to, false),
    // minlen = arrow dash-count - 1 (SvekEdge.java) — shared convention with
    // class/object, not state-specific (mechanisms.md §4).
    attributes: { minLen: (t.length ?? 2) - 1, ...edgeLabelAttrs(t, font, measurer) },
  }));
}

// ---------------------------------------------------------------------------
// Graph attrs
// ---------------------------------------------------------------------------

/** nodesep=35pt / ranksep=60pt floors (DotStringFactory.java) — same floors
 *  as class/object, applied via the shared emitter's resolveSep; explicit
 *  skinparam overrides skip the floor (mirrors class-dot-graph.ts's sepAttrs). */
function sepAttrs(theme: Theme): Partial<DotInputGraph> {
  return {
    nodeSep: theme.nodeSep ?? 35,
    rankSep: theme.rankSep ?? 60,
    ...(theme.nodeSep !== undefined ? { nodeSepExplicit: true } : {}),
    ...(theme.rankSep !== undefined ? { rankSepExplicit: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the flat-diagram DOT input graph. Caller (./layout.ts) guarantees no
 * state in `ast` carries children/concurrentRegions — composites route
 * through the legacy path until T4 lands child passes + cluster envelopes.
 */
export function buildDotGraph(
  ast: StateDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): DotInputGraph {
  const rankdir: 'TB' | 'LR' = ast.rankdir === 'left-to-right' ? 'LR' : 'TB';
  return {
    nodes: buildDotNodes(ast, theme, measurer, rankdir),
    edges: buildDotEdges(ast, theme, measurer),
    rankDir: rankdir,
    ...sepAttrs(theme),
  };
}

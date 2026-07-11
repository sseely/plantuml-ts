/**
 * Autonom ("autarkic") predicate — mission A4/T4, mechanisms.md §3.
 *
 * @see ~/git/plantuml/.../abel/Entity.java#isAutarkic (:690-715)
 * @see ~/git/plantuml/.../abel/EntityUtils.java#isPureInnerLink3 (:76-88)
 * @see ~/git/plantuml/.../dot/CucaDiagramSimplifierState.java (bottom-up
 *      driver loop — our recursion in ./state-composite-layout.ts achieves
 *      the same dump order structurally, see that file's module doc)
 */

import type { State } from './ast.js';
import { isBorderPoint } from './state-entity-position.js';

/** All descendant ids of `state` (children recursively + concurrent-region
 *  members recursively) — NOT including `state.id` itself (isPureInnerLink3
 *  checks LEAF containers, and the group's own id is never "inside its own
 *  subtree" for boundary purposes). */
export function subtreeIds(state: State): Set<string> {
  const ids = new Set<string>();
  const walk = (s: State): void => {
    ids.add(s.id);
    for (const c of s.children) walk(c);
    for (const region of s.concurrentRegions) for (const c of region) walk(c);
  };
  for (const c of state.children) walk(c);
  for (const region of state.concurrentRegions) for (const c of region) walk(c);
  return ids;
}

/** True iff any descendant (at any depth, including inside concurrent
 *  regions) is an entry/exit/pin border point — disqualifies autonom
 *  regardless of link topology (mechanisms.md §3, third bullet). */
export function hasBorderPointDescendant(state: State): boolean {
  const walk = (s: State): boolean => {
    if (isBorderPoint(s)) return true;
    if (s.children.some(walk)) return true;
    return s.concurrentRegions.some((region) => region.some(walk));
  };
  return state.children.some(walk) || state.concurrentRegions.some((r) => r.some(walk));
}

interface FlatLink {
  from: string;
  to: string;
}

/** Every transition in the WHOLE diagram, flattened (own-scope transitions
 *  of every composite, at every depth). Does NOT include the top-level
 *  scope's own transitions (`StateDiagramAST.transitions`) — those live
 *  outside any `State` node and must be supplied separately by the caller
 *  (see `./state-composite-classify.ts#classifyDiagram`'s
 *  `topLevelTransitions` parameter); `Entity.isAutarkic` iterates
 *  `this.diagram.getLinks()`, i.e. literally every link in the diagram
 *  regardless of the syntactic scope it was written in. */
export function collectAllTransitions(states: readonly State[]): FlatLink[] {
  const out: FlatLink[] = [];
  const walk = (s: State): void => {
    for (const t of s.transitions) out.push({ from: t.from, to: t.to });
    for (const c of s.children) walk(c);
    for (const region of s.concurrentRegions) for (const c of region) walk(c);
  };
  for (const s of states) walk(s);
  return out;
}

/**
 * Entity.isAutarkic: a composite is autonom iff every diagram link is "pure
 * inner" w.r.t. it AND no descendant is a border point.
 *
 * "Pure inner" (`EntityUtils.isPureInnerLink3`) compares, for each endpoint,
 * whether that endpoint's CONTAINER (its immediate enclosing group — for an
 * endpoint that IS `state` itself, that's `state`'s own PARENT, i.e.
 * outside `state`) is `state` or a descendant of `state`. A link is pure
 * inner iff both endpoints' containers agree (both inside-or-equal, or both
 * outside) — it disqualifies `state` exactly when it crosses the boundary,
 * one side in and the other out.
 *
 * `subtreeIds(state)` (descendants only, `state.id` itself excluded) is
 * exactly this "container inside-or-equal to state" test for ANY endpoint
 * id X, including X===state.id: a leaf/group's container is inside-or-equal
 * to `state` iff that leaf/group is itself somewhere in `state`'s subtree
 * (added by `subtreeIds`'s walk) — EXCEPT when X===state.id, whose
 * container is `state`'s own parent (outside), matching `subtreeIds`'
 * exclusion of `state.id`. So `fromIn`/`toIn` below need NO special case
 * for an endpoint that literally IS `state` — a link with one endpoint
 * equal to `state` and the other endpoint a genuine descendant (e.g.
 * `state A { A --> AInternal }`, bupani-17-puxi938) DOES disqualify (fromIn
 * false, toIn true — mismatch), while a true self-loop on the group itself
 * (`X --> X` where X===state.id) does NOT disqualify (fromIn===toIn===false
 * — both read as "outside", matching Java: both containers are the SAME
 * outside parent).
 *
 * `[*]` endpoints are always scope-local (each usage gets its own scoped
 * pseudostate entity, never a diagram-wide identity) so they never count as
 * crossing.
 *
 * PACKAGE-type groups and the CONCURRENT_STATE short-circuit (individual
 * `--`-region groups are ALWAYS autonom) are handled by the caller
 * (./state-composite-layout.ts) — this predicate covers the general STATE
 * group case only (the only GroupType our AST's `State.children`/
 * `concurrentRegions` composite node represents).
 */
export function isAutarkic(state: State, allTransitions: readonly FlatLink[]): boolean {
  if (hasBorderPointDescendant(state)) return false;
  const subtree = subtreeIds(state);
  for (const t of allTransitions) {
    if (t.from === '[*]' || t.to === '[*]') continue;
    const fromIn = subtree.has(t.from);
    const toIn = subtree.has(t.to);
    if (fromIn !== toIn) return false;
  }
  return true;
}

/** True iff some diagram link references `id` directly as an endpoint (the
 *  group entity itself, not a descendant) — `ClusterDotString`'s
 *  `thereALinkFromOrToGroup2`, drives the zaent anchor. */
export function isGroupTouched(id: string, allTransitions: readonly FlatLink[]): boolean {
  return allTransitions.some((t) => t.from === id || t.to === id);
}

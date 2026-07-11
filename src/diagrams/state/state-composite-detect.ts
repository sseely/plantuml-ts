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
 *  of every composite, at every depth, plus the top-level list the caller
 *  passes separately). Needed because isAutarkic is evaluated against the
 *  ENTIRE diagram's link set, not just `state`'s own subtree. */
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
 * inner" w.r.t. it (both endpoints inside its subtree, or both outside — a
 * link whose endpoint IS the group itself doesn't count as crossing, it's
 * handled by the zaent anchor mechanism instead) AND no descendant is a
 * border point. `[*]` endpoints are always scope-local (each usage gets its
 * own scoped pseudostate entity, never a diagram-wide identity) so they
 * never count as crossing.
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
    if (t.from === state.id || t.to === state.id) continue;
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

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

/**
 * True iff `state` (already a real composite -- a `{`/`begin` block was
 * opened for it) has at least one LOCAL child entity: a literal declared or
 * auto-created descendant, a concurrent region, or an inner transition
 * referencing `'[*]'` (which upstream materializes as a real scope-local
 * pseudostate CHILD -- `CommandLinkStateCommon`'s endpoint resolution
 * creates it as a genuine `LeafType.PSEUDO_STATE` entity, unlike our port's
 * `ensureState`, which deliberately never turns `'[*]'` into a `State` AST
 * node, mechanisms.md's `[*]`-is-scope-local convention -- so this predicate
 * re-derives the count from `s.transitions` instead).
 *
 * Mirrors `GroupMakerState.getImage()`'s literal leaf-fallback: `if
 * (group.countChildren() == 0 && group.groups().size() == 0) return new
 * EntityImageState(group);` (GroupMakerState.java:113-114) -- a composite
 * with ZERO real children collapses back to a plain leaf regardless of
 * whether it would otherwise be autonom or a cluster (a childless
 * composite's `subtreeIds()` is always empty, so it can only ever be
 * disqualified from autarkic BY a `[*]`-owned-in-its-own-scope link, which
 * itself requires a `[*]` transition and therefore already implies
 * `hasLocalContent` true -- a childless AND disqualified composite is
 * structurally impossible, so this single gate is safe to apply uniformly
 * before the autonom/cluster split, exactly where upstream's fallback
 * fires). Verified: `state s1 { s1 : text }` (gizati-67-kora187, description
 * line only, oracle-pinned EntityImageState 50x76 sizing -- NOT a wrapped
 * autonom box); `state A { A --> B }` where B is declared elsewhere
 * (figiza-55-migo973, zageca-24-zino008, pure external/self references
 * produce no local entity at all -- flat leaf boxes, no cluster/wrapper).
 * @see ~/git/plantuml/.../svek/GroupMakerState.java#getImage (:110-113)
 */
export function hasLocalContent(state: State): boolean {
  return (
    state.children.length > 0 ||
    state.concurrentRegions.length > 0 ||
    state.transitions.some((t) => t.from === '[*]' || t.to === '[*]')
  );
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

/** True iff `state` has at least one DIRECT child that is itself an
 *  entry/exit/pin border point -- narrower than `hasBorderPointDescendant`
 *  (which also counts border points nested inside descendant composites,
 *  relevant only to the autonom-disqualification predicate above). This is
 *  the `ClusterDotString`/`GroupMakerState` question "does THIS group's own
 *  `ee` rank-port block have anything to wrap?", which only ever looks at
 *  `state`'s immediate children (`Cluster.printRanks` iterates the group's
 *  own leaf members, never recurses into a nested cluster's members). */
export function hasDirectBorderPointChild(state: State): boolean {
  return state.children.some((c) => isBorderPoint(c));
}

/** True iff `state`'s own `ee` wrapper would render something OTHER than
 *  the zaent placeholder: a non-border direct child, a concurrent region, or
 *  a scope-local `'[*]'` pseudostate (mirrors `hasLocalContent`'s pseudo
 *  clause, minus the plain `children.length>0` arm which `hasLocalContent`
 *  cannot narrow to "non-border" without importing `isBorderPoint`). Used
 *  to gate the zaent POINT node itself (`ClusterDotString.java`'s trailing
 *  content-placeholder branch: "entityPositions>0 AND no port/added node
 *  exists" -- the "no port/added node exists" clause is exactly "this
 *  composite has no OTHER content"; a composite whose only children are
 *  border points needs the placeholder, one with real content does not,
 *  bujuta-44-rovo666/diteme-18-favi840 vs bitaxo-18-tamo974). */
export function hasNonBorderEeContent(state: State): boolean {
  return (
    state.children.some((c) => !isBorderPoint(c)) ||
    state.concurrentRegions.length > 0 ||
    state.transitions.some((t) => t.from === '[*]' || t.to === '[*]')
  );
}

interface FlatLink {
  from: string;
  to: string;
  /** Id of the composite whose OWN `.transitions` array this link came
   *  from; `undefined` for the diagram's top-level scope. Needed ONLY to
   *  resolve a `'[*]'` endpoint's container for `isAutarkic`'s boundary
   *  check below -- a scope-local pseudostate's container IS the scope
   *  that declared it, mirroring how a real auto-created child's container
   *  is implicitly `state`'s subtree membership (mission A4 Phase L
   *  iter 5). */
  scopeId?: string;
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
    for (const t of s.transitions) out.push({ from: t.from, to: t.to, scopeId: s.id });
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
 * pseudostate entity, never a diagram-wide identity), but that does NOT
 * mean they never count as crossing — a scope-local `[*]`'s CONTAINER is
 * the composite that WROTE the transition (`FlatLink.scopeId`), and that
 * container must go through the SAME inside/outside test as any other
 * endpoint (`pseudoIn` below, mission A4 Phase L iter 5, corrected from an
 * earlier unconditional `continue` that skipped the whole link — verified
 * wrong on cekavi-25-cija650: `state State1 { State1 --> [*] }` writes a
 * link whose real endpoint (`State1`, container = State1's own PARENT →
 * outside) crosses into the LOCAL final pseudostate it declares (container
 * = State1 itself → inside) — a genuine boundary crossing the blanket skip
 * hid, wrongly classifying State1 autonom instead of oracle's non-autonom
 * cluster-with-zaent-anchor).
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
  // A `[*]` endpoint's container is the scope that wrote it: inside iff
  // that scope IS `state` itself or a descendant of `state` (top-level
  // '[*]' transitions carry no scopeId, which is never `state.id` and
  // never in `subtree` — correctly "outside" any composite).
  const pseudoIn = (scopeId: string | undefined): boolean =>
    scopeId === state.id || (scopeId !== undefined && subtree.has(scopeId));
  for (const t of allTransitions) {
    const fromIn = t.from === '[*]' ? pseudoIn(t.scopeId) : subtree.has(t.from);
    const toIn = t.to === '[*]' ? pseudoIn(t.scopeId) : subtree.has(t.to);
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

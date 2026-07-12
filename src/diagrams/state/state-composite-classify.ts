/**
 * Whole-diagram composite classification (mission A4/T4) — computed ONCE up
 * front so any pass, at any depth, can resolve a transition endpoint without
 * re-walking the tree. Three outcomes per composite id:
 *   - 'leaf'    — not a composite (`hasLocalContent` false — see its doc,
 *                 state-composite-detect.ts, for why children.length alone
 *                 is unsafe);
 *   - 'autonom' — Entity.isAutarkic() true; gets its own child svek pass,
 *                 re-enters its container as a flattened leaf under its own
 *                 id (mechanisms.md §3);
 *   - 'cluster' — stays a nested `Cluster`; NOT directly addressable as an
 *                 edge endpoint (no single node represents it) — redirects
 *                 to its zaent anchor id (mechanisms.md §2/§4).
 */

import type { State } from './ast.js';
import {
  isAutarkic,
  collectAllTransitions,
  isGroupTouched,
  hasBorderPointDescendant,
  hasDirectBorderPointChild,
  hasNonBorderEeContent,
  hasLocalContent,
} from './state-composite-detect.js';
import { concurrentRegionScopeId } from './state-parse-state.js';

export type CompositeKind = 'leaf' | 'autonom' | 'cluster';

/**
 * One autarkic pass-firing unit (mission A4 Phase L iteration 19) — either a
 * whole 'autonom' composite (`state X { ... }`, re-enters its container as a
 * flattened leaf under `state.id`) or one `--`-delimited concurrent REGION
 * (a synthetic `GroupType.CONCURRENT_STATE` entity upstream, no `State` AST
 * node of its own in this port — `owner`/`regionIndex`/`members` carry
 * everything `buildConcurrentRegionPass` (./state-composite-concurrent.ts)
 * needs to build its pass and everything `concurrentRegionScopeId` needs to
 * key it into `ctx.resolvedRegions`). See `ClassifyResult.firingOrder`'s doc
 * below for the full ordering mechanism.
 */
export type FiringUnit =
  | { kind: 'composite'; id: string; state: State }
  | { kind: 'region'; id: string; owner: State; regionIndex: number; members: readonly State[] };

export interface ClassifyResult {
  kindOf: ReadonlyMap<string, CompositeKind>;
  /** ids whose `ee` rank-port block must be emitted at all: cluster
   *  composites with a link touching the group itself, OR a border-point
   *  descendant ANYWHERE in the subtree (mechanisms.md §2). Over-broad by
   *  design — `applyBorderPointRanks` (./state-composite-pass.ts) self-guards
   *  to a no-op when `s`'s own DIRECT children include no border point, so a
   *  composite whose only border point lives in a nested cluster child is
   *  harmlessly a no-op here; the nested child's OWN classify entry carries
   *  the real port block. */
  needsAnchor: ReadonlySet<string>;
  /** ids needing the zaent PLACEHOLDER POINT NODE itself — narrower than
   *  `needsAnchor`. `ClusterDotString.java`'s zaent branch fires on either:
   *  (1) `thereALinkFromOrToGroup2` — a link's endpoint IS the group entity
   *  itself, unconditionally (bemena-23-zebu249); or (2) "entityPositions>0
   *  AND no port/added node exists" — the placeholder is a FALLBACK for an
   *  otherwise-EMPTY `ee` wrapper, not something added alongside real
   *  content. A composite with DIRECT border-point children AND other real
   *  content (bujuta-44-rovo666: `entry1`/`entry2`/`exitA` alongside `sin`/
   *  `sin2`; diteme-18-favi840: `en1` alongside `A`/`B`/`C`/`[H]`) renders
   *  that real content in `ee` and needs NO placeholder; one with ONLY
   *  border-point children (bitaxo-18-tamo974: `state C { state d
   *  <<entrypoint>> }`, zero transitions) has nothing else to put there and
   *  DOES need it. */
  needsZaentPoint: ReadonlySet<string>;
  allTransitions: ReadonlyArray<{ from: string; to: string }>;
  /**
   * Global autarkic-pass FIRING order (mission A4 Phase L iteration 17,
   * extended iteration 19) — every 'autonom' composite AND every concurrent
   * (`--`-delimited) REGION in the WHOLE tree, deepest nesting level first,
   * source/declaration order as tie-break within a level. Mirrors
   * `CucaDiagramSimplifierState.getOrdered` (java:74-98): `getOrdered`
   * builds a breadth-first, per-parent-reversed level list then reverses
   * the WHOLE list once, which is provably equivalent (for any tree) to
   * "collect in plain preorder, then STABLE-sort by depth descending" —
   * at a fixed depth, preorder visit order and BFS-level visit order are
   * the same relative order (both equal lexicographic comparison of the
   * root-to-node child-index path). `Array.prototype.sort` is stable
   * (ES2019+), so a single preorder walk + one stable sort exactly
   * reproduces upstream's double-reversal without re-implementing the
   * LinkedHashSet bookkeeping.
   *
   * Iteration 19 (joleju-94-maru748): a concurrent region is ITS OWN
   * `Entity` upstream (`GroupType.CONCURRENT_STATE`, StateDiagram.java:204
   * `gotoGroup(..., GroupType.CONCURRENT_STATE)`), a DIRECT CHILD of the
   * owning composite (sibling to that composite's own region-0 content, NOT
   * nested inside it) — `Entity.isAutarkic` (abel/Entity.java:700-701)
   * short-circuits `GroupType.CONCURRENT_STATE` to `true` UNCONDITIONALLY,
   * before any link/leaf check, so every region participates in
   * `getOrdered`'s SAME global list as every composite, at the region's OWN
   * (true) depth — `owner.depth + 1`, exactly the depth of `owner`'s own
   * region-0 children (`walkClassify`'s `depth + 1` recursive call below),
   * since both are direct children of `owner` in the real entity tree. A
   * composite reached ONLY through a region is therefore `owner.depth + 2`
   * (the region's own depth, +1) — unchanged from iteration 17's formula,
   * which already got the MEMBER depth right; what iteration 17 missed was
   * a firing-order ENTRY for the region ENTITY itself. Without one, the
   * previous port fired an owning composite's ENTIRE region set (region-0's
   * own build LAST, each `--` region's build in declaration order before
   * it — mechanisms.md's ConcurrentStates doc) as ONE atomic bundle at the
   * composite's OWN (shallower) firing-order turn, which is WRONG whenever
   * two sibling composites reachable through DIFFERENT regions of a common
   * ancestor sit at the SAME absolute depth as each other's ancestor's OWN
   * region entities: one composite's region-0 build (bundled atomically)
   * lands one slot too early relative to a same-depth region belonging to
   * an ENTIRELY DIFFERENT composite elsewhere in the tree. Promoting each
   * region to its own firing-order entry — resolved by
   * `resolveAllAutonomPasses` into `ctx.resolvedRegions`
   * (./state-composite-pass.ts), keyed by `concurrentRegionScopeId` — and
   * having `buildConcurrentAutonomSpec` (./state-composite-concurrent.ts)
   * LOOK UP each region's already-resolved pass instead of building it
   * inline, fixes this: a composite's own region-0 build (still fired
   * INLINE as part of the composite's OWN entry — there is no separate
   * upstream Entity for region-0, it IS the composite's own direct content)
   * now naturally lands at the composite's TRUE depth, correctly
   * interleaved with every other same-depth entry tree-wide.
   * @see ~/git/plantuml/.../dot/CucaDiagramSimplifierState.java#getOrdered
   * @see ~/git/plantuml/.../abel/Entity.java#isAutarkic (CONCURRENT_STATE
   *      short-circuit, line 700-701)
   */
  firingOrder: readonly FiringUnit[];
}

/** One preorder-visited node en route to `firingOrder` -- carries a `depth`
 *  used ONLY for the final stable sort; preorder PUSH order (the array's own
 *  order before sorting) is the tie-break within a depth. */
interface DepthEntry {
  unit: FiringUnit;
  depth: number;
}

function walkClassify(
  states: readonly State[],
  allTransitions: readonly { from: string; to: string }[],
  kindOf: Map<string, CompositeKind>,
  needsAnchor: Set<string>,
  needsZaentPoint: Set<string>,
  depth: number,
  depthEntries: DepthEntry[],
): void {
  for (const s of states) {
    // `hasLocalContent`, not bare children.length -- mission A4 Phase L
    // iter 5, its doc (state-composite-detect.ts) has the full mechanism
    // (GroupMakerState.getImage()'s countChildren()==0 leaf fallback).
    const isComposite = hasLocalContent(s);
    if (!isComposite) {
      kindOf.set(s.id, 'leaf');
      continue;
    }
    // `autoPhantom` (mission A4 Phase L iter 10) mirrors upstream's
    // GroupType.PACKAGE -- Entity.isAutarkic's very first line
    // unconditionally disqualifies it, before any link analysis runs.
    const autonom = !s.autoPhantom && isAutarkic(s, allTransitions);
    kindOf.set(s.id, autonom ? 'autonom' : 'cluster');
    depthEntries.push({ unit: { kind: 'composite', id: s.id, state: s }, depth });
    // Children (and concurrent regions) MUST be classified before `s`'s own
    // `needsZaentPoint` check below -- `hasNonBorderEeContent` needs to know
    // whether each DIRECT child renders as a real SvekNode in `s`'s OWN pass
    // (leaf/autonom) or recurses into its own nested `Cluster` (cluster,
    // invisible to `Cluster#printCluster2`'s `added` tracking) -- see that
    // function's doc for the full mechanism (mission A4 Phase L iter 18,
    // temuxi-28-cega322).
    walkClassify(s.children, allTransitions, kindOf, needsAnchor, needsZaentPoint, depth + 1, depthEntries);
    // A `--`-delimited concurrent region is itself a distinct synthetic
    // GROUP entity upstream (`GroupType.CONCURRENT_STATE`,
    // StateDiagram.java:204 `gotoGroup(..., GroupType.CONCURRENT_STATE)`),
    // one level deeper than `s`; the region's own member states are ITS
    // children, one level deeper still -- so a composite reachable only
    // through a concurrent region sits at depth+2 relative to `s`, not
    // depth+1 (firingOrder's doc above). The region ENTITY itself (pushed
    // at depth+1, sibling to `s`'s own region-0 children, BEFORE recursing
    // into its members -- same preorder convention as `s`'s own push above)
    // is a mission A4 Phase L iteration 19 addition -- see firingOrder's doc
    // above for why a region needs its own firing-order entry at all.
    s.concurrentRegions.forEach((region, i) => {
      depthEntries.push({
        unit: { kind: 'region', id: concurrentRegionScopeId(s.id, i + 1), owner: s, regionIndex: i, members: region },
        depth: depth + 1,
      });
      walkClassify(region, allTransitions, kindOf, needsAnchor, needsZaentPoint, depth + 2, depthEntries);
    });
    if (!autonom) {
      const touched = isGroupTouched(s.id, allTransitions);
      // A composite disqualified from autonom by a border-point descendant
      // (anywhere in its subtree) needs its OWN `ee` block gated on here;
      // a composite disqualified by a crossing link needs it as the
      // link-touch anchor (thereALinkFromOrToGroup2). Either reason (or
      // both) is a single boolean the emitter's port-block gate cares about
      // (see needsAnchor's doc above for why the recursive check is safe).
      if (touched || hasBorderPointDescendant(s)) {
        needsAnchor.add(s.id);
      }
      // The POINT NODE itself is strictly narrower -- see needsZaentPoint's
      // doc above: only when there is no other content for `ee` to hold.
      if (touched || (hasDirectBorderPointChild(s) && !hasNonBorderEeContent(s, kindOf))) {
        needsZaentPoint.add(s.id);
      }
    }
  }
  // #lizard forgives -- linear per-composite classification loop, CCN well
  // under the cap; length is one straight-line branch per condition.
}

/**
 * `topLevelTransitions` is `StateDiagramAST.transitions` — links written at
 * the diagram's own top scope (outside every `state X { ... }` block) are a
 * SEPARATE field from any individual `State.transitions`, so
 * `collectAllTransitions(states)` alone never sees them.
 * `Entity.isAutarkic` (abel/Entity.java:702-704) iterates
 * `this.diagram.getLinks()` — literally every link in the diagram,
 * regardless of the syntactic scope it was declared in — so omitting the
 * top-level scope's own links under-counts crossing links and
 * over-classifies composites as autonom (verified on
 * desebo-47-maro096: every cross-composite link in that fixture is written
 * at top level, so without this parameter every composite in the diagram
 * was wrongly seen as having zero disqualifying links).
 */
export function classifyDiagram(
  states: readonly State[],
  topLevelTransitions: readonly { from: string; to: string }[] = [],
): ClassifyResult {
  const allTransitions = [...topLevelTransitions, ...collectAllTransitions(states)];
  const kindOf = new Map<string, CompositeKind>();
  const needsAnchor = new Set<string>();
  const needsZaentPoint = new Set<string>();
  const depthEntries: DepthEntry[] = [];
  walkClassify(states, allTransitions, kindOf, needsAnchor, needsZaentPoint, 1, depthEntries);
  // Stable sort (ES2019+) -- deepest first, preorder/declaration order as
  // tie-break within a depth (firingOrder's doc above proves equivalence
  // to getOrdered's BFS-per-level + double-reverse). A region unit is
  // ALWAYS included (Entity.isAutarkic's CONCURRENT_STATE short-circuit,
  // firingOrder's doc); a composite unit only when classified 'autonom'.
  const firingOrder = depthEntries
    .filter((e) => e.unit.kind === 'region' || kindOf.get(e.unit.id) === 'autonom')
    .sort((a, b) => b.depth - a.depth)
    .map((e) => e.unit);
  return { kindOf, needsAnchor, needsZaentPoint, allTransitions, firingOrder };
}

/** DOT id of a composite's synthetic point-anchor node (Svek's
 *  `Cluster.getSpecialPointId`, `"za" + group.getUid()`). */
export function zaentId(compositeId: string): string {
  return `__zaent_${compositeId}`;
}

/** Resolve a raw transition endpoint id to the id that actually appears as a
 *  DOT node in whichever pass contains it: itself (leaf/autonom-flattened)
 *  or its cluster's zaent anchor. `'[*]'` is resolved separately (scope
 *  local) by the caller — see ./state-composite-pass.ts. */
export function resolveEndpoint(id: string, classify: ClassifyResult): string {
  return classify.kindOf.get(id) === 'cluster' ? zaentId(id) : id;
}

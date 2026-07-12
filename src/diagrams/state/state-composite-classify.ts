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

export type CompositeKind = 'leaf' | 'autonom' | 'cluster';

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
   * Global autarkic-pass FIRING order (mission A4 Phase L iteration 17) —
   * every 'autonom' composite in the WHOLE tree, deepest nesting level
   * first, source/declaration order as tie-break within a level. Mirrors
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
   * `resolveAllAutonomPasses` (./state-composite-pass.ts) iterates this
   * list and fires each composite's own svek pass in order, DECOUPLED
   * from the (unchanged) recursive `resolveMember` tree-assembly walk —
   * `resolveMember`'s autonom branch reads the already-computed result
   * from `ctx.resolvedAutonom` instead of recursing inline, which is what
   * previously produced a per-branch depth-first order (finish sibling A's
   * whole subtree, including passes strictly SHALLOWER than some of
   * sibling B's, before sibling B's first pass even fires — verified wrong
   * against the oracle on leloja-87-tebi184's twin composite siblings).
   * @see ~/git/plantuml/.../dot/CucaDiagramSimplifierState.java#getOrdered
   */
  firingOrder: readonly State[];
}

function walkClassify(
  states: readonly State[],
  allTransitions: readonly { from: string; to: string }[],
  kindOf: Map<string, CompositeKind>,
  needsAnchor: Set<string>,
  needsZaentPoint: Set<string>,
  depth: number,
  depthEntries: { state: State; depth: number }[],
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
    depthEntries.push({ state: s, depth });
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
      if (touched || (hasDirectBorderPointChild(s) && !hasNonBorderEeContent(s))) {
        needsZaentPoint.add(s.id);
      }
    }
    walkClassify(s.children, allTransitions, kindOf, needsAnchor, needsZaentPoint, depth + 1, depthEntries);
    // A `--`-delimited concurrent region is itself a distinct synthetic
    // GROUP entity upstream (`GroupType.CONCURRENT_STATE`,
    // StateDiagram.java:204 `gotoGroup(..., GroupType.CONCURRENT_STATE)`),
    // one level deeper than `s`; the region's own member states are ITS
    // children, one level deeper still -- so a composite reachable only
    // through a concurrent region sits at depth+2 relative to `s`, not
    // depth+1 (firingOrder's doc above).
    for (const region of s.concurrentRegions) {
      walkClassify(region, allTransitions, kindOf, needsAnchor, needsZaentPoint, depth + 2, depthEntries);
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
  const depthEntries: { state: State; depth: number }[] = [];
  walkClassify(states, allTransitions, kindOf, needsAnchor, needsZaentPoint, 1, depthEntries);
  // Stable sort (ES2019+) -- deepest first, preorder/declaration order as
  // tie-break within a depth (firingOrder's doc above proves equivalence
  // to getOrdered's BFS-per-level + double-reverse).
  const firingOrder = depthEntries
    .filter((e) => kindOf.get(e.state.id) === 'autonom')
    .sort((a, b) => b.depth - a.depth)
    .map((e) => e.state);
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

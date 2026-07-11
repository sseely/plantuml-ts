/**
 * Whole-diagram composite classification (mission A4/T4) — computed ONCE up
 * front so any pass, at any depth, can resolve a transition endpoint without
 * re-walking the tree. Three outcomes per composite id:
 *   - 'leaf'    — not a composite (`hasLocalContent` false — see its doc,
 *                 state-composite-detect.ts, for why children.length alone
 *                 is unsafe);
 *   - 'autonom' — Entity.isAutarkic() true; gets its own child svek pass,
 *                 re-enters its container as a flattened leaf under its own
 *                 id (mechanisms.md §3).
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
  hasLocalContent,
} from './state-composite-detect.js';

export type CompositeKind = 'leaf' | 'autonom' | 'cluster';

export interface ClassifyResult {
  kindOf: ReadonlyMap<string, CompositeKind>;
  /** ids needing a zaent anchor: cluster composites with a link touching the
   *  group itself, OR (mechanisms.md §2) a cluster with an entry/exit-point
   *  descendant (the entry/exit envelope's own content-placeholder — present
   *  regardless of link-touching, verified on bitaxo-18-tamo974 which has
   *  zero transitions). */
  needsAnchor: ReadonlySet<string>;
  allTransitions: ReadonlyArray<{ from: string; to: string }>;
}

function walkClassify(
  states: readonly State[],
  allTransitions: readonly { from: string; to: string }[],
  kindOf: Map<string, CompositeKind>,
  needsAnchor: Set<string>,
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
    const autonom = isAutarkic(s, allTransitions);
    kindOf.set(s.id, autonom ? 'autonom' : 'cluster');
    if (!autonom) {
      // A composite disqualified from autonom by a border-point descendant
      // needs the anchor as the entry/exit envelope's placeholder even with
      // zero touching links (mechanisms.md §2, bitaxo-18-tamo974); a
      // composite disqualified by a crossing link needs it as the
      // link-touch anchor (thereALinkFromOrToGroup2). Either reason (or
      // both) is a single boolean the emitter cares about.
      if (isGroupTouched(s.id, allTransitions) || hasBorderPointDescendant(s)) {
        needsAnchor.add(s.id);
      }
    }
    walkClassify(s.children, allTransitions, kindOf, needsAnchor);
    for (const region of s.concurrentRegions) walkClassify(region, allTransitions, kindOf, needsAnchor);
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
  walkClassify(states, allTransitions, kindOf, needsAnchor);
  return { kindOf, needsAnchor, allTransitions };
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

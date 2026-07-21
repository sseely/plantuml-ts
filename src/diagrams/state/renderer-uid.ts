/**
 * renderer-uid.ts — mission G4 S1, mechanism 2: node/link uid assignment
 * for the state renderer, mirroring `class/renderer-uid.ts#buildClassUidPlan`
 * (G2 N2 precedent — same `ent%04d`/`lnk%d` shared-counter scheme).
 *
 * mission G4 S7 (mechanism 10, id-numbering creation-index gap): this port's
 * state parser now threads a real parse-time `creationIndex` (`ast.ts`'s
 * `State.creationIndex`/`Transition.creationIndex`/
 * `StateDiagramAST.pseudoCreationIndex`, `state-parse-state.ts`'s
 * `ParseState.creationCounter`) mirroring upstream `net.atmp.CucaDiagram
 * #cpt1` (`AtomicInteger`) — the SAME shared counter behind every real
 * `Entity`'s own `ent%04d` uid AND every `Link`'s own `lnkN` uid
 * (`Entity.java:171`, `Link.java:135`), incremented at TRUE creation time
 * (declaration order for states, transition-source order for transitions
 * and their own newly-auto-created endpoints, and once per concurrent-
 * region separator for the invisible `GroupType.CONCURRENT_STATE` group
 * `StateDiagram#concurrentState` constructs but never individually renders).
 *
 * A node/edge WITH a `creationIndex` uses that RAW value directly
 * (`ent%04d(creationIndex)`/`lnkN(creationIndex)`) — NOT dense re-packing.
 * This is deliberate, not an approximation: since `ParseState
 * .creationCounter` increments for EVERY real jar tick (including the ones
 * that never reach a renderable `StateNodeGeo`/`TransitionGeo` — a
 * `remove`d state's own tick, stamped during parsing before
 * `state-directives.ts#filterRemovedEntities` excludes it from the
 * layout-input AST; a CONCURRENT_STATE phantom group's own tick, never
 * represented in geometry at all), the SURVIVING items' raw `creationIndex`
 * values already carry the correct GAP at every such slot — using them
 * directly reproduces jar's real id sequence with no reconstruction step
 * needed (unlike `class/renderer-uid.ts#buildClassUidPlan`'s own dense-
 * merge-with-explicit-phantom-entries scheme, G2 N2/N15: that module's own
 * `creationIndex` stamping is NOT a full 1:1 replay of every jar tick, so it
 * needs an explicit phantom-rank mechanism to reproduce gaps the port's own
 * creation model doesn't otherwise account for).
 *
 * A node/edge WITHOUT a `creationIndex` (a hand-built test geometry
 * predating this mission, or the one still-unthreaded edge case named in
 * the S7 ledger — `state-composite-cluster.ts#buildConcurrentRegionLeaf`'s
 * synthetic region-as-node id, a CLUSTER-classified composite's OWN
 * concurrent region, not the AUTONOM case this mission's 5 required
 * fixtures covered) falls back to the pre-S7 dense-numbering scheme,
 * CONTINUING from the highest real tick used — mirrors the class engine's
 * own exact/fallback split precedent (G2 N2's `ClassUidPlan`).
 *
 * Traversal order for the FALLBACK-numbered items only (real-indexed items
 * are order-independent, keyed by their own raw value): states in
 * `StateGeometry.states` pre-order (parent before children — concurrent-
 * region members are reached via `children` too, since `StateNodeGeo
 * .concurrentRegions[i].children`/`.transitions` SHARE object identity with
 * the flat `children`/`transitions` arrays, mission G4 S6's own load-bearing
 * identity contract — no separate walk needed), then transitions:
 * `StateGeometry.transitions` (top-level pass, source order) FIRST, then
 * each node's own `.transitions` (mission G4 S5) walked in the SAME states
 * pre-order.
 *
 * `edgeUid` is a `Map` keyed by `TransitionGeo` object identity rather than
 * an array parallel to a single flat list — transitions live in MULTIPLE
 * arrays (the top-level list plus every composite node's own
 * `.transitions`), so a single array-index scheme cannot identify a
 * transition uniquely.
 *
 * @see plans/g4-state-svg/ledger.md (S1, mechanism 2; S5, transition
 *      nesting; S7, creation-index)
 */
import type { StateGeometry, StateNodeGeo, TransitionGeo } from './state-geo-types.js';

/** `StringUtils.getUid("ent", n)` — `"ent" + "%04d".format(n)`. */
function entUid(n: number): string {
  return `ent${String(n).padStart(4, '0')}`;
}

/** `CucaDiagram#getUniqueSequence("lnk")` — `"lnk" + n`, unpadded. */
function lnkUid(n: number): string {
  return `lnk${n}`;
}

export interface StateUidPlan {
  /** `StateNodeGeo.id` (at any nesting depth) → assigned `ent%04d` uid. */
  readonly nodeUid: ReadonlyMap<string, string>;
  /** Keyed by `TransitionGeo` object identity — the assigned `lnkN` uid per
   *  transition, resolved via {@link resolveEdgeUid} at render time. */
  readonly edgeUid: ReadonlyMap<TransitionGeo, string>;
  /** Resolves a raw `TransitionGeo.from`/`.to` endpoint id to its assigned
   *  node uid, falling back to the raw string itself when unresolved
   *  (mirrors `ClassUidPlan.resolveEntityUid`'s own fallback). */
  readonly resolveNodeUid: (id: string) => string;
}

function collectPreOrder(nodes: readonly StateNodeGeo[], out: StateNodeGeo[]): void {
  for (const n of nodes) {
    out.push(n);
    if (n.children.length > 0) collectPreOrder(n.children, out);
  }
}

/** `<top-level pass edges>, then <each node's own nested edges in states
 *  pre-order>` — see this module's own doc comment for why this exactly
 *  reproduces the pre-S5 flat-array numbering shape (used only to order the
 *  FALLBACK-numbered subset since mission G4 S7 — see module doc). */
function collectTransitionsInOrder(geo: StateGeometry, flatNodes: readonly StateNodeGeo[]): TransitionGeo[] {
  const out: TransitionGeo[] = [...geo.transitions];
  for (const n of flatNodes) out.push(...n.transitions);
  return out;
}

export function buildStateUidPlan(geo: StateGeometry): StateUidPlan {
  const flat: StateNodeGeo[] = [];
  collectPreOrder(geo.states, flat);
  const transitionsInOrder = collectTransitionsInOrder(geo, flat);

  // mission G4 S7: real-indexed items use their own raw `creationIndex`
  // directly (see module doc comment); the fallback dense counter for
  // items WITHOUT one continues from the highest real tick used, so it can
  // never collide with a real value.
  let maxUsed = 0;
  for (const n of flat) if (n.creationIndex !== undefined) maxUsed = Math.max(maxUsed, n.creationIndex);
  for (const t of transitionsInOrder) if (t.creationIndex !== undefined) maxUsed = Math.max(maxUsed, t.creationIndex);
  let fallbackCounter = maxUsed;

  const nodeUid = new Map<string, string>();
  for (const n of flat) {
    if (n.creationIndex !== undefined) {
      nodeUid.set(n.id, entUid(n.creationIndex));
    } else {
      fallbackCounter += 1;
      nodeUid.set(n.id, entUid(fallbackCounter));
    }
  }

  const edgeUid = new Map<TransitionGeo, string>();
  for (const t of transitionsInOrder) {
    if (t.creationIndex !== undefined) {
      edgeUid.set(t, lnkUid(t.creationIndex));
    } else {
      fallbackCounter += 1;
      edgeUid.set(t, lnkUid(fallbackCounter));
    }
  }

  const resolveNodeUid = (id: string): string => nodeUid.get(id) ?? id;

  return { nodeUid, edgeUid, resolveNodeUid };
}

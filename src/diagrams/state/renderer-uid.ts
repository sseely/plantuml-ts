/**
 * renderer-uid.ts — mission G4 S1, mechanism 2: node/link uid assignment
 * for the state renderer, mirroring `class/renderer-uid.ts#buildClassUidPlan`
 * (G2 N2 precedent — same `ent%04d`/`lnk%d` shared-counter scheme) but
 * WITHOUT that module's exact/fallback split: this port's state parser has
 * no `creationIndex` threading at all (grepped `src/diagrams/state/*.ts` for
 * `creationIndex`, zero hits), so this is a fallback-only dense numbering —
 * a documented approximation, not a precision requirement (see
 * `renderer-group.ts`'s own doc comment: `data-qualified-name`/`id` are
 * `data-*`-adjacent debug metadata for structural conformance purposes,
 * only the `class`/`id` VALUE stability across a diagram matters for the
 * link `data-entity-1`/`data-entity-2` cross-references, and `id` itself is
 * compared byte-exact by `compareSvg` — so getting the numbering "right" for
 * unambiguous fixtures, i.e. every non-composite/non-forked diagram in
 * simple source order, is the achievable bar this fallback targets).
 *
 * Numbering order: states in `StateGeometry.states` pre-order (parent
 * before children, matching real declaration order for a `state Foo { ... }`
 * block — the child states are declared AFTER their container), then
 * transitions in `StateGeometry.transitions` array order (the diagram's own
 * source order, `StateDiagramAST.transitions`).
 *
 * @see plans/g4-state-svg/ledger.md (S1, mechanism 2)
 */
import type { StateGeometry, StateNodeGeo } from './state-geo-types.js';

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
  /** Parallel to `geo.transitions` — the assigned `lnkN` uid per transition. */
  readonly edgeUid: readonly string[];
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

export function buildStateUidPlan(geo: StateGeometry): StateUidPlan {
  const flat: StateNodeGeo[] = [];
  collectPreOrder(geo.states, flat);

  const nodeUid = new Map<string, string>();
  let counter = 0;
  for (const n of flat) {
    counter += 1;
    nodeUid.set(n.id, entUid(counter));
  }

  const edgeUid = geo.transitions.map(() => {
    counter += 1;
    return lnkUid(counter);
  });

  const resolveNodeUid = (id: string): string => nodeUid.get(id) ?? id;

  return { nodeUid, edgeUid, resolveNodeUid };
}

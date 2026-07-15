/**
 * renderer-uid.ts — entity/cluster/link uid assignment for the klimt-backed
 * description renderer.
 *
 * Upstream assigns every `Entity`'s uid (`ent%04d`) and every `Link`'s uid
 * (`lnk` + counter, unpadded) from ONE shared `AtomicInteger` counter
 * (`net.atmp.CucaDiagram#cpt1`, `getUniqueSequenceValue()` /
 * `getUniqueSequence("lnk")` — verified by reading `CucaDiagram.java:127,
 * 725-730`), at ENTITY-CREATION time during parsing (declaration order,
 * including entities auto-created by a link referencing an unknown name).
 *
 * I3b write-set expansion (journaled — see the mission decision journal):
 * this port's parser now threads that true parse-time creation order
 * directly onto the AST (`DescriptiveNode.creationIndex` /
 * `DescriptiveLink.creationIndex`, assigned by `parse-state.ts#emitNode` and
 * the link-execute handler in `command-table.ts`), carried through
 * `layout.ts`/`layout-geo-post.ts` onto `DescriptionNodeGeo`/
 * `DescriptionEdgeGeo` unchanged. `buildUidPlan` below simply FORMATS those
 * already-correct values — it no longer computes ordering itself.
 *
 * `DescriptionGeometry` built by hand (most unit tests, and any caller that
 * constructs geo literals directly rather than going through
 * `parseDescription`/`layoutDescription`) never sets `creationIndex` — for
 * that case, `buildUidPlan` falls back to the PRE-I3b approximation (a
 * depth-first pre-order walk of `geo.nodes` — a container is "created"
 * before its children, matching `package Foo { ... }`'s brace-opening order
 * — followed by `geo.edges` in link-declaration order). This reproduces
 * upstream exactly for the common case (all entities declared before the
 * links referencing them, no links auto-creating an entity ahead of its
 * later top-level declaration) but is a documented approximation for
 * hand-built test fixtures only; every real `parseDescription()` output
 * always carries `creationIndex` on every node and edge, so production
 * renders always take the exact path.
 */
import type { DescriptionGeometry, DescriptionNodeGeo } from './layout-helpers.js';

/** `StringUtils.getUid("ent", n)` — `"ent" + "%04d".format(n)`. */
function entUid(n: number): string {
  return `ent${String(n).padStart(4, '0')}`;
}

/** `CucaDiagram#getUniqueSequence("lnk")` — `"lnk" + n`, unpadded. */
function lnkUid(n: number): string {
  return `lnk${n}`;
}

export interface UidPlan {
  /** AST node id → assigned `ent%04d` uid, for every node (container and
   *  leaf alike — upstream assigns a group entity a uid exactly like a
   *  leaf entity). */
  readonly nodeUid: ReadonlyMap<string, string>;
  /** Parallel to `geo.edges` — the assigned `lnkN` uid per edge, in
   *  `geo.edges` array order. */
  readonly edgeUid: readonly string[];
}

// ---------------------------------------------------------------------------
// Exact path — every node/edge carries a parse-time `creationIndex`.
// ---------------------------------------------------------------------------

function everyNodeHasIndex(nodes: readonly DescriptionNodeGeo[]): boolean {
  return nodes.every(
    (n) => n.creationIndex !== undefined && everyNodeHasIndex(n.children),
  );
}

function assignFromCreationIndex(nodes: readonly DescriptionNodeGeo[], nodeUid: Map<string, string>): void {
  for (const node of nodes) {
    nodeUid.set(node.id, entUid(node.creationIndex!));
    assignFromCreationIndex(node.children, nodeUid);
  }
}

// ---------------------------------------------------------------------------
// Fallback path — pre-I3b approximation, for hand-built geometries only.
// ---------------------------------------------------------------------------

function visitLegacy(nodes: readonly DescriptionNodeGeo[], nodeUid: Map<string, string>, counter: { n: number }): void {
  for (const node of nodes) {
    counter.n += 1;
    nodeUid.set(node.id, entUid(counter.n));
    if (node.children.length > 0) visitLegacy(node.children, nodeUid, counter);
  }
}

/** Builds the uid plan for one `DescriptionGeometry` — see module doc
 *  comment for the exact-vs-fallback algorithm choice.
 *
 *  G1b/J1 write-set expansion (journaled): parameter narrowed from the full
 *  `DescriptionGeometry` to `Pick<..., 'nodes' | 'edges'>` -- uid assignment
 *  only ever reads those two fields (never positions), so
 *  `layout-ink-shift.ts#computeInkShift` can build a plan from a RAW
 *  (pre-shift, no `totalWidth`/`totalHeight` yet) node/edge pair without
 *  fabricating the rest of `DescriptionGeometry`'s shape. Every existing
 *  caller passes a full `DescriptionGeometry`, which still satisfies this
 *  narrower type -- Interface Segregation, not a behavior change. */
export function buildUidPlan(geo: Pick<DescriptionGeometry, 'nodes' | 'edges'>): UidPlan {
  const nodeUid = new Map<string, string>();
  const exact = everyNodeHasIndex(geo.nodes) && geo.edges.every((e) => e.creationIndex !== undefined);
  if (exact) {
    assignFromCreationIndex(geo.nodes, nodeUid);
    const edgeUid = geo.edges.map((e) => lnkUid(e.creationIndex!));
    return { nodeUid, edgeUid };
  }
  const counter = { n: 0 };
  visitLegacy(geo.nodes, nodeUid, counter);
  const edgeUid = geo.edges.map(() => {
    counter.n += 1;
    return lnkUid(counter.n);
  });
  return { nodeUid, edgeUid };
}

/**
 * renderer-uid.ts — T17 write-set expansion (journaled): entity/cluster/link
 * uid assignment for the klimt-backed description renderer.
 *
 * Upstream assigns every `Entity`'s uid (`ent%04d`) and every `Link`'s uid
 * (`lnk` + counter, unpadded) from ONE shared `AtomicInteger` counter
 * (`net.atmp.CucaDiagram#cpt1`, `getUniqueSequenceValue()` /
 * `getUniqueSequence("lnk")` — verified by reading `CucaDiagram.java:127,
 * 725-730`), at ENTITY-CREATION time during parsing (declaration order,
 * including entities auto-created by a link referencing an unknown name).
 *
 * This port's `DescriptionGeometry` does not carry a parse-time creation
 * order — only the already-built tree/edge-list shape. This module
 * approximates upstream's order with a depth-first pre-order walk of
 * `geo.nodes` (a container is "created" before its children, matching
 * `package Foo { ... }`'s brace-opening order) followed by `geo.edges` in
 * link-declaration order (`layout-geo-post.ts#buildEdgeGeos` already sorts
 * these back into source order). This reproduces upstream exactly for the
 * common case (all entities declared before the links referencing them, no
 * links auto-creating an entity ahead of its later top-level declaration —
 * verified against `test-results/dot-cache/component/sacuso-94-gugi476`);
 * it can diverge only in the `id`/`data-uid` values (never geometry) for
 * fixtures where a link auto-creates a NEW entity before every other
 * top-level entity has been declared. Documented gap, not fixed here — see
 * the T17 mission report.
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

function visit(nodes: readonly DescriptionNodeGeo[], nodeUid: Map<string, string>, counter: { n: number }): void {
  for (const node of nodes) {
    counter.n += 1;
    nodeUid.set(node.id, entUid(counter.n));
    if (node.children.length > 0) visit(node.children, nodeUid, counter);
  }
}

/** Builds the uid plan for one `DescriptionGeometry` — see module doc
 *  comment for the algorithm and its known approximation. */
export function buildUidPlan(geo: DescriptionGeometry): UidPlan {
  const nodeUid = new Map<string, string>();
  const counter = { n: 0 };
  visit(geo.nodes, nodeUid, counter);
  const edgeUid = geo.edges.map(() => {
    counter.n += 1;
    return lnkUid(counter.n);
  });
  return { nodeUid, edgeUid };
}

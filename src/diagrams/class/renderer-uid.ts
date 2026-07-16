/**
 * renderer-uid.ts — G2 N2 (mechanism 3): entity/cluster/link uid
 * assignment for the class renderer, mirroring the description engine's
 * `renderer-uid.ts#buildUidPlan` (G1/I3b precedent — same shared-counter
 * scheme, same exact/fallback gate shape) but adapted to class's THREE
 * geometry categories (classifiers, namespaces, edges — description has
 * only nodes/edges, since a description "cluster" IS a node) plus a
 * fourth, always-fallback category (notes — see below).
 *
 * Upstream assigns every drawn element's uid (`ent%04d` classifiers/
 * clusters/notes, `lnk` + counter unpadded edges) from ONE shared
 * `AtomicInteger` counter (`net.atmp.CucaDiagram#cpt1`,
 * `getUniqueSequenceValue()`/`getUniqueSequence("lnk")` — same citation
 * description's own module doc comment already verified), at
 * ENTITY-CREATION time during parsing. This port's class parser threads
 * that creation order onto the AST (`Classifier.creationIndex`/
 * `Namespace.creationIndex`/`Relationship.creationIndex`, stamped at the
 * single creation chokepoints — `parser.ts#ensureClassifier`,
 * `class-namespace.ts#ensureNamespaceChain`, and the primary
 * relationship-dispatch site in `class-commands.ts`), carried through
 * `layout.ts` onto `ClassifierGeo`/`NamespaceGeo`/`EdgeGeo` unchanged.
 *
 * DENSE RE-NUMBERING (the key difference from a literal counter replay):
 * this function does NOT use `creationIndex` values as the uid number
 * directly — it uses them only to SORT the kept geometry items, then
 * assigns a fresh dense 1..N sequence over that sorted order. This is
 * deliberate, not an approximation: `ensureClassifier` sometimes stamps a
 * creationIndex on a classifier that never reaches `ClassGeometry` at all
 * (a relationship endpoint that resolves to an EXISTING namespace, e.g.
 * `pkg --> Foo` where `pkg` is a package — `ensureClassifier` still
 * auto-creates a phantom `Classifier` row for the bare reference before
 * `class-dot-graph.ts#packageEndpointAnchors` redirects the actual DOT
 * edge to an anchor point inside the cluster, so the phantom never gets a
 * `ClassifierGeo` — verified against `bajotu-30-soku184`: raw
 * creationIndex values are namespace=1, classifier=2, classifier=3,
 * PHANTOM=4, relationship=5, but jar's real uids are ent0001/ent0002/
 * ent0003/lnk4 with NO gap — dense re-numbering over the 4 KEPT items
 * (phantom excluded, it has no geo) reproduces that exactly, whereas a
 * literal counter replay would not).
 *
 * NOT reachable by dense re-numbering: upstream itself sometimes consumes
 * a real (non-phantom) uid for an internal node/edge this port does not
 * yet model (verified against `ririlu-13-zipi740`'s qualifier-bracket
 * relationships and `fibamu-81-zimo884`'s association-class couple — both
 * show additional gaps in the JAR's own numbering that this port's
 * geometry has no corresponding item for at all, so dense re-numbering
 * cannot reproduce them either). Named remainder, not investigated this
 * iteration — see `plans/g2-class-svg/ledger.md` N2.
 */
import type { ClassGeometry } from './layout.js';

/** `StringUtils.getUid("ent", n)` — `"ent" + "%04d".format(n)`. */
function entUid(n: number): string {
  return `ent${String(n).padStart(4, '0')}`;
}

/** `CucaDiagram#getUniqueSequence("lnk")` — `"lnk" + n`, unpadded. */
function lnkUid(n: number): string {
  return `lnk${n}`;
}

export interface ClassUidPlan {
  /** `Classifier.id` → assigned `ent%04d` uid. */
  readonly classifierUid: ReadonlyMap<string, string>;
  /** `Namespace.id` → assigned `ent%04d` uid. */
  readonly namespaceUid: ReadonlyMap<string, string>;
  /** `NoteGeo.id` → assigned `ent%04d` uid (always fallback-numbered —
   *  see module doc comment). */
  readonly noteUid: ReadonlyMap<string, string>;
  /** Parallel to `geo.edges` — the assigned `lnkN` uid per edge. */
  readonly edgeUid: readonly string[];
  /** Resolves a raw `EdgeGeo.from`/`.to` endpoint string (a classifier id
   *  OR a namespace id — see `packageEndpointAnchors` in the module doc
   *  comment) to its assigned uid, falling back to the raw string itself
   *  when neither map has it (matches description's own `renderer-edge
   *  .ts#drawEdge` fallback convention). */
  readonly resolveEntityUid: (id: string) => string;
}

/** Output maps `assignExact`/`assignFallback` fill in place — collapsed
 *  into one bundle (rather than 3 positional out-params) to stay inside
 *  this project's per-function param-count budget. */
interface UidMaps {
  readonly classifierUid: Map<string, string>;
  readonly namespaceUid: Map<string, string>;
  readonly edgeUid: string[];
}

type EntityKind = 'classifier' | 'namespace';
interface EntityItem {
  readonly kind: EntityKind;
  readonly id: string;
  readonly creationIndex: number;
}

function isExact(geo: ClassGeometry): boolean {
  return (
    geo.classifiers.every((c) => c.creationIndex !== undefined) &&
    geo.namespaces.every((n) => n.creationIndex !== undefined) &&
    geo.edges.every((e) => e.creationIndex !== undefined)
  );
}

/** Exact path: dense re-numbering over the creationIndex-sorted merge of
 *  every kept classifier/namespace/edge — see module doc comment. */
function assignExact(geo: ClassGeometry, maps: UidMaps): void {
  const entities: EntityItem[] = [
    ...geo.classifiers.map((c): EntityItem => ({ kind: 'classifier', id: c.id, creationIndex: c.creationIndex! })),
    ...geo.namespaces.map((n): EntityItem => ({ kind: 'namespace', id: n.id, creationIndex: n.creationIndex! })),
  ];

  type Ranked =
    | { readonly type: 'entity'; readonly item: EntityItem }
    | { readonly type: 'edge'; readonly index: number; readonly creationIndex: number };
  const merged: Ranked[] = [
    ...entities.map((item): Ranked => ({ type: 'entity', item })),
    ...geo.edges.map((e, index): Ranked => ({ type: 'edge', index, creationIndex: e.creationIndex! })),
  ];
  const rankOf = (r: Ranked): number => (r.type === 'entity' ? r.item.creationIndex : r.creationIndex);
  merged.sort((a, b) => rankOf(a) - rankOf(b));

  merged.forEach((entry, i) => {
    const rank = i + 1;
    if (entry.type === 'entity') {
      const uid = entUid(rank);
      if (entry.item.kind === 'classifier') maps.classifierUid.set(entry.item.id, uid);
      else maps.namespaceUid.set(entry.item.id, uid);
    } else {
      maps.edgeUid[entry.index] = lnkUid(rank);
    }
  });
}

/** Fallback path — no real per-fixture ordering guarantee, just a stable,
 *  deterministic default: namespaces then classifiers (each in `geo`
 *  array order — description's own fallback uses the same "containers
 *  before leaves, in array order" shape) then edges. Mirrors description
 *  `renderer-uid.ts`'s own documented fallback-is-an-approximation
 *  posture. Returns the final counter value (the next-free rank). */
function assignFallback(geo: ClassGeometry, maps: UidMaps): number {
  let counter = 0;
  for (const n of geo.namespaces) {
    counter += 1;
    maps.namespaceUid.set(n.id, entUid(counter));
  }
  for (const c of geo.classifiers) {
    counter += 1;
    maps.classifierUid.set(c.id, entUid(counter));
  }
  geo.edges.forEach((_e, index) => {
    counter += 1;
    maps.edgeUid[index] = lnkUid(counter);
  });
  return counter;
}

/** Builds the uid plan for one `ClassGeometry` — see module doc comment
 *  for the exact-vs-fallback algorithm choice and notes' always-fallback
 *  numbering. */
export function buildClassUidPlan(geo: ClassGeometry): ClassUidPlan {
  const maps: UidMaps = {
    classifierUid: new Map<string, string>(),
    namespaceUid: new Map<string, string>(),
    edgeUid: new Array<string>(geo.edges.length).fill(''),
  };
  const noteUid = new Map<string, string>();

  const lastRank = isExact(geo) ? assignExactAndCountRank(geo, maps) : assignFallback(geo, maps);

  // Notes: always fallback-numbered (no creationIndex threaded from
  // class-notes.ts this iteration — named remainder, module doc comment),
  // continuing from wherever the classifier/namespace/edge numbering left
  // off so a note-bearing fixture's non-note uids stay internally
  // consistent even though the notes themselves are best-effort.
  let noteCounter = lastRank;
  for (const note of geo.notes) {
    noteCounter += 1;
    noteUid.set(note.id, entUid(noteCounter));
  }

  const resolveEntityUid = (id: string): string =>
    maps.classifierUid.get(id) ?? maps.namespaceUid.get(id) ?? noteUid.get(id) ?? id;

  return { classifierUid: maps.classifierUid, namespaceUid: maps.namespaceUid, noteUid, edgeUid: maps.edgeUid, resolveEntityUid };
}

/** Thin wrapper so `buildClassUidPlan`'s ternary can share the same
 *  "returns the next-free rank" shape as `assignFallback`. */
function assignExactAndCountRank(geo: ClassGeometry, maps: UidMaps): number {
  assignExact(geo, maps);
  return maps.classifierUid.size + maps.namespaceUid.size + geo.edges.length;
}

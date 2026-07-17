/**
 * renderer-uid.ts — G2 N2 (mechanism 3): entity/cluster/link uid
 * assignment for the class renderer, mirroring the description engine's
 * `renderer-uid.ts#buildUidPlan` (G1/I3b precedent — same shared-counter
 * scheme, same exact/fallback gate shape) but adapted to class's THREE
 * geometry categories (classifiers, namespaces, edges — description has
 * only nodes/edges, since a description "cluster" IS a node) plus a
 * fourth, PARTIALLY-exact category (notes — see below and G2 N15).
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
 *
 * NOTES (G2 N15): `ClassNote.creationIndex` (see that field's doc comment
 * in `ast.ts`) is stamped for a NON-tip attached note (accounting for the
 * `CommandFactoryNoteOnEntity` "GMN" phantom-slot consumption) and for a
 * freestanding note — but NOT for a member-tip note (`CommandFactory
 * TipOnEntity`'s host+position merge isn't modeled at parse time). When
 * the overall geometry is exact (see `isExact` below), every note that DOES
 * carry a `creationIndex` is folded into the SAME dense-renumbering merge
 * as classifiers/namespaces/edges, in real creation-order position — the
 * remaining notes (member-tips, or any note when the overall geometry is
 * NOT exact) keep the pre-existing best-effort fallback: continuing the
 * dense count from wherever the exact/fallback pass left off, in `geo
 * .notes` array order.
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
  /** `NoteGeo.id` → assigned `ent%04d` uid — exact-numbered (interleaved
   *  with classifiers/namespaces/edges by real creation order) when the
   *  note carries a `creationIndex` AND the overall geometry is exact;
   *  best-effort fallback numbering otherwise (see module doc comment). */
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
 *  into one bundle (rather than several positional out-params) to stay
 *  inside this project's per-function param-count budget. */
interface UidMaps {
  readonly classifierUid: Map<string, string>;
  readonly namespaceUid: Map<string, string>;
  readonly noteUid: Map<string, string>;
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
 *  every kept classifier/namespace/edge, PLUS any note that itself carries
 *  a `creationIndex` (G2 N15) — see module doc comment. Returns the number
 *  of RANKS consumed (including phantom slots, G2 N15 -- NOT the same as
 *  the number of uids assigned, since a phantom consumes a rank but no
 *  uid), so the caller's note-fallback continuation starts from the right
 *  place. */
function assignExact(geo: ClassGeometry, maps: UidMaps): number {
  // G2 N19: an assoc-circle classifier's OWN uid slot is a REAL jar cpt1
  // burn that must consume a numbering rank, but `EntityImageAssociationPoint
  // #drawU` never wraps it in a `<g id="...">` -- excluded here from the
  // normal 'classifier' entity list; the phantom-entry block below gives it
  // a rank-consuming (uid-less) Ranked entry instead (`Classifier
  // .noUidSlot`'s doc comment, ast.ts). A lollipop classifier DOES get a
  // real, rendered `<g id="...">` (`EntityImageLollipopInterface#drawU`), so
  // it stays in this list unchanged.
  const entities: EntityItem[] = [
    ...geo.classifiers
      .filter((c) => c.noUidSlot !== true)
      .map((c): EntityItem => ({ kind: 'classifier', id: c.id, creationIndex: c.creationIndex! })),
    ...geo.namespaces.map((n): EntityItem => ({ kind: 'namespace', id: n.id, creationIndex: n.creationIndex! })),
  ];
  const exactNotes = geo.notes.filter((n) => n.creationIndex !== undefined);

  type Ranked =
    | { readonly type: 'entity'; readonly item: EntityItem }
    | { readonly type: 'edge'; readonly index: number; readonly creationIndex: number }
    | { readonly type: 'note'; readonly id: string; readonly creationIndex: number }
    // G2 N15: a discarded "GMN" phantom slot (`ClassNote.phantomSlot`'s doc
    // comment) -- consumes a numbering RANK (keeping the gap it produced in
    // the real upstream counter) without being written to any uid map.
    // Distinct from a phantom CLASSIFIER stub (module doc comment above),
    // which correctly has NO Ranked entry at all -- this phantom's rank
    // consumption is exactly the point, not an artifact to collapse away.
    | { readonly type: 'phantom'; readonly creationIndex: number };
  const merged: Ranked[] = [
    ...entities.map((item): Ranked => ({ type: 'entity', item })),
    ...geo.edges.flatMap((e, index): Ranked[] =>
      // G2 N19: the couple's synthetic-default-link phantom burn
      // (`Relationship.phantomSlot`'s doc comment, ast.ts) -- consumes the
      // rank immediately BEFORE this edge's own, same shape as a note's
      // `phantomSlot` (G2 N15).
      e.phantomSlot === true
        ? [
            { type: 'phantom', creationIndex: e.creationIndex! - 1 },
            { type: 'edge', index, creationIndex: e.creationIndex! },
          ]
        : [{ type: 'edge', index, creationIndex: e.creationIndex! }],
    ),
    ...exactNotes.flatMap((n): Ranked[] =>
      n.phantomSlot === true
        ? [
            { type: 'phantom', creationIndex: n.creationIndex! - 1 },
            { type: 'note', id: n.id, creationIndex: n.creationIndex! },
          ]
        : [{ type: 'note', id: n.id, creationIndex: n.creationIndex! }],
    ),
    // G2 N19: couple/lollipop phantom-slot bookkeeping -- see
    // `Classifier.phantomSlot`/`.noUidSlot`'s doc comments (ast.ts). A
    // classifier's OWN 'entity' Ranked entry (added above, when
    // `noUidSlot !== true`) already covers its `creationIndex` rank; this
    // only adds the EXTRA ranks a couple/lollipop entity's real jar cpt1
    // burns require: the preceding name-slot (`phantomSlot`), and -- for
    // assoc-circle only -- the entity's own never-rendered uid slot
    // (`noUidSlot`, which would otherwise consume NO rank at all now that
    // it is excluded from `entities` above).
    ...geo.classifiers.flatMap((c): Ranked[] => {
      const out: Ranked[] = [];
      if (c.phantomSlot === true) out.push({ type: 'phantom', creationIndex: c.creationIndex! - 1 });
      if (c.noUidSlot === true) out.push({ type: 'phantom', creationIndex: c.creationIndex! });
      // G2 N19: an explicit A-B association this circle subsumed and
      // removed -- `Classifier.subsumedLinkCreationIndex`'s doc comment
      // (ast.ts). An ARBITRARY standalone rank, unrelated to this
      // classifier's own `creationIndex` (unlike the two entries above).
      if (c.subsumedLinkCreationIndex !== undefined) {
        out.push({ type: 'phantom', creationIndex: c.subsumedLinkCreationIndex });
      }
      return out;
    }),
  ];
  const rankOf = (r: Ranked): number => (r.type === 'entity' ? r.item.creationIndex : r.creationIndex);
  merged.sort((a, b) => rankOf(a) - rankOf(b));

  merged.forEach((entry, i) => {
    const rank = i + 1;
    if (entry.type === 'entity') {
      const uid = entUid(rank);
      if (entry.item.kind === 'classifier') maps.classifierUid.set(entry.item.id, uid);
      else maps.namespaceUid.set(entry.item.id, uid);
    } else if (entry.type === 'edge') {
      maps.edgeUid[entry.index] = lnkUid(rank);
    } else if (entry.type === 'note') {
      maps.noteUid.set(entry.id, entUid(rank));
    }
    // 'phantom': rank consumed, nothing written -- see the Ranked union's
    // own doc comment above.
  });
  return merged.length;
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
 *  for the exact-vs-fallback algorithm choice and notes' partially-exact
 *  numbering. */
export function buildClassUidPlan(geo: ClassGeometry): ClassUidPlan {
  const maps: UidMaps = {
    classifierUid: new Map<string, string>(),
    namespaceUid: new Map<string, string>(),
    noteUid: new Map<string, string>(),
    edgeUid: new Array<string>(geo.edges.length).fill(''),
  };

  const exact = isExact(geo);
  const lastRank = exact ? assignExactAndCountRank(geo, maps) : assignFallback(geo, maps);

  // Remaining notes (member-tips whose merge-by-host+position isn't
  // modeled at parse time, or — when the overall geometry is NOT exact —
  // every note regardless of its own creationIndex, since mixing a real
  // creationIndex into an array-order fallback count would be meaningless)
  // keep the pre-existing best-effort fallback: continuing the dense count
  // from wherever the exact/fallback pass left off, in `geo.notes` array
  // order. G2 N15: skip notes already assigned above (exact-numbered).
  let noteCounter = lastRank;
  for (const note of geo.notes) {
    if (maps.noteUid.has(note.id)) continue;
    noteCounter += 1;
    maps.noteUid.set(note.id, entUid(noteCounter));
  }

  const resolveEntityUid = (id: string): string =>
    maps.classifierUid.get(id) ?? maps.namespaceUid.get(id) ?? maps.noteUid.get(id) ?? id;

  return {
    classifierUid: maps.classifierUid,
    namespaceUid: maps.namespaceUid,
    noteUid: maps.noteUid,
    edgeUid: maps.edgeUid,
    resolveEntityUid,
  };
}

/** Thin wrapper so `buildClassUidPlan`'s ternary can share the same
 *  "returns the next-free rank" shape as `assignFallback`. */
function assignExactAndCountRank(geo: ClassGeometry, maps: UidMaps): number {
  return assignExact(geo, maps);
}

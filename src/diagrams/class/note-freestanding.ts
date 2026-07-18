/**
 * note-freestanding.ts — G2/N16 Kind B: a freestanding note (`note "text"
 * as N1`, no host classifier/position) connected to a REAL classifier via a
 * plain relationship line (`N1 .. Bar`), NOT the note-attachment `of
 * <Entity>` syntax `note-layout.ts` otherwise handles. Upstream draws this
 * via the SAME `EntityImageNote#opaleLine`/`isOpalisable` mechanism as an
 * attached single-link note (Kind C, `note-opale.ts`) — ANY note leaf with
 * EXACTLY ONE non-invisible connection to a non-note entity is "opalisable"
 * (`GraphvizImageBuilder.java:133-148`); its connecting `Link` is suppressed
 * from drawing entirely (`SvekEdge#drawU`'s `if (opale) return;`) and the
 * note's own outline merges the connector into a zigzag notch instead
 * (jar-verified via `doseko-41-mavu661`/`sevaxa-72-pudi231`: the jar SVG
 * has no separate `<g class="link">` for the `N1 .. Bar` relationship at
 * all, just the note's own two merged `<path>`s).
 *
 * G2/N13-N14 already built the Opale mechanism for Kind A (member-tip) and
 * Kind C (attached single-link note, `note-layout.ts#mapGroupNoteGeos`'s
 * own singleton-group branch already tries `buildOpaleNoteGeo` given a
 * `connectorPoints` array — it just never RECEIVES one for a freestanding
 * note, since `groupEdge` returns `undefined` when a note has no `target`/
 * `position`, N9's own doc comment). This module supplies THAT connector,
 * in two halves (the SAME "exactly one connection" eligibility gate, run
 * twice — once PRE-layout, once POST-layout, see each function's own doc
 * comment for why one pass isn't enough):
 *  - {@link findFreestandingNoteRelationshipIndices} (PRE-layout, on raw
 *    `ast.relationships`) — `class-dot-graph.ts` uses this to set
 *    `noArrow: true` on an eligible relationship's DOT edge BEFORE layout
 *    runs, mirroring N14's identical fix for the synthetic note-attachment
 *    edge (`note-layout.ts#groupEdge`) — without it, graphviz-ts reserves
 *    its default ~10-11px arrow-clip gap when trimming the spline to the
 *    note's box boundary, landing `resolveOpaleConnector`'s notch anchor
 *    short of the real edge (jar-verified wrong against `doseko-41-
 *    mavu661` before this fix).
 *  - {@link findFreestandingNoteConnectors} (POST-layout, on the already-
 *    routed `EdgeGeo[]`) — `layout.ts` uses this to supply
 *    `mapNoteGeos`/`mapGroupNoteGeos` with the note's real connector
 *    points, and to know which edge to drop from the final visible set
 *    once its note resolves via Opale.
 *
 * SCOPE GUARD (diagnosed via `temise-16-neco018`'s 3->234 regression while
 * jar-verifying): a note's OTHER endpoint must be an ORDINARY classifier,
 * never a synthetic `assoc-circle`/`lollipop` entity (`class-assoc-
 * couple.ts`'s `(A,B)` point node, `class-lollipop.ts`'s `()--` circle) --
 * those are svek-internal layout constructs this port invents, not real
 * UML classifiers `isOpalisable` was ever verified against; `N1 ..
 * (Reporter, Queue)` is NOT the same mechanism as `N1 .. Bar`.
 * {@link excludedEntityIds} computes the exclusion set.
 *
 * Kept separate from `note-layout.ts` (already at the project's 500-line
 * cap) and `layout.ts` (near cap).
 * @see ~/git/plantuml/.../svek/GraphvizImageBuilder.java:133-148,245-263
 */
import type { ClassNote, Classifier, Relationship } from './ast.js';
import type { EdgeGeo } from './layout.js';

function freestandingNoteIds(notes: readonly ClassNote[]): ReadonlySet<string> {
  return new Set(notes.filter((n) => n.target === undefined).map((n) => n.id));
}

/** Synthetic-entity ids this mechanism must never treat as a note's "real"
 *  connection target — see the module doc comment's scope guard. */
function excludedEntityIds(classifiers: readonly Classifier[]): ReadonlySet<string> {
  return new Set(
    classifiers.filter((c) => c.kind === 'assoc-circle' || c.kind === 'lollipop').map((c) => c.id),
  );
}

/**
 * Groups `items` by which freestanding note (if any) each one's `from`/`to`
 * endpoints touch, keeping only groups of size exactly 1 (`isOpalisable`'s
 * own uniqueness gate) — an item touching a NOTE at both ends (note-to-note)
 * or NEITHER end doesn't count, and one whose OTHER end is an excluded
 * synthetic entity doesn't count either (module doc comment's scope guard).
 * `isInvisible` excludes an invisible relationship the same way
 * `buildEdgeGeos` already does for the post-layout case (there, always
 * `false` — `EdgeGeo[]` is ALREADY invis-filtered).
 */
function findUniqueTouching<T>(
  items: readonly T[],
  noteIds: ReadonlySet<string>,
  excludedIds: ReadonlySet<string>,
  endpoints: (item: T) => readonly [string, string],
  isInvisible: (item: T) => boolean,
): Map<string, T> {
  const touching = new Map<string, T[]>();
  for (const item of items) {
    if (isInvisible(item)) continue;
    const [from, to] = endpoints(item);
    const fromIsNote = noteIds.has(from);
    const toIsNote = noteIds.has(to);
    if (fromIsNote === toIsNote) continue; // both or neither -> not a candidate
    const noteEnd = fromIsNote ? from : to;
    const otherEnd = fromIsNote ? to : from;
    if (excludedIds.has(otherEnd)) continue;
    const list = touching.get(noteEnd) ?? [];
    list.push(item);
    touching.set(noteEnd, list);
  }
  const out = new Map<string, T>();
  for (const [noteId, list] of touching) {
    if (list.length === 1) out.set(noteId, list[0]!);
  }
  return out;
}

/**
 * PRE-layout: the set of `ast.relationships` INDICES that are Kind-B
 * candidates — `class-dot-graph.ts#buildDotEdges` maps 1:1 by index to
 * `edge-${i}` DOT edge ids, so the caller can set `noArrow: true` on
 * exactly these before handing the graph to the layout engine. See the
 * module doc comment for why this must run BEFORE layout, not just once
 * post-layout.
 */
export function findFreestandingNoteRelationshipIndices(
  notes: readonly ClassNote[],
  relationships: readonly Relationship[],
  classifiers: readonly Classifier[],
): ReadonlySet<number> {
  const noteIds = freestandingNoteIds(notes);
  if (noteIds.size === 0) return new Set();
  const excluded = excludedEntityIds(classifiers);
  const indexed = relationships.map((rel, i) => ({ rel, i }));
  const matched = findUniqueTouching(
    indexed,
    noteIds,
    excluded,
    (x) => [x.rel.from, x.rel.to],
    (x) => x.rel.invis === true,
  );
  return new Set([...matched.values()].map((x) => x.i));
}

/**
 * POST-layout: maps a freestanding note's id to the ONE already-routed
 * `EdgeGeo` connecting it to a non-note entity. `edges` is already
 * invis-filtered by `buildEdgeGeos`, so every edge here is a real
 * candidate connection.
 */
export function findFreestandingNoteConnectors(
  notes: readonly ClassNote[],
  edges: readonly EdgeGeo[],
  classifiers: readonly Classifier[],
): Map<string, EdgeGeo> {
  const noteIds = freestandingNoteIds(notes);
  if (noteIds.size === 0) return new Map();
  const excluded = excludedEntityIds(classifiers);
  return findUniqueTouching(edges, noteIds, excluded, (e) => [e.from, e.to], () => false);
}

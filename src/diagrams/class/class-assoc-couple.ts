/**
 * Association-class couple: `(A,B) .. C` (or `C .. (A,B)`).
 *
 * PlantUML draws a tiny `shape=circle` connector on the A–B association and
 * attaches the association class C to it (verified against the oracle):
 *   A → circle, circle → B, circle → C (or C → circle for the trailing form).
 * An explicit `A -- B` association is SUBSUMED (removed): its multiplicities,
 * label, and length move onto the two circle edges — @see
 * AbstractClassOrObjectDiagram.java's `insertPointBetween`/`Association
 * #createNew`. Both A→circle and circle→B reuse the subsumed edge's own
 * `length` (its dash count; 2 when there was no prior edge — LinkArg.noDisplay
 * default) rather than a fixed value (jixamu-89-ribo225, vonago-16-zime449,
 * tunelu-64-xica833: single-dash `-`/`--` subsumed edges transfer length
 * 1/2 respectively, NOT a hardcoded self-vs-distinct constant).
 *
 * The circle→C (or C→circle) length follows `Association#createNew`'s parity
 * flip: default 1 (minlen 0), EXCEPT it flips to 2 (minlen 1) when the
 * subsumed edge's length is 1 for a DISTINCT pair, or 2 for a SELF-couple
 * `(A,A)` (jixamu/vonago/fibamu).
 *
 * A `note on link:` attached to the subsumed edge (class-commands.ts sets
 * `Relationship.linkNote`) moves onto the new circle edges the same way
 * (`NoteLinkStrategy`): fully onto the A→circle edge alone when the class-link
 * length stays 1, split across BOTH new edges when it flips to 2
 * (tunelu-64-xica833 / vonago-16-zime449). A plain inline `label` on the
 * subsumed edge always transfers fully onto A→circle regardless of the flip
 * (`LinkArg.build(existingLink.getLabel(), length)` — begico-70-guva302's
 * `research .. correlations : "Baird…"` reused by the double-couple form).
 *
 * The couple's C endpoint may be a pre-existing NOTE id (`note as N1` /
 * `N1 .. (A,B)`, temise-16-neco018) — reused directly instead of spawning a
 * phantom classifier, mirroring the relationship dispatcher's `isNoteId`
 * check (class-commands.ts rule 6).
 *
 * The multi-couple shared-circle form (`R1..(A,B)` + `(A,B)..R2`, bunuce/
 * gojole/meriso/radavi — an (A,B) pair coupled TWICE) reuses the existing
 * circle's SIBLING (a second circle, invis-linked to the first) rather than
 * a single shared node, and retroactively fixes up the OLDER circle
 * (`Association#createSecondAssociation`/`createInSecond`): its class edge
 * is unconditionally forced to C→circle (inverted if it was circle→C), and —
 * only if its own subsumed edge had length 1 — its entity edges bump to
 * length 2 and its class edge is forced to length 1. The NEWER circle's own
 * class edge is always circle→C, length 1, regardless of how its OWN couple
 * statement was written (leading or trailing) — see `retrofitPriorCircle`.
 * A third+ coupling on the same pair (upstream: `getExistingAssociatedPoints
 * .size() > 1` → "Cannot have more than 2 associations", the whole line
 * dropped) is out of scope — no fixture couples one pair more than twice.
 */

import type { ClassDiagramAST, Classifier, Relationship } from './ast.js';
import { isNoteId } from './class-notes.js';
import { stripQuotes } from './class-relationship-parser.js';
import { resolveArrow, parseArrowDecors } from './class-arrow-grammar.js';
import { EDGE_DECORATION_MAP } from './class-dot-graph.js';
import { EMPTY_SUBSUMED, subsumeExplicitAssociation } from './class-assoc-subsume.js';

/**
 * `(A,B) <arrow> C` or `C <arrow> (A,B)`. Group 1-4 = leading couple (A, B,
 * ARROW, C); 5-8 = trailing couple (C, ARROW, A, B). G2 N8: the arrow token
 * is now its own capture group (was consumed but discarded) so
 * {@link applyAssocCouple} can resolve the couple's OWN decor/dashing for
 * its class-link edge (`Association#createNew`'s `linkType` param — see
 * `Relationship.dashed`'s doc comment, ast.ts).
 */
export const ASSOC_COUPLE_RE =
  /^\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)\s*([-.=<>|*ox]+)\s*("[^"]*"|[^\s()]+)\s*$|^("[^"]*"|[^\s()]+)\s*([-.=<>|*ox]+)\s*\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)\s*$/;

/** `(A,B) <arrow> (C,D)` — a couple on both sides. Groups: A,B,C,D. */
export const ASSOC_DOUBLE_COUPLE_RE =
  /^\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)\s*[-.=<>|*ox]+\s*\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)\s*$/;

/**
 * G2 N19: shared parse-time creation counter, same shape as `ParseState
 * .creationCounter`/class-notes.ts's `NoteCreationCounter` -- optional so
 * hand-built `ClassDiagramAST` fixtures that call `applyAssocCouple`
 * directly (most unit tests) keep working unchanged, same "absent when
 * built by hand" posture `Classifier.creationIndex`'s doc comment (ast.ts)
 * establishes.
 */
export interface AssocCoupleCounter {
  value: number;
}

/**
 * Parse + apply a couple line: ensure the three classes, synthesise the circle
 * connector, and push the three association edges. Returns false if the line is
 * not a couple. `ensure` resolves/creates a classifier by name (the parser's
 * `ensureClassifier`), returning it so the resolved (qualified) id is used.
 */
export function applyAssocCouple(
  ast: ClassDiagramAST,
  ensure: (id: string) => Classifier,
  line: string,
  counter?: AssocCoupleCounter,
): boolean {
  const m = ASSOC_COUPLE_RE.exec(line);
  if (m === null) return false;
  const leading = m[1] !== undefined;
  const [a, b, c, arrowToken] = leading
    ? [m[1]!, m[2]!, m[4]!, m[3]!]
    : [m[7]!, m[8]!, m[5]!, m[6]!];
  // G2 N19: the C endpoint may already be a declared NOTE (`note as N1` then
  // `N1 .. (A,B)`, temise-16-neco018) — reuse its id directly rather than
  // spawning a phantom classifier (mirrors class-commands.ts rule 6's
  // isNoteId check for plain relationship endpoints). Resolved BEFORE the
  // circle is synthesised: `CommandLinkClass#executeArgSpecial1/2` resolves
  // ALL THREE quarks (A, B, then C) before ever calling `associationClass`
  // -- jar-verified via `buvake-41-vulu531`'s creation order (`class A;
  // class B; (A,B) .. C` -> ent0001=A, ent0002=B, ent0003=C, THEN the
  // circle's own "apoint4" name burn) -- so a NEWLY auto-created C must get
  // its `creationIndex` before the circle's phantom-slot burns below.
  const cName = stripQuotes(c);
  const cId = isNoteId(ast, cName) ? cName : ensure(c).id;
  const { circleId, classEdgeLength, forceCircleToClass, circle, invisSiblingEdges } =
    makeCoupleCircle(ast, ensure, a, b, true, counter);
  // Leading `(A,B) arrow C` draws circle→C (executeArgSpecial1, mode 1);
  // trailing `C arrow (A,B)` draws C→circle (executeArgSpecial2, mode 2).
  // A REPEAT coupling on an already-coupled pair overrides this: its class
  // edge is always circle→C regardless of how it was written
  // (`createInSecond` — see `invertPriorClassEdge`'s doc).
  const circleToClass = leading || forceCircleToClass;
  // G2 N8: the class-link edge's decor/dashing come from the couple line's
  // OWN arrow token (`pointToAssocied = new Link(..., linkType, ...)`,
  // `Association#createNew`/`#createInSecond` — `linkType` is always the
  // CURRENT command's parsed arrow, never inverted for mode/direction: decor1
  // always lands on the edge's `from` end and decor2 on `to`, matching
  // `parseArrowDecors(arrowToken, /* swapDirection */ false)` applied
  // directly to whichever endpoint `circleToClass` already resolved as
  // `from`/`to` above). `type` itself stays the couple's own hardcoded
  // `'association'` (not the resolved arrow type) to avoid perturbing the
  // DOT-graph `HIERARCHICAL` swap (extension/implementation), which keys off
  // `RelationshipType` alone and is unrelated to this render-only decor fix.
  const arrowInfo = resolveArrow(arrowToken) ?? { type: 'association' as const, swapDirection: false };
  const { sourceDecor, targetDecor } = parseArrowDecors(arrowToken, false);
  const dashed = EDGE_DECORATION_MAP[arrowInfo.type].dashed;
  const edge: Relationship = circleToClass
    ? { from: circleId, to: cId, type: 'association', length: classEdgeLength, sourceDecor, targetDecor, dashed }
    : { from: cId, to: circleId, type: 'association', length: classEdgeLength, sourceDecor, targetDecor, dashed };
  // G2 N19/N20: the couple's own class-link edge (`Association#createNew`'s
  // `pointToAssocied` / `createInSecond`'s own `pointToAssocied`) burns here
  // for BOTH the single-coupling and repeat-coupling paths -- no
  // `!forceCircleToClass` guard (was gated pre-N20).
  if (counter !== undefined) {
    counter.value += 1;
    edge.creationIndex = counter.value;
  }
  ast.relationships.push(edge);
  // G2 N20: `createInSecond`'s FINAL burn -- the invisible sibling link
  // connecting the prior circle to this one, stamped LAST (after this
  // circle's own class-edge above), on the NEW circle's own classifier --
  // see `Classifier.repeatCoupleInvisLinkCreationIndex`'s doc comment.
  if (counter !== undefined) {
    for (const _sibling of invisSiblingEdges) {
      counter.value += 1;
      circle.repeatCoupleInvisLinkCreationIndex = counter.value;
    }
  }
  return true;
}

/**
 * Double couple `(A,B) . (C,D)`: a circle per couple, joined by a VISIBLE
 * minlen-0 edge (pibifa/begico). Distinct from the same-pair invis sibling
 * link. Mirrors `associationClass`'s 4-entity overload + `insertPointBetween`
 * — no note-on-link split here (that strategy only exists on the one-sided
 * `Association#createNew` path, i.e. `applyAssocCouple` above).
 */
export function applyDoubleCouple(
  ast: ClassDiagramAST,
  ensure: (id: string) => Classifier,
  line: string,
): boolean {
  const m = ASSOC_DOUBLE_COUPLE_RE.exec(line);
  if (m === null) return false;
  const c1 = makeCoupleCircle(ast, ensure, m[1]!, m[2]!).circleId;
  const c2 = makeCoupleCircle(ast, ensure, m[3]!, m[4]!).circleId;
  ast.relationships.push({ from: c1, to: c2, type: 'association', length: 1 });
  return true;
}

/**
 * Create the circle connector for one couple `(A,B)`: ensure A/B, subsume an
 * explicit A–B edge (moving its length/multiplicities/label onto the circle
 * edges), push A→circle + circle→B, and add an invis link to any sibling
 * circle on the same pair. Returns the circle id, the resolved a/b ids, and
 * the class-link length `applyAssocCouple` needs for its own circle↔C edge
 * (`Association#createNew`'s parity-flip rule — see file doc).
 *
 * `splitNoteOnLink` is true only for the one-sided couple path
 * (`applyAssocCouple`): a subsumed `linkNote` transfers fully onto the
 * A→circle edge when the class-link length stays 1, or is split across BOTH
 * new edges when it flips to 2. The double-couple path (`applyDoubleCouple`)
 * has no such split — a plain `label` always transfers fully onto A→circle
 * regardless of `splitNoteOnLink`.
 */
function makeCoupleCircle(
  ast: ClassDiagramAST,
  ensure: (id: string) => Classifier,
  // Verbatim names (quotes included) so `ensure` resolves to the SAME id a
  // `class "side1"` declaration produced, which keeps its quotes.
  aName: string,
  bName: string,
  splitNoteOnLink = false,
  // G2 N19: single-coupling-only jar cpt1 burn tracking (`AssocCoupleCounter`'s
  // doc comment) -- deliberately NOT applied on the repeat-coupling path
  // (`isRepeatCouple`/`createSecondAssociation`/`createInSecond`) or the
  // double-couple `(A,B) arrow (C,D)` path (`applyDoubleCouple`, which never
  // passes a counter here): both burn jar's shared counter in a DIFFERENT
  // relative order than the single-coupling `Association` class this
  // function otherwise mirrors -- named remainder, `plans/g2-class-svg/
  // ledger.md` N19.
  counter?: AssocCoupleCounter,
): {
  circleId: string; aId: string; bId: string; classEdgeLength: number; forceCircleToClass: boolean;
  circle: Classifier; invisSiblingEdges: Relationship[];
} {
  const aId = ensure(aName).id;
  const bId = ensure(bName).id;
  const priorCircles = sameAssocCircles(ast, aId, bId);
  // Association#createSecondAssociation's branch: a REPEAT coupling on an
  // already-coupled (A,B) pair (bunuce/gojole/meriso/radavi) — a third+
  // coupling is out of scope (upstream errors the whole line out; see file doc).
  const isRepeatCouple = priorCircles.length === 1;
  if (isRepeatCouple) applyLengthFlip(ast, priorCircles[0]!, aId, bId);

  const subsumed = subsumeExplicitAssociation(ast, aId, bId);
  const circleId = `__assoc${ast.classifiers.filter((x) => x.kind === 'assoc-circle').length}`;
  const circle: Classifier = { id: circleId, display: '', kind: 'assoc-circle', typeParams: [], members: [] };
  // G2 N19: `Association`'s ctor burns the jar shared counter TWICE,
  // consecutively -- once for the `"apoint" + N` name (`getUniqueSequence
  // ("apoint")`), once for the circle Entity's own uid (`reallyCreateLeaf`).
  // Neither is ever collapsed by dense re-numbering into the OTHER burns
  // this function/`applyAssocCouple` make below -- see `Classifier
  // .syntheticIdName`/`.phantomSlot`/`.noUidSlot`'s doc comments (ast.ts).
  // G2 N20: `Association`'s ctor (name+own-uid burns) runs identically for
  // `createSecondAssociation`'s NEW circle -- no `!isRepeatCouple` guard
  // (was gated pre-N20, when repeat-coupling was entirely unstamped).
  if (counter !== undefined) {
    counter.value += 1;
    circle.syntheticIdName = `apoint${counter.value}`;
    counter.value += 1;
    circle.creationIndex = counter.value;
    circle.phantomSlot = true;
    circle.noUidSlot = true;
    // G2 N19: preserve the removed explicit edge's own real jar burn -- see
    // `SubsumedLink.creationIndex`'s doc comment.
    if (subsumed.creationIndex !== undefined) {
      circle.subsumedLinkCreationIndex = subsumed.creationIndex;
    }
  }
  ast.classifiers.push(circle);

  // createInSecond hardcodes both entity edges to length 2 for a repeat
  // coupling, regardless of any subsumed edge's own length.
  const entityLength = isRepeatCouple ? 2 : (subsumed.length ?? 2);
  // G2 N8: entity edges keep the subsumed link's own per-end decor, split
  // via `Association#createNew`'s `getPart1()`/`getPart2()` — NONE at the
  // circle end always, the original a/b-side decor at the classifier end
  // (`SubsumedLink.aSideDecor`/`bSideDecor` doc comment); the body dash
  // style (`linkStyle`, untouched by the split) is shared by both new edges.
  const subsumedDashed = subsumed.dashed ?? false;
  const aEdge: Relationship = {
    from: aId, to: circleId, type: 'association', length: entityLength,
    sourceDecor: 'none', targetDecor: subsumed.bSideDecor ?? 'none', dashed: subsumedDashed,
  };
  if (subsumed.a !== undefined) aEdge.fromMultiplicity = subsumed.a;
  // A `Class::member` port on the subsumed edge (pajoka-72-reju527) still
  // registers the classifier as port-shielded (upstream: `Entity
  // #addPortShortName`, a permanent entity-level flag set once, independent
  // of the link's later lifecycle) — our port has no such persistent flag, so
  // the port is carried onto the surviving circle edge instead: shieldedClassifierIds
  // (class-layout-helpers.ts) scans ALL current relationships for `fromPort`/
  // `toPort`, so this reproduces the same observable shield.
  if (subsumed.portA !== undefined) aEdge.fromPort = subsumed.portA;
  const bEdge: Relationship = {
    from: circleId, to: bId, type: 'association', length: entityLength,
    sourceDecor: subsumed.aSideDecor ?? 'none', targetDecor: 'none', dashed: subsumedDashed,
  };
  if (subsumed.b !== undefined) bEdge.toMultiplicity = subsumed.b;
  if (subsumed.portB !== undefined) bEdge.toPort = subsumed.portB;

  // Association#createNew's parity flip: default 1, flip to 2 exactly when
  // the subsumed length/self-couple-ness disagree. A repeat coupling instead
  // hardcodes 1 (createInSecond's `LinkArg.build(label, 1)`).
  const isSelf = aId === bId;
  const classEdgeLength = isRepeatCouple
    ? 1
    : (entityLength === 1 && !isSelf) || (entityLength === 2 && isSelf)
      ? 2
      : 1;

  if (splitNoteOnLink && subsumed.linkNote !== undefined) {
    aEdge.label = subsumed.linkNote;
    if (classEdgeLength !== 1) bEdge.label = subsumed.linkNote;
  } else if (subsumed.label !== undefined) {
    aEdge.label = subsumed.label;
  }

  // G2 N19: `Association#createNew` constructs `entity1ToPoint` THEN
  // `pointToEntity2`, immediately after the circle's own two burns above --
  // stamp in that exact order (repeat-coupling stays unstamped, matching
  // the ctor guard above). When NO explicit A-B association existed to
  // subsume (`subsumed === EMPTY_SUBSUMED`), `createNew`'s OWN
  // `existingLink = new Link(..., LinkDecor.NONE, LinkDecor.NONE, ...)`
  // fallback burns ONE extra phantom slot right here, purely to supply
  // default type/length values -- jar-verified: `buvake-41-vulu531`'s
  // `(A,B) .. C` (no prior `A--B` line) numbers its edges ONE HIGHER than
  // `bosiki-11-xaza958`'s otherwise-identical shape (which DOES subsume an
  // explicit `A--B`) -- see `Relationship.phantomSlot`'s doc comment.
  // G2 N20: `createInSecond`'s phantom-default-link + entity1ToPoint +
  // pointToEntity2 burns run identically for a repeat coupling (its OWN
  // `existingLink = foundLink(...)` is always null too, per the SAME
  // already-split-by-coupling-#1 reasoning -- no `!isRepeatCouple` guard).
  if (counter !== undefined) {
    if (subsumed === EMPTY_SUBSUMED) counter.value += 1;
    counter.value += 1;
    aEdge.creationIndex = counter.value;
    if (subsumed === EMPTY_SUBSUMED) aEdge.phantomSlot = true;
    counter.value += 1;
    bEdge.creationIndex = counter.value;
  }
  ast.relationships.push(aEdge, bEdge);
  // G2 N20: the CONDITIONAL `getInv()` burn -- must run AFTER aEdge/bEdge's
  // own burns above, BEFORE this circle's own class-edge burn (which
  // `applyAssocCouple` stamps AFTER `makeCoupleCircle` returns) -- see
  // `invertPriorClassEdge`'s own doc comment for the exact jar citation.
  if (isRepeatCouple) invertPriorClassEdge(ast, priorCircles[0]!, aId, bId, counter);
  // G2 N20: the invisible sibling link (`createInSecond`'s FINAL burn) is
  // pushed here (structural placement unchanged from pre-N20) but NOT
  // stamped yet -- its creationIndex comes LAST in jar's real sequence,
  // AFTER this circle's own class-edge (`applyAssocCouple`, which receives
  // it back via `invisSiblingEdges` and stamps it there).
  const invisSiblingEdges: Relationship[] = [];
  for (const prior of priorCircles) {
    const sibling: Relationship = { from: prior, to: circleId, type: 'association', length: 1, invis: true };
    ast.relationships.push(sibling);
    invisSiblingEdges.push(sibling);
  }
  return { circleId, aId, bId, classEdgeLength, forceCircleToClass: isRepeatCouple, circle, invisSiblingEdges };
}

/** The circle's OWN class-link edge — the one relationship touching
 *  `circleId` that is neither its A nor B entity edge, found by elimination
 *  (a circle has at most: A→circle, circle→B, an invis sibling link, and one
 *  class-link edge). */
function findClassEdge(
  rels: readonly Relationship[],
  circleId: string,
  aId: string,
  bId: string,
): Relationship | undefined {
  return rels.find(
    (r) =>
      r.invis !== true &&
      (r.from === circleId || r.to === circleId) &&
      r.from !== aId &&
      r.to !== aId &&
      r.from !== bId &&
      r.to !== bId,
  );
}

/**
 * `Association#createSecondAssociation`'s length-flip mutation on the OLDER
 * circle when an (A,B) pair gets coupled a second time (`AbstractClassOr
 * ObjectDiagram.java:242-246`): ONLY if its own subsumed edge had length 1,
 * its entity↔circle edges bump to length 2 and its class edge is forced
 * to length 1. No burn (a pure field mutation on already-created Link
 * objects) — distinct from {@link invertPriorClassEdge} below (a
 * DIFFERENT upstream method, `createInSecond`, which DOES burn).
 */
function applyLengthFlip(ast: ClassDiagramAST, priorId: string, aId: string, bId: string): void {
  const rels = ast.relationships;
  const priorAEdge = rels.find((r) => r.from === aId && r.to === priorId);
  const priorBEdge = rels.find((r) => r.from === priorId && r.to === bId);
  const classEdge = findClassEdge(rels, priorId, aId, bId);
  if (priorAEdge?.length === 1) {
    priorAEdge.length = 2;
    if (priorBEdge !== undefined) priorBEdge.length = 2;
    if (classEdge !== undefined) classEdge.length = 1;
  }
}

/**
 * `Association#createInSecond`'s CONDITIONAL class-edge inversion
 * (`AbstractClassOrObjectDiagram.java:326-330`): the OLDER circle's class
 * edge is inverted to C→circle exactly when it currently points
 * circle→C (a "leading"-form first coupling) — jar's `getInv()`
 * constructs a BRAND NEW `Link` object, burning ONE more shared-counter
 * slot; this port instead mutates the EXISTING `Relationship` object in
 * place (`from`/`to` swap, matching the pre-N20 structural behavior
 * exactly) and, when a counter is active, re-stamps its `creationIndex` to
 * the new burn's value while preserving the orphaned old value on the
 * PRIOR circle's own {@link Classifier.invertedClassEdgeOldCreationIndex}
 * (see that field's doc comment, ast.ts, for why the old rank must stay
 * represented as a phantom).
 */
function invertPriorClassEdge(
  ast: ClassDiagramAST,
  priorId: string,
  aId: string,
  bId: string,
  counter?: AssocCoupleCounter,
): void {
  const rels = ast.relationships;
  const classEdge = findClassEdge(rels, priorId, aId, bId);
  if (classEdge === undefined || classEdge.from !== priorId) return;
  const classEdgeIdx = rels.indexOf(classEdge);
  // G2 N20: jar's `getInv()` REMOVES the old link and RE-ADDS the new
  // (inverted) one at the CURRENT point in the draw-order list
  // (`removeLink`/`addLink`, AbstractClassOrObjectDiagram.java:327-329) --
  // a real reordering, not an in-place value swap. Splice-and-repush
  // reproduces the exact jar-verified draw position (right after THIS
  // coupling's own aEdge/bEdge, before its class-edge) -- see
  // `bunuce-10-vere519`'s jar SVG (`R1-apoint6` drawn 3rd-to-last, not
  // 3rd, once its FIRST coupling was leading-form).
  rels.splice(classEdgeIdx, 1);
  const other = classEdge.to;
  classEdge.to = priorId;
  classEdge.from = other;
  rels.push(classEdge);
  if (counter === undefined) return;
  const oldIndex = classEdge.creationIndex;
  counter.value += 1;
  classEdge.creationIndex = counter.value;
  if (oldIndex === undefined) return;
  const priorCircle = ast.classifiers.find((c) => c.id === priorId);
  if (priorCircle !== undefined) priorCircle.invertedClassEdgeOldCreationIndex = oldIndex;
}

/** assoc-circle ids that already connect to BOTH aId and bId (same pair). */
function sameAssocCircles(ast: ClassDiagramAST, aId: string, bId: string): string[] {
  const touches = (cid: string, id: string): boolean =>
    ast.relationships.some((r) => (r.from === cid && r.to === id) || (r.from === id && r.to === cid));
  return ast.classifiers
    .filter((x) => x.kind === 'assoc-circle')
    .map((x) => x.id)
    .filter((cid) => touches(cid, aId) && touches(cid, bId));
}

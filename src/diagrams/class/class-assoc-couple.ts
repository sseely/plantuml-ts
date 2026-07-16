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

import type { ClassDiagramAST, Classifier, Relationship, LinkDecor } from './ast.js';
import { isNoteId } from './class-notes.js';
import { stripQuotes } from './class-relationship-parser.js';
import { resolveArrow, parseArrowDecors } from './class-arrow-grammar.js';
import { EDGE_DECORATION_MAP } from './class-dot-graph.js';

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
 * Parse + apply a couple line: ensure the three classes, synthesise the circle
 * connector, and push the three association edges. Returns false if the line is
 * not a couple. `ensure` resolves/creates a classifier by name (the parser's
 * `ensureClassifier`), returning it so the resolved (qualified) id is used.
 */
export function applyAssocCouple(
  ast: ClassDiagramAST,
  ensure: (id: string) => Classifier,
  line: string,
): boolean {
  const m = ASSOC_COUPLE_RE.exec(line);
  if (m === null) return false;
  const leading = m[1] !== undefined;
  const [a, b, c, arrowToken] = leading
    ? [m[1]!, m[2]!, m[4]!, m[3]!]
    : [m[7]!, m[8]!, m[5]!, m[6]!];
  const { circleId, classEdgeLength, forceCircleToClass } = makeCoupleCircle(ast, ensure, a, b, true);
  // The C endpoint may already be a declared NOTE (`note as N1` then
  // `N1 .. (A,B)`, temise-16-neco018) — reuse its id directly rather than
  // spawning a phantom classifier (mirrors class-commands.ts rule 6's
  // isNoteId check for plain relationship endpoints).
  const cName = stripQuotes(c);
  const cId = isNoteId(ast, cName) ? cName : ensure(c).id;
  // Leading `(A,B) arrow C` draws circle→C (executeArgSpecial1, mode 1);
  // trailing `C arrow (A,B)` draws C→circle (executeArgSpecial2, mode 2).
  // A REPEAT coupling on an already-coupled pair overrides this: its class
  // edge is always circle→C regardless of how it was written
  // (`createInSecond` — see `retrofitPriorCircle`'s doc).
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
  ast.relationships.push(edge);
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
): { circleId: string; aId: string; bId: string; classEdgeLength: number; forceCircleToClass: boolean } {
  const aId = ensure(aName).id;
  const bId = ensure(bName).id;
  const priorCircles = sameAssocCircles(ast, aId, bId);
  // Association#createSecondAssociation's branch: a REPEAT coupling on an
  // already-coupled (A,B) pair (bunuce/gojole/meriso/radavi) — a third+
  // coupling is out of scope (upstream errors the whole line out; see file doc).
  const isRepeatCouple = priorCircles.length === 1;
  if (isRepeatCouple) retrofitPriorCircle(ast, priorCircles[0]!, aId, bId);

  const subsumed = subsumeExplicitAssociation(ast, aId, bId);
  const circleId = `__assoc${ast.classifiers.filter((x) => x.kind === 'assoc-circle').length}`;
  ast.classifiers.push({ id: circleId, display: '', kind: 'assoc-circle', typeParams: [], members: [] });

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

  ast.relationships.push(aEdge, bEdge);
  for (const prior of priorCircles) {
    ast.relationships.push({ from: prior, to: circleId, type: 'association', length: 1, invis: true });
  }
  return { circleId, aId, bId, classEdgeLength, forceCircleToClass: isRepeatCouple };
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
 * `Association#createInSecond`'s retroactive fixup on the OLDER circle when
 * an (A,B) pair gets coupled a second time: its class edge is unconditionally
 * inverted to C→circle if it currently points circle→C, and — ONLY if its own
 * subsumed edge had length 1 (`createSecondAssociation`'s guard) — its
 * entity↔circle edges bump to length 2 and its class edge is forced to
 * length 1.
 */
function retrofitPriorCircle(ast: ClassDiagramAST, priorId: string, aId: string, bId: string): void {
  const rels = ast.relationships;
  const priorAEdge = rels.find((r) => r.from === aId && r.to === priorId);
  const priorBEdge = rels.find((r) => r.from === priorId && r.to === bId);
  const classEdge = findClassEdge(rels, priorId, aId, bId);
  if (priorAEdge?.length === 1) {
    priorAEdge.length = 2;
    if (priorBEdge !== undefined) priorBEdge.length = 2;
    if (classEdge !== undefined) classEdge.length = 1;
  }
  if (classEdge !== undefined && classEdge.from === priorId) {
    const other = classEdge.to;
    classEdge.to = priorId;
    classEdge.from = other;
  }
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

interface SubsumedLink {
  a: string | undefined;
  b: string | undefined;
  portA: string | undefined;
  portB: string | undefined;
  length: number | undefined;
  label: string | undefined;
  linkNote: string | undefined;
  /**
   * G2 N8: the subsumed edge's own per-end decor, resolved to its EFFECTIVE
   * value (`ex.sourceDecor`/`targetDecor`, falling back to
   * `EDGE_DECORATION_MAP[ex.type]` the same way `layout.ts#buildEdgeGeos`
   * does) — feeds `Association#createNew`'s `getPart1()`/`getPart2()` split
   * (decor1→the `a`-side edge's OWN end, NONE at the circle end; decor2→the
   * `b`-side edge's OWN end, NONE at the circle end). `aSideDecor`/
   * `bSideDecor` name the decor at THAT classifier's own end of the
   * ORIGINAL two-entity link, oriented so `makeCoupleCircle` never has to
   * re-derive `ex.from === aId` itself. NOT verified against a link.
   * isInverted()-normalized original entity (upstream's own bookkeeping for
   * a link parsed in reversed textual order) — every corpus fixture that
   * reaches this path subsumes a plain, undecorated `--`/`-` association
   * (jar-verified survey, G2 N8), so this simplification is unreached by
   * any known fixture; flagged, not fixed, for a decorated-subsumed-edge
   * case if one is ever found.
   */
  aSideDecor: LinkDecor | undefined;
  bSideDecor: LinkDecor | undefined;
  /** The subsumed edge's own body dash-style — carried to BOTH new entity
   *  edges unchanged (`LinkType`'s `linkStyle` is untouched by `getPart1()`/
   *  `getPart2()`, only `decor1`/`decor2` are split). */
  dashed: boolean | undefined;
}

const EMPTY_SUBSUMED: SubsumedLink = {
  a: undefined,
  b: undefined,
  portA: undefined,
  portB: undefined,
  length: undefined,
  label: undefined,
  linkNote: undefined,
  aSideDecor: undefined,
  bSideDecor: undefined,
  dashed: undefined,
};

/** Index of the LAST relationship directly between aId/bId (either direction),
 *  mirroring `AbstractClassOrObjectDiagram#foundLink`'s backward scan — when
 *  TWO relationships exist between the same pair (begico-70-guva302: a
 *  composition AND a later separate dotted association between
 *  `research`/`correlations`), the couple subsumes the MOST RECENTLY declared
 *  one, leaving earlier ones as their own separate edges. -1 when none. */
function findLastAssociationIndex(rels: readonly Relationship[], aId: string, bId: string): number {
  for (let i = rels.length - 1; i >= 0; i--) {
    const r = rels[i]!;
    if ((r.from === aId && r.to === bId) || (r.from === bId && r.to === aId)) return i;
  }
  return -1;
}

/**
 * Remove an explicit `A -- B` association (the couple subsumes it) and return
 * its multiplicities/ports/length/label/linkNote, oriented to the a/b sides
 * (a `Class::member` port on the subsumed edge still shields the classifier —
 * see `makeCoupleCircle`'s `portA`/`portB` comment). Returns all-`undefined`
 * when none existed.
 */
function subsumeExplicitAssociation(ast: ClassDiagramAST, aId: string, bId: string): SubsumedLink {
  const idx = findLastAssociationIndex(ast.relationships, aId, bId);
  if (idx < 0) return EMPTY_SUBSUMED;
  const ex = ast.relationships[idx]!;
  ast.relationships.splice(idx, 1);
  // Effective per-end decor, resolved the same way `layout.ts#buildEdgeGeos`
  // resolves a relationship's own decor (explicit override, else the
  // type-derived default) — see `SubsumedLink.aSideDecor`'s doc comment.
  const decor = EDGE_DECORATION_MAP[ex.type];
  const exSourceDecor = ex.sourceDecor ?? decor.sourceDecor;
  const exTargetDecor = ex.targetDecor ?? decor.targetDecor;
  const exDashed = ex.dashed ?? decor.dashed;
  const oriented =
    ex.from === aId
      ? {
          a: ex.fromMultiplicity, b: ex.toMultiplicity, portA: ex.fromPort, portB: ex.toPort,
          aSideDecor: exSourceDecor, bSideDecor: exTargetDecor,
        }
      : {
          a: ex.toMultiplicity, b: ex.fromMultiplicity, portA: ex.toPort, portB: ex.fromPort,
          aSideDecor: exTargetDecor, bSideDecor: exSourceDecor,
        };
  return { ...oriented, length: ex.length, label: ex.label, linkNote: ex.linkNote, dashed: exDashed };
}

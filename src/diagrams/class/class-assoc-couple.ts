/**
 * Association-class couple: `(A,B) .. C` (or `C .. (A,B)`).
 *
 * PlantUML draws a tiny `shape=circle` connector on the A–B association and
 * attaches the association class C to it (verified against the oracle):
 *   A → circle (minlen 1), circle → B (minlen 1), circle → C.
 * The class-link circle→C is minlen 0 for a distinct pair (buvake/jaloja) and
 * minlen 1 for a self-couple `(A,A)` (fibamu). An explicit `A -- B` association
 * is SUBSUMED: it is removed and its multiplicities move onto the circle edges
 * as the tail (A) and head (B) labels (jaloja/fibamu).
 *
 * The multi-couple shared-circle form (`R1..(A,B)` + `(A,B)..R2`, getufo/meriso)
 * and the double-couple `(A,B) . (A,C)` (pibifa) are not handled here.
 */

import type { ClassDiagramAST, Classifier, Relationship } from './ast.js';

/** `(A,B) <arrow> C` or `C <arrow> (A,B)`. Group 1-3 = leading couple; 4-6 = trailing. */
export const ASSOC_COUPLE_RE =
  /^\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)\s*[-.=<>|*ox]+\s*("[^"]*"|[^\s()]+)\s*$|^("[^"]*"|[^\s()]+)\s*[-.=<>|*ox]+\s*\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)\s*$/;

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
  const [a, b, c] = m[1] !== undefined ? [m[1], m[2]!, m[3]!] : [m[5]!, m[6]!, m[4]!];
  const { circleId, aId, bId } = makeCoupleCircle(ast, ensure, a, b);
  const cId = ensure(c).id;
  // Self-couple `(A,A)` places the class one rank down (minlen 1); a distinct
  // pair keeps it beside the connector (minlen 0).
  ast.relationships.push({ from: circleId, to: cId, type: 'association', length: aId === bId ? 2 : 1 });
  return true;
}

/**
 * Double couple `(A,B) . (C,D)`: a circle per couple, joined by a VISIBLE
 * minlen-0 edge (pibifa/begico). Distinct from the same-pair invis sibling link.
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
 * explicit A–B edge (moving multiplicities onto the circle edges), push
 * A→circle + circle→B, and add an invis link to any sibling circle on the same
 * pair. Returns the circle id and the resolved a/b ids.
 */
function makeCoupleCircle(
  ast: ClassDiagramAST,
  ensure: (id: string) => Classifier,
  // Verbatim names (quotes included) so `ensure` resolves to the SAME id a
  // `class "side1"` declaration produced, which keeps its quotes.
  aName: string,
  bName: string,
): { circleId: string; aId: string; bId: string } {
  const aId = ensure(aName).id;
  const bId = ensure(bName).id;
  const priorCircles = sameAssocCircles(ast, aId, bId);
  const mult = subsumeExplicitAssociation(ast, aId, bId);
  const circleId = `__assoc${ast.classifiers.filter((x) => x.kind === 'assoc-circle').length}`;
  ast.classifiers.push({ id: circleId, display: '', kind: 'assoc-circle', typeParams: [], members: [] });
  const aEdge: Relationship = { from: aId, to: circleId, type: 'association', length: 2 };
  if (mult.a !== undefined) aEdge.fromMultiplicity = mult.a;
  const bEdge: Relationship = { from: circleId, to: bId, type: 'association', length: 2 };
  if (mult.b !== undefined) bEdge.toMultiplicity = mult.b;
  ast.relationships.push(aEdge, bEdge);
  for (const prior of priorCircles) {
    ast.relationships.push({ from: prior, to: circleId, type: 'association', length: 1, invis: true });
  }
  return { circleId, aId, bId };
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

/**
 * Remove an explicit `A -- B` association (the couple subsumes it) and return
 * its multiplicities, oriented to the a/b sides. Returns empty when none.
 */
function subsumeExplicitAssociation(
  ast: ClassDiagramAST,
  aId: string,
  bId: string,
): { a: string | undefined; b: string | undefined } {
  const idx = ast.relationships.findIndex(
    (r) => (r.from === aId && r.to === bId) || (r.from === bId && r.to === aId),
  );
  if (idx < 0) return { a: undefined, b: undefined };
  const ex = ast.relationships[idx]!;
  ast.relationships.splice(idx, 1);
  return ex.from === aId
    ? { a: ex.fromMultiplicity, b: ex.toMultiplicity }
    : { a: ex.toMultiplicity, b: ex.fromMultiplicity };
}

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
  // Use the endpoint names verbatim (quotes included) — `ensure` must resolve to
  // the SAME id a `class "side1"` declaration produced, which keeps its quotes.
  const [a, b, c] = m[1] !== undefined ? [m[1], m[2]!, m[3]!] : [m[5]!, m[6]!, m[4]!];
  const aId = ensure(a).id;
  const bId = ensure(b!).id;
  const cId = ensure(c!).id;
  const mult = subsumeExplicitAssociation(ast, aId, bId);

  const circleId = `__assoc${ast.classifiers.filter((x) => x.kind === 'assoc-circle').length}`;
  ast.classifiers.push({ id: circleId, display: '', kind: 'assoc-circle', typeParams: [], members: [] });
  const aEdge: Relationship = { from: aId, to: circleId, type: 'association', length: 2 };
  if (mult.a !== undefined) aEdge.fromMultiplicity = mult.a;
  const bEdge: Relationship = { from: circleId, to: bId, type: 'association', length: 2 };
  if (mult.b !== undefined) bEdge.toMultiplicity = mult.b;
  // Self-couple `(A,A)` places the class one rank down (minlen 1); a distinct
  // pair keeps it beside the connector (minlen 0).
  const cEdge: Relationship = { from: circleId, to: cId, type: 'association', length: aId === bId ? 2 : 1 };
  ast.relationships.push(aEdge, bEdge, cEdge);
  return true;
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

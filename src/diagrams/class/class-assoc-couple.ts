/**
 * Association-class couple: `(A,B) .. C` (or `C .. (A,B)`).
 *
 * PlantUML draws a tiny `shape=circle` connector on the A–B association and
 * attaches the association class C to it. Structure verified against the oracle
 * (buvake/jaloja/pabuma/pibifa/sacala), all with the same edge minlens:
 *   A → circle (minlen 1), circle → B (minlen 1), circle → C (minlen 0),
 * encoded via arrow `length` (minlen = length - 1) of 2 / 2 / 1.
 *
 * Only the pure single-couple form is handled here; the multi-couple / explicit
 * self-association variants (getufo/meriso/fibamu) have different structure.
 */

import type { ClassDiagramAST, Classifier } from './ast.js';

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
  const circleId = `__assoc${ast.classifiers.filter((x) => x.kind === 'assoc-circle').length}`;
  ast.classifiers.push({ id: circleId, display: '', kind: 'assoc-circle', typeParams: [], members: [] });
  ast.relationships.push(
    { from: aId, to: circleId, type: 'association', length: 2 },
    { from: circleId, to: bId, type: 'association', length: 2 },
    { from: circleId, to: cId, type: 'association', length: 1 },
  );
  return true;
}

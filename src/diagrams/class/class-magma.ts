/**
 * Class-engine binding for the shared cucadiagram "Magma" standalone-chaining
 * feature (`src/core/magma.ts`). Builds the class diagram's `MagmaGroupInput[]`
 * (root pseudo-group + each namespace with its direct classifiers, declaration
 * order) and the `touched` set (every relationship endpoint), then delegates to
 * the shared `buildMagmaEdges`.
 */
import type { ClassDiagramAST } from './ast.js';
import type { DotInputEdge } from '../../core/graph-layout.js';
import { buildMagmaEdges, type MagmaGroupInput } from '../../core/magma.js';

/**
 * Build the invisible square-grid chaining edges for a class diagram's
 * standalone (link-less) classifiers. `anchors` are the package-endpoint
 * classifiers dropped from the dot node set — they must not be magma leaves.
 */
export function buildClassMagmaEdges(
  ast: ClassDiagramAST,
  anchors: Map<string, string>,
): DotInputEdge[] {
  const touched = new Set<string>();
  for (const rel of ast.relationships) {
    touched.add(rel.from);
    touched.add(rel.to);
  }

  const inNamespace = new Set(ast.namespaces.flatMap((n) => n.classifiers));
  const isMagmaLeaf = (id: string): boolean => !anchors.has(id);

  const rootLeaves = ast.classifiers
    .filter((c) => !inNamespace.has(c.id) && isMagmaLeaf(c.id))
    .map((c) => c.id);

  const groups: MagmaGroupInput[] = [
    { astId: undefined, parentAstId: undefined, leafDotIds: rootLeaves },
  ];
  for (const ns of ast.namespaces) {
    groups.push({
      astId: ns.id,
      parentAstId: ns.parentId,
      leafDotIds: ns.classifiers.filter(isMagmaLeaf),
    });
  }

  return buildMagmaEdges(groups, touched);
}

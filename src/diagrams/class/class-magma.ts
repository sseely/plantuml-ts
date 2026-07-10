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
 * Every dot node id that upstream's isStandalone (CucaDiagram.java:630-635)
 * would find attached to a Link: relationship endpoints plus attached-note
 * connectors. isStandalone walks ALL links with no filtering, so a `note
 * <pos> of Entity`'s Link (CommandFactoryNoteOnEntity#executeInternal
 * ~line 340-360, addLink at line 360) makes BOTH the note leaf and its host
 * classifier non-standalone. A floating note (`note as N ... end note`,
 * `target` undefined) gets no Link unless a later relationship line connects
 * it — that case is already covered by the relationship endpoints below.
 */
function collectTouched(ast: ClassDiagramAST): Set<string> {
  const touched = new Set<string>();
  for (const rel of ast.relationships) {
    touched.add(rel.from);
    touched.add(rel.to);
  }
  for (const note of ast.notes) {
    if (note.target !== undefined) {
      touched.add(note.target);
      touched.add(note.id);
    }
  }
  return touched;
}

/**
 * Build the invisible square-grid chaining edges for a class diagram's
 * standalone (link-less) classifiers. `anchors` are the package-endpoint
 * classifiers dropped from the dot node set — they must not be magma leaves.
 */
export function buildClassMagmaEdges(
  ast: ClassDiagramAST,
  anchors: Map<string, string>,
): DotInputEdge[] {
  const touched = collectTouched(ast);

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

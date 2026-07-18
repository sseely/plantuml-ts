/**
 * Class-engine binding for the shared cucadiagram "Magma" standalone-chaining
 * feature (`src/core/magma.ts`). Builds the class diagram's `MagmaGroupInput[]`
 * (root pseudo-group + each namespace with its direct classifiers, declaration
 * order) and the `touched` set (every relationship endpoint), then delegates to
 * the shared `buildMagmaEdges`.
 */
import type { ClassDiagramAST, Classifier } from './ast.js';
import type { DotInputEdge } from '../../core/graph-layout.js';
import { buildMagmaEdges, type MagmaGroupInput } from '../../core/magma.js';

/**
 * True for a classifier synthesized by `collapseEmptyNamespace`
 * (class-namespace.ts) from an empty `package`/`namespace` — a plain group
 * collapsed to a `kind: 'descriptive'` leaf with NO `usymbol`. Every
 * genuinely-declared descriptive leaf/container always carries a `usymbol`
 * (its source keyword — `database`, `rectangle`, …): directly-declared ones
 * via `class-declaration-parser.ts`'s TYPE_MAP (`{ kind: 'descriptive',
 * usymbol: rawKind }`), and collapsed-empty DESCRIPTIVE containers
 * (`rectangle Foo {}`) via `closeContainer`'s immediate `usymbol =
 * usymbol` assignment right after the collapse (class-container.ts). Only
 * the plain-package/namespace collapse path never sets one — the one place
 * `makeClassifier(nsId, 'descriptive', ns.display, parentId)` is called
 * with no follow-up `usymbol` write, whether the collapse ran at parse time
 * (same-line `X {}`) or later at the layout-input boundary
 * (`collapseEmptyNamespacesFinal`). That distinguishes it reliably, in
 * either the pre- or post-collapse AST, without needing to reach back into
 * the parser (see `isCollapsedGroup`'s use below).
 */
export function isCollapsedGroup(c: Classifier): boolean {
  return c.kind === 'descriptive' && c.usymbol === undefined;
}
// G2 N33: also consumed by `class-layout-helpers.ts#measureClassifier`
// (sizing dispatch) and `renderer.ts` (unwrapped-render dispatch) -- the
// SAME test both use to decide a collapsed-empty package/namespace draws
// its own small `EntityImageEmptyPackage` folder icon instead of a
// classifier box, and must never be a magma leaf either.

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
 *
 * A classifier synthesized from a collapsed-empty `package`/`namespace`
 * (`isCollapsedGroup` above) must ALSO never be a magma leaf. Upstream
 * computes magma (`CucaDiagram#applySingleStrategy`, CucaDiagram.java:
 * 679-706) over `Entity.leafs()`, which excludes every `isGroup()==true`
 * child (abel/Entity.java:649-655) — at that point in upstream's pipeline
 * an empty package/namespace is STILL a group; the mute to a leaf type
 * (`LeafType.EMPTY_PACKAGE`) happens later, at DOT-export time
 * (`GraphvizImageBuilder#printGroups`), strictly after `applySingleStrategy`
 * already ran. This port instead computes magma from an AST where that
 * collapse has already happened (at parse time for same-line `X {}`, or at
 * the layout-input boundary for `collapseEmptyNamespacesFinal`), so without
 * this exclusion 3 unrelated top-level entities (one real leaf plus two
 * collapsed empty containers) wrongly clear the >=3 standalone threshold and
 * get square-chained, while the oracle emits no magma edges for them
 * (gatula-10-bifu561: `package foo {}` / `namespace bar {}` / `class qux {}`).
 */
export function buildClassMagmaEdges(
  ast: ClassDiagramAST,
  anchors: Map<string, string>,
): DotInputEdge[] {
  const touched = collectTouched(ast);

  const inNamespace = new Set(ast.namespaces.flatMap((n) => n.classifiers));
  const classifierById = new Map(ast.classifiers.map((c) => [c.id, c] as const));
  const isMagmaLeaf = (id: string): boolean => {
    if (anchors.has(id)) return false;
    const classifier = classifierById.get(id);
    return classifier === undefined || !isCollapsedGroup(classifier);
  };

  // Root-level NOTE leaves count too: upstream `g.leafs()` yields every leaf
  // of the group — notes and classifiers live in the same Quark tree — so two
  // floating notes plus one class reach the >=3 standalone threshold and get
  // square-chained (nuxoni-26-xala894). A floating note's dot node id is its
  // own note id (note-layout.ts newGroup); attached notes are `touched`
  // (collectTouched) and drop out inside buildMagmaEdges, matching upstream's
  // isStandalone. In-namespace notes are already in `Namespace.classifiers`
  // (see ClassNote.namespace) so the per-namespace groups below cover them.
  // Appending notes after classifiers loses upstream's exact creation
  // interleave, but every parity check (degree/minlen multisets) is invariant
  // under standalone order — only leaf identity assignments shift.
  const rootLeaves = [
    ...ast.classifiers.filter((c) => !inNamespace.has(c.id)).map((c) => c.id),
    ...ast.notes.filter((n) => n.namespace === undefined).map((n) => n.id),
  ].filter(isMagmaLeaf);

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

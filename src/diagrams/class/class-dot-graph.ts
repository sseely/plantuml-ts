/**
 * Class diagram DOT-graph construction.
 *
 * Builds the `DotInputGraph` (nodes, edges, clusters) consumed by the shared
 * dot layout engine from a `ClassDiagramAST` + pre-measured classifier sizes.
 * Split out of ./layout.ts to keep both files under the project's per-file
 * size cap; behavior is unchanged (pure move).
 */

import type {
  Classifier,
  ClassDiagramAST,
  ClassifierKind,
  Namespace,
  Relationship,
  RelationshipType,
} from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type {
  DotInputCluster,
  DotInputGraph,
  DotInputNode,
  DotInputEdge,
} from '../../core/graph-layout.js';
import { buildNoteGraphParts } from './note-layout.js';
import { findFreestandingNoteRelationshipIndices } from './note-freestanding.js';
import { buildClassMagmaEdges } from './class-magma.js';
import {
  edgeLabelAttrs,
  packageEndpointAnchors,
  shieldedClassifierIds,
  type MeasuredClassifier,
} from './class-layout-helpers.js';
import { LOLLIPOP_SIZE, ASSOC_POINT_SIZE } from './class-lollipop.js';
import type { EdgeGeo } from './layout.js';

// ---------------------------------------------------------------------------
// Edge decoration map
// ---------------------------------------------------------------------------

interface EdgeDecoration {
  targetDecor: EdgeGeo['targetDecor'];
  sourceDecor: EdgeGeo['sourceDecor'];
  dashed: boolean;
}

export const EDGE_DECORATION_MAP: Record<RelationshipType, EdgeDecoration> = {
  extension:      { targetDecor: 'triangle',     sourceDecor: 'none',         dashed: false },
  implementation: { targetDecor: 'triangle',     sourceDecor: 'none',         dashed: true  },
  composition:    { targetDecor: 'none',          sourceDecor: 'filledDiamond', dashed: false },
  aggregation:    { targetDecor: 'none',          sourceDecor: 'diamond',      dashed: false },
  dependency:     { targetDecor: 'open',          sourceDecor: 'none',         dashed: true  },
  association:    { targetDecor: 'open',          sourceDecor: 'none',         dashed: false },
  usage:          { targetDecor: 'none',          sourceDecor: 'none',         dashed: true  },
};

// For hierarchical relationships the parent must rank above the child in the
// TB layout, so the dot graph swaps from/to. The edge points returned by dot
// are then reversed so the rendered arrow still flows child → parent with the
// triangle arrowhead at the parent end.
const HIERARCHICAL = new Set<RelationshipType>(['extension', 'implementation']);

export interface DotGraphParts {
  dotGraph: DotInputGraph;
  swappedEdges: Set<number>;
  noteParts: ReturnType<typeof buildNoteGraphParts>;
  /** G2 N18: namespace id -> its `zaent-*` point-anchor DOT node id (see
   *  `packageEndpointAnchors`'s own doc comment) -- threaded OUT so
   *  `buildNamespaceGeos` can fold the anchor's own dot-assigned position
   *  into a namespace's footprint walk (the anchor is a REAL member of the
   *  cluster and, per `plans/g2-class-svg/ledger.md` N17/N18, occupies a
   *  rank slot ABOVE the topmost classifier when the package is used as a
   *  relationship/note endpoint -- `ns.classifiers` alone misses it). Pure
   *  data export, no change to what is emitted to graphviz-ts. */
  anchors: Map<string, string>;
}

/**
 * The set of namespace ids that must emit a cluster: any namespace whose
 * subtree contains at least one direct member classifier. A namespace with no
 * direct members is still kept when a descendant has members (it is a real
 * ancestor cluster and its members bubble up in the oracle); a namespace whose
 * entire subtree is empty is dropped — the oracle omits member-less subgraphs
 * (verified against mujopi-30-zadi566: two empty packages produce no cluster).
 */
function nonEmptyNamespaceIds(ast: ClassDiagramAST): Set<string> {
  const byId = new Map(ast.namespaces.map((n) => [n.id, n] as const));
  const keep = new Set<string>();
  for (const ns of ast.namespaces) {
    if (ns.classifiers.length === 0) continue;
    let cur: Namespace | undefined = ns;
    while (cur !== undefined && !keep.has(cur.id)) {
      keep.add(cur.id);
      cur = cur.parentId !== undefined ? byId.get(cur.parentId) : undefined;
    }
  }
  return keep;
}

/**
 * Build one `DotInputCluster` per non-empty package/namespace, nesting via
 * `parentId` for dotted/nested names (mirrors the description engine's
 * `buildDotClusters` in ../description/layout.ts). `id` is a synthetic
 * `clusterN` token — NOT `ns.id` — because the comparator's `parseClusters`
 * (tests/oracle/svek-dot.ts:109) only recognizes subgraphs named exactly
 * `^cluster\d+$`; the description engine's `clusterId` generator
 * (`cluster${counter.n++}`, description/layout.ts:108) uses the same scheme.
 * Only direct member classifiers go in `nodeIds`; descendants' members bubble
 * up through the nesting, matching the oracle's cluster-membership counting.
 */
function buildDotClusters(
  ast: ClassDiagramAST,
  anchors: Map<string, string>,
): DotInputCluster[] | undefined {
  const keep = nonEmptyNamespaceIds(ast);
  if (keep.size === 0) return undefined;
  const kept = ast.namespaces.filter((ns) => keep.has(ns.id));
  const clusterIdByNs = new Map(kept.map((ns, i) => [ns.id, `cluster${i}`] as const));
  return kept.map((ns, i) => {
    // A package used as a relationship endpoint carries its point anchor as an
    // extra direct member of its own cluster (svek ClusterDotString).
    const anchorId = anchors.get(ns.id);
    const nodeIds = anchorId !== undefined ? [...ns.classifiers, anchorId] : ns.classifiers;
    const cluster: DotInputCluster = { id: `cluster${i}`, nodeIds };
    if (ns.display.length > 0) cluster.label = ns.display;
    const parentClusterId =
      ns.parentId !== undefined ? clusterIdByNs.get(ns.parentId) : undefined;
    if (parentClusterId !== undefined) cluster.parentId = parentClusterId;
    return cluster;
  });
}

/** Under `skinparam linetype ortho`, svek routes the main edge label through
 *  `xlabel` instead of `label` (SvekEdge.java:434-441: dotSplines == ORTHO
 *  branch) — taillabel/headlabel are unaffected (upstream only tests
 *  `dotMode`/`dotSplines` in the `hasNoteLabelText()` branch). Mutates in
 *  place; called only when linetype is ortho. */
function moveLabelToXlabel(attrs: NonNullable<DotInputEdge['attributes']>): void {
  if (attrs.label === undefined) return;
  attrs.xlabel = attrs.label;
  attrs.xlabelWidth = attrs.labelWidth!;
  attrs.xlabelHeight = attrs.labelHeight!;
  delete attrs.label;
  delete attrs.labelWidth;
  delete attrs.labelHeight;
}

/** Build one dot edge per relationship, with minlen + label attributes. An
 *  endpoint that is a package cluster is routed to that cluster's point anchor. */
interface DotEdgeAttrContext {
  font: { family: string; size: number };
  measurer: StringMeasurer;
  linetype: Theme['linetype'];
  kindBIndices: ReadonlySet<number>;
}

/** One relationship's DOT edge attributes -- split out of `buildDotEdges`
 *  (G2/N16) to keep that function's own CCN under the project's complexity
 *  cap after adding the Kind-B `noArrow` gate. */
function buildDotEdgeAttrs(rel: Relationship, i: number, ctx: DotEdgeAttrContext): NonNullable<DotInputEdge['attributes']> {
  const attrs = { minLen: (rel.length ?? 2) - 1, ...edgeLabelAttrs(rel, ctx.font, ctx.measurer) };
  if (ctx.linetype === 'ortho') moveLabelToXlabel(attrs);
  if (rel.invis === true) attrs.invis = true;
  if (rel.weight !== undefined) attrs.weight = rel.weight;
  // G2/N16 Kind B: a freestanding note's ONE real relationship connector
  // must route with NO arrow-clip reservation (the SAME `noArrow` fix N14
  // already applied to the synthetic note-attachment edge) -- computed
  // PRE-layout since it affects the spline's own routed endpoint, not just
  // its rendered decoration (`note-freestanding.ts`'s own doc comment).
  if (ctx.kindBIndices.has(i)) attrs.noArrow = true;
  return attrs;
}

function buildDotEdges(
  ast: ClassDiagramAST,
  font: { family: string; size: number },
  measurer: StringMeasurer,
  anchors: Map<string, string>,
  linetype: Theme['linetype'],
): DotInputEdge[] {
  const kindBIndices = findFreestandingNoteRelationshipIndices(ast.notes, ast.relationships, ast.classifiers);
  const ctx: DotEdgeAttrContext = { font, measurer, linetype, kindBIndices };
  return ast.relationships.map((rel: Relationship, i: number) => {
    const swap = HIERARCHICAL.has(rel.type);
    const from = swap ? rel.to : rel.from;
    const to = swap ? rel.from : rel.to;
    const attrs = buildDotEdgeAttrs(rel, i, ctx);
    return { id: `edge-${i}`, from: anchors.get(from) ?? from, to: anchors.get(to) ?? to, attributes: attrs };
  });
}

/** Classifier kind → non-default svek node shape (everything else → rect). */
const KIND_SHAPE: Partial<Record<ClassifierKind, DotInputNode['shape']>> = {
  association: 'diamond', // `<> name` (CommandDiamondAssociation)
  'assoc-circle': 'circle', // `(A,B) .. C` connector on the A–B association
  circle: 'plaintext', // `circle Foo` / `() name` — the small circle table
  usecase: 'ellipse', // `usecase Foo` (LeafType.USECASE)
  state: 'rounded', // `state Foo` (LeafType.STATE, classdiagram-only ALL_TYPES superset)
  lollipop: 'circle', // `Name ()-- Existing` (CommandLinkLollipop)
  map: 'plaintext', // `map Name { ... }` — EntityImageMap.getShapeType is
  // ALWAYS RECTANGLE_HTML_FOR_PORTS (never a plain rect, even with zero rows).
  json: 'plaintext', // `json Name { ... }` — EntityImageJson.getShapeType is
  // the SAME RECTANGLE_HTML_FOR_PORTS shape as map, ALWAYS (even scalar/empty).
};

/**
 * A map/json's `shape=plaintext` is EntityImageMap/EntityImageJson's own
 * per-row shield table (svek's RECTANGLE_HTML_FOR_PORTS), NOT the qualifier/
 * `::member` port-shield mechanism this flag drives (svek-dot-emit.ts's
 * portTable — a single compass-point "P" cell, wrong shape for either). A map
 * row link (class-map-commands.ts) sets `fromPort` on its relationship purely
 * as row-target metadata; it must not flip this flag even though
 * shieldedClassifierIds sees the same relationship.
 */
function shouldMarkPort(shape: DotInputNode['shape'] | undefined, isShieldedPort: boolean, kind: ClassifierKind): boolean {
  return shape === 'plaintext' && isShieldedPort && kind !== 'map' && kind !== 'json';
}

/** Build one dot node for a single classifier — split out of buildDotNodes
 *  purely to keep that function's own NLOC/CCN under the project caps. */
function buildOneDotNode(
  classifier: Classifier,
  measuredMap: Map<string, MeasuredClassifier>,
  shielded: Map<string, { isPort: boolean }>,
): DotInputNode {
  const measured = measuredMap.get(classifier.id)!;
  // A lollipop circle is a fixed 10x10 (upstream `EntityImageLollipopInterface
  // .SIZE`), never text-measured — measureClassifier has no special case for
  // this kind, so its generic (min-100, text-based) width/height is discarded.
  const isLollipop = classifier.kind === 'lollipop';
  // G2 N8: an association-class-couple "point" entity is a fixed 4x4 circle
  // (upstream `EntityImageAssociationPoint.SIZE`), same "never text-measured,
  // generic width/height discarded" shape as the lollipop case above.
  const isAssocPoint = classifier.kind === 'assoc-circle';
  const node: DotInputNode = {
    id: classifier.id,
    width: isLollipop ? LOLLIPOP_SIZE : isAssocPoint ? ASSOC_POINT_SIZE : measured.width,
    height: isLollipop ? LOLLIPOP_SIZE : isAssocPoint ? ASSOC_POINT_SIZE : measured.height,
  };
  const shield = shielded.get(classifier.id);
  const shape = KIND_SHAPE[classifier.kind] ?? (shield !== undefined ? 'plaintext' : undefined);
  if (shape !== undefined) node.shape = shape;
  if (shouldMarkPort(shape, shield?.isPort === true, classifier.kind)) node.isPort = true;
  return node;
}

/**
 * Build one dot node per classifier, marking qualifier/port targets plaintext.
 * A classifier that is also a package endpoint is dropped (its cluster gets a
 * point anchor instead — see packageEndpointAnchors); one point node per anchor
 * is appended.
 */
function buildDotNodes(
  ast: ClassDiagramAST,
  measuredMap: Map<string, MeasuredClassifier>,
  anchors: Map<string, string>,
): DotInputNode[] {
  const shielded = shieldedClassifierIds(ast);
  const nodes = ast.classifiers
    .filter((classifier) => !anchors.has(classifier.id))
    .map((classifier) => buildOneDotNode(classifier, measuredMap, shielded));
  for (const anchorId of anchors.values()) {
    // Width/height are ignored by the point emitter (hardcoded .01in).
    nodes.push({ id: anchorId, width: 1, height: 1, shape: 'point' });
  }
  return nodes;
}

/** DOT nodesep/ranksep attrs. Oracle emits nodesep=0.486111in (35px),
 *  ranksep=0.833333in (60px) by default; `skinparam nodesep`/`ranksep`
 *  (theme.nodeSep/rankSep, nonzero) unconditionally replace that default
 *  (SkinParam.java:847-856, DotStringFactory.java:117-133 — no max-clamp)
 *  and skip the emitter's minimum floor (svek-dot-emit resolveSep). */
function sepAttrs(theme: Theme): Partial<DotInputGraph> {
  return {
    nodeSep: theme.nodeSep ?? 35,
    rankSep: theme.rankSep ?? 60,
    ...(theme.nodeSep !== undefined ? { nodeSepExplicit: true } : {}),
    ...(theme.rankSep !== undefined ? { rankSepExplicit: true } : {}),
  };
}

/**
 * Build the dot input graph — all classifiers + notes flattened into the
 * root graph (D5) — plus the set of hierarchical edge indices that were
 * swapped from/to for ranking (see HIERARCHICAL above).
 */
export function buildDotGraph(
  ast: ClassDiagramAST,
  measuredMap: Map<string, MeasuredClassifier>,
  theme: Theme,
  measurer: StringMeasurer,
): DotGraphParts {
  const anchors = packageEndpointAnchors(ast, nonEmptyNamespaceIds(ast));
  const dotNodes: DotInputNode[] = buildDotNodes(ast, measuredMap, anchors);

  const labelFont = { family: theme.fontFamily, size: theme.fontSize };
  // Magma standalone-chaining edges appended after the real relationship edges.
  const dotEdges: DotInputEdge[] = [...buildDotEdges(ast, labelFont, measurer, anchors, theme.linetype), ...buildClassMagmaEdges(ast, anchors)];

  const swappedEdges = new Set(
    ast.relationships
      .map((rel, i) => (HIERARCHICAL.has(rel.type) ? i : -1))
      .filter((i) => i >= 0),
  );

  // Notes lay out as their own nodes + connector edges (Svek note-on-entity).
  // `anchors` also routes a `note <pos> of <package>` target to that
  // package's `zaent-*` point anchor (packageEndpointAnchors scans notes too).
  const noteParts = buildNoteGraphParts(ast.notes, theme, measurer, anchors);
  dotNodes.push(...noteParts.nodes);
  dotEdges.push(...noteParts.edges);

  const clusters = buildDotClusters(ast, anchors);

  const dotGraph: DotInputGraph = {
    nodes: dotNodes,
    edges: dotEdges,
    rankDir: ast.rankdir === 'LR' ? 'LR' : 'TB',
    ...sepAttrs(theme),
    ...(clusters !== undefined ? { clusters } : {}),
  };

  return { dotGraph, swappedEdges, noteParts, anchors };
}

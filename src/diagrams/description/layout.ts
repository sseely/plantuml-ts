/**
 * Unified layout engine for PlantUML descriptive diagrams
 * (component / use-case / deployment).
 *
 * Algorithm (single-pass, cluster-aware): walk the AST, classifying each
 * node as a graphviz cluster (container symbol with children) or a
 * DotInputNode (leaf, or empty container). Build one DotInputGraph and call
 * layoutGraph() once; map results back to DescriptionGeometry — leaf
 * positions from result.nodes, container bboxes as a bottom-up padded union
 * of children, edge points from result.edges (real graphviz splines),
 * cross-container endpoints clipped at the container bbox. No DOM/SVG/async.
 */

import type { DescriptionDiagramAST, DescriptiveLink, DescriptiveNode } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import type {
  DotInputNode,
  DotInputEdge,
  DotInputCluster,
  DotInputGraph,
  DotLayoutResult,
} from '../../core/graph-layout.js';
import { layoutGraph } from '../../core/graph-layout.js';
import type { USymbol } from '../../core/descriptive-keywords.js';
import {
  type DescriptionNodeGeo,
  type Bbox,
  EMPTY_CONTAINER_WIDTH,
  EMPTY_CONTAINER_HEIGHT,
  GROUP_ANCHOR_SIZE,
  isClusterNode,
  measureLeafNode,
  computeContainerBbox,
  shiftGeo,
  buildNodeGeoIndex,
  type EdgeContainerEndpoints,
  resolveEndpoint,
  containerEndpointsInfo,
  groupAnchorNodeId,
  shapeForNode,
  isPortLabelWide,
  portTablePad,
  measureTitleLabel,
  measureShadowAnchorDims,
  type DescriptionEdgeGeo,
  type DescriptionGeometry,
  degenerateSingleLeaf,
} from './layout-helpers.js';
import {
  type EdgeMapping,
  buildEdgeGeos,
  computeTotalDimensions,
} from './layout-geo-post.js';
import { computeInkShift } from './layout-ink-shift.js';
import { computePortClusterBbox, type PortClusterInfo, type ClusterSpacing } from './frontier-cluster-bbox.js';
import type { ComponentStyle } from './leaf-sizing.js';
import { computeGraphSpacing, buildLinkEdgeAttributes } from './link-edge-attrs.js';
import type { SpriteDimsLookup } from '../../core/creole-atoms.js';
import { spriteDimsLookupFor } from '../../core/sprite-commands.js';
import { buildMagmaEdges, magmaGroups } from './magma.js';
import {
  effectiveRemovedIds, effectiveHiddenIds, visibleStereotypeLabels, nodeWithVisibleStereotype,
} from './element-grammar.js';
import {
  buildNamespaceGroups,
  findCollidingIds,
  dotKeyFor,
  scopedKey,
} from './namespace-groups.js';

export type {
  DescriptionNodeGeo,
  DescriptionEdgeGeo,
  DescriptionGeometry,
} from './layout-helpers.js';

// ── Public output types ──

// ── Internal types ──

interface ContainerDesc {
  // "cluster0" etc — matches comparator's /^cluster\d+$/ (we re-prefix `cluster_` anyway).
  clusterId: string;
  astId: string;
  symbol: USymbol;
  display: string;
  /** G1 I5b: ALL stereotype tags, in source order. */
  stereotype?: readonly string[];
  directLeafAstIds: string[];
  parentAstId?: string;
}

interface ClassifyCtx {
  leafIdSet: Set<string>;
  containers: ContainerDesc[];
  containerById: Map<string, ContainerDesc>;
  astNodeById: Map<string, DescriptiveNode>;
  counter: { n: number };
  /** `skinparam componentStyle` — gates the UML2 component corner icon. */
  componentStyle: ComponentStyle | undefined;
  /** Container-scoped identity (mission I1b) — bare ids that are TRUE
   *  cross-scope collisions across the WHOLE diagram
   *  (namespace-groups.ts#findCollidingIds), read by `dotKeyFor` to decide
   *  whether a node needs disambiguation. */
  collidingIds: ReadonlySet<string>;
  /** SI5b+E2r T7 seam (c): bridges `ast.sprites` (T4's `SpriteRegistry`) to
   *  T6's `SpriteDimsLookup` (seam (b), `sprite-commands.ts
   *  #spriteDimsLookupFor`) — consulted by `measureLeafNode` (D9) so a
   *  `<$sprite>` atom in a leaf's display text actually widens/heightens
   *  its DOT node size, per the batch-2 decision-journal's flagged gap. */
  sprites: SpriteDimsLookup | undefined;
  /** Every node's ALWAYS-fully-qualified path (ancestor chain + own id,
   *  regardless of collision) mapped to whatever canonical key
   *  `classifyAst` actually assigned it — lets `resolveEndpoint`
   *  (layout-helpers.ts) translate a namespace-qualified link reference
   *  (`command-table.ts#resolveEndpointNamespace`) back to the right DOT
   *  node id even when that node's bare id turned out not to need
   *  disambiguation. See namespace-groups.ts's `dotKeyFor` doc + the
   *  description-dot-100 decision journal (I1b). */
  qualifiedPathToDotKey: Map<string, string>;
}

interface PortClusterCtx {
  readonly infoByAstId: ReadonlyMap<string, PortClusterInfo>;
  readonly spacing: ClusterSpacing;
}

interface EdgeDotBuildResult {
  dotEdges: DotInputEdge[];
  dotEdgeToLinkIdx: Map<string, number>;
  edgeContainerEndpoints: Map<string, EdgeContainerEndpoints>;
  /** Cluster ids referenced directly by an edge (isThereALinkFromOrToGroup);
   *  each needs a shared group-anchor point node + cluster membership. */
  groupAnchorClusterIds: Set<string>;
}


// ── Phase 1: AST classification ──

function classifyAsCluster(
  node: DescriptiveNode,
  ctx: ClassifyCtx,
  removed: ReadonlySet<string>,
  key: string,
  ancestorIds: readonly string[],
  parentAstId?: string,
): void {
  const clusterId = `cluster${ctx.counter.n++}`;
  const childAncestors = [...ancestorIds, node.id];
  const directLeafAstIds = node.children
    .filter((c) => !isEffectiveCluster(c, removed))
    .map((c) => dotKeyFor(childAncestors, c.id, ctx.collidingIds));
  const desc: ContainerDesc = {
    clusterId, astId: key, symbol: node.symbol,
    display: node.display, directLeafAstIds,
  };
  if (parentAstId !== undefined) desc.parentAstId = parentAstId;
  if (node.stereotype !== undefined) desc.stereotype = node.stereotype;
  ctx.containers.push(desc);
  ctx.containerById.set(key, desc);
  classifyAst(node.children, ctx, removed, childAncestors, key);
}

/** Unfiltered container count (declaration view) — the degenerate check
 *  (DotData.isDegeneratedWithFewEntities) counts groups BEFORE removal. */
function countRawContainers(nodes: readonly DescriptiveNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (isClusterNode(node)) n += 1 + countRawContainers(node.children);
  }
  return n;
}

/** Removal-aware cluster predicate: GraphvizImageBuilder's empty-group
 *  demotion (java:416-418) applies to the removal-FILTERED view — a group
 *  whose visible children are all removed becomes a LEAF (gezemu-34 oracle:
 *  `frame l3 { component D }` + `remove D` renders l3 as a rect). */
function isEffectiveCluster(node: DescriptiveNode, removed: ReadonlySet<string>): boolean {
  return (
    isClusterNode(node) && node.children.some((c) => !removed.has(c.id))
  );
}

function classifyAst(
  nodes: readonly DescriptiveNode[],
  ctx: ClassifyCtx,
  removed: ReadonlySet<string>,
  ancestorIds: readonly string[] = [],
  parentAstId?: string,
): void {
  for (const node of nodes) {
    const key = dotKeyFor(ancestorIds, node.id, ctx.collidingIds);
    ctx.astNodeById.set(key, node);
    ctx.qualifiedPathToDotKey.set(scopedKey([...ancestorIds, node.id]), key);
    if (isEffectiveCluster(node, removed)) {
      classifyAsCluster(node, ctx, removed, key, ancestorIds, parentAstId);
    } else {
      ctx.leafIdSet.add(key);
    }
  }
}

// ── Phase 2: DotInputGraph construction ──

/** One entry per rank (source=portin, sink=portout) that a cluster's own
 *  direct port children populate, keyed by clusterId — feeds both the
 *  DotInputCluster.portRanks emitter field and the anchor-shape decision
 *  in buildDotNodes (ClusterDotString.entityPositionsExceptNormal /
 *  hasPort()). Description-diagram entities only ever carry
 *  EntityPosition NORMAL/PORTIN/PORTOUT (abel/Entity.java:327-338) — so
 *  "cluster has a port child" and Java's hasPort() coincide exactly here. */
function computePortRanksByCluster(
  ctx: ClassifyCtx,
): Map<string, { rank: 'source' | 'sink'; nodeIds: string[] }[]> {
  const result = new Map<string, { rank: 'source' | 'sink'; nodeIds: string[] }[]>();
  for (const c of ctx.containers) {
    const source: string[] = [];
    const sink: string[] = [];
    for (const id of c.directLeafAstIds) {
      const n = ctx.astNodeById.get(id);
      if (n?.symbol !== 'port') continue;
      (n.position === 'portout' ? sink : source).push(id);
    }
    const ranks: { rank: 'source' | 'sink'; nodeIds: string[] }[] = [];
    if (source.length > 0) ranks.push({ rank: 'source', nodeIds: source });
    if (sink.length > 0) ranks.push({ rank: 'sink', nodeIds: sink });
    if (ranks.length > 0) result.set(c.clusterId, ranks);
  }
  return result;
}

/** A port leaf's own DOT node: fixed RADIUS*2 square, `shape=plaintext`
 *  PORT="P" table when its label is wide (SvekNode
 *  .appendLabelHtmlSpecialForPort), plain small `shape=rect` otherwise;
 *  `isPort` always set (drives the `:P` edge-ref suffix regardless of
 *  which shape branch applies — Link.getEntityPort/usePortP). The real
 *  layout engine (unlike the emitter-only fields above) DOES read
 *  `attributes.rank` (graph-layout.ts addNodes) — portin/portout genuinely
 *  pin the port to its container's source/sink rank, matching
 *  EntityPosition.getInputs()/getOutputs(). */
function buildPortNode(
  id: string,
  node: DescriptiveNode,
  dims: { width: number; height: number },
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): DotInputNode {
  const dotNode: DotInputNode = {
    id, width: dims.width, height: dims.height, isPort: true,
    attributes: { rank: node.position === 'portout' ? 'sink' : 'source' },
  };
  if (isPortLabelWide(node, fontSpec, measurer)) {
    dotNode.shape = 'plaintext';
    dotNode.portPad = portTablePad(node, fontSpec, measurer);
  }
  return dotNode;
}

/** The shared anchor node for a cluster that needs one — either because an
 *  edge targets the group directly (`groupAnchorClusterIds`, P2/i5) or
 *  because it has port children (`portClusterIds`). ClusterDotString's
 *  hasPort() branch (lines 177-184) redeclares the SAME id with
 *  `shape=rect` + the cluster's own title HTML; when the cluster is BOTH a
 *  port cluster AND a real group-edge target (`hasGroupEdge`,
 *  `thereALinkFromOrToGroup2`, lines 148-149), upstream emits the plain
 *  `shape=point` anchor FIRST, unconditionally of hasPort() — reproduced via
 *  `groupAnchorAlsoPoint` (see graph-layout.types.ts / svek-dot-emit.ts),
 *  not by picking a single shape. */
function buildAnchorNode(
  clusterId: string,
  display: string,
  symbol: USymbol,
  isPortCluster: boolean,
  hasGroupEdge: boolean,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): DotInputNode {
  const anchor: DotInputNode = {
    id: groupAnchorNodeId(clusterId),
    width: GROUP_ANCHOR_SIZE,
    height: GROUP_ANCHOR_SIZE,
  };
  if (isPortCluster) {
    anchor.shape = 'rect';
    const title = measureTitleLabel(display, symbol, fontSpec, measurer);
    anchor.titleLabelWidth = title.width;
    anchor.titleLabelHeight = title.height;
    if (hasGroupEdge) anchor.groupAnchorAlsoPoint = true;
  } else {
    anchor.shape = 'point';
  }
  return anchor;
}

function buildDotNodes(
  ctx: ClassifyCtx,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  anchorClusterIds: ReadonlySet<string>,
  portClusterIds: ReadonlySet<string>,
  groupAnchorClusterIds: ReadonlySet<string>,
  links: readonly DescriptiveLink[],
  fixCircle: boolean,
  stereotypeRules: ReadonlyArray<{ pattern?: string; show: boolean }>,
): DotInputNode[] {
  const result: DotInputNode[] = [];
  for (const [id, node] of ctx.astNodeById) {
    if (!ctx.leafIdSet.has(id)) continue;
    // G1 I-hideshow: DOT node width/height must be sized from the FILTERED
    // (visible-only) stereotype labels, matching jar's own
    // EntityImageDescription/EntityImageUseCase (both size from
    // `portionShower.getVisibleStereotypeLabels`, never the raw list) --
    // otherwise a `hide stereotype` fixture reserves height/width for a
    // guillemet block the render pass then correctly omits, a real
    // geometry mismatch (favega-89-rado990, lufiba-62-dubi670). Cheap
    // shallow clone; returns the SAME node reference when nothing changes
    // (`visibleStereotypeLabels`'s own doc comment).
    const sizedNode = nodeWithVisibleStereotype(node, stereotypeRules);
    const dims = measureLeafNode(sizedNode, fontSpec, measurer, ctx.componentStyle, ctx.sprites);
    if (node.symbol === 'port') {
      result.push(buildPortNode(id, node, dims, fontSpec, measurer));
      continue;
    }
    const dotNode: DotInputNode = { id, width: dims.width, height: dims.height };
    const shape = shapeForNode(node, links, fixCircle);
    if (shape !== undefined) dotNode.shape = shape;
    result.push(dotNode);
  }
  // Group-anchor nodes (ClusterDotString.java:149/177-184) — one per
  // cluster referenced directly by an edge and/or carrying port children,
  // shared across all edges/ranks that reference that cluster.
  for (const clusterId of anchorClusterIds) {
    const c = ctx.containers.find((cd) => cd.clusterId === clusterId);
    if (c === undefined) continue;
    result.push(
      buildAnchorNode(
        clusterId, c.display, c.symbol, portClusterIds.has(clusterId),
        groupAnchorClusterIds.has(clusterId), fontSpec, measurer,
      ),
    );
  }
  return result;
}

function buildDotClusters(
  ctx: ClassifyCtx,
  anchorClusterIds: ReadonlySet<string>,
  portRanksByCluster: ReadonlyMap<string, { rank: 'source' | 'sink'; nodeIds: string[] }[]>,
  kermor: boolean,
): DotInputCluster[] {
  return ctx.containers.map((c) => {
    // The anchor is a direct member of its own cluster (not nested in any
    // child sub-cluster) — ClusterDotString.java:149 emits it at the
    // cluster's own level, before its `i`/`p1` nesting.
    const nodeIds = anchorClusterIds.has(c.clusterId)
      ? [...c.directLeafAstIds, groupAnchorNodeId(c.clusterId)]
      : c.directLeafAstIds;
    const cluster: DotInputCluster = { id: c.clusterId, nodeIds };
    if (c.display.length > 0) cluster.label = c.display;
    if (c.parentAstId !== undefined) {
      const parentDesc = ctx.containerById.get(c.parentAstId);
      if (parentDesc !== undefined) cluster.parentId = parentDesc.clusterId;
    }
    const portRanks = portRanksByCluster.get(c.clusterId);
    if (portRanks !== undefined) {
      cluster.portRanks = portRanks;
      // ClusterDotStringKermor's printRanks never chains to an anchor (see
      // runLayout's anchorClusterIds comment) — no anchor node exists to
      // point at under kermor, so portAnchorId stays unset.
      if (!kermor) cluster.portAnchorId = groupAnchorNodeId(c.clusterId);
    }
    return cluster;
  });
}

function buildDotEdges(
  links: readonly DescriptiveLink[],
  ctx: ClassifyCtx,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  linetype: 'ortho' | 'polyline' | undefined,
): EdgeDotBuildResult {
  const dotEdges: DotInputEdge[] = [];
  const dotEdgeToLinkIdx = new Map<string, number>();
  const edgeContainerEndpoints = new Map<string, EdgeContainerEndpoints>();
  const groupAnchorClusterIds = new Set<string>();
  const clusterIdByContainerAstId = new Map(
    ctx.containers.map((c) => [c.astId, c.clusterId]),
  );

  for (let i = 0; i < links.length; i++) {
    const link = links[i]!;
    // Link.isRemoved (net/sourceforge/plantuml/abel/Link.java:492-498): a
    // stereotype-removed link is dropped from DOT emission independent of
    // its endpoints (see element-grammar.ts#removeMatchingLinks). Endpoint-
    // based removal is filtered separately, after this loop, via the
    // `removed` node-id set (runLayout's dotEdges.filter below).
    if (link.removed === true) continue;
    const fromRes = resolveEndpoint(
      link.from, ctx.leafIdSet, ctx.astNodeById, clusterIdByContainerAstId,
      ctx.qualifiedPathToDotKey,
    );
    const toRes = resolveEndpoint(
      link.to, ctx.leafIdSet, ctx.astNodeById, clusterIdByContainerAstId,
      ctx.qualifiedPathToDotKey,
    );
    if (fromRes === undefined || toRes === undefined) continue;
    if (fromRes.dotNodeId === toRes.dotNodeId) continue;

    const dotId = `dot-edge-${i}`;
    dotEdges.push({
      id: dotId,
      from: fromRes.dotNodeId,
      to: toRes.dotNodeId,
      attributes: buildLinkEdgeAttributes(link, fontSpec, measurer, linetype, ctx.sprites),
    });
    dotEdgeToLinkIdx.set(dotId, i);

    const info = containerEndpointsInfo(fromRes, toRes);
    if (info !== undefined) edgeContainerEndpoints.set(dotId, info);
    if (fromRes.containerAstId !== undefined) {
      groupAnchorClusterIds.add(clusterIdByContainerAstId.get(fromRes.containerAstId)!);
    }
    if (toRes.containerAstId !== undefined) {
      groupAnchorClusterIds.add(clusterIdByContainerAstId.get(toRes.containerAstId)!);
    }
  }
  return { dotEdges, dotEdgeToLinkIdx, edgeContainerEndpoints, groupAnchorClusterIds };
}

// ── Phase 3: geo tree construction (bottom-up, containers padded around children) ──

/**
 * `EntityImagePort.upPosition()` (svek/image/EntityImagePort.java:76-80):
 * a port child's label goes ABOVE its box when the port's own top edge
 * sits above the parent cluster's vertical CENTER, else BELOW. Mutates
 * each `symbol === 'port'` entry of `children` in place -- this is the
 * one call site where a port's already-resolved `y` (assigned earlier in
 * THIS SAME recursive walk, via the leaf branch of `buildGeoNode`) and its
 * parent's own just-computed `bbox` are both in scope together; every
 * other node kind is left untouched (upstream's own check is only ever
 * reached from `EntityImagePort`, never from a general entity/cluster
 * draw path). See `DescriptionNodeGeo.portLabelAbove`'s doc comment.
 */
function applyPortLabelPositions(children: readonly DescriptionNodeGeo[], bbox: Bbox): void {
  const centerY = bbox.y + bbox.height / 2;
  for (const child of children) {
    if (child.symbol === 'port') child.portLabelAbove = child.y < centerY;
  }
}

function buildGeoNode(
  astNode: DescriptiveNode,
  leafPosMap: Map<string, { x: number; y: number; width: number; height: number }>,
  ancestorIds: readonly string[],
  collidingIds: ReadonlySet<string>,
  removed: ReadonlySet<string>,
  hidden: ReadonlySet<string>,
  stereotypeRules: ReadonlyArray<{ pattern?: string; show: boolean }>,
  portClusterCtx: PortClusterCtx,
): DescriptionNodeGeo {
  // Container-scoped identity (mission I1b): the geo tree's own `.id` must
  // match whatever `classifyAst` assigned as the node's canonical DOT key
  // -- bare `astNode.id` in the common (non-colliding) case, else the same
  // ancestor-qualified path, so `renderer-uid.ts#buildRenderPlan`'s
  // `nodeUid` map (keyed off THIS field) still lines up with
  // `DescriptionEdgeGeo.from`/`.to` (copied verbatim from `link.from`/`.to`,
  // which carries that same canonical key for a qualified link endpoint).
  const key = dotKeyFor(ancestorIds, astNode.id, collidingIds);
  // Removal-aware branch decision (I5g): mirrors `classifyAst`'s own
  // `isEffectiveCluster` check -- a container that is NOT itself removed
  // but whose visible children are all gone was laid out as a LEAF DOT
  // node (GraphvizImageBuilder.printGroups java:415-418's empty-group
  // mute-to-LeafType.EMPTY_PACKAGE); the raw, removal-blind `isClusterNode`
  // used here previously always recursed into `astNode.children`
  // regardless of removal, drawing a demoted container's already-removed
  // content anyway (gogosu-37-mipe918: `component b { component b_sub }`
  // + `remove b_sub` drew `b` as a cluster wrapping a phantom `b_sub`
  // instead of the jar's single leaf-styled `b` box).
  if (!isEffectiveCluster(astNode, removed)) {
    const pos = leafPosMap.get(key) ?? {
      x: 0, y: 0, width: EMPTY_CONTAINER_WIDTH, height: EMPTY_CONTAINER_HEIGHT,
    };
    const geo: DescriptionNodeGeo = {
      id: key, symbol: astNode.symbol, display: astNode.display,
      x: pos.x, y: pos.y, width: pos.width, height: pos.height, children: [],
    };
    const visibleStereotype = visibleStereotypeLabels(astNode.stereotype, stereotypeRules);
    if (visibleStereotype !== undefined && visibleStereotype.length > 0) geo.stereotype = visibleStereotype;
    if (astNode.color !== undefined) geo.color = astNode.color;
    if (astNode.creationIndex !== undefined) geo.creationIndex = astNode.creationIndex;
    if (astNode.declaredAsGroup === true) geo.declaredAsGroup = true;
    // G1 I-hideshow: draw-time-only marker (see `DescriptionNodeGeo.hidden`'s
    // doc comment) -- position/size above are UNAFFECTED, jar-verified.
    if (hidden.has(key)) geo.hidden = true;
    return geo;
  }
  const childAncestors = [...ancestorIds, astNode.id];
  // A directly-`remove`d child (leaf OR container) is dropped entirely --
  // `GraphvizImageBuilder.printGroups` (`if (g.isRemoved()) continue;`) and
  // `printEntities` both skip a removed entity outright, no placeholder.
  // Only an EFFECTIVELY-empty (not itself removed) container survives the
  // filter and recurses into the leaf branch above via its own
  // `isEffectiveCluster` check.
  const children = astNode.children
    .filter((c) => !removed.has(c.id))
    .map((c) => buildGeoNode(
      c, leafPosMap, childAncestors, collidingIds, removed, hidden, stereotypeRules, portClusterCtx,
    ));
  // G1b/J2 (mechanism B): a cluster with port children gets its box from
  // `FrontierCalculator`/`manageEntryExitPoint`, not the plain padded-union
  // formula -- see frontier-cluster-bbox.ts's doc comment.
  const portInfo = portClusterCtx.infoByAstId.get(key);
  const bbox = portInfo === undefined
    ? computeContainerBbox(children)
    : computePortClusterBbox(children, portInfo, portClusterCtx.spacing);
  applyPortLabelPositions(children, bbox);
  const geo: DescriptionNodeGeo = {
    id: key, symbol: astNode.symbol, display: astNode.display,
    ...bbox, children,
  };
  const visibleStereotype = visibleStereotypeLabels(astNode.stereotype, stereotypeRules);
  if (visibleStereotype !== undefined && visibleStereotype.length > 0) geo.stereotype = visibleStereotype;
  if (astNode.color !== undefined) geo.color = astNode.color;
  if (astNode.creationIndex !== undefined) geo.creationIndex = astNode.creationIndex;
  if (astNode.declaredAsGroup === true) geo.declaredAsGroup = true;
  // G1 I-hideshow: a hidden CONTAINER draws NOTHING at all (jar-verified,
  // Cluster.java:298-300's own early return -- not even its border/title,
  // component/mavuxi-16-jafi782's `a` cluster) -- its descendants are
  // ALSO hidden (`effectiveHiddenIds`'s ancestor-propagation closure), so
  // this single flag suffices; `renderer.ts#drawClusters` never needs to
  // special-case "hidden container, visible descendant" (jar's own
  // `Entity#isHidden` parent short-circuit makes that combination
  // structurally impossible).
  if (hidden.has(key)) geo.hidden = true;
  return geo;
}

function buildGeoTree(
  astNodes: readonly DescriptiveNode[],
  leafPosMap: Map<string, { x: number; y: number; width: number; height: number }>,
  collidingIds: ReadonlySet<string>,
  removed: ReadonlySet<string>,
  hidden: ReadonlySet<string>,
  stereotypeRules: ReadonlyArray<{ pattern?: string; show: boolean }>,
  portClusterCtx: PortClusterCtx,
): DescriptionNodeGeo[] {
  // Removed leaves (lazy CommandRemoveRestore markers) were never laid out;
  // a directly-removed CONTAINER is excluded here too (I5g) -- only an
  // effectively-empty-but-not-removed container demotes to a leaf via
  // `buildGeoNode`'s own `isEffectiveCluster` check, matching
  // `printGroups`'s `isRemoved()` skip vs `isEmpty()` mute distinction.
  // `hidden` (G1 I-hideshow) is NEVER a membership filter here -- unlike
  // `removed`, a hidden node stays fully in the geo tree (see
  // `buildGeoNode`'s doc comment); only threaded through so it and every
  // descendant carry the correct `.hidden` marker for the render pass.
  return astNodes
    .filter((n) => !removed.has(n.id))
    .filter((n) => leafPosMap.has(dotKeyFor([], n.id, collidingIds)) || isEffectiveCluster(n, removed))
    .map((n) => buildGeoNode(
      n, leafPosMap, [], collidingIds, removed, hidden, stereotypeRules, portClusterCtx,
    ));
}

// ── Public API helpers ──

// CommandRemoveRestore is a LAZY marker upstream (CucaDiagram.isRemoved at
// print time): magma chaining and the degenerate count run UNFILTERED; only
// classification (empty-group demotion on the filtered view) and the DOT
// emission drop removed entities (verified: cifaki-66 keeps the magma edge
// between the two surviving leaves of a 3-standalone chain; gezemu-34
// demotes an emptied frame to a leaf).
/** Builds the `PortClusterInfo` (frontier-cluster-bbox.ts) for every
 *  container that has port children. Two DIFFERENT title measurements feed
 *  it -- see `title-label-sizing.ts`'s doc comments for the full mechanism
 *  and why they must stay different: `titleWidth`/`titleHeight`
 *  (`measureTitleLabel`, jar-exact -- `ensureMinWidth`'s
 *  `getTitleAndAttributeWidth() + 10` floor, `Cluster.java:427-428`) vs
 *  `anchorWidth`/`anchorHeight` (`measureShadowAnchorDims`, a legacy
 *  compensating value the isolated shadow graph needs to reproduce jar's
 *  real cluster geometry -- G1b J3 found the jar-exact anchor dims REGRESS
 *  `computePortClusterBbox`'s result there, an 8px shadow-graph-only
 *  structural gap unrelated to this function). Kermor never builds a port
 *  anchor at all (`portAnchorId` stays unset, see `buildDotClusters`'s own
 *  comment) -- `manageEntryExitPoint`'s upstream call site is unconditional
 *  on kermor, but no kermor fixture in this port exercises a port cluster,
 *  so this is scoped to the non-kermor path pending real coverage. */
function buildPortClusterInfoByAstId(
  ctx: ClassifyCtx,
  portRanksByCluster: ReadonlyMap<string, { rank: 'source' | 'sink'; nodeIds: string[] }[]>,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  kermor: boolean,
): Map<string, PortClusterInfo> {
  const out = new Map<string, PortClusterInfo>();
  if (kermor) return out;
  for (const c of ctx.containers) {
    const ranks = portRanksByCluster.get(c.clusterId);
    if (ranks === undefined) continue;
    const title = measureTitleLabel(c.display, c.symbol, fontSpec, measurer);
    const anchor = measureShadowAnchorDims(c.display, fontSpec, measurer);
    out.set(c.astId, {
      ranks, anchorWidth: anchor.width, anchorHeight: anchor.height,
      titleWidth: title.width, titleHeight: title.height,
    });
  }
  return out;
}

function runLayout(
  ast: DescriptionDiagramAST,
  ctx: ClassifyCtx,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  linetype: 'ortho' | 'polyline' | undefined,
  removed: ReadonlySet<string>,
  fixCircle: boolean,
): {
  result: DotLayoutResult; edgeDotBuild: EdgeDotBuildResult;
  portClusterInfoByAstId: Map<string, PortClusterInfo>; spacing: ClusterSpacing;
} {

  // Edges first: buildDotClusters/buildDotNodes need to know which clusters
  // require a group-anchor node — either a direct group-edge
  // (edgeDotBuild.groupAnchorClusterIds, P2/i5) or port children
  // (portRanksByCluster, ClusterDotString.entityPositionsExceptNormal).
  const edgeDotBuild = buildDotEdges(ast.links, ctx, fontSpec, measurer, linetype);
  // applySingleStrategy: standalone leaves square-chain with invisible
  // links per group (magma.ts).
  edgeDotBuild.dotEdges.push(...buildMagmaEdges(magmaGroups(ctx),
    new Set(edgeDotBuild.dotEdges.flatMap((e) => [e.from, e.to]))));
  if (removed.size > 0) {
    edgeDotBuild.dotEdges = edgeDotBuild.dotEdges.filter(
      (e) => !removed.has(e.from) && !removed.has(e.to),
    );
  }
  const portRanksByCluster = computePortRanksByCluster(ctx);
  const portClusterIds = new Set(portRanksByCluster.keys());
  // ClusterDotStringKermor's own printRanks (svek/ClusterDotStringKermor
  // .java:231-245) has no hasPort()-chain-to-anchor branch at all -- under
  // kermor, port children NEVER need the shared anchor node/rank-chain
  // machinery (contrast ClusterDotString.printRanks, which does). Real
  // group-to-group edges (edgeDotBuild.groupAnchorClusterIds) still need an
  // anchor either way -- untouched by this exclusion, and unexercised by
  // any kermor fixture in this port (see decision-journal.md I2).
  const kermor = ast.kermor === true;
  const anchorClusterIds = kermor
    ? new Set(edgeDotBuild.groupAnchorClusterIds)
    : new Set([...edgeDotBuild.groupAnchorClusterIds, ...portClusterIds]);
  const dotClusters = buildDotClusters(ctx, anchorClusterIds, portRanksByCluster, kermor)
    .map((c) => ({ ...c, nodeIds: c.nodeIds.filter((id) => !removed.has(id)) }));
  const { nodeSep, rankSep } = computeGraphSpacing(ast.links, fontSpec, measurer, kermor, ctx.sprites);
  const input: DotInputGraph = {
    nodes: buildDotNodes(
      ctx, fontSpec, measurer, anchorClusterIds, portClusterIds,
      edgeDotBuild.groupAnchorClusterIds, ast.links, fixCircle,
      ast.stereotypeVisibilityRules ?? [],
    ).filter((n) => !removed.has(n.id)),
    edges: edgeDotBuild.dotEdges,
    nodeSep, rankSep,
    // I9 (path/@d): description draws every arrowhead itself (SvekEdge /
    // extremity/*.ts), matching the Svek-DOT emitter's own universal
    // `arrowhead=none` — see `DotInputGraph.manualArrowheads`'s doc comment.
    manualArrowheads: true,
  };
  // DotStringFactory only emits rankdir=LR for skinparam Rankdir LEFT_TO_RIGHT
  // (`left to right direction`, CommandRankDir.java); TB emits no attribute.
  if (ast.rankdir === 'LR') input.rankDir = 'LR';
  if (dotClusters.length > 0) input.clusters = dotClusters;
  if (kermor) input.kermor = true;
  const portClusterInfoByAstId = buildPortClusterInfoByAstId(
    ctx, portRanksByCluster, fontSpec, measurer, kermor,
  );
  const spacing: ClusterSpacing = { nodeSep, rankSep, rankdir: ast.rankdir === 'LR' ? 'LR' : 'TB' };
  return { result: layoutGraph(input), edgeDotBuild, portClusterInfoByAstId, spacing };
}

function buildGeoAndEdges(
  ast: DescriptionDiagramAST,
  result: DotLayoutResult,
  edgeDotBuild: EdgeDotBuildResult,
  collidingIds: ReadonlySet<string>,
  removed: ReadonlySet<string>,
  theme: Theme,
  measurer: StringMeasurer,
  portClusterCtx: PortClusterCtx,
): { nodes: DescriptionNodeGeo[]; edges: DescriptionEdgeGeo[] } {
  // G1 I-hideshow: `hidden` is draw-time-only (never a DOT/geo-tree
  // membership filter, contrast `removed` above) -- computed here, once,
  // from the SAME final `ast.nodes` this function already threads through
  // `buildGeoTree`/`buildEdgeGeos`.
  const hidden = effectiveHiddenIds(ast.nodes, ast.hideShowRules ?? []);
  const stereotypeRules = ast.stereotypeVisibilityRules ?? [];
  const leafPosMap = new Map(result.nodes.map((n) => [n.id, n]));
  const rawNodes = buildGeoTree(
    ast.nodes, leafPosMap, collidingIds, removed, hidden, stereotypeRules, portClusterCtx,
  );
  const geoIndex = buildNodeGeoIndex(rawNodes);
  // G1b/J1 (mechanism C): build edges ONCE at (dx=0,dy=0) -- the RAW,
  // fully-resolved (spline-clipped, labeled) draw shape `computeInkShift`'s
  // ink walk needs (see that function's own doc comment for why translating
  // an already-clipped spline commutes with clipping a not-yet-shifted one).
  const rawMapping: EdgeMapping = {
    dotEdgeToLinkIdx: edgeDotBuild.dotEdgeToLinkIdx,
    edgeContainerEndpoints: edgeDotBuild.edgeContainerEndpoints,
    geoIndex,
    dx: 0, dy: 0,
  };
  const rawEdges = buildEdgeGeos(ast.links, result.edges, rawMapping, hidden);
  const { dx, dy } = computeInkShift(rawNodes, rawEdges, theme, measurer, ast.sprites);
  const nodes = rawNodes.map((n) => shiftGeo(n, dx, dy));
  const edges = (dx === 0 && dy === 0)
    ? rawEdges
    : buildEdgeGeos(ast.links, result.edges, { ...rawMapping, dx, dy }, hidden);
  return { nodes, edges };
}

// ── Public API ──

/** Lay out a descriptive diagram; pixel geometry for all nodes and edges
 *  (see the file-header algorithm summary above). */
export function layoutDescription(
  ast: DescriptionDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): DescriptionGeometry {
  if (ast.nodes.length === 0) {
    return {
      totalWidth: 0, totalHeight: 0, nodes: [], edges: [],
      ...(ast.seed !== undefined ? { seed: ast.seed } : {}),
      ...(ast.scale !== undefined ? { scale: ast.scale } : {}),
    };
  }
  const fontSpec: FontSpec = { family: theme.fontFamily, size: theme.fontSize };
  // Container-scoped identity (mission I1b): the set of TRUE cross-scope
  // colliding bare ids, computed from the ORIGINAL (un-grouped) tree once --
  // reused by both `classifyAst` (walks the namespace-grouped tree) and
  // `buildGeoTree` (walks the original tree) so the two independent walks
  // agree on which nodes need disambiguation. Phantom-group ids
  // (namespace-groups.ts) are always fully-qualified-unique synthetic
  // strings, so omitting them from this scan cannot introduce a false
  // collision. See namespace-groups.ts's `dotKeyFor` doc.
  const collidingIds = findCollidingIds(ast.nodes);
  const ctx: ClassifyCtx = {
    leafIdSet: new Set(), containers: [],
    containerById: new Map(), astNodeById: new Map(), counter: { n: 0 },
    componentStyle: theme.componentStyle,
    collidingIds, qualifiedPathToDotKey: new Map(),
    sprites: ast.sprites !== undefined ? spriteDimsLookupFor(ast.sprites) : undefined,
  };
  const removed = effectiveRemovedIds(ast.nodes, ast.links, ast.removeUnlinked === true);
  // Phantom `set separator`-derived package nesting (namespace-groups.ts) is
  // synthesized HERE, at layout time, mirroring upstream's own
  // `eventuallyBuildPhantomGroups` timing (called from `getTextBlock`,
  // net/atmp/CucaDiagram.java:465) — AFTER magma/single-strategy would have
  // already run on the un-grouped tree upstream (CucaDiagram.java:679,
  // DescriptionDiagram#checkFinalError). `magmaGroups` (magma.ts) below
  // still reads THIS grouped `ctx`, so it separately excludes any
  // `phantomGroup` container from standalone-chaining consideration — see
  // that file's doc and the description-dot-100 decision journal (I1).
  const groupedNodes = buildNamespaceGroups(ast.nodes, ast.namespaceSeparator);
  classifyAst(groupedNodes, ctx, removed);
  // Degenerate check counts UNFILTERED entities (DotData counts before the
  // removed filter) — use the raw cluster predicate, not the removal-aware
  // classification.
  const rawContainers = countRawContainers(ast.nodes);
  const degenerate = degenerateSingleLeaf(ast, rawContainers, fontSpec, measurer, theme.componentStyle);
  if (degenerate !== undefined) {
    return {
      ...degenerate,
      ...(ast.seed !== undefined ? { seed: ast.seed } : {}),
      ...(ast.scale !== undefined ? { scale: ast.scale } : {}),
    };
  }
  const { result, edgeDotBuild, portClusterInfoByAstId, spacing } = runLayout(
    ast, ctx, fontSpec, measurer, theme.linetype ?? ast.linetype, removed,
    theme.fixCircleLabelOverlapping === true,
  );
  const { nodes, edges } = buildGeoAndEdges(
    ast, result, edgeDotBuild, collidingIds, removed, theme, measurer,
    { infoByAstId: portClusterInfoByAstId, spacing },
  );
  const { totalWidth, totalHeight } = computeTotalDimensions(nodes, edges);
  return {
    totalWidth, totalHeight, nodes, edges,
    ...(ast.seed !== undefined ? { seed: ast.seed } : {}),
    ...(ast.sprites !== undefined ? { sprites: ast.sprites } : {}),
    ...(ast.scale !== undefined ? { scale: ast.scale } : {}),
  };
}

export type { USymbol };

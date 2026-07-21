/**
 * Description-diagram layout, phases 2-3: `DotInputGraph` node/cluster/edge
 * construction (svek's `ClusterDotString`/`SvekNode` analogs) and the
 * bottom-up geo-tree assembly that maps solved DOT positions back onto
 * `DescriptionNodeGeo`.
 *
 * Split out of `./layout.ts` (mission G5/C1) to keep both files under the
 * project's per-file size cap -- a PURE MOVE, no behavior change. Mirrors
 * the project's established split precedent (`svg.ts`→`svg-markers.ts`,
 * `style-map-theme.ts`→`style-map-element.ts`): `./layout.ts` re-imports
 * every symbol below and keeps its own public API (`layoutDescription`)
 * unchanged.
 */

import type { DescriptiveNode, DescriptiveLink } from './ast.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import type {
  DotInputNode,
  DotInputEdge,
  DotInputCluster,
} from '../../core/graph-layout.js';
import type { USymbol } from '../../core/descriptive-keywords.js';
import {
  type DescriptionNodeGeo,
  type Bbox,
  EMPTY_CONTAINER_WIDTH,
  EMPTY_CONTAINER_HEIGHT,
  GROUP_ANCHOR_SIZE,
  measureLeafNode,
  computeContainerBbox,
  type EdgeContainerEndpoints,
  resolveEndpoint,
  containerEndpointsInfo,
  groupAnchorNodeId,
  shapeForNode,
  isPortLabelWide,
  portTablePad,
  measureTitleLabel,
} from './layout-helpers.js';
import { computePortClusterBbox, type PortClusterInfo, type ClusterSpacing } from './frontier-cluster-bbox.js';
import { buildLinkEdgeAttributes } from './link-edge-attrs.js';
import { visibleStereotypeLabels, nodeWithVisibleStereotype } from './element-grammar.js';
import { dotKeyFor } from './namespace-groups.js';
import type { ClassifyCtx, EdgeDotBuildResult } from './layout.js';
import { isEffectiveCluster } from './layout.js';

export interface PortClusterCtx {
  readonly infoByAstId: ReadonlyMap<string, PortClusterInfo>;
  readonly spacing: ClusterSpacing;
}

// ── Phase 2: DotInputGraph construction ──

/** One entry per rank (source=portin, sink=portout) that a cluster's own
 *  direct port children populate, keyed by clusterId — feeds both the
 *  DotInputCluster.portRanks emitter field and the anchor-shape decision
 *  in buildDotNodes (ClusterDotString.entityPositionsExceptNormal /
 *  hasPort()). Description-diagram entities only ever carry
 *  EntityPosition NORMAL/PORTIN/PORTOUT (abel/Entity.java:327-338) — so
 *  "cluster has a port child" and Java's hasPort() coincide exactly here. */
export function computePortRanksByCluster(
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
  // #lizard forgives -- pre-existing (7 params): the cohesive anchor-node
  // build context threaded from buildDotNodes's own single call site --
  // mission G5/C1 500-line split (pure move), not introduced here.
}

export function buildDotNodes(
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
  // #lizard forgives -- pre-existing (NLOC 38, CCN 7, 9 params): a flat
  // node-then-anchor build loop with early-continue guards -- mission
  // G5/C1 500-line split (pure move), not introduced here.
}

export function buildDotClusters(
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

export function buildDotEdges(
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
  // #lizard forgives -- pre-existing (NLOC 47, CCN 9): a per-link resolve
  // + attribute-build loop with early-continue guards -- mission G5/C1
  // 500-line split (pure move), not introduced here.
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
  // #lizard forgives -- pre-existing (NLOC 49, CCN 17, 8 params): two
  // parallel leaf/container branches (upstream's own EMPTY_PACKAGE-demote
  // vs real-cluster-recursion split, GraphvizImageBuilder.printGroups)
  // sharing the same optional-field-copy shape -- mission G5/C1 500-line
  // split (pure move), not introduced here.
}

export function buildGeoTree(
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
  // #lizard forgives -- pre-existing (7 params): the cohesive geo-tree
  // build context threaded from buildGeoAndEdges's own single call site --
  // mission G5/C1 500-line split (pure move), not introduced here.
}

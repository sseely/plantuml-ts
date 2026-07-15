/**
 * Pure, stateless helpers for the description diagram layout engine.
 *
 * Reduced for the single-pass cluster layout: grid-based inner layout,
 * InnerLayoutResult, and buildContainerOwnerMap are removed. What remains:
 * types, sizing constants, leaf measurement, bbox computation, spline clipping,
 * geo coordinate shift, and the node-geo index.
 */

import type {
  DescriptionDiagramAST,
  DescriptiveLink,
  DescriptiveLinkStyle,
  DescriptiveNode,
} from './ast.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import { CONTAINER_SYMBOLS } from './parse-helpers.js';
import type { USymbol } from '../../core/descriptive-keywords.js';
import type { DotInputNodeShape } from '../../core/graph-layout.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';
import type { ScaleSpec } from '../../core/scale-command.js';
import { spriteDimsLookupFor } from '../../core/sprite-commands.js';
import { visibleStereotypeLabels, nodeWithVisibleStereotype } from './element-grammar.js';

// ---------------------------------------------------------------------------
// Public output node type
// ---------------------------------------------------------------------------

export interface DescriptionNodeGeo {
  id: string;
  /** Upstream USymbol shape — drives render dispatch in T6. */
  symbol: USymbol;
  display: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: DescriptionNodeGeo[];
  /** G1 I5b: ALL stereotype tags, in source order (see
   *  `DescriptiveNode.stereotype`'s doc comment). */
  stereotype?: readonly string[];
  /** Raw inline color/style override string (`#orange;line:blue`,
   *  `#line.dashed`), verbatim from `DescriptiveNode.color` — parsed at
   *  render time by `renderer-entity.ts#parseColorOverride` (mirrors
   *  upstream `Colors`, klimt/color/Colors.java — see that parser's own
   *  doc comment for the token grammar and what is/isn't ported). */
  color?: string;
  /** I3b write-set expansion (journaled) -- copied straight through from
   *  `DescriptiveNode.creationIndex` by `layout.ts#buildGeoNode` (and
   *  `degenerateSingleLeaf`'s own single-node geo) -- see that field's doc
   *  comment for the shared parse-time counter mechanism. Consumed only by
   *  `renderer-uid.ts#buildUidPlan`; no layout math reads it. */
  creationIndex?: number;
  /** I3b write-set expansion (journaled) -- copied straight through from
   *  `DescriptiveNode.declaredAsGroup`. An EXPLICITLY-braced container
   *  (`component X { }`) keeps this flag even when EMPTY (`children.length
   *  === 0`) -- `GraphvizImageBuilder.printGroups` (java:408-423) demotes
   *  an empty `GroupType.PACKAGE` to a leaf-drawn `EMPTY_PACKAGE` entity
   *  but still registers it in ITS OWN group-sibling iteration (drawn
   *  before/interleaved with real subgroups, never with true top-level
   *  leaves) -- consumed only by `renderer.ts#collectByKind`'s draw-order
   *  walk; no layout math reads it. */
  declaredAsGroup?: true;
  /** G1 I5 write-set expansion (journaled) -- set ONLY on a `symbol ===
   *  'port'` child, by `layout.ts#buildGeoNode`'s container branch (the
   *  one place a port's parent cluster bbox AND the port's own resolved
   *  x/y are both in scope at once). Mirrors upstream `EntityImagePort
   *  .upPosition()` (svek/image/EntityImagePort.java:76-80): `true` when
   *  the port's top edge (`y`) sits above its parent cluster's vertical
   *  CENTER (`node.getMinY() < clusterCenter.getY()`) -- drives which side
   *  of the port's small box `renderer-entity.ts#drawPortFallback` draws
   *  its label text on. Consumed only there; no other layout math reads
   *  it. Absent on every non-port node (upstream's own check is only ever
   *  reached from `EntityImagePort`). */
  portLabelAbove?: boolean;
  /** G1 I-hideshow: `true` when this node (or an ancestor container) is
   *  hidden by a `hide`/`show` entity-visibility rule
   *  (`element-grammar.ts#effectiveHiddenIds`) -- draw-time-only, computed
   *  AFTER layout (position/size are unaffected, jar-verified: hidden
   *  entities still fully participate in the DOT graph, only their drawing
   *  is suppressed). Consumed by `renderer.ts#drawClusters`/
   *  `#drawEntities` to skip the node entirely; absent means visible
   *  (every non-hide fixture never sets it). */
  hidden?: true;
}

// ---------------------------------------------------------------------------
// Axis-aligned bounding box (internal utility)
// ---------------------------------------------------------------------------

export interface Bbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Sizing constants (exported so layout.ts can use them)
// ---------------------------------------------------------------------------

// Leaf-node box sizing (measureLeafNode + its per-symbol USymbol margin table)
// lives in ./leaf-sizing.js. measureLeafNode is used internally here and by
// layout.ts; the constants are re-exported so existing importers keep their
// `layout-helpers` import path.
import { measureLeafNode, type ComponentStyle } from './leaf-sizing.js';
export {
  measureLeafNode,
  ACTOR_WIDTH,
  ACTOR_HEIGHT,
  USECASE_HEIGHT,
  PORT_SIZE,
} from './leaf-sizing.js';

/** Padding on left / right / bottom inside a container box. */
export const CONTAINER_PADDING = 16;
/** Extra space at the top of a container box for its label. */
export const CONTAINER_TOP_PAD = 28;

/** Width of an empty container (container symbol with no children). */
export const EMPTY_CONTAINER_WIDTH = 160;
/** Height of an empty container. */
export const EMPTY_CONTAINER_HEIGHT = 80;
/** Trailing (right/bottom) diagram margin (jar-verified 12px on `[A]`). */
export const LAYOUT_MARGIN = 12;
/** Leading (left/top) margin where content starts — jar-verified 7px
 *  (`[A]`: outermost rect at 7,7). Asymmetric with the trailing margin;
 *  total = LAYOUT_MARGIN_LEADING + content + LAYOUT_MARGIN. */
export const LAYOUT_MARGIN_LEADING = 7;
/** Svek group-anchor point size — `width=.01` (inches) in ClusterDotString
 *  .java:149/183, converted to px (0.01in * 72px/in). Height matches width;
 *  our layout engine (unlike real graphviz's `point` shape) always requires
 *  an explicit height. */
export const GROUP_ANCHOR_SIZE = 0.72;
/** SvekNode.appendLabelHtmlSpecialForPort's `width2 > 40` threshold: a port
 *  whose display text renders wider than this switches from the plain
 *  small `shape=rect` square to the `shape=plaintext` PORT="P" HTML table. */
const PORT_LABEL_WIDE_THRESHOLD = 40;
/** SvekNode.appendLabelHtmlSpecialForPortHtml's `fullWidth` floor. */
const PORT_TABLE_PAD_FLOOR = 10;
/** Approximate title-bar sizing for the ClusterDotString port placeholder's
 *  reused cluster-title label (`empty()`, ClusterDotString.java:177-184) —
 *  render fidelity is not the DOT-parity bar (the comparator never reads
 *  inside a `label=<...>` value), so nominal padding stands in for Svek's
 *  real `getTitleAndAttributeWidth/Height`. */
const TITLE_LABEL_H_PADDING = 20;
const TITLE_LABEL_HEIGHT = 16;

// ---------------------------------------------------------------------------
// Container membership
// ---------------------------------------------------------------------------

export function isContainer(symbol: USymbol): boolean {
  return CONTAINER_SYMBOLS.has(symbol);
}

/**
 * True when an AST node becomes a graphviz cluster:
 * has a container symbol AND has at least one child.
 */
export function isClusterNode(node: DescriptiveNode): boolean {
  return isContainer(node.symbol) && node.children.length > 0;
}

// ---------------------------------------------------------------------------
// Container bounding box
// ---------------------------------------------------------------------------

/**
 * Compute a container's bbox as the padded union of its direct children's
 * bboxes (each child may be a leaf geo or a container geo already padded).
 * Returns EMPTY_CONTAINER dimensions when directChildren is empty.
 */
export function computeContainerBbox(directChildren: DescriptionNodeGeo[]): Bbox {
  if (directChildren.length === 0) {
    return { x: 0, y: 0, width: EMPTY_CONTAINER_WIDTH, height: EMPTY_CONTAINER_HEIGHT };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of directChildren) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x + c.width > maxX) maxX = c.x + c.width;
    if (c.y + c.height > maxY) maxY = c.y + c.height;
  }
  return {
    x: minX - CONTAINER_PADDING,
    y: minY - CONTAINER_TOP_PAD,
    width: (maxX - minX) + 2 * CONTAINER_PADDING,
    height: (maxY - minY) + CONTAINER_TOP_PAD + CONTAINER_PADDING,
  };
}

// ---------------------------------------------------------------------------
// Coordinate shift
// ---------------------------------------------------------------------------

/** Recursively shift a DescriptionNodeGeo and all its descendants by (dx, dy). */
export function shiftGeo(geo: DescriptionNodeGeo, dx: number, dy: number): DescriptionNodeGeo {
  return {
    ...geo,
    x: geo.x + dx,
    y: geo.y + dy,
    children: geo.children.map((c) => shiftGeo(c, dx, dy)),
  };
}

// ---------------------------------------------------------------------------
// Spline clipping at bbox boundary
// ---------------------------------------------------------------------------

export function insideBbox(p: { x: number; y: number }, b: Bbox): boolean {
  return p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
}

// Spline↔container-bbox clipping (`clipSplineStart`/`clipSplineEnd`) lives in
// `spline-clip.ts`: it needs `insideBbox`/`Bbox` from here, and was split out
// both to stay under the 500-line cap and because the bezier-aware rewrite
// (de Casteljau boundary split, follow-up F1) grew past a one-liner.

// ---------------------------------------------------------------------------
// Node-geo index (flat id → geo, including descendants)
// ---------------------------------------------------------------------------

export function buildNodeGeoIndex(
  geos: readonly DescriptionNodeGeo[],
): Map<string, DescriptionNodeGeo> {
  const map = new Map<string, DescriptionNodeGeo>();
  function index(list: readonly DescriptionNodeGeo[]): void {
    for (const g of list) {
      map.set(g.id, g);
      if (g.children.length > 0) index(g.children);
    }
  }
  index(geos);
  return map;
}


// ---------------------------------------------------------------------------
// Link endpoint resolution (moved from layout.ts — file-size limit)
// ---------------------------------------------------------------------------

export interface EdgeContainerEndpoints {
  fromContainerAstId?: string;
  toContainerAstId?: string;
}

/**
 * DOT node id an edge endpoint resolves to (`dotNodeId`), plus the AST
 * container id when the endpoint targeted a group directly (`containerAstId`
 * — used for spline-clipping to the container's rendered bbox, unchanged by
 * the group-anchor mechanism below).
 */
export interface ResolvedEndpoint {
  dotNodeId: string;
  containerAstId: string | undefined;
}

/**
 * Synthetic DOT node id for a group's shared anchor point — Svek's
 * `Cluster.getSpecialPointId` (`"za" + group.getUid()`), one per group,
 * reused by every edge that targets that group directly (never one per
 * edge). Keyed off our own synthetic `clusterId` (never user-controlled)
 * rather than the AST id, so it can never collide with a user identifier.
 */
export function groupAnchorNodeId(clusterId: string): string {
  return `${clusterId}-anchor`;
}

/**
 * Resolve a link endpoint (`DescriptiveLink.from`/`to`) to the DOT node id
 * an edge should attach to.
 *
 * - A leaf id (including an EMPTY container — GraphvizImageBuilder.java:
 *   416-418 demotes every empty `GroupType.PACKAGE` group, which covers all
 *   description-diagram block groups, to a plain leaf entity) resolves to
 *   itself directly.
 * - A non-empty container id (the only remaining case — every empty
 *   container is already in `leafIdSet`) resolves to that group's shared
 *   anchor point (`Bibliotekon.getNodeUid`'s group fallback), never to one
 *   of its descendants — upstream never anchors a group-edge to a
 *   descendant leaf.
 *
 * `qualifiedPathToDotKey` (mission I1b, container-scoped identity —
 * namespace-groups.ts's `dotKeyFor`) is an optional translation table from
 * a node's ALWAYS-fully-qualified path (`command-table.ts`'s
 * `resolveEndpointNamespace`, whenever a link endpoint was resolved via a
 * dotted reference into an existing container) to whatever canonical key
 * `classifyAst` actually assigned that node — its bare id in the common
 * (non-colliding) case, or that same qualified path when disambiguation was
 * needed. A direct `id` lookup is tried FIRST and always wins when it
 * succeeds, so this fallback never changes behavior for any endpoint that
 * isn't a namespace-qualified reference.
 */
export function resolveEndpoint(
  id: string,
  leafIdSet: Set<string>,
  astNodeById: Map<string, DescriptiveNode>,
  clusterIdByContainerAstId: Map<string, string>,
  qualifiedPathToDotKey?: ReadonlyMap<string, string>,
): ResolvedEndpoint | undefined {
  const key =
    leafIdSet.has(id) || astNodeById.has(id) ? id : (qualifiedPathToDotKey?.get(id) ?? id);
  if (leafIdSet.has(key)) return { dotNodeId: key, containerAstId: undefined };
  const node = astNodeById.get(key);
  if (node === undefined) return undefined;
  const clusterId = clusterIdByContainerAstId.get(key);
  if (clusterId === undefined) return undefined;
  return { dotNodeId: groupAnchorNodeId(clusterId), containerAstId: key };
}

export function containerEndpointsInfo(
  fromRes: ResolvedEndpoint,
  toRes: ResolvedEndpoint,
): EdgeContainerEndpoints | undefined {
  const info: EdgeContainerEndpoints = {};
  if (fromRes.containerAstId !== undefined) info.fromContainerAstId = fromRes.containerAstId;
  if (toRes.containerAstId !== undefined) info.toContainerAstId = toRes.containerAstId;
  if (info.fromContainerAstId === undefined && info.toContainerAstId === undefined) {
    return undefined;
  }
  return info;
}

// Node shape: EntityImageDescription/SvekNode ShapeType -> Svek DOT shape.
// See plans/dot-oracle-sync/phase-2-description/shape-mechanism.md.

/** shapeType switch: FOLDER/PACKAGE stay `rect` (folder tab is render-only),
 *  HEXAGON->hexagon, USECASE(_BUSINESS)->ellipse. INTERFACE is resolved by
 *  {@link isInterfaceShielded}; everything else (actor included) is `rect`. */
export function symbolBaseShape(symbol: USymbol): DotInputNodeShape | undefined {
  if (symbol === 'hexagon') return 'hexagon';
  if (symbol === 'usecase' || symbol === 'usecase-business') return 'ellipse';
  return undefined;
}

/** getShield (hasKal1/hasKal2 qualifiers never apply to description
 *  diagrams). Gates the suppressions that zero hideText's shield: (a)
 *  isThereADoubleLink; (b) hasSomeHorizontalLinkVisible (non-hidden length-1
 *  link -- fixCircleLabelOverlapping defaults false, always applies); (c)
 *  hasSomeHorizontalLinkDoubleDecorated (length-1, decor both ends, no
 *  `!hidden` guard). */
export function isInterfaceShielded(
  id: string,
  links: readonly DescriptiveLink[],
  fixCircleLabelOverlapping = false,
): boolean {
  const touching = links.filter((l) => l.from === id || l.to === id);
  const others = new Set<string>();
  for (const l of touching) {
    const other = l.from === id ? l.to : l.from;
    if (others.has(other)) return false; // (a) isThereADoubleLink
    others.add(other);
  }
  // (b) hasSomeHorizontalLinkVisible — non-hidden length-1 link; suppresses
  //     only when fixCircleLabelOverlapping is false.
  if (
    !fixCircleLabelOverlapping &&
    touching.some((l) => l.length === 1 && l.hidden !== true)
  ) {
    return false;
  }
  // (c) hasSomeHorizontalLinkDoubleDecorated — length-1, decor on both ends
  //     (no !hidden guard); always suppresses.
  if (
    touching.some(
      (l) => l.length === 1 && l.tailDecor !== undefined && l.headDecor !== undefined,
    )
  ) {
    return false;
  }
  return true;
}

/** Svek shape for a leaf: ShapeType map + shield/plaintext for `interface`
 *  (and `circle`, see below). */
export function shapeForNode(
  node: DescriptiveNode,
  links: readonly DescriptiveLink[],
  fixCircleLabelOverlapping = false,
): DotInputNodeShape | undefined {
  // `Entity.getUSymbol` (abel/Entity.java:415-416) overrides the leaf's
  // stored USymbol unconditionally for LeafType.CIRCLE: `if (getLeafType()
  // == LeafType.CIRCLE) return USymbols.INTERFACE;` -- a bare `circle X`
  // element is INTERFACE for every consumer (EntityImageDescription's
  // shapeType/hideText included), not the "default component" symbol the
  // local `usymbol = null` in CommandCreateElementFull might suggest at a
  // glance (that variable is validation-only, never stored). Confirmed
  // against the oracle (kizobu-64-rozo458, tacixe-99-gesi489): a lone
  // `circle` leaf renders shape=plaintext, not rect. `circle` shares the
  // interface shield mechanism byte-for-byte.
  if (node.symbol === 'interface' || node.symbol === 'circle') {
    return isInterfaceShielded(node.id, links, fixCircleLabelOverlapping)
      ? 'plaintext'
      : undefined;
  }
  return symbolBaseShape(node.symbol);
}

// ---------------------------------------------------------------------------
// Port entity shape (EntityPosition PORTIN/PORTOUT — abel/EntityPosition
// .java, SvekNode.appendLabelHtmlSpecialForPort)
// ---------------------------------------------------------------------------

/** SvekNode.appendLabelHtmlSpecialForPort: `getMaxWidthFromLabelForEntryExit
 *  (stringBounder) > 40` switches a port leaf from the plain small
 *  `shape=rect` square to the `shape=plaintext` PORT="P" HTML table. */
export function isPortLabelWide(
  node: DescriptiveNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): boolean {
  return measurer.measure(node.display, fontSpec).width > PORT_LABEL_WIDE_THRESHOLD;
}

/** appendLabelHtmlSpecialForPortHtml's `fullWidth` (`width2 - 40`, floored
 *  at 10) — the blank cell width flanking the PORT="P" cell. Only called
 *  once {@link isPortLabelWide} is true. */
export function portTablePad(
  node: DescriptiveNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): number {
  const width2 = measurer.measure(node.display, fontSpec).width;
  return Math.max(PORT_TABLE_PAD_FLOOR, width2 - PORT_LABEL_WIDE_THRESHOLD);
}

/** Approximate title-bar dims for a cluster's own display name — used only
 *  by the `ClusterDotString.empty()` port placeholder (layout.ts), which
 *  reuses the owning cluster's title as its `label=<TABLE...>` value. */
export function measureTitleLabel(
  display: string,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): { width: number; height: number } {
  return {
    width: measurer.measure(display, fontSpec).width + TITLE_LABEL_H_PADDING,
    height: TITLE_LABEL_HEIGHT,
  };
}


export interface DescriptionEdgeGeo {
  id: string;
  from: string;
  to: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
  stereotype?: string;
  /** G1 I5e: true ONLY for the post-colon-embedded stereotype form (the
   *  one shape upstream actually draws as a visible edge label) -- see
   *  `DescriptiveLink.stereotypeIsLinkLabel`'s doc comment for the full
   *  mechanism. Absent means the pre-colon/style-selector-only form,
   *  never drawn. */
  stereotypeIsLinkLabel?: true;
  /** Final resolved style category (queue char + bracket override) -- see
   *  `DescriptiveLink.style`'s doc comment. Copied straight through by
   *  `layout-geo-post.ts#assembleEdgeGeo`. */
  style: DescriptiveLinkStyle;
  /** Bracket `thickness=N` override -- see `DescriptiveLink
   *  .thicknessOverride`'s doc comment. */
  styleThickness?: number;
  /** Bracket `#color` override (primary segment only, leading `#`
   *  stripped) -- see `DescriptiveLink.colorOverride`'s doc comment. Feeds
   *  BOTH the line stroke and the (same-color) filled extremity, matching
   *  upstream `svek/SvekEdge.java:884-893`. */
  styleColor?: string;
  arrowHead?: 'open' | 'filled' | 'none';
  /**
   * T17 write-set expansion (journaled — see the mission decision journal):
   * the raw `DescriptiveLink.tailDecor`/`.headDecor` tokens, carried through
   * unchanged from the AST so `renderDescription` can feed `SvekEdge`'s full
   * `LinkDecorName` vocabulary (composition/aggregation/extends/crowfoot/…)
   * instead of only the lossy `arrowHead` open/filled/none classification.
   * No layout math reads these — passthrough only.
   */
  tailDecor?: string;
  headDecor?: string;
  /** I3b write-set expansion (journaled) -- copied straight through from
   *  `DescriptiveLink.creationIndex` by `layout-geo-post.ts#assembleEdgeGeo`
   *  -- see that field's doc comment. Consumed only by
   *  `renderer-uid.ts#buildUidPlan`; no layout math reads it. */
  creationIndex?: number;
  /** `true` when EITHER endpoint entity is hidden by a `hide`/`show`
   *  rule (`Link#isHidden()`, abel/Link.java:458-459's `cl1.isHidden() ||
   *  cl2.isHidden()` disjunct ONLY). Computed by `layout-geo-post.ts
   *  #assembleEdgeGeo` from the SAME `hidden` id set `buildGeoNode` uses;
   *  consumed by `renderer.ts#drawEdges` to skip the edge entirely
   *  (jar-verified: comp1--comp2 with comp2 hidden draws neither entity
   *  NOR the connecting edge, component/ciboso-93-romi495).
   *
   *  G1 I-linkstyle: the THIRD upstream disjunct, `Link#isHidden()`'s own
   *  `this.hidden` field (the `-[hidden]-` bracket keyword,
   *  `DescriptiveLink.hidden`) is DELIBERATELY still not folded in here --
   *  attempted and reverted. Wiring it (OR-ing `link.hidden` into this
   *  field) correctly elides the edge's `<path>`/`<polygon>` (jar-verified
   *  component/balopu-66-jagu236: `-[hidden]->` draws nothing, matching
   *  the jar) but REGRESSES the diagram's overall canvas size on fixtures
   *  where that edge's un-drawn geometry would otherwise have extended the
   *  ink-extent bounding box (component/dujodu-23-viba393: 5->159 diffs,
   *  component/tujica-34-tire129: 1->62 diffs -- both `svg/@width
   *  @height @viewBox` shrink below the jar's value). This is the SAME
   *  class of gap I-hideshow already root-caused and partially fixed for
   *  hidden ENTITIES ("hidden entities must still reserve canvas space" --
   *  upstream's `UHidden` wraps the `UGraphic` so draw calls still run
   *  (and still register ink-extent) but paint nothing; this port's
   *  coarse "skip the draw call entirely" approximation loses that
   *  ink-extent registration) -- not yet extended to hidden EDGES. Fixing
   *  it requires the edge to still contribute its spline's ink extent to
   *  the canvas-size computation while suppressing only the visible paint,
   *  a LimitFinder-adjacent mechanism out of a bracket-modifier-parsing
   *  iteration's scope. */
  hidden?: true;
}

export interface DescriptionGeometry {
  totalWidth: number;
  totalHeight: number;
  nodes: DescriptionNodeGeo[];
  edges: DescriptionEdgeGeo[];
  /** T17 seed thread — see `DescriptionDiagramAST.seed`'s doc comment.
   *  Copied straight through from the AST by `layout.ts`; no layout math
   *  reads it. Consumed by `renderDescription`'s `UGraphicSvg.build` call. */
  seed?: bigint;
  /**
   * SI5b+E2r T7 write-set expansion (journaled, additive-only, same
   * pattern as `seed` above): the diagram's `sprite $name {...}` registry
   * (T4, `ast.sprites`), copied straight through by `layout.ts` — no
   * layout math reads it (D9 measurement already resolved sprite DIMS via
   * `leaf-sizing.ts`'s `SpriteDimsLookup` param, seam (b)). Consumed only
   * at render time (`renderer.ts` -> `renderer-entity.ts#drawEntity` ->
   * `render-atoms.ts`) to resolve `<$name>` atoms to actual tinted PNGs.
   * `SyncPlugin#render(geo, theme)`'s two-arg contract has no `ast`
   * param — this mirrors `seed`'s own established precedent for getting
   * AST-only data to the render phase through `geo` instead. */
  sprites?: SpriteRegistry;
  /**
   * Mission G1 I-scale write-set expansion (journaled, additive-only,
   * same pattern as `seed`/`sprites` above): the diagram's `scale ...`
   * directive (`DescriptiveNode`'s sibling field, `ast.ts`'s `scale` doc
   * comment), copied straight through by `layout.ts` -- no layout math
   * reads it (scale is an SVG-emission-time concern only). Consumed only
   * by `renderer.ts#renderDescription`, which resolves it to a clamped
   * numeric factor (`scale-command.ts#resolveScaleFactor`) against the
   * diagram's own unscaled document dimension.
   */
  scale?: ScaleSpec;
}

/**
 * GraphvizImageBuilder.buildImage:211-222: a diagram with zero groups, zero
 * links, and exactly one root leaf (DotData.isDegeneratedWithFewEntities —
 * checked BEFORE empty-group demotion, so a lone empty braced container does
 * NOT qualify) is drawn directly as EntityImageDegenerated; PlantUML never
 * invokes graphviz. We must not either, or the DOT graph counts diverge.
 * Hexagon leaves are excluded upstream and take the normal svek path.
 */
export function degenerateSingleLeaf(
  ast: DescriptionDiagramAST,
  containersCount: number,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  componentStyle: ComponentStyle | undefined,
): DescriptionGeometry | undefined {
  // #lizard forgives — pre-existing: CCN is a flat chain of early-return
  // guards (the upstream "does this qualify as a degenerate single leaf?"
  // predicate), and the 5 params are the cohesive leaf-measurement context
  // threaded from the caller. Surfaced by a full-file rescan, not new here.
  if (ast.links.length !== 0 || containersCount !== 0) return undefined;
  if (ast.nodes.length !== 1) return undefined;
  const node = ast.nodes[0]!;
  if (node.declaredAsGroup === true || node.symbol === 'hexagon') return undefined;
  // SI5b+E2r T7 write-set expansion (journaled, seam (c) completeness): the
  // degenerate single-leaf path bypasses `runLayout`'s normal DOT pipeline
  // entirely, so it needs its OWN sprite-dims bridge for D9 measurement —
  // same one-liner `layout.ts#layoutDescription` builds for the normal path.
  const sprites = ast.sprites !== undefined ? spriteDimsLookupFor(ast.sprites) : undefined;
  // G1 I-hideshow: a single-root-leaf diagram can still carry `hide
  // stereotype`/`hide <<label>> stereotype` -- filter BEFORE sizing so a
  // hidden guillemet block reserves no footprint (EntityImageUseCase.java
  // :96-109/EntityImageDescription.java:190-201 both size from the
  // ALREADY-filtered `portionShower.getVisibleStereotypeLabels` result,
  // not the raw stereotype list). No corpus fixture in this iteration's
  // 13-fixture reach exercises this path (all have links/containers) --
  // included for structural consistency with the two other assignment
  // points (`layout.ts#buildGeoNode`, `layout.ts#buildDotNodes`), which
  // both filter the identical way.
  const stereotypeRules = ast.stereotypeVisibilityRules ?? [];
  const visibleStereotype = visibleStereotypeLabels(node.stereotype, stereotypeRules);
  const visibleNode = nodeWithVisibleStereotype(node, stereotypeRules);
  const dims = measureLeafNode(visibleNode, fontSpec, measurer, componentStyle, sprites);
  const geo: DescriptionNodeGeo = {
    id: node.id,
    symbol: node.symbol,
    display: node.display,
    x: LAYOUT_MARGIN_LEADING,
    y: LAYOUT_MARGIN_LEADING,
    width: dims.width,
    height: dims.height,
    children: [],
  };
  if (visibleStereotype !== undefined && visibleStereotype.length > 0) geo.stereotype = visibleStereotype;
  if (node.color !== undefined) geo.color = node.color;
  if (node.creationIndex !== undefined) geo.creationIndex = node.creationIndex;
  return {
    totalWidth: dims.width + LAYOUT_MARGIN_LEADING + LAYOUT_MARGIN,
    totalHeight: dims.height + LAYOUT_MARGIN_LEADING + LAYOUT_MARGIN,
    nodes: [geo],
    edges: [],
    ...(ast.sprites !== undefined ? { sprites: ast.sprites } : {}),
  };
}

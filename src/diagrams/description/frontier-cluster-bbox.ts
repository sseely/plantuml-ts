/**
 * frontier-cluster-bbox.ts — wires `frontier-calculator.ts` (`Cluster.java
 * #manageEntryExitPoint`/`FrontierCalculator.java`) and `frontier-shadow-
 * layout.ts` (the `initial` rect source) together into one `Bbox` a port
 * cluster's `buildGeoNode` (layout.ts) can drop in place of
 * `computeContainerBbox`'s result.
 *
 * Mirrors `Cluster.manageEntryExitPoint` (java:410-430): split the
 * cluster's already-resolved children into `insides` (normal-position —
 * full rect) vs `points` (ports — center only), run the port-cluster
 * shadow layout to get `initial`, align its frame to the real, already-
 * resolved port positions (see `frontier-shadow-layout.ts`'s doc comment
 * for why this alignment step is needed instead of reusing the shadow
 * calc's own port positions directly), then apply `manageEntryExitPoint`
 * + `ensureMinWidth` (java:427-428's `getTitleAndAttributeWidth() + 10`
 * guard, reproduced verbatim).
 *
 * Scoped to `insides.length === 0` (a PURE port-only container — no
 * `insides` alongside the ports). Java's own `core == null` branch
 * (FrontierCalculator.java:60-63) covers BOTH: when `insides` is non-empty,
 * `core` seeds from the real (already precise) merged `insides` rects
 * directly, and `initial` only matters for its "untouched-axis snap-back"
 * role (java:85-95) -- a real fixture (`component/cuxelu-66-zopu195`,
 * `component/dugovi-24-kupu658`, both `component X { [normal] portout p }`)
 * showed that snap-back, fed by this module's necessarily-APPROXIMATE
 * `initial` (a single combined-bbox placeholder standing in for the real
 * `insides` members inside the shadow calc, which Java never needs at all
 * for this branch), regresses vs. the prior padded-union formula -- so the
 * mixed-children case falls back to `computeContainerBbox` here instead of
 * shipping an imprecise mechanism-B result. See decision-journal.md's J2
 * entry and the ledger's named remainder for the real fix (an `insides`
 * that doesn't need shadow-layout approximation at all for this branch).
 */
import type { DescriptionNodeGeo, Bbox } from './layout-helpers.js';
import { computeContainerBbox } from './layout-helpers.js';
import {
  manageEntryExitPoint, ensureMinWidth, type RectangleArea, type Point, type FrontierRankdir,
} from './frontier-calculator.js';
import {
  computePortClusterInitialRect, type ShadowRankSpec, type ShadowPortSpec,
} from './frontier-shadow-layout.js';

export interface PortClusterInfo {
  readonly ranks: readonly { rank: 'source' | 'sink'; nodeIds: readonly string[] }[];
  readonly anchorWidth: number;
  readonly anchorHeight: number;
  /** `Cluster.getTitleAndAttributeWidth()` -- 0 when the cluster has no
   *  title/attribute text (guards the `ensureMinWidth` call below, matching
   *  java:427's `> 0` condition). */
  readonly titleWidth: number;
  readonly titleHeight: number;
}

/** Graph-level spacing/direction a port cluster's shadow layout must
 *  match -- the SAME `nodeSep`/`rankSep`/`rankdir` the real pipeline
 *  already resolved for this diagram (`computeGraphSpacing`, `ast.rankdir`
 *  -- see `frontier-shadow-layout.ts`'s doc comment for why this keeps the
 *  shadow calc's port spacing faithful to the real one). */
export interface ClusterSpacing {
  readonly nodeSep: number;
  readonly rankSep: number;
  readonly rankdir: FrontierRankdir;
}

function toRect(g: DescriptionNodeGeo): RectangleArea {
  return { minX: g.x, minY: g.y, maxX: g.x + g.width, maxY: g.y + g.height };
}

function toShadowRanks(
  ranks: PortClusterInfo['ranks'],
  byId: ReadonlyMap<string, DescriptionNodeGeo>,
): ShadowRankSpec[] {
  return ranks
    .map((r) => ({
      rank: r.rank,
      ports: r.nodeIds
        .map((id): ShadowPortSpec | undefined => {
          const c = byId.get(id);
          return c === undefined ? undefined : { id, width: c.width, height: c.height };
        })
        .filter((p): p is ShadowPortSpec => p !== undefined),
    }))
    .filter((r) => r.ports.length > 0);
}

interface InsidesAndPoints {
  readonly insides: RectangleArea[];
  readonly pointsById: Map<string, Point>;
}

/** `Cluster.manageEntryExitPoint`'s own split (java:413-417): normal-
 *  position children merge their full rect into `insides`; ports
 *  contribute only their center point, keyed by id for the alignment step
 *  below. */
function splitInsidesAndPoints(children: readonly DescriptionNodeGeo[]): InsidesAndPoints {
  const insides: RectangleArea[] = [];
  const pointsById = new Map<string, Point>();
  for (const c of children) {
    if (c.symbol === 'port') {
      pointsById.set(c.id, { x: c.x + c.width / 2, y: c.y + c.height / 2 });
    } else {
      insides.push(toRect(c));
    }
  }
  return { insides, pointsById };
}

/** Runs the port-cluster shadow layout and aligns its own coordinate frame
 *  to the real, already-resolved port positions via one reference port
 *  (frontier-shadow-layout.ts's doc comment) -- relative port spacing is
 *  already faithful in the real pipeline, so a single (dx,dy) translation
 *  suffices. */
function computeAlignedInitial(
  shadowRanks: readonly ShadowRankSpec[],
  pointsById: ReadonlyMap<string, Point>,
  info: PortClusterInfo,
  spacing: ClusterSpacing,
): RectangleArea {
  const shadow = computePortClusterInitialRect({
    ranks: shadowRanks,
    anchorWidth: info.anchorWidth,
    anchorHeight: info.anchorHeight,
    ...spacing,
  });
  const refId = shadowRanks[0]!.ports[0]!.id;
  const shadowPt = shadow.portCenters.get(refId)!;
  const mainPt = pointsById.get(refId)!;
  const dx = mainPt.x - shadowPt.x;
  const dy = mainPt.y - shadowPt.y;
  return {
    minX: shadow.initial.minX + dx, minY: shadow.initial.minY + dy,
    maxX: shadow.initial.maxX + dx, maxY: shadow.initial.maxY + dy,
  };
}

/** Computes a port cluster's real drawn bbox, faithfully mirroring
 *  `Cluster.manageEntryExitPoint` for the pure-port-only (`insides` empty)
 *  case -- see this module's doc comment for why the mixed-children case
 *  falls back to `computeContainerBbox` instead. Also falls back there if
 *  no port child actually resolved a position (defensive -- `info` is only
 *  ever built from clusters `computePortRanksByCluster` already confirmed
 *  have port children). */
export function computePortClusterBbox(
  children: readonly DescriptionNodeGeo[],
  info: PortClusterInfo,
  spacing: ClusterSpacing,
): Bbox {
  const byId = new Map(children.map((c) => [c.id, c]));
  const shadowRanks = toShadowRanks(info.ranks, byId);
  const { insides, pointsById } = splitInsidesAndPoints(children);
  if (shadowRanks.length === 0 || insides.length > 0) return computeContainerBbox([...children]);

  const initial = computeAlignedInitial(shadowRanks, pointsById, info, spacing);
  let core = manageEntryExitPoint(initial, insides, [...pointsById.values()], spacing.rankdir);
  if (info.titleWidth > 0 && info.titleHeight > 0) {
    core = ensureMinWidth(core, initial, info.titleWidth + 10);
  }
  return { x: core.minX, y: core.minY, width: core.maxX - core.minX, height: core.maxY - core.minY };
}

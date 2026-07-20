/**
 * GeoSpec → StateGeometry materialization (mission A4/T4). Walks the
 * `GeoSpec` tree built by ./state-composite-pass.ts and, using the real
 * positions from each pass's own `DotLayoutResult`, produces the renderer's
 * `StateNodeGeo`/`TransitionGeo` tree:
 *   - `'state'` leaves read their position directly off the (shared) pass's
 *     posMap.
 *   - `'cluster'` composites share the SAME pass's posMap as their members
 *     (non-autonom composites are not a pass boundary) — the composite's own
 *     box is the bounding box of its (already-absolute) children.
 *   - `'autonom'` composites read their OWN flattened-node position off the
 *     CONTAINING pass's posMap, then shift their wrapped child pass's own
 *     (locally-rooted) geometry into that absolute frame by
 *     `InnerStateAutonom`'s title/body offset (state-composite-sizing.ts).
 */

import type { DotLayoutResult } from '../../core/graph-layout.js';
import type { GeoSpec } from './state-composite-pass.js';
import { buildTopLevelPass, buildLevelTransitionGeos } from './state-composite-pass.js';
import type { StateNodeGeo, TransitionGeo, StateGeometry, StateRegionGeo } from './state-geo-types.js';
import type { StateDiagramAST } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';

/** Exported (mission G4 S4): `state-composite-autonom.ts#buildPlainAutonomSpec`
 *  reuses this SAME node-position lookup shape to build a LOCAL (pre-outer-
 *  shift) posMap for its own child pass's ink-extent computation — see that
 *  module's own doc comment. */
export type PosMap = Map<string, DotLayoutResult['nodes'][number]>;

const BOX_PAD = 12;

function shiftGeo(g: StateNodeGeo, dx: number, dy: number): StateNodeGeo {
  const children = g.children.map((c) => shiftGeo(c, dx, dy));
  const transitions = g.transitions.map((t) => shiftTransition(t, dx, dy));
  return {
    ...g,
    x: g.x + dx,
    y: g.y + dy,
    children,
    transitions,
    // mission G4 S6, mechanism 13: an ANCESTOR's own shift (e.g. this node
    // is a nested composite reached via a grandparent's `spec.localStates`)
    // must ALSO shift `concurrentRegions`/`separators` if this node itself
    // owns concurrent regions -- otherwise a nested concurrent composite's
    // separator lines would retain their PRE-ancestor-shift coordinates.
    // `concurrentRegions` is rebuilt from the ALREADY-shifted `children`/
    // `transitions` above (by slicing on original per-region lengths) so
    // object identity with the flat arrays is preserved, matching
    // `materializeAutonom`'s own identity-sharing contract.
    ...(g.concurrentRegions !== undefined
      ? { concurrentRegions: resliceRegions(g.concurrentRegions, children, transitions) }
      : {}),
    ...(g.separators !== undefined
      ? { separators: g.separators.map((sep) => ({ x1: sep.x1 + dx, y1: sep.y1 + dy, x2: sep.x2 + dx, y2: sep.y2 + dy })) }
      : {}),
  };
}

/** Re-groups already-shifted flat `children`/`transitions` back into their
 *  original per-region boundaries (lengths preserved 1:1 by `shiftGeo`'s own
 *  `.map` above, which never adds/removes entries) -- see `shiftGeo`'s own
 *  doc comment for why this must reuse the SAME shifted objects rather than
 *  re-deriving them. */
function resliceRegions(
  original: readonly StateRegionGeo[],
  shiftedChildren: readonly StateNodeGeo[],
  shiftedTransitions: readonly TransitionGeo[],
): StateRegionGeo[] {
  const out: StateRegionGeo[] = [];
  let childCursor = 0;
  let transitionCursor = 0;
  for (const region of original) {
    out.push({
      children: shiftedChildren.slice(childCursor, childCursor + region.children.length),
      transitions: shiftedTransitions.slice(transitionCursor, transitionCursor + region.transitions.length),
    });
    childCursor += region.children.length;
    transitionCursor += region.transitions.length;
  }
  return out;
}

function shiftTransition(t: TransitionGeo, dx: number, dy: number): TransitionGeo {
  return {
    ...t,
    points: t.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    ...(t.label !== undefined ? { label: { ...t.label, x: t.label.x + dx, y: t.label.y + dy } } : {}),
  };
}

function boundingBox(children: readonly StateNodeGeo[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of children) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + c.height);
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: minX - BOX_PAD,
    y: minY - BOX_PAD,
    width: maxX - minX + BOX_PAD * 2,
    height: maxY - minY + BOX_PAD * 2,
  };
}

/** mission G4 S3 (mechanism 6): threads `spec.headerLines`/`bodyLines`/
 *  `color` onto the materialized `StateNodeGeo` — `undefined` for a
 *  concurrent-region LEAF spec (`state-composite-cluster.ts
 *  #buildConcurrentRegionLeaf`, which never sets these fields, see
 *  `GeoSpec`'s own `'autonom'` variant doc comment in state-composite-
 *  pass.ts) so `renderer-composite-box.ts#renderComposite` falls back to
 *  the pre-mechanism-6 shape for that case, unchanged.
 *
 *  mission G4 S5 (transition-nesting mechanism): `spec.localTransitions`
 *  (THIS pass's own edges, pre-shift) attach directly onto the returned
 *  node's own `StateNodeGeo.transitions` field, shifted into the SAME
 *  absolute frame as `children` — no longer bubbled up through an
 *  `outTransitions` accumulator param (the pre-S5 flat-sibling
 *  simplification). A NESTED autonom composite reachable via
 *  `spec.localStates` attaches ITS OWN `localTransitions` onto ITS OWN
 *  node during the SAME recursive `materializeSpecs` call below — nothing
 *  bubbles past its own pass boundary, matching jar's real per-pass
 *  nesting (`renderer-group.ts`'s own doc comment, `bajelo-54-dixe684`
 *  jar-verified). */
function materializeAutonom(
  spec: Extract<GeoSpec, { kind: 'autonom' }>,
  posMap: PosMap,
): StateNodeGeo | undefined {
  const pos = posMap.get(spec.id);
  if (pos === undefined) return undefined;
  const dx = pos.x + spec.offset.x;
  const dy = pos.y + spec.offset.y;
  const localPosMap: PosMap = new Map(spec.localPositions.nodes.map((n) => [n.id, n]));
  // mission G4 S6, mechanism 13: `spec.regions` (concurrent-region-owning
  // composites ONLY) drives `children`/`transitions` too -- built by
  // CONCATENATING the per-region materialized results, never the reverse,
  // so `concurrentRegions[i].children`/`.transitions` and the flat
  // `children`/`transitions` share the SAME object instances
  // (`renderer-uid.ts`'s `edgeUid` Map is keyed by `TransitionGeo` object
  // identity -- see `StateNodeGeo.concurrentRegions`'s own doc comment,
  // state-geo-types.ts). `undefined` for every plain (non-concurrent)
  // autonom composite, which keeps the pre-S6 flat-materialization path
  // unchanged.
  const regionsOut: StateRegionGeo[] | undefined = spec.regions?.map((r) => ({
    children: materializeSpecs(r.specs, localPosMap).map((g) => shiftGeo(g, dx, dy)),
    transitions: r.transitions.map((t) => shiftTransition(t, dx, dy)),
  }));
  const children =
    regionsOut !== undefined
      ? regionsOut.flatMap((r) => r.children)
      : materializeSpecs(spec.localStates, localPosMap).map((g) => shiftGeo(g, dx, dy));
  const transitions =
    regionsOut !== undefined
      ? regionsOut.flatMap((r) => r.transitions)
      : spec.localTransitions.map((t) => shiftTransition(t, dx, dy));
  const separators = spec.separators?.map((sep) => ({
    x1: sep.x1 + dx,
    y1: sep.y1 + dy,
    x2: sep.x2 + dx,
    y2: sep.y2 + dy,
  }));
  return {
    id: spec.id, kind: 'normal', display: spec.display, x: pos.x, y: pos.y, width: pos.width, height: pos.height, children, transitions,
    ...(regionsOut !== undefined ? { concurrentRegions: regionsOut } : {}),
    ...(separators !== undefined ? { separators } : {}),
    ...(spec.headerLines !== undefined ? { headerLines: spec.headerLines } : {}),
    ...(spec.bodyLines !== undefined ? { bodyLines: spec.bodyLines } : {}),
    ...(spec.color !== undefined ? { color: spec.color } : {}),
  };
}

/** mission G4 S5: a non-autonom `cluster` never owns any transitions of its
 *  own — it shares its container pass's edges (`state-composite-geo.ts`'s
 *  own module doc comment, `'cluster'` branch), so `transitions` is always
 *  `[]` here (any NESTED autonom within `spec.children` still attaches its
 *  own edges to ITS OWN node via the SAME recursive `materializeSpecs`
 *  call, unaffected by this node owning none). */
function materializeCluster(
  spec: Extract<GeoSpec, { kind: 'cluster' }>,
  posMap: PosMap,
): StateNodeGeo | undefined {
  const children = materializeSpecs(spec.children, posMap);
  if (children.length === 0) return undefined;
  const box = boundingBox(children);
  return { id: spec.id, kind: 'normal', display: spec.display, x: box.x, y: box.y, width: box.width, height: box.height, children, transitions: [] };
}

/** Exported (mission G4 S4): `state-composite-autonom.ts#buildPlainAutonomSpec`
 *  reuses this SAME dispatch to materialize its own child pass's content
 *  into `StateNodeGeo`/`TransitionGeo` — needed so the mechanism-7 ink-
 *  extent computation (`layout-ink-extent.ts#computeSvekResultGeometry`)
 *  sees the EXACT same shapes (including nested autonom/cluster composites)
 *  the top-level assembly below would eventually produce, rather than a
 *  parallel, possibly-drifting re-derivation. mission G4 S5: no longer
 *  takes an `outTransitions` accumulator — every pass's own edges now
 *  attach directly to that pass's own returned `StateNodeGeo.transitions`
 *  (see `materializeAutonom`'s own doc comment); `computeSvekResultGeometry`'s
 *  ink walk (`layout-ink-extent.ts#addNodeInk`) recurses into this SAME
 *  `.transitions` field, so ink coverage is unchanged. */
export function materializeSpecs(specs: readonly GeoSpec[], posMap: PosMap): StateNodeGeo[] {
  const out: StateNodeGeo[] = [];
  for (const spec of specs) {
    if (spec.kind === 'state') {
      const pos = posMap.get(spec.id);
      if (pos === undefined) continue;
      out.push({
        id: spec.id, kind: spec.stateKind, display: spec.display, x: pos.x, y: pos.y, width: pos.width, height: pos.height,
        children: [],
        transitions: [],
        ...(spec.headerLines !== undefined ? { headerLines: spec.headerLines } : {}),
        ...(spec.bodyLines !== undefined ? { bodyLines: spec.bodyLines } : {}),
        ...(spec.color !== undefined ? { color: spec.color } : {}),
      });
    } else if (spec.kind === 'autonom') {
      const g = materializeAutonom(spec, posMap);
      if (g !== undefined) out.push(g);
    } else {
      const g = materializeCluster(spec, posMap);
      if (g !== undefined) out.push(g);
    }
  }
  return out;
}

/** Composite (non-flat) pipeline entry point — mission A4/T4 replacement for
 *  ./layout.ts's legacy `legacyLayoutLevel` recursion. mission G4 S5:
 *  `transitions` is now ONLY the top-level pass's own edges (every nested
 *  pass's own edges live on its own `StateNodeGeo.transitions` instead,
 *  attached during `materializeSpecs` above). */
export function layoutComposite(ast: StateDiagramAST, theme: Theme, measurer: StringMeasurer): StateGeometry {
  const { acc, result, specs } = buildTopLevelPass(ast, theme, measurer);
  if (acc.nodes.length === 0) {
    return { totalWidth: 0, totalHeight: 0, states: [], transitions: [] };
  }
  const posMap: PosMap = new Map(result.nodes.map((n) => [n.id, n]));
  const states = materializeSpecs(specs, posMap);
  const transitions = buildLevelTransitionGeos(acc, result);
  return { totalWidth: result.width, totalHeight: result.height, states, transitions };
}

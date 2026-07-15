/**
 * frontier-calculator.ts — faithful port of upstream's port-cluster sizing
 * subsystem: `Cluster.java#manageEntryExitPoint` (java:410-430) +
 * `svek/FrontierCalculator.java` (the whole file).
 *
 * Upstream splits a cluster's member `SvekNode`s into `insides`
 * (normal-position entities — full `RectangleArea` merged into the
 * boundary) vs `points` (entry/exit-point ports, `isNormalPosition==false`
 * — only their CENTER point merged), then `FrontierCalculator` computes the
 * cluster's real drawn rectangle: when `insides` is EMPTY (a port-only
 * container), `core` falls back to a 2x2 box centered on the cluster's OWN
 * graphviz-assigned rectangle (`initial` — see `frontier-shadow-layout.ts`
 * for how this port obtains that value), merges each port's center, then a
 * push step (`DELTA = 3 * EntityPosition.RADIUS = 18`, java:47,97-146)
 * expands the boundary by `DELTA` on whichever edge a port's center sits
 * within `DELTA` of, except the rankdir-perpendicular corner case.
 *
 * This module operates entirely in the SAME y-DOWN (screen/SVG) coordinate
 * convention `DescriptionNodeGeo` already uses — unlike jar's own klimt
 * geometry, upstream's `RectangleArea`/`Cluster` machinery already runs
 * post-`DotStringFactory` SVG-coordinate extraction (y-down), so no
 * y-flip is needed to stay faithful; the push/touch logic is exact-equality
 * based and therefore orientation-agnostic as long as callers stay
 * internally consistent (verified against jar's raw graphviz-native (y-up)
 * numbers AND jar's final SVG (y-down) numbers for `component/
 * gafegu-06-nito976` — both reduce to the same 177x99 result).
 */

/** Mirrors upstream `klimt/geom/RectangleArea` (the axis-aligned-box
 *  subset `FrontierCalculator` actually uses). Immutable — every mutator
 *  below returns a new value, matching `RectangleArea`'s own immutable
 *  `with*`/`add*`/`merge` methods. */
export interface RectangleArea {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** `EntityPosition.RADIUS` (abel/EntityPosition.java:56). */
export const ENTITY_POSITION_RADIUS = 6;
/** `FrontierCalculator.DELTA` (svek/FrontierCalculator.java:47). */
const DELTA = 3 * ENTITY_POSITION_RADIUS;

function buildRect(minX: number, minY: number, maxX: number, maxY: number): RectangleArea {
  return { minX, minY, maxX, maxY };
}

/** `RectangleArea#merge(RectangleArea)`. */
function mergeRect(a: RectangleArea, b: RectangleArea): RectangleArea {
  return buildRect(
    Math.min(a.minX, b.minX), Math.min(a.minY, b.minY),
    Math.max(a.maxX, b.maxX), Math.max(a.maxY, b.maxY),
  );
}

/** `RectangleArea#merge(XPoint2D)`. */
function mergePoint(a: RectangleArea, p: Point): RectangleArea {
  return buildRect(
    Math.min(a.minX, p.x), Math.min(a.minY, p.y),
    Math.max(a.maxX, p.x), Math.max(a.maxY, p.y),
  );
}

function withMinX(r: RectangleArea, d: number): RectangleArea { return { ...r, minX: d }; }
function withMaxX(r: RectangleArea, d: number): RectangleArea { return { ...r, maxX: d }; }
function withMinY(r: RectangleArea, d: number): RectangleArea { return { ...r, minY: d }; }
function withMaxY(r: RectangleArea, d: number): RectangleArea { return { ...r, maxY: d }; }
function addMinX(r: RectangleArea, d: number): RectangleArea { return { ...r, minX: r.minX + d }; }
function addMaxX(r: RectangleArea, d: number): RectangleArea { return { ...r, maxX: r.maxX + d }; }
function addMinY(r: RectangleArea, d: number): RectangleArea { return { ...r, minY: r.minY + d }; }
function addMaxY(r: RectangleArea, d: number): RectangleArea { return { ...r, maxY: r.maxY + d }; }

/** `DotStringFactory`'s `Rankdir` — only the two values `FrontierCalculator`
 *  branches on (`svek/FrontierCalculator.java:120`). */
export type FrontierRankdir = 'TB' | 'LR';

/** Seed `core` when `insides` is empty: `FrontierCalculator`'s constructor,
 *  java:60-63 — a 2x2 box centered on `initial`'s own center point. */
function seedCore(initial: RectangleArea): RectangleArea {
  const cx = (initial.minX + initial.maxX) / 2;
  const cy = (initial.minY + initial.maxY) / 2;
  return buildRect(cx - 1, cy - 1, cx + 1, cy + 1);
}

/** Faithful port of `FrontierCalculator`'s constructor
 *  (svek/FrontierCalculator.java:51-148) — computes the cluster's real
 *  drawn rectangle from its graphviz-assigned `initial` rect, its
 *  normal-position member rects (`insides`), and its port center points
 *  (`points`). Callers needing `ensureMinWidth` (java:154-167) apply it to
 *  this function's result separately (mirrors `Cluster
 *  .manageEntryExitPoint`'s own two-call sequence, java:425-430).
 */
export function manageEntryExitPoint(
  initial: RectangleArea,
  insides: readonly RectangleArea[],
  points: readonly Point[],
  rankdir: FrontierRankdir,
): RectangleArea {
  let core: RectangleArea | undefined;
  for (const inside of insides) core = core === undefined ? inside : mergeRect(core, inside);
  if (core === undefined) core = seedCore(initial);
  for (const p of points) core = mergePoint(core, p);

  let touchMinX = false;
  let touchMaxX = false;
  let touchMinY = false;
  let touchMaxY = false;
  for (const p of points) {
    if (p.x === core.minX) touchMinX = true;
    if (p.x === core.maxX) touchMaxX = true;
    if (p.y === core.minY) touchMinY = true;
    if (p.y === core.maxY) touchMaxY = true;
  }
  if (!touchMinX) core = withMinX(core, initial.minX);
  if (!touchMaxX) core = withMaxX(core, initial.maxX);
  if (!touchMinY) core = withMinY(core, initial.minY);
  if (!touchMaxY) core = withMaxY(core, initial.maxY);

  let pushMinX = false;
  let pushMaxX = false;
  let pushMinY = false;
  let pushMaxY = false;
  for (const p of points) {
    if (p.y === core.minY || p.y === core.maxY) {
      if (Math.abs(p.x - core.maxX) < DELTA) pushMaxX = true;
      if (Math.abs(p.x - core.minX) < DELTA) pushMinX = true;
    }
    if (p.x === core.minX || p.x === core.maxX) {
      if (Math.abs(p.y - core.maxY) < DELTA) pushMaxY = true;
      if (Math.abs(p.y - core.minY) < DELTA) pushMinY = true;
    }
  }
  for (const p of points) {
    if (rankdir === 'LR') {
      if (p.x === core.minX && (p.y === core.minY || p.y === core.maxY)) pushMinX = false;
      if (p.x === core.maxX && (p.y === core.minY || p.y === core.maxY)) pushMaxX = false;
    } else {
      if (p.y === core.minY && (p.x === core.minX || p.x === core.maxX)) pushMinY = false;
      if (p.y === core.maxY && (p.x === core.minX || p.x === core.maxX)) pushMaxY = false;
    }
  }
  if (pushMaxX) core = addMaxX(core, DELTA);
  if (pushMinX) core = addMinX(core, -DELTA);
  if (pushMaxY) core = addMaxY(core, DELTA);
  if (pushMinY) core = addMinY(core, -DELTA);

  // #lizard forgives -- faithful port of FrontierCalculator's constructor
  // (svek/FrontierCalculator.java:51-148); branch count mirrors upstream's
  // own touch/push/corner-exclusion cases.
  return core;
}

/** Faithful port of `FrontierCalculator#ensureMinWidth`
 *  (svek/FrontierCalculator.java:154-167). */
export function ensureMinWidth(
  core: RectangleArea,
  initial: RectangleArea,
  minWidth: number,
): RectangleArea {
  const delta = core.maxX - core.minX - minWidth;
  if (delta >= 0) return core;
  let newMinX = core.minX + delta / 2;
  let newMaxX = core.maxX - delta / 2;
  const error = newMinX - initial.minX;
  if (error < 0) {
    newMinX -= error;
    newMaxX -= error;
  }
  return withMaxX(withMinX(core, newMinX), newMaxX);
}

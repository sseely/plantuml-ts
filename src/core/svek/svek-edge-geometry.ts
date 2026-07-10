import type { Point2D } from '../klimt/UTranslate.js';
import { DotPath } from '../klimt/shape/DotPath.js';

/**
 * svek-edge-geometry.ts — spline/label geometry helpers for
 * `SvekEdge.ts`. Split out to keep that file under this project's
 * 500-line cap (reported split).
 */

/**
 * buildDotPathFromSplinePoints — converts the flat graphviz-spline
 * point list `SvekEdgeInput.points` carries (this port's layout
 * pipeline's own output shape — see `layout-helpers.ts`'s
 * `DescriptionEdgeGeo`, matching the "start point, then (cp1, cp2,
 * endpoint) triples" convention from `dotgen/dotsplines.c`) into a
 * `DotPath` (`DotPath.fromBeziers`/`addCurve` — T2-ported klimt shape).
 *
 * Not a 1:1 port of any single upstream method — upstream's
 * `SvekEdge#solveLine` builds its `DotPath` by parsing graphviz's
 * RENDERED SVG `<path d="...">` text back out (`SvgResult#toDotPath`,
 * a full SVG-path-string parser this port's layout does not need,
 * since `DescriptionEdgeGeo.points` already carries the same control
 * points as plain numbers — no SVG round-trip). This function is the
 * point-list-to-`DotPath` adapter that role requires here instead.
 *
 * Throws (system-boundary input validation — this is `SvekEdge`'s
 * public constructor input, not an internal invariant) when the point
 * count isn't `1 + 3*n` for some `n >= 1` (start point plus at least
 * one complete bezier triple) — a malformed/degenerate spline this
 * class cannot draw a body for.
 */
export function buildDotPathFromSplinePoints(points: readonly Point2D[]): DotPath {
  if (points.length < 4 || (points.length - 1) % 3 !== 0) {
    throw new Error(
      `buildDotPathFromSplinePoints: expected 1 + 3*n points (n>=1), got ${points.length}`,
    );
  }
  let path = DotPath.fromBeziers([]);
  const first = points[0]!;
  let prev: Point2D = first;
  for (let i = 1; i < points.length; i += 3) {
    const cp1 = points[i]!;
    const cp2 = points[i + 1]!;
    const end = points[i + 2]!;
    path = path.addCurve(prev, cp1, cp2, end);
    prev = end;
  }
  return path;
}

/**
 * edgeMidpoint — the stereotype-placement anchor
 * (`src/diagrams/description/renderer.ts`'s own `edgeMidpoint`, ported
 * verbatim here for the klimt drawable — the two renderers share the
 * same "midpoint of the point list" convention for where a stereotype
 * guillemet label sits, absent a real bezier-midpoint solve — see
 * `DotPath.ts`'s `getMiddle()` deferral note).
 */
export function edgeMidpoint(points: readonly Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0]!;
  const mid = Math.floor(points.length / 2);
  const a = points[mid - 1]!;
  const b = points[mid]!;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

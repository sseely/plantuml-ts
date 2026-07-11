/**
 * Transition label placement — shared by every state-layout pipeline (flat,
 * T3; composite, T4) so antiparallel transitions don't overlap their labels.
 * Split out to a standalone module (no dependents) to avoid an import cycle
 * between ./layout.ts and the composite-pass modules, both of which need it.
 */

import type { Transition } from './ast.js';
import { transitionLabelText } from './state-dot-graph.js';

/** Label offset perpendicular to the edge direction. */
const LABEL_PERP = 12;

/** Attach a transition's label (guard/action/plain) at the edge's geometric
 *  midpoint, offset perpendicular to the edge direction. Pure function of
 *  the routed points. */
export function attachTransitionLabel(
  t: Transition,
  points: ReadonlyArray<{ x: number; y: number }>,
): { text: string; x: number; y: number } | undefined {
  const labelText = transitionLabelText(t);
  if (labelText === undefined || points.length < 2) return undefined;
  let mid: { x: number; y: number };
  if (points.length === 2) {
    const p0 = points[0]!;
    const p1 = points[1]!;
    mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  } else {
    mid = points[Math.floor(points.length / 2)]!;
  }
  const p0 = points[0]!;
  const pLast = points[points.length - 1]!;
  const eDx = pLast.x - p0.x;
  const eDy = pLast.y - p0.y;
  const eLen = Math.sqrt(eDx * eDx + eDy * eDy) || 1;
  return {
    text: labelText,
    x: mid.x + (eDy / eLen) * LABEL_PERP,
    y: mid.y + (-eDx / eLen) * LABEL_PERP - 4,
  };
}

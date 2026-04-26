import type { DotEdge, DotNode, DotWorkingGraph } from './types.js';

const LABEL_CLEARANCE = 12;
const MAX_SHIFT_ATTEMPTS = 10;
const LABEL_CHAR_WIDTH = 7;
const LABEL_HEIGHT = 14;

function midpointOf(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  const mid = (points.length - 1) / 2;
  const lo = Math.floor(mid);
  const hi = Math.ceil(mid);
  const p0 = points[lo]!;
  const p1 = points[hi]!;
  return { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
}

function isInsideNode(px: number, py: number, node: DotNode): boolean {
  return (
    px >= node.x &&
    px <= node.x + node.width &&
    py >= node.y &&
    py <= node.y + node.height
  );
}

function isInsideAnyNode(px: number, py: number, nodes: DotNode[]): boolean {
  for (const node of nodes) {
    if (!node.virtual && isInsideNode(px, py, node)) {
      return true;
    }
  }
  return false;
}

/**
 * Compute the perpendicular direction to the edge segment containing the
 * midpoint. Returns a unit-ish vector (dx, dy) perpendicular to the edge.
 * Falls back to (1, 0) if the edge has only a single point (degenerate).
 */
function perpendicularAt(
  points: Array<{ x: number; y: number }>,
  midIdx: number,
): { dx: number; dy: number } {
  const lo = Math.max(0, midIdx - 1);
  const hi = Math.min(points.length - 1, midIdx + 1);
  const p0 = points[lo]!;
  const p1 = points[hi]!;
  const ex = p1.x - p0.x;
  const ey = p1.y - p0.y;
  const len = Math.sqrt(ex * ex + ey * ey);
  if (len < 1e-9) {
    return { dx: 1, dy: 0 };
  }
  // Perpendicular: rotate 90° — (ex, ey) → (-ey, ex)
  return { dx: -ey / len, dy: ex / len };
}

interface LabelBBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function labelBBox(labelX: number, labelY: number, label: string): LabelBBox {
  const w = label.length * LABEL_CHAR_WIDTH;
  const h = LABEL_HEIGHT;
  return { x: labelX - w / 2, y: labelY - h / 2, w, h };
}

function bboxesOverlap(a: LabelBBox, b: LabelBBox): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function placeEdgeLabels(graph: DotWorkingGraph): void {
  const allEdges: DotEdge[] = [...graph.edges, ...graph.longEdges];
  const nodes = graph.nodes;

  // First pass: place each label at the midpoint, then shift away from nodes
  for (const edge of allEdges) {
    if (!edge.label || edge.points.length === 0) {
      continue;
    }

    const mp = midpointOf(edge.points);
    let lx = mp.x;
    let ly = mp.y;

    if (isInsideAnyNode(lx, ly, nodes)) {
      const midIdx = Math.floor((edge.points.length - 1) / 2);
      const perp = perpendicularAt(edge.points, midIdx);

      let shifted = false;
      for (let attempt = 1; attempt <= MAX_SHIFT_ATTEMPTS; attempt++) {
        const cx = mp.x + perp.dx * LABEL_CLEARANCE * attempt;
        const cy = mp.y + perp.dy * LABEL_CLEARANCE * attempt;
        if (!isInsideAnyNode(cx, cy, nodes)) {
          lx = cx;
          ly = cy;
          shifted = true;
          break;
        }
      }

      // If shifting in perpendicular direction failed, try the opposite direction
      if (!shifted) {
        for (let attempt = 1; attempt <= MAX_SHIFT_ATTEMPTS; attempt++) {
          const cx = mp.x - perp.dx * LABEL_CLEARANCE * attempt;
          const cy = mp.y - perp.dy * LABEL_CLEARANCE * attempt;
          if (!isInsideAnyNode(cx, cy, nodes)) {
            lx = cx;
            ly = cy;
            break;
          }
        }
      }
    }

    edge.labelX = lx;
    edge.labelY = ly;
  }

  // Second pass: resolve label-label overlaps
  // Collect edges that actually got a label placed
  const labeled = allEdges.filter(
    (e): e is DotEdge & { label: string; labelX: number; labelY: number } =>
      e.label !== undefined && e.label.length > 0 && e.labelX !== undefined && e.labelY !== undefined,
  );

  for (let i = 0; i < labeled.length; i++) {
    for (let j = i + 1; j < labeled.length; j++) {
      const a = labeled[i]!;
      const b = labeled[j]!;
      const ba = labelBBox(a.labelX, a.labelY, a.label);
      const bb = labelBBox(b.labelX, b.labelY, b.label);

      if (!bboxesOverlap(ba, bb)) {
        continue;
      }

      // Compute overlap amount and shift the second label by the overlap in
      // the perpendicular direction of its own edge
      const overlapX = Math.min(ba.x + ba.w, bb.x + bb.w) - Math.max(ba.x, bb.x);
      const overlapY = Math.min(ba.y + ba.h, bb.y + bb.h) - Math.max(ba.y, bb.y);

      // Shift in the direction of smaller overlap (minimum translation vector)
      if (overlapX <= overlapY) {
        // Shift horizontally: push b to the right of a
        const sign = bb.x >= ba.x ? 1 : -1;
        b.labelX += sign * overlapX;
      } else {
        // Shift vertically: push b below a
        const sign = bb.y >= ba.y ? 1 : -1;
        b.labelY += sign * overlapY;
      }
    }
  }
}

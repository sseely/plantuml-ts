export const NUMDIMS = 2;
export const NUMSIDES = 2 * NUMDIMS;

export interface Rect_t {
  boundary: [number, number, number, number];
}

export function InitRect(r: Rect_t): void {
  r.boundary[0] = 0;
  r.boundary[1] = 0;
  r.boundary[2] = 0;
  r.boundary[3] = 0;
}

export function NullRect(): Rect_t {
  return { boundary: [1, 0, -1, 0] };
}

function Undefined(r: Rect_t): boolean {
  return r.boundary[0] > r.boundary[2];
}

export function RectArea(r: Rect_t): number {
  if (Undefined(r)) return 0;
  const dimX = r.boundary[2] - r.boundary[0];
  const dimY = r.boundary[3] - r.boundary[1];
  if (dimX === 0 || dimY === 0) return 0;
  return dimX * dimY;
}

export function CombineRect(r: Rect_t, rr: Rect_t): Rect_t {
  if (Undefined(r)) return { boundary: [rr.boundary[0], rr.boundary[1], rr.boundary[2], rr.boundary[3]] };
  if (Undefined(rr)) return { boundary: [r.boundary[0], r.boundary[1], r.boundary[2], r.boundary[3]] };
  return {
    boundary: [
      Math.min(r.boundary[0], rr.boundary[0]),
      Math.min(r.boundary[1], rr.boundary[1]),
      Math.max(r.boundary[2], rr.boundary[2]),
      Math.max(r.boundary[3], rr.boundary[3]),
    ],
  };
}

export function Overlap(r: Rect_t, s: Rect_t): boolean {
  if (r.boundary[0] > s.boundary[2] || s.boundary[0] > r.boundary[2]) return false;
  if (r.boundary[1] > s.boundary[3] || s.boundary[1] > r.boundary[3]) return false;
  return true;
}

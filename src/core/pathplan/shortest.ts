import type { Ppoint, Ppoly, Ppolyline } from './util.js';

const ISCCW = 1;
const ISCW = 2;
const ISON = 3;

const DQ_FRONT = 1;
const DQ_BACK = 2;

// ccw: returns ISCCW(1), ISCW(2), or ISON(3)
function ccw(p1: Ppoint, p2: Ppoint, p3: Ppoint): number {
  const d = (p1.y - p2.y) * (p3.x - p2.x) - (p3.y - p2.y) * (p1.x - p2.x);
  return d > 0 ? ISCW : d < 0 ? ISCCW : ISON;
}

// between: is pc between pa and pb (collinear check)?
function between(pa: Ppoint, pb: Ppoint, pc: Ppoint): boolean {
  const p1x = pb.x - pa.x;
  const p1y = pb.y - pa.y;
  const p2x = pc.x - pa.x;
  const p2y = pc.y - pa.y;
  if (ccw(pa, pb, pc) !== ISON) return false;
  return (
    p2x * p1x + p2y * p1y >= 0 &&
    p2x * p2x + p2y * p2y <= p1x * p1x + p1y * p1y
  );
}

function intersects(pa: Ppoint, pb: Ppoint, pc: Ppoint, pd: Ppoint): boolean {
  if (
    ccw(pa, pb, pc) === ISON ||
    ccw(pa, pb, pd) === ISON ||
    ccw(pc, pd, pa) === ISON ||
    ccw(pc, pd, pb) === ISON
  ) {
    if (
      between(pa, pb, pc) ||
      between(pa, pb, pd) ||
      between(pc, pd, pa) ||
      between(pc, pd, pb)
    )
      return true;
  } else {
    const ccw1 = ccw(pa, pb, pc) === ISCCW ? 1 : 0;
    const ccw2 = ccw(pa, pb, pd) === ISCCW ? 1 : 0;
    const ccw3 = ccw(pc, pd, pa) === ISCCW ? 1 : 0;
    const ccw4 = ccw(pc, pd, pb) === ISCCW ? 1 : 0;
    return (ccw1 ^ ccw2) !== 0 && (ccw3 ^ ccw4) !== 0;
  }
  return false;
}

function isdiagonal(
  pnli: number,
  pnlip2: number,
  pnlps: Ppoint[],
  pnln: number
): boolean {
  const pnlip1 = (pnli + 1) % pnln;
  const pnlim1 = (pnli + pnln - 1) % pnln;
  let res: boolean;

  if (
    ccw(pnlps[pnlim1]!, pnlps[pnli]!, pnlps[pnlip1]!) === ISCCW
  ) {
    res =
      ccw(pnlps[pnli]!, pnlps[pnlip2]!, pnlps[pnlim1]!) === ISCCW &&
      ccw(pnlps[pnlip2]!, pnlps[pnli]!, pnlps[pnlip1]!) === ISCCW;
  } else {
    res = ccw(pnlps[pnli]!, pnlps[pnlip2]!, pnlps[pnlip1]!) === ISCW;
  }
  if (!res) return false;

  for (let pnlj = 0; pnlj < pnln; pnlj++) {
    const pnljp1 = (pnlj + 1) % pnln;
    if (
      !(
        pnlj === pnli ||
        pnljp1 === pnli ||
        pnlj === pnlip2 ||
        pnljp1 === pnlip2
      )
    ) {
      if (
        intersects(
          pnlps[pnli]!,
          pnlps[pnlip2]!,
          pnlps[pnlj]!,
          pnlps[pnljp1]!
        )
      )
        return false;
    }
  }
  return true;
}

interface Pointnlink {
  pp: Ppoint;
  link: Pointnlink | null;
}

interface Tedge {
  pnl0: Pointnlink;
  pnl1: Pointnlink;
  rightIndex: number; // -1 = SIZE_MAX equivalent
}

interface Triangle {
  mark: number;
  e: [Tedge, Tedge, Tedge];
}

function makeTedge(p0: Pointnlink, p1: Pointnlink): Tedge {
  return { pnl0: p0, pnl1: p1, rightIndex: -1 };
}

function makeTriangle(
  pnla: Pointnlink,
  pnlb: Pointnlink,
  pnlc: Pointnlink
): Triangle {
  return {
    mark: 0,
    e: [makeTedge(pnla, pnlb), makeTedge(pnlb, pnlc), makeTedge(pnlc, pnla)],
  };
}

function triangulate(points: Pointnlink[], pointCount: number, tris: Triangle[]): boolean {
  if (pointCount > 3) {
    for (let pnli = 0; pnli < pointCount; pnli++) {
      const pnlip1 = (pnli + 1) % pointCount;
      const pnlip2 = (pnli + 2) % pointCount;
      const pts = points.map((p) => p.pp);
      if (isdiagonal(pnli, pnlip2, pts, pointCount)) {
        tris.push(
          makeTriangle(points[pnli]!, points[pnlip1]!, points[pnlip2]!)
        );
        // remove points[pnlip1]
        for (let k = pnlip1; k < pointCount - 1; k++) {
          points[k] = points[k + 1]!;
        }
        return triangulate(points, pointCount - 1, tris);
      }
    }
    return false;
  } else {
    tris.push(makeTriangle(points[0]!, points[1]!, points[2]!));
    return true;
  }
}

function connectTris(tris: Triangle[], tri1: number, tri2: number): void {
  for (let ei = 0; ei < 3; ei++) {
    for (let ej = 0; ej < 3; ej++) {
      const e1 = tris[tri1]!.e[ei as 0 | 1 | 2];
      const e2 = tris[tri2]!.e[ej as 0 | 1 | 2];
      if (
        (e1.pnl0.pp === e2.pnl0.pp && e1.pnl1.pp === e2.pnl1.pp) ||
        (e1.pnl0.pp === e2.pnl1.pp && e1.pnl1.pp === e2.pnl0.pp)
      ) {
        tris[tri1]!.e[ei as 0 | 1 | 2].rightIndex = tri2;
        tris[tri2]!.e[ej as 0 | 1 | 2].rightIndex = tri1;
      }
    }
  }
}

function marktripath(tris: Triangle[], trii: number, trij: number): boolean {
  if (tris[trii]!.mark !== 0) return false;
  tris[trii]!.mark = 1;
  if (trii === trij) return true;
  for (let ei = 0; ei < 3; ei++) {
    const ri = tris[trii]!.e[ei as 0 | 1 | 2].rightIndex;
    if (ri !== -1 && marktripath(tris, ri, trij)) return true;
  }
  tris[trii]!.mark = 0;
  return false;
}

function pointintri(tris: Triangle[], trii: number, pp: Ppoint): boolean {
  let sum = 0;
  for (let ei = 0; ei < 3; ei++) {
    const e = tris[trii]!.e[ei as 0 | 1 | 2];
    if (ccw(e.pnl0.pp, e.pnl1.pp, pp) !== ISCW) sum++;
  }
  return sum === 3 || sum === 0;
}

interface Deque {
  pnlps: Pointnlink[];
  pnlpn: number;
  fpnlpi: number;
  lpnlpi: number;
  apex: number;
}

function add2dq(dq: Deque, side: number, pnlp: Pointnlink): void {
  if (side === DQ_FRONT) {
    if (dq.lpnlpi >= dq.fpnlpi) pnlp.link = dq.pnlps[dq.fpnlpi] ?? null;
    dq.fpnlpi--;
    dq.pnlps[dq.fpnlpi] = pnlp;
  } else {
    if (dq.lpnlpi >= dq.fpnlpi) pnlp.link = dq.pnlps[dq.lpnlpi] ?? null;
    dq.lpnlpi++;
    dq.pnlps[dq.lpnlpi] = pnlp;
  }
}

function splitdq(dq: Deque, side: number, index: number): void {
  if (side === DQ_FRONT) dq.lpnlpi = index;
  else dq.fpnlpi = index;
}

function finddqsplit(dq: Deque, pnlp: Pointnlink): number {
  for (let index = dq.fpnlpi; index < dq.apex; index++) {
    if (
      ccw(
        dq.pnlps[index + 1]!.pp,
        dq.pnlps[index]!.pp,
        pnlp.pp
      ) === ISCCW
    )
      return index;
  }
  for (let index = dq.lpnlpi; index > dq.apex; index--) {
    if (
      ccw(
        dq.pnlps[index - 1]!.pp,
        dq.pnlps[index]!.pp,
        pnlp.pp
      ) === ISCW
    )
      return index;
  }
  return dq.apex;
}

// Pshortestpath:
// Find a shortest path contained in the polygon polyp going between the
// points supplied in eps. The resulting polyline is stored in output.
// Returns 0 on success, -1 on bad input, -2 on memory allocation problem.
export function Pshortestpath(
  polyp: Ppoly,
  eps: [Ppoint, Ppoint],
  output: Ppolyline
): number {
  // Find leftmost vertex to determine polygon orientation
  let minx = Infinity;
  let minpi = 0;
  for (let pi = 0; pi < polyp.pn; pi++) {
    if (minx > polyp.ps[pi]!.x) {
      minx = polyp.ps[pi]!.x;
      minpi = pi;
    }
  }
  const p2 = polyp.ps[minpi]!;
  const p1 = polyp.ps[minpi === 0 ? polyp.pn - 1 : minpi - 1]!;
  const p3 = polyp.ps[(minpi + 1) % polyp.pn]!;

  // Build pointnlink array, deduplicating consecutive equal points, oriented CCW
  const pnls: Pointnlink[] = [];
  if (
    (p1.x === p2.x && p2.x === p3.x && p3.y > p2.y) ||
    ccw(p1, p2, p3) !== ISCCW
  ) {
    for (let pi = polyp.pn - 1; pi >= 0; pi--) {
      if (
        pi < polyp.pn - 1 &&
        polyp.ps[pi]!.x === polyp.ps[pi + 1]!.x &&
        polyp.ps[pi]!.y === polyp.ps[pi + 1]!.y
      )
        continue;
      pnls.push({ pp: polyp.ps[pi]!, link: null });
    }
  } else {
    for (let pi = 0; pi < polyp.pn; pi++) {
      if (
        pi > 0 &&
        polyp.ps[pi]!.x === polyp.ps[pi - 1]!.x &&
        polyp.ps[pi]!.y === polyp.ps[pi - 1]!.y
      )
        continue;
      pnls.push({ pp: polyp.ps[pi]!, link: null });
    }
  }

  // link[] is set as circular; only used by triangulate isdiagonal
  for (let i = 0; i < pnls.length; i++) {
    pnls[i]!.link = pnls[i % polyp.pn] ?? null;
  }

  const pnll = pnls.length;
  const tris: Triangle[] = [];

  const workPnls = pnls.slice();
  if (!triangulate(workPnls, pnll, tris)) {
    return -2;
  }

  // Connect pairs of triangles that share an edge
  for (let trii = 0; trii < tris.length; trii++) {
    for (let trij = trii + 1; trij < tris.length; trij++) {
      connectTris(tris, trii, trij);
    }
  }

  // Find first and last triangles containing eps[0] and eps[1]
  let ftrii = -1;
  for (let trii = 0; trii < tris.length; trii++) {
    if (pointintri(tris, trii, eps[0])) {
      ftrii = trii;
      break;
    }
  }
  if (ftrii === -1) return -1;

  let ltrii = -1;
  for (let trii = 0; trii < tris.length; trii++) {
    if (pointintri(tris, trii, eps[1])) {
      ltrii = trii;
      break;
    }
  }
  if (ltrii === -1) return -1;

  // Mark triangle path from ftrii to ltrii
  if (!marktripath(tris, ftrii, ltrii)) {
    // Fallback: straight line
    output.pn = 2;
    output.ps = [{ ...eps[0] }, { ...eps[1] }];
    return 0;
  }

  // If same triangle, direct line
  if (ftrii === ltrii) {
    output.pn = 2;
    output.ps = [{ ...eps[0] }, { ...eps[1] }];
    return 0;
  }

  // Build deque for funnel shortest path
  const dqSize = pnll * 2;
  const dq: Deque = {
    pnlps: new Array<Pointnlink>(dqSize),
    pnlpn: dqSize,
    fpnlpi: Math.floor(dqSize / 2),
    lpnlpi: Math.floor(dqSize / 2) - 1,
    apex: 0,
  };

  const epnls: [Pointnlink, Pointnlink] = [
    { pp: eps[0], link: null },
    { pp: eps[1], link: null },
  ];

  add2dq(dq, DQ_FRONT, epnls[0]);
  dq.apex = dq.fpnlpi;

  let trii = ftrii;
  while (trii !== -1) {
    const trip = tris[trii]!;
    trip.mark = 2;

    // Find the exiting edge (neighbour with mark === 1)
    let ei = 0;
    for (ei = 0; ei < 3; ei++) {
      const ri = trip.e[ei as 0 | 1 | 2].rightIndex;
      if (ri !== -1 && tris[ri]!.mark === 1) break;
    }

    let lpnlp: Pointnlink;
    let rpnlp: Pointnlink;

    if (ei === 3) {
      // In last triangle
      if (
        ccw(eps[1], dq.pnlps[dq.fpnlpi]!.pp, dq.pnlps[dq.lpnlpi]!.pp) ===
        ISCCW
      ) {
        lpnlp = dq.pnlps[dq.lpnlpi]!;
        rpnlp = epnls[1];
      } else {
        lpnlp = epnls[1];
        rpnlp = dq.pnlps[dq.lpnlpi]!;
      }
    } else {
      const e = trip.e[ei as 0 | 1 | 2];
      const pnlp = trip.e[((ei + 1) % 3) as 0 | 1 | 2].pnl1;
      if (ccw(e.pnl0.pp, pnlp.pp, e.pnl1.pp) === ISCCW) {
        lpnlp = e.pnl1;
        rpnlp = e.pnl0;
      } else {
        lpnlp = e.pnl0;
        rpnlp = e.pnl1;
      }
    }

    // Update deque
    if (trii === ftrii) {
      add2dq(dq, DQ_BACK, lpnlp);
      add2dq(dq, DQ_FRONT, rpnlp);
    } else {
      if (dq.pnlps[dq.fpnlpi] !== rpnlp && dq.pnlps[dq.lpnlpi] !== rpnlp) {
        const splitindex = finddqsplit(dq, rpnlp);
        splitdq(dq, DQ_BACK, splitindex);
        add2dq(dq, DQ_FRONT, rpnlp);
        if (splitindex > dq.apex) dq.apex = splitindex;
      } else {
        const splitindex = finddqsplit(dq, lpnlp);
        splitdq(dq, DQ_FRONT, splitindex);
        add2dq(dq, DQ_BACK, lpnlp);
        if (splitindex < dq.apex) dq.apex = splitindex;
      }
    }

    // Advance to next marked triangle
    trii = -1;
    for (let ej = 0; ej < 3; ej++) {
      const ri = trip.e[ej as 0 | 1 | 2].rightIndex;
      if (ri !== -1 && tris[ri]!.mark === 1) {
        trii = ri;
        break;
      }
    }
  }

  // Count path length following the link chain from epnls[1]
  let i = 0;
  let pnlp: Pointnlink | null = epnls[1];
  while (pnlp !== null) {
    i++;
    pnlp = pnlp.link;
  }

  const ops: Ppoint[] = new Array<Ppoint>(i);
  let idx = i - 1;
  pnlp = epnls[1];
  while (pnlp !== null) {
    ops[idx--] = { ...pnlp.pp };
    pnlp = pnlp.link;
  }

  output.pn = i;
  output.ps = ops;
  return 0;
}

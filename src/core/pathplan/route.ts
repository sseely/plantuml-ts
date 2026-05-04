import type { Ppoint, Ppolyline, Pedge_t } from './util.js';
import { solve3 } from './solvers.js';

const EPSILON1 = 1e-3;
const EPSILON2 = 1e-6;

interface Tna {
  t: number;
  a: [Ppoint, Ppoint];
}

// Output point buffer — mutable module-level state matching C's static globals
let ops: Ppoint[] = [];
let opl = 0;

function growops(newopn: number): boolean {
  while (ops.length < newopn) ops.push({ x: 0, y: 0 });
  return true;
}

function pAdd(p1: Ppoint, p2: Ppoint): Ppoint {
  return { x: p1.x + p2.x, y: p1.y + p2.y };
}

function pSub(p1: Ppoint, p2: Ppoint): Ppoint {
  return { x: p1.x - p2.x, y: p1.y - p2.y };
}

function pDist(p1: Ppoint, p2: Ppoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.hypot(dx, dy);
}

function pScale(p: Ppoint, c: number): Ppoint {
  return { x: p.x * c, y: p.y * c };
}

function pDot(p1: Ppoint, p2: Ppoint): number {
  return p1.x * p2.x + p1.y * p2.y;
}

function normv(v: Ppoint): Ppoint {
  const d = v.x * v.x + v.y * v.y;
  if (d > 1e-6) {
    const s = Math.sqrt(d);
    return { x: v.x / s, y: v.y / s };
  }
  return { ...v };
}

function B0(t: number): number {
  const tmp = 1.0 - t;
  return tmp * tmp * tmp;
}

function B1(t: number): number {
  const tmp = 1.0 - t;
  return 3 * t * tmp * tmp;
}

function B2(t: number): number {
  const tmp = 1.0 - t;
  return 3 * t * t * tmp;
}

function B3(t: number): number {
  return t * t * t;
}

function B01(t: number): number {
  const tmp = 1.0 - t;
  return tmp * tmp * (tmp + 3 * t);
}

function B23(t: number): number {
  const tmp = 1.0 - t;
  return t * t * (3 * tmp + t);
}

function dist_n(p: Ppoint[], n: number): number {
  let rv = 0.0;
  for (let i = 1; i < n; i++) {
    rv += Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.y - p[i - 1]!.y);
  }
  return rv;
}

function points2coeff(
  v0: number,
  v1: number,
  v2: number,
  v3: number,
  coeff: number[]
): void {
  coeff[3] = v3 + 3 * v1 - (v0 + 3 * v2);
  coeff[2] = 3 * v0 + 3 * v2 - 6 * v1;
  coeff[1] = 3 * (v1 - v0);
  coeff[0] = v0;
}

function addroot(root: number, roots: number[], rootnp: { n: number }): void {
  if (root >= 0 && root <= 1) {
    roots[rootnp.n++] = root;
  }
}

function splineintersectsline(
  sps: Ppoint[],
  lps: Ppoint[],
  roots: number[]
): number {
  const scoeff: [number, number, number, number] = [0, 0, 0, 0];
  const xcoeff: [number, number] = [lps[0]!.x, lps[1]!.x - lps[0]!.x];
  const ycoeff: [number, number] = [lps[0]!.y, lps[1]!.y - lps[0]!.y];
  const xroots = [0, 0, 0];
  const yroots = [0, 0, 0];
  const rootnRef = { n: 0 };

  if (xcoeff[1] === 0) {
    if (ycoeff[1] === 0) {
      points2coeff(sps[0]!.x, sps[1]!.x, sps[2]!.x, sps[3]!.x, scoeff);
      scoeff[0] -= xcoeff[0];
      const xrootn = solve3(scoeff, xroots);
      points2coeff(sps[0]!.y, sps[1]!.y, sps[2]!.y, sps[3]!.y, scoeff);
      scoeff[0] -= ycoeff[0];
      const yrootn = solve3(scoeff, yroots);
      if (xrootn === 4) {
        if (yrootn === 4) return 4;
        for (let j = 0; j < yrootn; j++) addroot(yroots[j]!, roots, rootnRef);
      } else if (yrootn === 4) {
        for (let i = 0; i < xrootn; i++) addroot(xroots[i]!, roots, rootnRef);
      } else {
        for (let i = 0; i < xrootn; i++) {
          for (let j = 0; j < yrootn; j++) {
            if (xroots[i] === yroots[j]) addroot(xroots[i]!, roots, rootnRef);
          }
        }
      }
      return rootnRef.n;
    } else {
      points2coeff(sps[0]!.x, sps[1]!.x, sps[2]!.x, sps[3]!.x, scoeff);
      scoeff[0] -= xcoeff[0];
      const xrootn = solve3(scoeff, xroots);
      if (xrootn === 4) return 4;
      for (let i = 0; i < xrootn; i++) {
        const tv = xroots[i]!;
        if (tv >= 0 && tv <= 1) {
          points2coeff(sps[0]!.y, sps[1]!.y, sps[2]!.y, sps[3]!.y, scoeff);
          let sv =
            scoeff[0] +
            tv * (scoeff[1] + tv * (scoeff[2] + tv * scoeff[3]));
          sv = (sv - ycoeff[0]) / ycoeff[1];
          if (sv >= 0 && sv <= 1) addroot(tv, roots, rootnRef);
        }
      }
      return rootnRef.n;
    }
  } else {
    const rat = ycoeff[1] / xcoeff[1];
    points2coeff(
      sps[0]!.y - rat * sps[0]!.x,
      sps[1]!.y - rat * sps[1]!.x,
      sps[2]!.y - rat * sps[2]!.x,
      sps[3]!.y - rat * sps[3]!.x,
      scoeff
    );
    scoeff[0] += rat * xcoeff[0] - ycoeff[0];
    const xrootn = solve3(scoeff, xroots);
    if (xrootn === 4) return 4;
    for (let i = 0; i < xrootn; i++) {
      const tv = xroots[i]!;
      if (tv >= 0 && tv <= 1) {
        points2coeff(sps[0]!.x, sps[1]!.x, sps[2]!.x, sps[3]!.x, scoeff);
        let sv =
          scoeff[0] +
          tv * (scoeff[1] + tv * (scoeff[2] + tv * scoeff[3]));
        sv = (sv - xcoeff[0]) / xcoeff[1];
        if (sv >= 0 && sv <= 1) addroot(tv, roots, rootnRef);
      }
    }
    return rootnRef.n;
  }
}

function DISTSQ(a: Ppoint, b: Ppoint): number {
  return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
}

function splineisinside(
  edges: Pedge_t[],
  edgen: number,
  sps: Ppoint[]
): boolean {
  const roots = [0, 0, 0, 0];
  const lps: [Ppoint, Ppoint] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];

  for (let ei = 0; ei < edgen; ei++) {
    lps[0] = edges[ei]!.a;
    lps[1] = edges[ei]!.b;
    const rootn = splineintersectsline(sps, lps, roots);
    if (rootn === 4) continue;
    for (let rooti = 0; rooti < rootn; rooti++) {
      const r = roots[rooti]!;
      if (r < EPSILON2 || r > 1 - EPSILON2) continue;
      const t = r;
      const td = t * t * t;
      const tc = 3 * t * t * (1 - t);
      const tb = 3 * t * (1 - t) * (1 - t);
      const ta = (1 - t) * (1 - t) * (1 - t);
      const ip: Ppoint = {
        x:
          ta * sps[0]!.x +
          tb * sps[1]!.x +
          tc * sps[2]!.x +
          td * sps[3]!.x,
        y:
          ta * sps[0]!.y +
          tb * sps[1]!.y +
          tc * sps[2]!.y +
          td * sps[3]!.y,
      };
      if (DISTSQ(ip, lps[0]) < EPSILON1 || DISTSQ(ip, lps[1]) < EPSILON1)
        continue;
      return false;
    }
  }
  return true;
}

function splinefits(
  edges: Pedge_t[],
  edgen: number,
  pa: Ppoint,
  va: Ppoint,
  pb: Ppoint,
  vb: Ppoint,
  inps: Ppoint[],
  inpn: number
): number {
  const sps: [Ppoint, Ppoint, Ppoint, Ppoint] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  const forceflag = inpn === 2 ? 1 : 0;
  let first = 1;

  let a = 4;
  for (;;) {
    sps[0] = { x: pa.x, y: pa.y };
    sps[1] = { x: pa.x + (a * va.x) / 3.0, y: pa.y + (a * va.y) / 3.0 };
    sps[2] = { x: pb.x - (a * vb.x) / 3.0, y: pb.y - (a * vb.y) / 3.0 };
    sps[3] = { x: pb.x, y: pb.y };

    if (first !== 0 && dist_n(sps, 4) < dist_n(inps, inpn) - EPSILON1)
      return 0;
    first = 0;

    if (splineisinside(edges, edgen, sps)) {
      if (!growops(opl + 4)) return -1;
      for (let pi = 1; pi < 4; pi++) {
        ops[opl] = { x: sps[pi]!.x, y: sps[pi]!.y };
        opl++;
      }
      return 1;
    }
    if (a < 0.005) {
      if (forceflag !== 0) {
        if (!growops(opl + 4)) return -1;
        for (let pi = 1; pi < 4; pi++) {
          ops[opl] = { x: sps[pi]!.x, y: sps[pi]!.y };
          opl++;
        }
        return 1;
      }
      break;
    }
    if (a > 0.01) a /= 2;
    else a = 0;
  }
  return 0;
}

function mkspline(
  inps: Ppoint[],
  inpn: number,
  tnas: Tna[],
  ev0: Ppoint,
  ev1: Ppoint,
  sp0Out: { p: Ppoint; v: Ppoint },
  sp1Out: { p: Ppoint; v: Ppoint }
): number {
  const c: [[number, number], [number, number]] = [
    [0, 0],
    [0, 0],
  ];
  const x: [number, number] = [0, 0];
  let scale0 = 0;
  let scale3 = 0;

  for (let i = 0; i < inpn; i++) {
    c[0][0] += pDot(tnas[i]!.a[0], tnas[i]!.a[0]);
    c[0][1] += pDot(tnas[i]!.a[0], tnas[i]!.a[1]);
    c[1][0] = c[0][1]!;
    c[1][1] += pDot(tnas[i]!.a[1], tnas[i]!.a[1]);
    const tmp = pSub(
      inps[i]!,
      pAdd(
        pScale(inps[0]!, B01(tnas[i]!.t)),
        pScale(inps[inpn - 1]!, B23(tnas[i]!.t))
      )
    );
    x[0] += pDot(tnas[i]!.a[0], tmp);
    x[1] += pDot(tnas[i]!.a[1], tmp);
  }

  const det01 = c[0][0] * c[1][1] - c[1][0] * c[0][1];
  const det0X = c[0][0] * x[1] - c[0][1] * x[0];
  const detX1 = x[0] * c[1][1] - x[1] * c[0][1];

  if (Math.abs(det01) >= 1e-6) {
    scale0 = detX1 / det01;
    scale3 = det0X / det01;
  }
  if (Math.abs(det01) < 1e-6 || scale0 <= 0.0 || scale3 <= 0.0) {
    const d01 = pDist(inps[0]!, inps[inpn - 1]!) / 3.0;
    scale0 = d01;
    scale3 = d01;
  }

  sp0Out.p = { ...inps[0]! };
  sp0Out.v = pScale(ev0, scale0);
  sp1Out.p = { ...inps[inpn - 1]! };
  sp1Out.v = pScale(ev1, scale3);
  return 0;
}

function reallyroutespline(
  edges: Pedge_t[],
  edgen: number,
  inps: Ppoint[],
  inpsOffset: number,
  inpn: number,
  ev0: Ppoint,
  ev1: Ppoint
): number {
  const tnas: Tna[] = new Array<Tna>(inpn);
  tnas[0] = { t: 0, a: [{ x: 0, y: 0 }, { x: 0, y: 0 }] };
  for (let i = 1; i < inpn; i++) {
    tnas[i] = {
      t:
        (tnas[i - 1]!.t ?? 0) +
        pDist(inps[inpsOffset + i]!, inps[inpsOffset + i - 1]!),
      a: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    };
  }
  const total = tnas[inpn - 1]!.t;
  for (let i = 1; i < inpn; i++) {
    tnas[i]!.t /= total;
  }
  for (let i = 0; i < inpn; i++) {
    tnas[i]!.a[0] = pScale(ev0, B1(tnas[i]!.t));
    tnas[i]!.a[1] = pScale(ev1, B2(tnas[i]!.t));
  }

  const sp0Out = { p: { x: 0, y: 0 }, v: { x: 0, y: 0 } };
  const sp1Out = { p: { x: 0, y: 0 }, v: { x: 0, y: 0 } };
  const slicedInps = inps.slice(inpsOffset, inpsOffset + inpn);

  if (mkspline(slicedInps, inpn, tnas, ev0, ev1, sp0Out, sp1Out) === -1)
    return -1;

  const fit = splinefits(
    edges,
    edgen,
    sp0Out.p,
    sp0Out.v,
    sp1Out.p,
    sp1Out.v,
    slicedInps,
    inpn
  );
  if (fit > 0) return 0;
  if (fit < 0) return -1;

  const cp1 = pAdd(sp0Out.p, pScale(sp0Out.v, 1 / 3.0));
  const cp2 = pSub(sp1Out.p, pScale(sp1Out.v, 1 / 3.0));
  let maxi = -1;
  let maxd = -1;
  for (let i = 1; i < inpn - 1; i++) {
    const t = tnas[i]!.t;
    const p: Ppoint = {
      x:
        B0(t) * sp0Out.p.x +
        B1(t) * cp1.x +
        B2(t) * cp2.x +
        B3(t) * sp1Out.p.x,
      y:
        B0(t) * sp0Out.p.y +
        B1(t) * cp1.y +
        B2(t) * cp2.y +
        B3(t) * sp1Out.p.y,
    };
    const d = pDist(p, slicedInps[i]!);
    if (d > maxd) {
      maxd = d;
      maxi = i;
    }
  }

  const spliti = maxi;
  const splitv1 = normv(pSub(slicedInps[spliti]!, slicedInps[spliti - 1]!));
  const splitv2 = normv(pSub(slicedInps[spliti + 1]!, slicedInps[spliti]!));
  const splitv = normv(pAdd(splitv1, splitv2));

  if (
    reallyroutespline(
      edges,
      edgen,
      slicedInps,
      0,
      spliti + 1,
      ev0,
      splitv
    ) < 0
  )
    return -1;
  if (
    reallyroutespline(
      edges,
      edgen,
      slicedInps,
      spliti,
      inpn - spliti,
      splitv,
      ev1
    ) < 0
  )
    return -1;
  return 0;
}

// Proutespline:
// Given barrier line segments edges as obstacles, a template path input_route,
// and endpoint slope vectors, construct a bezier spline and return in output_route.
// Returns 0 on success, -1 on failure.
export function Proutespline(
  barriers: Pedge_t[],
  n_barriers: number,
  input_route: Ppolyline,
  endpoint_slopes: [Ppoint, Ppoint],
  output_route: Ppolyline
): number {
  const inps = input_route.ps;
  const inpn = input_route.pn;

  const ev0 = normv(endpoint_slopes[0]);
  const ev1 = normv(endpoint_slopes[1]);

  opl = 0;
  ops = [];
  if (!growops(4)) return -1;

  ops[opl++] = { ...inps[0]! };

  if (
    reallyroutespline(barriers, n_barriers, inps, 0, inpn, ev0, ev1) === -1
  )
    return -1;

  output_route.pn = opl;
  output_route.ps = ops.slice(0, opl);
  return 0;
}

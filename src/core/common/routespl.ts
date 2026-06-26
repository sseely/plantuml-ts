type Point = { x: number; y: number };

const EPSILON1 = 1e-3;
const EPSILON2 = 1e-6;

function ptAdd(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function ptSub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function ptScale(p: Point, c: number): Point {
  return { x: p.x * c, y: p.y * c };
}

function ptDot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function ptDist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function ptDistSq(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function normv(v: Point): Point {
  const d = v.x * v.x + v.y * v.y;
  if (d > 1e-6) {
    const len = Math.sqrt(d);
    return { x: v.x / len, y: v.y / len };
  }
  return v;
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

function polylineLengthArr(pts: readonly Point[]): number {
  let rv = 0;
  for (let i = 1; i < pts.length; i++) {
    rv += ptDist(pts[i]!, pts[i - 1]!);
  }
  return rv;
}

type TNA = { t: number; a: [Point, Point] };

function mkspline(
  inps: Point[],
  tnas: TNA[],
  ev0: Point,
  ev1: Point,
): { p0: Point; v0: Point; p1: Point; v1: Point } {
  const inpn = inps.length;
  let scale0 = 0;
  let scale3 = 0;
  const c: [[number, number], [number, number]] = [
    [0, 0],
    [0, 0],
  ];
  const x: [number, number] = [0, 0];

  for (let i = 0; i < inpn; i++) {
    const a0 = tnas[i]!.a[0];
    const a1 = tnas[i]!.a[1];
    c[0][0] += ptDot(a0, a0);
    c[0][1] += ptDot(a0, a1);
    c[1][0] = c[0][1];
    c[1][1] += ptDot(a1, a1);
    const tmp = ptSub(
      inps[i]!,
      ptAdd(
        ptScale(inps[0]!, B01(tnas[i]!.t)),
        ptScale(inps[inpn - 1]!, B23(tnas[i]!.t)),
      ),
    );
    x[0] += ptDot(a0, tmp);
    x[1] += ptDot(a1, tmp);
  }

  const det01 = c[0][0] * c[1][1] - c[1][0] * c[0][1];
  const det0X = c[0][0] * x[1] - c[0][1] * x[0];
  const detX1 = x[0] * c[1][1] - x[1] * c[0][1];

  if (Math.abs(det01) >= 1e-6) {
    scale0 = detX1 / det01;
    scale3 = det0X / det01;
  }
  if (Math.abs(det01) < 1e-6 || scale0 <= 0 || scale3 <= 0) {
    const d01 = ptDist(inps[0]!, inps[inpn - 1]!) / 3;
    scale0 = d01;
    scale3 = d01;
  }

  return {
    p0: inps[0]!,
    v0: ptScale(ev0, scale0),
    p1: inps[inpn - 1]!,
    v1: ptScale(ev1, scale3),
  };
}

function points2coeff(
  v0: number,
  v1: number,
  v2: number,
  v3: number,
): [number, number, number, number] {
  return [v0, 3 * (v1 - v0), 3 * v0 + 3 * v2 - 6 * v1, v3 + 3 * v1 - (v0 + 3 * v2)];
}

function addroot(root: number, roots: number[]): void {
  if (root >= 0 && root <= 1) roots.push(root);
}

function solve3(coeff: [number, number, number, number], roots: number[]): number {
  const coeff0 = coeff[0];
  const coeff1 = coeff[1];
  const coeff2 = coeff[2];
  const coeff3 = coeff[3];
  if (Math.abs(coeff3) < 1e-12) {
    const qa = coeff2;
    const qb = coeff1;
    const qc = coeff0;
    if (Math.abs(qa) < 1e-12) {
      if (Math.abs(qb) > 1e-12) addroot(-qc / qb, roots);
    } else {
      const disc = qb * qb - 4 * qa * qc;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        addroot((-qb + sq) / (2 * qa), roots);
        addroot((-qb - sq) / (2 * qa), roots);
      }
    }
    return roots.length;
  }
  const f = (3 * coeff2 * coeff3 - coeff1 * coeff1) / (3 * coeff3 * coeff3);
  const g =
    (2 * coeff1 * coeff1 * coeff1 -
      9 * coeff2 * coeff1 * coeff3 +
      27 * coeff3 * coeff3 * coeff0) /
    (27 * coeff3 * coeff3 * coeff3);
  const h = (g * g) / 4 + (f * f * f) / 27;
  if (h > 0) {
    const sqrtH = Math.sqrt(h);
    const rr = -g / 2 + sqrtH;
    const s = rr >= 0 ? Math.pow(rr, 1 / 3) : -Math.pow(-rr, 1 / 3);
    const t2 = -g / 2 - sqrtH;
    const u = t2 >= 0 ? Math.pow(t2, 1 / 3) : -Math.pow(-t2, 1 / 3);
    addroot(s + u - coeff1 / (3 * coeff3), roots);
  } else if (Math.abs(h) < 1e-12) {
    const cubeRoot = g >= 0 ? -Math.pow(g / 2, 1 / 3) : Math.pow(-g / 2, 1 / 3);
    addroot(2 * cubeRoot - coeff1 / (3 * coeff3), roots);
    addroot(-cubeRoot - coeff1 / (3 * coeff3), roots);
  } else {
    const iVal = Math.sqrt((g * g) / 4 - h);
    const j = Math.pow(iVal, 1 / 3);
    const k = Math.acos(-g / (2 * iVal));
    const m = Math.cos(k / 3);
    const nv = Math.sqrt(3) * Math.sin(k / 3);
    const pp = -coeff1 / (3 * coeff3);
    addroot(2 * j * m + pp, roots);
    addroot(-j * (m + nv) + pp, roots);
    addroot(-j * (m - nv) + pp, roots);
  }
  return roots.length;
}

function splineintersectslineCollect(
  sps: [Point, Point, Point, Point],
  lps: [Point, Point],
  out: number[],
): number {
  const xcoeff0 = lps[0].x;
  const xcoeff1 = lps[1].x - lps[0].x;
  const ycoeff0 = lps[0].y;
  const ycoeff1 = lps[1].y - lps[0].y;

  if (Math.abs(xcoeff1) < 1e-12) {
    if (Math.abs(ycoeff1) < 1e-12) {
      const xc = points2coeff(sps[0].x, sps[1].x, sps[2].x, sps[3].x);
      xc[0] -= xcoeff0;
      const yc = points2coeff(sps[0].y, sps[1].y, sps[2].y, sps[3].y);
      yc[0] -= ycoeff0;
      const xr: number[] = [];
      const yr: number[] = [];
      const xrn = solve3(xc, xr);
      const yrn = solve3(yc, yr);
      if (xrn === 4) {
        if (yrn === 4) return 4;
        for (const r of yr) addroot(r, out);
      } else if (yrn === 4) {
        for (const r of xr) addroot(r, out);
      } else {
        for (const r of xr) {
          if (yr.includes(r)) addroot(r, out);
        }
      }
      return out.length;
    } else {
      const xc = points2coeff(sps[0].x, sps[1].x, sps[2].x, sps[3].x);
      xc[0] -= xcoeff0;
      const xr: number[] = [];
      const xrn = solve3(xc, xr);
      if (xrn === 4) return 4;
      for (const tv of xr) {
        if (tv >= 0 && tv <= 1) {
          const yc = points2coeff(sps[0].y, sps[1].y, sps[2].y, sps[3].y);
          const sv =
            (yc[0] + tv * (yc[1] + tv * (yc[2] + tv * yc[3])) - ycoeff0) / ycoeff1;
          if (sv >= 0 && sv <= 1) addroot(tv, out);
        }
      }
      return out.length;
    }
  } else {
    const rat = ycoeff1 / xcoeff1;
    const mc = points2coeff(
      sps[0].y - rat * sps[0].x,
      sps[1].y - rat * sps[1].x,
      sps[2].y - rat * sps[2].x,
      sps[3].y - rat * sps[3].x,
    );
    mc[0] += rat * xcoeff0 - ycoeff0;
    const mr: number[] = [];
    const mrn = solve3(mc, mr);
    if (mrn === 4) return 4;
    for (const tv of mr) {
      if (tv >= 0 && tv <= 1) {
        const xc = points2coeff(sps[0].x, sps[1].x, sps[2].x, sps[3].x);
        const sv =
          (xc[0] + tv * (xc[1] + tv * (xc[2] + tv * xc[3])) - xcoeff0) / xcoeff1;
        if (sv >= 0 && sv <= 1) addroot(tv, out);
      }
    }
    return out.length;
  }
}

type Edge = { a: Point; b: Point };

function splineisinside(edges: Edge[], sps: [Point, Point, Point, Point]): boolean {
  for (const edge of edges) {
    const lps: [Point, Point] = [edge.a, edge.b];
    const roots: number[] = [];
    const rootn = splineintersectslineCollect(sps, lps, roots);
    if (rootn === 4) continue;
    for (const t of roots) {
      if (t < EPSILON2 || t > 1 - EPSILON2) continue;
      const td = t * t * t;
      const tc = 3 * t * t * (1 - t);
      const tb = 3 * t * (1 - t) * (1 - t);
      const ta = (1 - t) * (1 - t) * (1 - t);
      const ip: Point = {
        x: ta * sps[0].x + tb * sps[1].x + tc * sps[2].x + td * sps[3].x,
        y: ta * sps[0].y + tb * sps[1].y + tc * sps[2].y + td * sps[3].y,
      };
      if (ptDistSq(ip, lps[0]) < EPSILON1 || ptDistSq(ip, lps[1]) < EPSILON1) continue;
      return false;
    }
  }
  return true;
}

function splinefits(
  edges: Edge[],
  pa: Point,
  va: Point,
  pb: Point,
  vb: Point,
  inps: Point[],
  ops: Point[],
): boolean {
  const inpn = inps.length;
  const forceflag = inpn === 2;
  let first = true;
  let a = 4;

  for (;;) {
    const sps: [Point, Point, Point, Point] = [
      pa,
      { x: pa.x + (a * va.x) / 3, y: pa.y + (a * va.y) / 3 },
      { x: pb.x - (a * vb.x) / 3, y: pb.y - (a * vb.y) / 3 },
      pb,
    ];

    if (first && polylineLengthArr(sps) < polylineLengthArr(inps) - EPSILON1) {
      first = false;
      if (a > 0.01) a /= 2;
      else a = 0;
      continue;
    }
    first = false;

    if (splineisinside(edges, sps)) {
      ops.push(sps[1], sps[2], sps[3]);
      return true;
    }

    if (a < 0.005) {
      if (forceflag) {
        ops.push(sps[1], sps[2], sps[3]);
        return true;
      }
      break;
    }
    if (a > 0.01) a /= 2;
    else a = 0;
  }
  return false;
}

function reallyroutespline(
  edges: Edge[],
  inps: Point[],
  ev0: Point,
  ev1: Point,
  ops: Point[],
): void {
  const inpn = inps.length;
  const tnas: TNA[] = [];

  tnas.push({ t: 0, a: [ptScale(ev0, B1(0)), ptScale(ev1, B2(0))] });
  for (let i = 1; i < inpn; i++) {
    const prevT = tnas[i - 1]!.t;
    tnas.push({
      t: prevT + ptDist(inps[i]!, inps[i - 1]!),
      a: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    });
  }
  const totalLen = tnas[inpn - 1]!.t;
  if (totalLen > 0) {
    for (let i = 1; i < inpn; i++) {
      tnas[i]!.t /= totalLen;
    }
  }
  for (let i = 0; i < inpn; i++) {
    tnas[i]!.a[0] = ptScale(ev0, B1(tnas[i]!.t));
    tnas[i]!.a[1] = ptScale(ev1, B2(tnas[i]!.t));
  }

  const { p0, v0, p1, v1 } = mkspline(inps, tnas, ev0, ev1);

  const fit = splinefits(edges, p0, v0, p1, v1, inps, ops);
  if (fit) return;

  const cp1 = ptAdd(p0, ptScale(v0, 1 / 3));
  const cp2 = ptSub(p1, ptScale(v1, 1 / 3));

  let maxi = -1;
  let maxd = -1;
  for (let i = 1; i < inpn - 1; i++) {
    const t = tnas[i]!.t;
    const p: Point = {
      x: B0(t) * p0.x + B1(t) * cp1.x + B2(t) * cp2.x + B3(t) * p1.x,
      y: B0(t) * p0.y + B1(t) * cp1.y + B2(t) * cp2.y + B3(t) * p1.y,
    };
    const d = ptDist(p, inps[i]!);
    if (d > maxd) {
      maxd = d;
      maxi = i;
    }
  }

  const spliti = maxi < 0 ? Math.floor(inpn / 2) : maxi;
  const splitv1 = normv(ptSub(inps[spliti]!, inps[spliti - 1]!));
  const splitv2 = normv(ptSub(inps[spliti + 1]!, inps[spliti]!));
  const splitv = normv(ptAdd(splitv1, splitv2));

  reallyroutespline(edges, inps.slice(0, spliti + 1), ev0, splitv, ops);
  reallyroutespline(edges, inps.slice(spliti), splitv, ev1, ops);
}

export function makePolyline(line: Point[]): Point[] {
  if (line.length === 0) return [];
  if (line.length === 1) return [{ ...line[0]! }, { ...line[0]! }];

  const out: Point[] = [];
  out.push({ ...line[0]! });
  out.push({ ...line[0]! });
  for (let i = 1; i < line.length - 1; i++) {
    out.push({ ...line[i]! });
    out.push({ ...line[i]! });
    out.push({ ...line[i]! });
  }
  out.push({ ...line[line.length - 1]! });
  out.push({ ...line[line.length - 1]! });
  return out;
}

export function routesplines(
  points: Array<{ x: number; y: number }>,
  startTangent?: { x: number; y: number },
  endTangent?: { x: number; y: number },
): Array<{ x: number; y: number }> {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0]! }];

  const inps = points.map((p) => ({ x: p.x, y: p.y }));
  const ev0 = normv(startTangent ?? { x: 0, y: 0 });
  const ev1 = normv(endTangent ?? { x: 0, y: 0 });

  const ops: Point[] = [];
  ops.push(inps[0]!);
  reallyroutespline([], inps, ev0, ev1, ops);

  return ops.map((p) => ({ x: p.x, y: p.y }));
}

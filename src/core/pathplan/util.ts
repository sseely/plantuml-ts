export interface Ppoint {
  x: number;
  y: number;
}

export type Pvector = Ppoint;

export interface Ppoly {
  ps: Ppoint[];
  pn: number;
}

export type Ppolyline = Ppoly;

export interface Pedge_t {
  a: Ppoint;
  b: Ppoint;
}

// vconfig_t is an opaque handle in the C API (visibility graph). Declared for
// T18 consumer compatibility even though visibility graph is not ported here.
export type vconfig_t = Record<string, never>;

export function Ppolybarriers(polys: Ppoly[], npolys: number): Pedge_t[] {
  const barriers: Pedge_t[] = [];
  for (let i = 0; i < npolys; i++) {
    const pp = polys[i]!;
    for (let j = 0; j < pp.pn; j++) {
      const k = (j + 1) >= pp.pn ? 0 : j + 1;
      barriers.push({ a: pp.ps[j]!, b: pp.ps[k]! });
    }
  }
  return barriers;
}

export function make_polyline(line: Ppolyline, sline: Ppolyline): void {
  const pts: Ppoint[] = [];
  let i = 0;
  pts.push({ ...line.ps[i]! });
  pts.push({ ...line.ps[i]! });
  i++;
  for (; i + 1 < line.pn; i++) {
    pts.push({ ...line.ps[i]! });
    pts.push({ ...line.ps[i]! });
    pts.push({ ...line.ps[i]! });
  }
  pts.push({ ...line.ps[i]! });
  pts.push({ ...line.ps[i]! });
  sline.pn = pts.length;
  sline.ps = pts;
}

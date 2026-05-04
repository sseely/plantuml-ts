import type { DotWorkingGraph } from '../dot/types.js';

export interface PackedComponent {
  nodes: Array<{ id: string; x: number; y: number }>;
  xOffset: number;
  yOffset: number;
}

interface Bbox {
  llx: number;
  lly: number;
  urx: number;
  ury: number;
}

interface Ginfo {
  perim: number;
  cells: Array<{ x: number; y: number }>;
  nc: number;
  index: number;
}

function computeComponentBbox(g: DotWorkingGraph): Bbox {
  if (g.nodes.length === 0) {
    return { llx: 0, lly: 0, urx: 0, ury: 0 };
  }
  let llx = Infinity,
    lly = Infinity,
    urx = -Infinity,
    ury = -Infinity;
  for (const n of g.nodes) {
    const hw = n.width / 2;
    const hh = n.height / 2;
    llx = Math.min(llx, n.x - hw);
    lly = Math.min(lly, n.y - hh);
    urx = Math.max(urx, n.x + hw);
    ury = Math.max(ury, n.y + hh);
  }
  return { llx, lly, urx, ury };
}

const C_POLY = 100;

function computeStep(ng: number, bbs: Bbox[], margin: number): number {
  const a = C_POLY * ng - 1;
  let b = 0;
  let c = 0;
  for (const bb of bbs) {
    const W = bb.urx - bb.llx + 2 * margin;
    const H = bb.ury - bb.lly + 2 * margin;
    b -= W + H;
    c -= W * H;
  }
  const d = b * b - 4.0 * a * c;
  if (d < 0) return 1;
  const r = Math.sqrt(d);
  const l1 = (-b + r) / (2 * a);
  let root = Math.floor(l1);
  if (root === 0) root = 1;
  return root;
}

function cval(v: number, s: number): number {
  if (v >= 0) return Math.floor(v / s);
  return Math.trunc((v + 1) / s) - 1;
}

function gridCount(x: number, s: number): number {
  return Math.ceil(x / s);
}

function genBox(
  bb: Bbox,
  index: number,
  ssize: number,
  margin: number,
): Ginfo {
  const psMap = new Set<string>();
  const cells: Array<{ x: number; y: number }> = [];

  const llx = cval(0 - margin, ssize);
  const lly = cval(0 - margin, ssize);
  const urx = cval(bb.urx - bb.llx + margin, ssize);
  const ury = cval(bb.ury - bb.lly + margin, ssize);

  for (let x = llx; x <= urx; x++) {
    for (let y = lly; y <= ury; y++) {
      const key = `${x},${y}`;
      if (!psMap.has(key)) {
        psMap.add(key);
        cells.push({ x, y });
      }
    }
  }

  const W = gridCount(bb.urx - bb.llx + 2 * margin, ssize);
  const H = gridCount(bb.ury - bb.lly + 2 * margin, ssize);
  const perim = W + H;

  return { perim, cells, nc: cells.length, index };
}

function fits(
  x: number,
  y: number,
  info: Ginfo,
  occupied: Set<string>,
  place: { x: number; y: number },
  step: number,
  bbs: readonly Bbox[],
): boolean {
  const cells = info.cells;
  for (const cell of cells) {
    const key = `${cell.x + x},${cell.y + y}`;
    if (occupied.has(key)) return false;
  }

  const bb = bbs[info.index];
  if (bb === undefined) return false;
  place.x = step * x - Math.round(bb.llx);
  place.y = step * y - Math.round(bb.lly);

  for (const cell of cells) {
    occupied.add(`${cell.x + x},${cell.y + y}`);
  }
  return true;
}

function placeGraph(
  i: number,
  info: Ginfo,
  occupied: Set<string>,
  place: { x: number; y: number },
  step: number,
  margin: number,
  bbs: readonly Bbox[],
): void {
  const bb = bbs[info.index];
  if (bb === undefined) return;

  if (i === 0) {
    const W = gridCount(bb.urx - bb.llx + 2 * margin, step);
    const H = gridCount(bb.ury - bb.lly + 2 * margin, step);
    if (fits(-Math.floor(W / 2), -Math.floor(H / 2), info, occupied, place, step, bbs)) {
      return;
    }
  }

  if (fits(0, 0, info, occupied, place, step, bbs)) return;

  const W = bb.urx - bb.llx;
  const H = bb.ury - bb.lly;

  if (W >= H) {
    for (let bnd = 1; ; bnd++) {
      let x = 0;
      let y = -bnd;
      for (; x < bnd; x++) {
        if (fits(x, y, info, occupied, place, step, bbs)) return;
      }
      for (; y < bnd; y++) {
        if (fits(x, y, info, occupied, place, step, bbs)) return;
      }
      for (; x > -bnd; x--) {
        if (fits(x, y, info, occupied, place, step, bbs)) return;
      }
      for (; y > -bnd; y--) {
        if (fits(x, y, info, occupied, place, step, bbs)) return;
      }
      for (; x < 0; x++) {
        if (fits(x, y, info, occupied, place, step, bbs)) return;
      }
    }
  } else {
    for (let bnd = 1; ; bnd++) {
      let y = 0;
      let x = -bnd;
      for (; y > -bnd; y--) {
        if (fits(x, y, info, occupied, place, step, bbs)) return;
      }
      for (; x < bnd; x++) {
        if (fits(x, y, info, occupied, place, step, bbs)) return;
      }
      for (; y < bnd; y++) {
        if (fits(x, y, info, occupied, place, step, bbs)) return;
      }
      for (; x > -bnd; x--) {
        if (fits(x, y, info, occupied, place, step, bbs)) return;
      }
      for (; y > 0; y--) {
        if (fits(x, y, info, occupied, place, step, bbs)) return;
      }
    }
  }
}

function polyRects(ng: number, bbs: Bbox[], margin: number): Array<{ x: number; y: number }> | null {
  const stepSize = computeStep(ng, bbs, margin);
  if (stepSize <= 0) return null;

  const infos: Ginfo[] = [];
  for (let i = 0; i < ng; i++) {
    const bb = bbs[i];
    if (bb === undefined) continue;
    infos.push(genBox(bb, i, stepSize, margin));
  }

  const sorted = infos.slice().sort((a, b) => {
    if (b.perim < a.perim) return -1;
    if (b.perim > a.perim) return 1;
    return 0;
  });

  const occupied = new Set<string>();
  const places: Array<{ x: number; y: number }> = Array.from({ length: ng }, () => ({ x: 0, y: 0 }));

  for (let i = 0; i < sorted.length; i++) {
    const si = sorted[i];
    if (si === undefined) continue;
    const place = places[si.index];
    if (place === undefined) continue;
    placeGraph(i, si, occupied, place, stepSize, margin, bbs);
  }

  return places;
}

export function packSubgraphs(
  components: DotWorkingGraph[],
  margin: number,
): PackedComponent[] {
  const ng = components.length;
  if (ng === 0) return [];

  const bbs = components.map(computeComponentBbox);

  if (ng === 1) {
    const g = components[0];
    if (g === undefined) return [];
    return [
      {
        nodes: g.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })),
        xOffset: 0,
        yOffset: 0,
      },
    ];
  }

  const places = polyRects(ng, bbs, margin);

  return components.map((g, i) => {
    const offset = places?.[i] ?? { x: 0, y: 0 };
    return {
      nodes: g.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })),
      xOffset: offset.x,
      yOffset: offset.y,
    };
  });
}

import type { DotWorkingGraph, DotNode } from '../dot/types.js';
import { RTreeOpen, RTreeClose, RTreeInsert, RTreeSearch, RTreeLeafListFree } from './rtree-index.js';
import type { RTree_t, LeafList_t } from './rtree-index.js';
import { Overlap } from './rectangle.js';
import type { Rect_t } from './rectangle.js';

export interface XlabelResult {
  nodeId: string;
  x: number;
  y: number;
}

interface XlabelEntry {
  node: DotNode;
  labelWidth: number;
  labelHeight: number;
  posX: number;
  posY: number;
  set: boolean;
}

const XLXDENOM = 8;
const XLYDENOM = 2;
const XLNBR = 9;
const XLPXPY = 0;
const XLCXPY = 1;
const XLNXPY = 2;
const XLPXCY = 3;
// const XLCXCY = 4; // center — not used as neighbor index in neighbor tracking
const XLNXCY = 5;
const XLPXNY = 6;
const XLCXNY = 7;
const XLNXNY = 8;

interface BestPos_t {
  n: number;
  area: number;
  posX: number;
  posY: number;
}

function objp2rect(posX: number, posY: number, sz: { w: number; h: number }): Rect_t {
  return {
    boundary: [
      Math.round(posX),
      Math.round(posY),
      Math.round(posX + sz.w),
      Math.round(posY + sz.h),
    ],
  };
}

function objplp2rect(e: XlabelEntry): Rect_t {
  return {
    boundary: [
      Math.round(e.posX),
      Math.round(e.posY),
      Math.round(e.posX + e.labelWidth),
      Math.round(e.posY + e.labelHeight),
    ],
  };
}

function objplpmks(e: XlabelEntry): Rect_t {
  const nodeX = e.node.x;
  const nodeY = e.node.y;
  const nodeW = e.node.width;
  const nodeH = e.node.height;
  const lw = e.labelWidth;
  const lh = e.labelHeight;
  return {
    boundary: [
      Math.floor(nodeX - lw),
      Math.floor(nodeY - lh),
      Math.ceil(nodeX + nodeW + lw),
      Math.ceil(nodeY + nodeH + lh),
    ],
  };
}

function aabbaabb(r: Rect_t, s: Rect_t): number {
  if (!Overlap(r, s)) return 0;
  const iminx = Math.max(r.boundary[0], s.boundary[0]);
  const iminy = Math.max(r.boundary[1], s.boundary[1]);
  const imaxx = Math.min(r.boundary[2], s.boundary[2]);
  const imaxy = Math.min(r.boundary[3], s.boundary[3]);
  return (imaxx - iminx) * (imaxy - iminy);
}

function lblenclosing(e: XlabelEntry, px: number, py: number): boolean {
  return (
    px > e.posX &&
    px < e.posX + e.labelWidth &&
    py > e.posY &&
    py < e.posY + e.labelHeight
  );
}

function getintrsxi(
  eX: number, eY: number,
  cpX: number, cpY: number
): number {
  if (cpY < eY) {
    if (cpX < eX) return XLPXPY;
    if (cpX > eX) return XLNXPY;
    return XLCXPY;
  }
  if (cpY > eY) {
    if (cpX < eX) return XLPXNY;
    if (cpX > eX) return XLNXNY;
    return XLCXNY;
  }
  if (cpX < eX) return XLPXCY;
  if (cpX > eX) return XLNXCY;
  return -1;
}

function recordointrsx(
  opX: number, opY: number,
  cpEntry: XlabelEntry,
  rp: Rect_t,
  a: number,
  intrsx: (XlabelEntry | null)[]
): number {
  const cpX = cpEntry.node.x;
  const cpY = cpEntry.node.y;
  let i = getintrsxi(opX, opY, cpX, cpY);
  if (i < 0) i = 5;
  if (intrsx[i] !== null) {
    const existing = intrsx[i]!;
    let maxa = 0.0;
    const srect = objp2rect(existing.node.x, existing.node.y, { w: existing.node.width, h: existing.node.height });
    const sa = aabbaabb(rp, srect);
    if (sa > a) maxa = sa;
    if (existing.set) {
      const srect2 = objplp2rect(existing);
      const sa2 = aabbaabb(rp, srect2);
      if (sa2 > a) maxa = Math.max(sa2, maxa);
    }
    if (maxa > 0.0) return maxa;
    intrsx[i] = cpEntry;
    return a;
  }
  intrsx[i] = cpEntry;
  return a;
}

function recordlintrsx(
  opX: number, opY: number,
  cpEntry: XlabelEntry,
  rp: Rect_t,
  a: number,
  intrsx: (XlabelEntry | null)[]
): number {
  const cpX = cpEntry.node.x;
  const cpY = cpEntry.node.y;
  let i = getintrsxi(opX, opY, cpX, cpY);
  if (i < 0) i = 5;
  if (intrsx[i] !== null) {
    const existing = intrsx[i]!;
    let maxa = 0.0;
    const srect = objp2rect(existing.node.x, existing.node.y, { w: existing.node.width, h: existing.node.height });
    const sa = aabbaabb(rp, srect);
    if (sa > a) maxa = sa;
    if (existing.set) {
      const srect2 = objplp2rect(existing);
      const sa2 = aabbaabb(rp, srect2);
      if (sa2 > a) maxa = Math.max(sa2, maxa);
    }
    if (maxa > 0.0) return maxa;
    intrsx[i] = cpEntry;
    return a;
  }
  intrsx[i] = cpEntry;
  return a;
}

function xlintersections(
  spdx: RTree_t,
  entries: XlabelEntry[],
  e: XlabelEntry,
  intrsx: (XlabelEntry | null)[]
): BestPos_t {
  const bp: BestPos_t = { n: 0, area: 0, posX: e.posX, posY: e.posY };

  for (const other of entries) {
    if (other === e) continue;
    if (other.node.width > 0 && other.node.height > 0) continue;
    if (lblenclosing(e, other.node.x, other.node.y)) {
      bp.n++;
    }
  }

  const rect = objplp2rect(e);
  const llp = RTreeSearch(spdx, spdx.root, rect);
  if (!llp) return bp;

  let cur: LeafList_t | null = llp;
  while (cur) {
    const cp = cur.leaf.data as XlabelEntry;
    if (cp === e) {
      cur = cur.next;
      continue;
    }

    const srect = objp2rect(cp.node.x, cp.node.y, { w: cp.node.width, h: cp.node.height });
    const a = aabbaabb(rect, srect);
    if (a > 0.0) {
      const ra = recordointrsx(e.node.x, e.node.y, cp, rect, a, intrsx);
      bp.n++;
      bp.area += ra;
    }

    if (!cp.set) {
      cur = cur.next;
      continue;
    }
    const srect2 = objplp2rect(cp);
    const a2 = aabbaabb(rect, srect2);
    if (a2 > 0.0) {
      const ra2 = recordlintrsx(e.node.x, e.node.y, cp, rect, a2, intrsx);
      bp.n++;
      bp.area += ra2;
    }

    cur = cur.next;
  }
  RTreeLeafListFree(llp);
  return bp;
}

function xladjust(spdx: RTree_t, entries: XlabelEntry[], e: XlabelEntry): BestPos_t {
  const nodeX = e.node.x;
  const nodeY = e.node.y;
  const nodeW = e.node.width;
  const nodeH = e.node.height;
  const lw = e.labelWidth;
  const lh = e.labelHeight;

  const xincr = (2 * lw + nodeW) / XLXDENOM;
  const yincr = (2 * lh + nodeH) / XLYDENOM;
  const intrsx: (XlabelEntry | null)[] = new Array<XlabelEntry | null>(XLNBR).fill(null);

  e.posX = nodeX - lw;
  e.posY = nodeY + nodeH;
  let bp = xlintersections(spdx, entries, e, intrsx);
  if (bp.n === 0) return bp;

  e.posY = nodeY;
  let nbp = xlintersections(spdx, entries, e, intrsx);
  if (nbp.n === 0) return nbp;
  if (nbp.area < bp.area) bp = nbp;

  e.posY = nodeY - lh;
  nbp = xlintersections(spdx, entries, e, intrsx);
  if (nbp.n === 0) return nbp;
  if (nbp.area < bp.area) bp = nbp;

  e.posX = nodeX;
  e.posY = nodeY + nodeH;
  nbp = xlintersections(spdx, entries, e, intrsx);
  if (nbp.n === 0) return nbp;
  if (nbp.area < bp.area) bp = nbp;

  e.posY = nodeY - lh;
  nbp = xlintersections(spdx, entries, e, intrsx);
  if (nbp.n === 0) return nbp;
  if (nbp.area < bp.area) bp = nbp;

  e.posX = nodeX + nodeW;
  e.posY = nodeY + nodeH;
  nbp = xlintersections(spdx, entries, e, intrsx);
  if (nbp.n === 0) return nbp;
  if (nbp.area < bp.area) bp = nbp;

  e.posY = nodeY;
  nbp = xlintersections(spdx, entries, e, intrsx);
  if (nbp.n === 0) return nbp;
  if (nbp.area < bp.area) bp = nbp;

  e.posY = nodeY - lh;
  nbp = xlintersections(spdx, entries, e, intrsx);
  if (nbp.n === 0) return nbp;
  if (nbp.area < bp.area) bp = nbp;

  if (intrsx[XLPXNY] !== null || intrsx[XLCXNY] !== null || intrsx[XLNXNY] !== null || intrsx[XLPXCY] !== null || intrsx[XLPXPY] !== null) {
    if (intrsx[XLCXNY] === null && intrsx[XLNXNY] === null) {
      for (e.posX = nodeX - lw, e.posY = nodeY + nodeH; e.posX <= nodeX + nodeW; e.posX += xincr) {
        nbp = xlintersections(spdx, entries, e, intrsx);
        if (nbp.n === 0) return nbp;
        if (nbp.area < bp.area) bp = nbp;
      }
    }
    if (intrsx[XLPXCY] === null && intrsx[XLPXPY] === null) {
      for (e.posX = nodeX - lw, e.posY = nodeY + nodeH; e.posY >= nodeY - lh; e.posY -= yincr) {
        nbp = xlintersections(spdx, entries, e, intrsx);
        if (nbp.n === 0) return nbp;
        if (nbp.area < bp.area) bp = nbp;
      }
    }
  }

  e.posX = nodeX + nodeW;
  e.posY = nodeY - lh;
  if (intrsx[XLNXPY] !== null || intrsx[XLCXPY] !== null || intrsx[XLPXPY] !== null || intrsx[XLNXCY] !== null || intrsx[XLNXNY] !== null) {
    if (intrsx[XLCXPY] === null && intrsx[XLPXPY] === null) {
      for (e.posX = nodeX + nodeW, e.posY = nodeY - lh; e.posX >= nodeX - lw; e.posX -= xincr) {
        nbp = xlintersections(spdx, entries, e, intrsx);
        if (nbp.n === 0) return nbp;
        if (nbp.area < bp.area) bp = nbp;
      }
    }
    if (intrsx[XLNXCY] === null && intrsx[XLNXNY] === null) {
      for (e.posX = nodeX + nodeW, e.posY = nodeY - lh; e.posY <= nodeY + nodeH; e.posY += yincr) {
        nbp = xlintersections(spdx, entries, e, intrsx);
        if (nbp.n === 0) return nbp;
        if (nbp.area < bp.area) bp = nbp;
      }
    }
  }

  return bp;
}

function hd_hil_s_from_xy(px: number, py: number, n: number): number {
  let x = px, y = py;
  let s = 0;
  for (let i = n - 1; i >= 0; i--) {
    const xi = (x >> i) & 1;
    const yi = (y >> i) & 1;
    s = 4 * s + 2 * xi + (xi ^ yi);
    const swap = x ^ y;
    y = y ^ (x & (yi - 1));
    x = swap ^ y;
    const mask = -xi & (yi - 1);
    x = x ^ mask;
    y = y ^ mask;
  }
  return s;
}

function xlhorder(bbMaxX: number, bbMaxY: number): number {
  const maxVal = Math.max(bbMaxX, bbMaxY);
  if (maxVal <= 0) return 1;
  return Math.floor(Math.log2(Math.round(maxVal))) + 1;
}

export function xlabelPositions(graph: DotWorkingGraph): XlabelResult[] {
  const entries: XlabelEntry[] = [];

  for (const node of graph.nodes) {
    const n = node as DotNode & { xlabel?: string; xlabelWidth?: number; xlabelHeight?: number };
    if (!n.xlabel) continue;
    const lw = n.xlabelWidth ?? 40;
    const lh = n.xlabelHeight ?? 18;
    entries.push({
      node,
      labelWidth: lw,
      labelHeight: lh,
      posX: node.x,
      posY: node.y,
      set: false,
    });
  }

  if (entries.length === 0) return [];

  let bbMaxX = 0;
  let bbMaxY = 0;
  for (const e of entries) {
    const rx = e.node.x + e.node.width + e.labelWidth;
    const ry = e.node.y + e.node.height + e.labelHeight;
    if (rx > bbMaxX) bbMaxX = rx;
    if (ry > bbMaxY) bbMaxY = ry;
  }

  const order = xlhorder(bbMaxX, bbMaxY);

  const sorted = entries.slice().sort((a, b) => {
    const ax = a.node.x + (a.node.x + a.node.width + a.labelWidth - (a.node.x - a.labelWidth)) / 2;
    const ay = a.node.y + (a.node.y + a.node.height + a.labelHeight - (a.node.y - a.labelHeight)) / 2;
    const bx = b.node.x + (b.node.x + b.node.width + b.labelWidth - (b.node.x - b.labelWidth)) / 2;
    const by = b.node.y + (b.node.y + b.node.height + b.labelHeight - (b.node.y - b.labelHeight)) / 2;
    const sa = hd_hil_s_from_xy(Math.trunc(ax), Math.trunc(ay), order);
    const sb = hd_hil_s_from_xy(Math.trunc(bx), Math.trunc(by), order);
    return sa - sb;
  });

  const spdx = RTreeOpen();

  for (const e of sorted) {
    const rect = objplpmks(e);
    RTreeInsert(spdx, rect, e, spdx.root);
  }

  const results: XlabelResult[] = [];
  for (const e of entries) {
    const bp = xladjust(spdx, entries, e);
    if (bp.n === 0) {
      e.set = true;
    } else if (bp.area === 0) {
      e.posX = bp.posX;
      e.posY = bp.posY;
      e.set = true;
    } else {
      e.posX = bp.posX;
      e.posY = bp.posY;
      e.set = true;
    }
    results.push({ nodeId: e.node.id, x: e.posX, y: e.posY });
  }

  RTreeClose(spdx);
  return results;
}

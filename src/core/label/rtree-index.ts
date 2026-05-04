import type { Rect_t } from './rectangle.js';
import { Overlap } from './rectangle.js';
import { NODECARD, RTreeNewNode, AddBranch, NodeCover } from './node.js';
import type { Node_t, Branch_t } from './node.js';
import type { SplitQ_t } from './split_q.js';
import { makeSplitQ } from './split_q.js';

export interface Leaf_t {
  rect: Rect_t;
  data: object;
}

export interface LeafList_t {
  next: LeafList_t | null;
  leaf: Leaf_t;
}

export interface RTree_t {
  root: Node_t;
  split: SplitQ_t;
}

function RTreeNewLeafList(leaf: Leaf_t): LeafList_t {
  return { leaf, next: null };
}

function RTreeLeafListAdd(llp: LeafList_t | null, leaf: Leaf_t | null): LeafList_t | null {
  if (!leaf) return llp;
  const nlp = RTreeNewLeafList(leaf);
  nlp.next = llp;
  return nlp;
}

export function RTreeLeafListFree(_llp: LeafList_t): void {
  // No-op in GC environment; preserved for API parity
}

export function RTreeOpen(): RTree_t {
  const rtp: RTree_t = {
    root: null as unknown as Node_t,
    split: makeSplitQ(),
  };
  rtp.root = RTreeNewNode(rtp);
  rtp.root.level = 0;
  return rtp;
}

function RTreeClose2(n: Node_t): void {
  if (n.level > 0) {
    for (let i = 0; i < NODECARD; i++) {
      const br = n.branch[i];
      if (br !== undefined && br.child !== null) {
        RTreeClose2(br.child as Node_t);
      }
    }
  }
}

export function RTreeClose(rtp: RTree_t): void {
  RTreeClose2(rtp.root);
}

export function RTreeSearch(rtp: RTree_t, n: Node_t, r: Rect_t): LeafList_t | null {
  let llp: LeafList_t | null = null;

  if (n.level > 0) {
    for (let i = 0; i < NODECARD; i++) {
      const br = n.branch[i];
      if (br !== undefined && br.child !== null && Overlap(r, br.rect)) {
        const tlp = RTreeSearch(rtp, br.child as Node_t, r);
        if (llp) {
          let xlp: LeafList_t = llp;
          while (xlp.next) xlp = xlp.next;
          xlp.next = tlp;
        } else {
          llp = tlp;
        }
      }
    }
  } else {
    for (let i = 0; i < NODECARD; i++) {
      const br = n.branch[i];
      if (br !== undefined && br.child !== null && Overlap(r, br.rect)) {
        const leaf: Leaf_t = {
          rect: br.rect,
          data: br.child,
        };
        llp = RTreeLeafListAdd(llp, leaf);
      }
    }
  }
  return llp;
}

export function RTreeInsert(rtp: RTree_t, r: Rect_t, data: object, _rootRef: Node_t): number {
  const newNodeArr: Node_t[] = [];

  if (RTreeInsert2(rtp, r, data, rtp.root, newNodeArr, 0)) {
    const newroot = RTreeNewNode(rtp);
    newroot.level = rtp.root.level + 1;
    const b0: Branch_t = { rect: NodeCover(rtp.root), child: rtp.root };
    AddBranch(rtp, b0, newroot, null);
    const b1: Branch_t = { rect: NodeCover(newNodeArr[0] as Node_t), child: newNodeArr[0] as Node_t };
    AddBranch(rtp, b1, newroot, null);
    rtp.root = newroot;
    return 1;
  }
  return 0;
}

function RTreeInsert2(rtp: RTree_t, r: Rect_t, data: object, n: Node_t, newOut: Node_t[], level: number): number {
  if (n.level > level) {
    const i = pickBranch(r, n);
    const br = n.branch[i];
    if (br === undefined) return 0;
    const n2: Node_t[] = [];
    if (!RTreeInsert2(rtp, r, data, br.child as Node_t, n2, level)) {
      n.branch[i] = { rect: combineRect(r, br.rect), child: br.child };
      return 0;
    } else {
      n.branch[i] = { rect: NodeCover(br.child as Node_t), child: br.child };
      const b: Branch_t = { rect: NodeCover(n2[0] as Node_t), child: n2[0] as Node_t };
      return AddBranch(rtp, b, n, newOut);
    }
  } else if (n.level === level) {
    const b: Branch_t = { rect: r, child: data };
    return AddBranch(rtp, b, n, newOut);
  } else {
    return 0;
  }
}

function pickBranch(r: Rect_t, n: Node_t): number {
  let bestIncr = 0;
  let bestArea = 0;
  let best = 0;
  let bestSet = false;

  for (let i = 0; i < NODECARD; i++) {
    const br = n.branch[i];
    if (br !== undefined && br.child !== null) {
      const area = rectArea(br.rect);
      const rect = combineRect(r, br.rect);
      const increase = rectArea(rect) - area;
      if (!bestSet || increase < bestIncr) {
        best = i;
        bestArea = area;
        bestIncr = increase;
        bestSet = true;
      } else if (increase === bestIncr && area < bestArea) {
        best = i;
        bestArea = area;
        bestIncr = increase;
      }
    }
  }
  return best;
}

function rectArea(r: Rect_t): number {
  if (r.boundary[0] > r.boundary[2]) return 0;
  const dimX = r.boundary[2] - r.boundary[0];
  const dimY = r.boundary[3] - r.boundary[1];
  if (dimX === 0 || dimY === 0) return 0;
  return dimX * dimY;
}

function combineRect(r: Rect_t, rr: Rect_t): Rect_t {
  if (r.boundary[0] > r.boundary[2]) return { boundary: [rr.boundary[0], rr.boundary[1], rr.boundary[2], rr.boundary[3]] };
  if (rr.boundary[0] > rr.boundary[2]) return { boundary: [r.boundary[0], r.boundary[1], r.boundary[2], r.boundary[3]] };
  return {
    boundary: [
      Math.min(r.boundary[0], rr.boundary[0]),
      Math.min(r.boundary[1], rr.boundary[1]),
      Math.max(r.boundary[2], rr.boundary[2]),
      Math.max(r.boundary[3], rr.boundary[3]),
    ],
  };
}

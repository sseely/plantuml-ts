import type { Rect_t } from './rectangle.js';
import { InitRect, CombineRect, RectArea } from './rectangle.js';
import { SplitNode } from './split_q.js';
import type { RTree_t } from './rtree-index.js';

export const NODECARD = 64;

export interface Branch_t {
  rect: Rect_t;
  child: Node_t | object | null;
}

export interface Node_t {
  count: number;
  level: number;
  branch: Branch_t[];
}

function makeBranch(): Branch_t {
  const b: Branch_t = { rect: { boundary: [0, 0, 0, 0] }, child: null };
  InitRect(b.rect);
  return b;
}

export function RTreeNewNode(_rtp: RTree_t): Node_t {
  const n: Node_t = { count: 0, level: -1, branch: [] };
  InitNode(n);
  return n;
}

export function InitNode(n: Node_t): void {
  n.count = 0;
  n.level = -1;
  n.branch = [];
  for (let i = 0; i < NODECARD; i++) {
    n.branch.push(makeBranch());
  }
}

export function NodeCover(n: Node_t): Rect_t {
  let flag = true;
  let r: Rect_t = { boundary: [0, 0, 0, 0] };
  InitRect(r);
  for (let i = 0; i < NODECARD; i++) {
    const br = n.branch[i];
    if (br !== undefined && br.child !== null) {
      if (flag) {
        r = { boundary: [br.rect.boundary[0], br.rect.boundary[1], br.rect.boundary[2], br.rect.boundary[3]] };
        flag = false;
      } else {
        r = CombineRect(r, br.rect);
      }
    }
  }
  return r;
}

export function PickBranch(r: Rect_t, n: Node_t): number {
  let bestIncr = 0;
  let bestArea = 0;
  let best = 0;
  let bestSet = false;

  for (let i = 0; i < NODECARD; i++) {
    const br = n.branch[i];
    if (br !== undefined && br.child !== null) {
      const area = RectArea(br.rect);
      const rect = CombineRect(r, br.rect);
      const increase = RectArea(rect) - area;
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

export function AddBranch(rtp: RTree_t, b: Branch_t, n: Node_t, newOut: Node_t[] | null): number {
  if (n.count < NODECARD) {
    for (let i = 0; i < NODECARD; i++) {
      const br = n.branch[i];
      if (br !== undefined && br.child === null) {
        n.branch[i] = { rect: { boundary: [b.rect.boundary[0], b.rect.boundary[1], b.rect.boundary[2], b.rect.boundary[3]] }, child: b.child };
        n.count++;
        break;
      }
    }
    return 0;
  } else {
    if (newOut !== null) {
      SplitNode(rtp, n, b, newOut, AddBranch, RTreeNewNode);
    }
    return 1;
  }
}

export function DisconBranch(n: Node_t, i: number): void {
  const br = n.branch[i];
  if (br !== undefined) {
    n.branch[i] = makeBranch();
  }
  n.count--;
}

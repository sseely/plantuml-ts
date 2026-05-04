import { NODECARD } from './node.js';
import type { Branch_t, Node_t } from './node.js';
import type { RTree_t } from './rtree-index.js';
import { CombineRect, NullRect, RectArea } from './rectangle.js';
import type { Rect_t } from './rectangle.js';

interface PartitionVars {
  partition: number[];
  taken: boolean[];
  count: [number, number];
  cover: [Rect_t, Rect_t];
  area: [number, number];
}

export interface SplitQ_t {
  BranchBuf: Branch_t[];
  CoverSplit: Rect_t;
  CoverSplitArea: number;
  Partitions: [PartitionVars];
}

export function makeSplitQ(): SplitQ_t {
  return {
    BranchBuf: Array.from({ length: NODECARD + 1 }, () => ({
      rect: { boundary: [0, 0, 0, 0] as [number, number, number, number] },
      child: null,
    })),
    CoverSplit: { boundary: [0, 0, 0, 0] },
    CoverSplitArea: 0,
    Partitions: [
      {
        partition: new Array<number>(NODECARD + 1).fill(-1),
        taken: new Array<boolean>(NODECARD + 1).fill(false),
        count: [0, 0],
        cover: [NullRect(), NullRect()],
        area: [0, 0],
      },
    ],
  };
}

function copyRect(r: Rect_t): Rect_t {
  return { boundary: [r.boundary[0], r.boundary[1], r.boundary[2], r.boundary[3]] };
}

function GetBranches(rtp: RTree_t, n: Node_t, b: Branch_t): void {
  for (let i = 0; i < NODECARD; i++) {
    const br = n.branch[i];
    if (br !== undefined) {
      rtp.split.BranchBuf[i] = { rect: copyRect(br.rect), child: br.child };
    }
  }
  rtp.split.BranchBuf[NODECARD] = { rect: copyRect(b.rect), child: b.child };

  const firstBuf = rtp.split.BranchBuf[0];
  if (firstBuf !== undefined) {
    rtp.split.CoverSplit = copyRect(firstBuf.rect);
  }
  for (let i = 1; i < NODECARD + 1; i++) {
    const buf = rtp.split.BranchBuf[i];
    if (buf !== undefined) {
      rtp.split.CoverSplit = CombineRect(rtp.split.CoverSplit, buf.rect);
    }
  }
  rtp.split.CoverSplitArea = RectArea(rtp.split.CoverSplit);

  n.count = 0;
  n.level = -1;
  for (let i = 0; i < NODECARD; i++) {
    n.branch[i] = { rect: { boundary: [0, 0, 0, 0] }, child: null };
  }
}

function Classify(rtp: RTree_t, i: number, group: 0 | 1): void {
  const p = rtp.split.Partitions[0];
  p.partition[i] = group;
  p.taken[i] = true;

  const buf = rtp.split.BranchBuf[i];
  if (buf === undefined) return;

  if (p.count[group] === 0) {
    p.cover[group] = copyRect(buf.rect);
  } else {
    p.cover[group] = CombineRect(buf.rect, p.cover[group]);
  }
  p.area[group] = RectArea(p.cover[group]);
  p.count[group]++;
}

function PickSeeds(rtp: RTree_t): void {
  const area: number[] = [];
  for (let i = 0; i < NODECARD + 1; i++) {
    const buf = rtp.split.BranchBuf[i];
    area.push(buf !== undefined ? RectArea(buf.rect) : 0);
  }

  let worst = 0;
  let seed0 = 0, seed1 = 0;
  for (let i = 0; i < NODECARD; i++) {
    const bi = rtp.split.BranchBuf[i];
    if (bi === undefined) continue;
    for (let j = i + 1; j < NODECARD + 1; j++) {
      const bj = rtp.split.BranchBuf[j];
      if (bj === undefined) continue;
      const rect = CombineRect(bi.rect, bj.rect);
      const ai = area[i] ?? 0;
      const aj = area[j] ?? 0;
      const waste = RectArea(rect) - ai - aj;
      if (waste > worst) {
        worst = waste;
        seed0 = i;
        seed1 = j;
      }
    }
  }
  Classify(rtp, seed0, 0);
  Classify(rtp, seed1, 1);
}

function InitPVars(rtp: RTree_t): void {
  const p = rtp.split.Partitions[0];
  p.count[0] = p.count[1] = 0;
  p.cover[0] = NullRect();
  p.cover[1] = NullRect();
  p.area[0] = p.area[1] = 0;
  for (let i = 0; i < NODECARD + 1; i++) {
    p.taken[i] = false;
    p.partition[i] = -1;
  }
}

function MethodZero(rtp: RTree_t): void {
  InitPVars(rtp);
  PickSeeds(rtp);

  const p = rtp.split.Partitions[0];
  while (
    p.count[0] + p.count[1] < NODECARD + 1 &&
    p.count[0] < NODECARD + 1 &&
    p.count[1] < NODECARD + 1
  ) {
    let biggestDiffSet = false;
    let biggestDiff = 0;
    let chosen = 0;
    let betterGroup: 0 | 1 = 0;

    for (let i = 0; i < NODECARD + 1; i++) {
      if (p.taken[i]) continue;
      const buf = rtp.split.BranchBuf[i];
      if (buf === undefined) continue;
      const rect0 = CombineRect(buf.rect, p.cover[0]);
      const growth0 = RectArea(rect0) - p.area[0];
      const rect1 = CombineRect(buf.rect, p.cover[1]);
      const growth1 = RectArea(rect1) - p.area[1];
      let diff: number;
      let group: 0 | 1;
      if (growth1 >= growth0) {
        diff = growth1 - growth0;
        group = 0;
      } else {
        diff = growth0 - growth1;
        group = 1;
      }
      if (!biggestDiffSet || diff > biggestDiff) {
        biggestDiff = diff;
        biggestDiffSet = true;
        chosen = i;
        betterGroup = group;
      } else if (diff === biggestDiff && p.count[group] < p.count[betterGroup]) {
        chosen = i;
        betterGroup = group;
      }
    }
    Classify(rtp, chosen, betterGroup);
  }

  const p2 = rtp.split.Partitions[0];
  if (p2.count[0] + p2.count[1] < NODECARD + 1) {
    let group: 0 | 1 = 0;
    if (p2.count[0] >= NODECARD + 1) group = 1;
    for (let i = 0; i < NODECARD + 1; i++) {
      if (!p2.taken[i]) {
        Classify(rtp, i, group);
      }
    }
  }
}

function LoadNodes(
  rtp: RTree_t,
  n: Node_t,
  q: Node_t,
  addBranchFn: (rtp: RTree_t, b: Branch_t, n: Node_t, newNode: Node_t[] | null) => number
): void {
  const p = rtp.split.Partitions[0];
  for (let i = 0; i < NODECARD + 1; i++) {
    const buf = rtp.split.BranchBuf[i];
    if (buf === undefined) continue;
    if (p.partition[i] === 0) {
      addBranchFn(rtp, buf, n, null);
    } else if (p.partition[i] === 1) {
      addBranchFn(rtp, buf, q, null);
    }
  }
}

export function SplitNode(
  rtp: RTree_t,
  n: Node_t,
  b: Branch_t,
  nn: Node_t[],
  addBranchFn: (rtp: RTree_t, b: Branch_t, n: Node_t, newNode: Node_t[] | null) => number,
  newNodeFn: (rtp: RTree_t) => Node_t
): void {
  const level = n.level;
  GetBranches(rtp, n, b);
  MethodZero(rtp);

  const newNode = newNodeFn(rtp);
  newNode.level = n.level = level;
  LoadNodes(rtp, n, newNode, addBranchFn);
  nn[0] = newNode;
}

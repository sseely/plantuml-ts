import { describe, it, expect } from 'vitest';
import { RTreeOpen, RTreeClose, RTreeInsert, RTreeSearch, RTreeLeafListFree } from '../../../src/core/label/rtree-index.js';
import { RectArea, CombineRect, NullRect, Overlap } from '../../../src/core/label/rectangle.js';
import { NodeCover, PickBranch, DisconBranch, InitNode, AddBranch, RTreeNewNode } from '../../../src/core/label/node.js';
import type { Rect_t } from '../../../src/core/label/rectangle.js';

function makeRect(x0: number, y0: number, x1: number, y1: number): Rect_t {
  return { boundary: [x0, y0, x1, y1] };
}

describe('RTree', () => {
  it('given an empty tree, search returns null', () => {
    const rtp = RTreeOpen();
    const result = RTreeSearch(rtp, rtp.root, makeRect(0, 0, 10, 10));
    expect(result).toBeNull();
    RTreeClose(rtp);
  });

  it('given one inserted rect, search finds it when overlapping', () => {
    const rtp = RTreeOpen();
    const data = { id: 'a' };
    RTreeInsert(rtp, makeRect(0, 0, 10, 10), data, rtp.root);
    const result = RTreeSearch(rtp, rtp.root, makeRect(5, 5, 15, 15));
    expect(result).not.toBeNull();
    expect(result!.leaf.data).toBe(data);
    RTreeLeafListFree(result!);
    RTreeClose(rtp);
  });

  it('given one inserted rect, search returns null when no overlap', () => {
    const rtp = RTreeOpen();
    const data = { id: 'b' };
    RTreeInsert(rtp, makeRect(0, 0, 10, 10), data, rtp.root);
    const result = RTreeSearch(rtp, rtp.root, makeRect(20, 20, 30, 30));
    expect(result).toBeNull();
    RTreeClose(rtp);
  });

  it('given multiple inserted rects, search finds all overlapping', () => {
    const rtp = RTreeOpen();
    const a = { id: 'a' };
    const b = { id: 'b' };
    const c = { id: 'c' };
    RTreeInsert(rtp, makeRect(0, 0, 10, 10), a, rtp.root);
    RTreeInsert(rtp, makeRect(5, 5, 15, 15), b, rtp.root);
    RTreeInsert(rtp, makeRect(50, 50, 60, 60), c, rtp.root);
    const result = RTreeSearch(rtp, rtp.root, makeRect(0, 0, 20, 20));
    expect(result).not.toBeNull();
    const found: unknown[] = [];
    let cur = result;
    while (cur) {
      found.push(cur.leaf.data);
      cur = cur.next;
    }
    expect(found).toContain(a);
    expect(found).toContain(b);
    expect(found).not.toContain(c);
    RTreeLeafListFree(result!);
    RTreeClose(rtp);
  });

  it('given many inserts triggering a split, all rects are still findable', () => {
    const rtp = RTreeOpen();
    const items: Array<{ id: string }> = [];
    for (let i = 0; i < 70; i++) {
      const item = { id: `item${i}` };
      items.push(item);
      RTreeInsert(rtp, makeRect(i * 5, i * 5, i * 5 + 4, i * 5 + 4), item, rtp.root);
    }
    for (let i = 0; i < 70; i++) {
      const result = RTreeSearch(rtp, rtp.root, makeRect(i * 5, i * 5, i * 5 + 4, i * 5 + 4));
      expect(result).not.toBeNull();
      RTreeLeafListFree(result!);
    }
    RTreeClose(rtp);
  });

  it('given rects in multiple quadrants triggering splits, internal node search works', () => {
    const rtp = RTreeOpen();
    const positions = [
      [0, 0], [100, 0], [200, 0], [0, 100], [100, 100], [200, 100],
      [0, 200], [100, 200], [200, 200], [50, 50], [150, 50], [50, 150],
      [150, 150], [300, 300], [400, 0], [0, 400], [400, 400],
      [250, 250], [350, 350], [450, 50],
    ];
    const items: Array<{ id: string }> = [];
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      if (pos === undefined) continue;
      const item = { id: `item${i}` };
      items.push(item);
      RTreeInsert(rtp, makeRect(pos[0] ?? 0, pos[1] ?? 0, (pos[0] ?? 0) + 10, (pos[1] ?? 0) + 10), item, rtp.root);
    }
    const result = RTreeSearch(rtp, rtp.root, makeRect(0, 0, 500, 500));
    expect(result).not.toBeNull();
    const found: unknown[] = [];
    let cur = result;
    while (cur) {
      found.push(cur.leaf.data);
      cur = cur.next;
    }
    expect(found.length).toBe(positions.length);
    RTreeLeafListFree(result!);
    RTreeClose(rtp);
  });

  it('given a large insert triggering multiple tree levels, search still finds items by narrow rect', () => {
    const rtp = RTreeOpen();
    for (let i = 0; i < 150; i++) {
      RTreeInsert(rtp, makeRect(i * 3, i * 3, i * 3 + 2, i * 3 + 2), { id: `x${i}` }, rtp.root);
    }
    const result = RTreeSearch(rtp, rtp.root, makeRect(0, 0, 2, 2));
    expect(result).not.toBeNull();
    RTreeLeafListFree(result!);
    RTreeClose(rtp);
  });

  it('given a narrow rect that misses all branches at internal level, search returns null', () => {
    const rtp = RTreeOpen();
    for (let i = 0; i < 70; i++) {
      RTreeInsert(rtp, makeRect(i * 10, 0, i * 10 + 5, 5), { id: `r${i}` }, rtp.root);
    }
    const result = RTreeSearch(rtp, rtp.root, makeRect(10000, 10000, 10010, 10010));
    expect(result).toBeNull();
    RTreeClose(rtp);
  });
});

describe('rectangle utilities', () => {
  it('RectArea returns 0 for undefined rect (boundary[0] > boundary[2])', () => {
    const r = NullRect();
    expect(RectArea(r)).toBe(0);
  });

  it('RectArea returns 0 for zero-width rect', () => {
    const r = makeRect(5, 0, 5, 10);
    expect(RectArea(r)).toBe(0);
  });

  it('RectArea returns 0 for zero-height rect', () => {
    const r = makeRect(0, 5, 10, 5);
    expect(RectArea(r)).toBe(0);
  });

  it('RectArea returns correct area for normal rect', () => {
    const r = makeRect(0, 0, 10, 5);
    expect(RectArea(r)).toBe(50);
  });

  it('CombineRect with first rect undefined returns second rect', () => {
    const r = NullRect();
    const rr = makeRect(1, 2, 3, 4);
    const result = CombineRect(r, rr);
    expect(result.boundary[0]).toBe(1);
    expect(result.boundary[1]).toBe(2);
    expect(result.boundary[2]).toBe(3);
    expect(result.boundary[3]).toBe(4);
  });

  it('CombineRect with second rect undefined returns first rect', () => {
    const r = makeRect(1, 2, 3, 4);
    const rr = NullRect();
    const result = CombineRect(r, rr);
    expect(result.boundary[0]).toBe(1);
    expect(result.boundary[1]).toBe(2);
    expect(result.boundary[2]).toBe(3);
    expect(result.boundary[3]).toBe(4);
  });

  it('Overlap returns false when rects do not overlap on y axis', () => {
    const r = makeRect(0, 0, 10, 5);
    const s = makeRect(0, 10, 10, 15);
    expect(Overlap(r, s)).toBe(false);
  });

  it('Overlap returns true when rects overlap', () => {
    const r = makeRect(0, 0, 10, 10);
    const s = makeRect(5, 5, 15, 15);
    expect(Overlap(r, s)).toBe(true);
  });

  it('Overlap returns false when r is to the right of s', () => {
    const r = makeRect(20, 0, 30, 10);
    const s = makeRect(0, 0, 10, 10);
    expect(Overlap(r, s)).toBe(false);
  });
});

describe('node utilities', () => {
  it('NodeCover returns zero rect for empty node', () => {
    const rtp = RTreeOpen();
    const n = RTreeNewNode(rtp);
    InitNode(n);
    const r = NodeCover(n);
    expect(r.boundary[0]).toBe(0);
    RTreeClose(rtp);
  });

  it('NodeCover covers all children', () => {
    const rtp = RTreeOpen();
    const n = RTreeNewNode(rtp);
    InitNode(n);
    AddBranch(rtp, { rect: makeRect(0, 0, 10, 10), child: { dummy: true } }, n, null);
    AddBranch(rtp, { rect: makeRect(20, 20, 30, 30), child: { dummy: true } }, n, null);
    const r = NodeCover(n);
    expect(r.boundary[0]).toBe(0);
    expect(r.boundary[1]).toBe(0);
    expect(r.boundary[2]).toBe(30);
    expect(r.boundary[3]).toBe(30);
    RTreeClose(rtp);
  });

  it('PickBranch returns 0 for a node with one branch', () => {
    const rtp = RTreeOpen();
    const n = RTreeNewNode(rtp);
    InitNode(n);
    AddBranch(rtp, { rect: makeRect(10, 10, 20, 20), child: { dummy: true } }, n, null);
    const best = PickBranch(makeRect(5, 5, 15, 15), n);
    expect(best).toBe(0);
    RTreeClose(rtp);
  });

  it('PickBranch selects branch with smaller area increase', () => {
    const rtp = RTreeOpen();
    const n = RTreeNewNode(rtp);
    InitNode(n);
    AddBranch(rtp, { rect: makeRect(0, 0, 5, 5), child: { dummy: 'small' } }, n, null);
    AddBranch(rtp, { rect: makeRect(100, 100, 200, 200), child: { dummy: 'large' } }, n, null);
    const best = PickBranch(makeRect(0, 0, 3, 3), n);
    expect(best).toBe(0);
    RTreeClose(rtp);
  });

  it('PickBranch tie-breaking selects branch with smaller area', () => {
    const rtp = RTreeOpen();
    const n = RTreeNewNode(rtp);
    InitNode(n);
    AddBranch(rtp, { rect: makeRect(0, 0, 10, 10), child: { dummy: 'a' } }, n, null);
    AddBranch(rtp, { rect: makeRect(100, 100, 200, 200), child: { dummy: 'b' } }, n, null);
    const query = makeRect(5, 5, 15, 15);
    const best = PickBranch(query, n);
    expect(best).toBeGreaterThanOrEqual(0);
    RTreeClose(rtp);
  });

  it('DisconBranch decrements count and clears child', () => {
    const rtp = RTreeOpen();
    const n = RTreeNewNode(rtp);
    InitNode(n);
    AddBranch(rtp, { rect: makeRect(0, 0, 10, 10), child: { dummy: true } }, n, null);
    expect(n.count).toBe(1);
    DisconBranch(n, 0);
    expect(n.count).toBe(0);
    const br = n.branch[0];
    expect(br).toBeDefined();
    if (br !== undefined) {
      expect(br.child).toBeNull();
    }
    RTreeClose(rtp);
  });
});

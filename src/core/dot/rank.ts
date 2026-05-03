import type { DotWorkingGraph, DotNode, DotEdge, Subtree } from './types.js';

// ---------------------------------------------------------------------------
// Constants mirroring graphviz rank type values
// ---------------------------------------------------------------------------
const SAMERANK = 1;
const MINRANK = 2;
const SOURCERANK = 3;
const MAXRANK = 4;
const SINKRANK = 5;

const SEARCHSIZE = 30;

// ---------------------------------------------------------------------------
// Union-find (UF_find / UF_union) — used for collapse_rankset
// ---------------------------------------------------------------------------

function ufFind(n: DotNode): DotNode {
  // path compression
  if (n.ufParent === undefined || n.ufParent === n) {
    return n;
  }
  const root = ufFind(n.ufParent);
  n.ufParent = root;
  return root;
}

function ufUnion(a: DotNode, b: DotNode): DotNode {
  const ra = ufFind(a);
  const rb = ufFind(b);
  if (ra === rb) return ra;
  const sa = ra.ufSize ?? 1;
  const sb = rb.ufSize ?? 1;
  // union by size — larger becomes root
  if (sa >= sb) {
    rb.ufParent = ra;
    ra.ufSize = sa + sb;
    return ra;
  } else {
    ra.ufParent = rb;
    rb.ufSize = sa + sb;
    return rb;
  }
}

// ---------------------------------------------------------------------------
// collapse_rankset — merge nodes in a rank-constraint set
// ---------------------------------------------------------------------------

function collapse_rankset(
  graph: DotWorkingGraph,
  nodes: DotNode[],
  kind: number,
): void {
  if (nodes.length === 0) return;

  let u: DotNode = nodes[0]!;
  const rankStr = rankKindToString(kind);
  if (rankStr !== null) u.ranktype = rankStr;

  for (let i = 1; i < nodes.length; i++) {
    const v = nodes[i]!;
    u = ufUnion(u, v);
    const uRoot = ufFind(u);
    if (rankStr !== null) {
      uRoot.ranktype = rankStr;
      v.ranktype = rankStr;
    }
  }

  const leader = ufFind(u);

  switch (kind) {
    case MINRANK:
    case SOURCERANK:
      if (graph.minSetLeader == null) {
        graph.minSetLeader = leader;
      } else {
        graph.minSetLeader = ufUnion(graph.minSetLeader, leader);
        graph.minSetLeader = ufFind(graph.minSetLeader);
      }
      if (kind === SOURCERANK) {
        const minLeader = ufFind(graph.minSetLeader);
        minLeader.ranktype = 'source';
      }
      break;
    case MAXRANK:
    case SINKRANK:
      if (graph.maxSetLeader == null) {
        graph.maxSetLeader = leader;
      } else {
        graph.maxSetLeader = ufUnion(graph.maxSetLeader, leader);
        graph.maxSetLeader = ufFind(graph.maxSetLeader);
      }
      if (kind === SINKRANK) {
        const maxLeader = ufFind(graph.maxSetLeader);
        maxLeader.ranktype = 'sink';
      }
      break;
    default:
      break;
  }
}

function rankKindToString(
  kind: number,
): 'same' | 'min' | 'max' | 'source' | 'sink' | null {
  switch (kind) {
    case SAMERANK:
      return 'same';
    case MINRANK:
      return 'min';
    case SOURCERANK:
      return 'source';
    case MAXRANK:
      return 'max';
    case SINKRANK:
      return 'sink';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// collapse_sets — iterate nodes with rank attributes, call collapse_rankset
// ---------------------------------------------------------------------------

function collapse_sets(graph: DotWorkingGraph): void {
  const sameGroups = new Map<string, DotNode[]>();

  for (const n of graph.nodes) {
    if (n.ufParent === undefined) {
      n.ufParent = n;
      n.ufSize = 1;
    }
    const attr = (n as DotNode & { attributes?: { rank?: string } }).attributes
      ?.rank;
    if (attr === undefined) continue;

    const key = attr;
    const group = sameGroups.get(key) ?? [];
    group.push(n);
    sameGroups.set(key, group);
  }

  for (const [key, nodes] of sameGroups) {
    let kind: number;
    switch (key) {
      case 'same':
        kind = SAMERANK;
        break;
      case 'min':
        kind = MINRANK;
        break;
      case 'source':
        kind = SOURCERANK;
        break;
      case 'max':
        kind = MAXRANK;
        break;
      case 'sink':
        kind = SINKRANK;
        break;
      default:
        continue;
    }
    collapse_rankset(graph, nodes, kind);
  }
}

// ---------------------------------------------------------------------------
// minmax_edges — reverse edges incident to min/max sets to enforce constraints
// ---------------------------------------------------------------------------

function minmax_edges(graph: DotWorkingGraph): void {
  if (graph.minSetLeader == null && graph.maxSetLeader == null) {
    return;
  }

  if (graph.minSetLeader != null) {
    graph.minSetLeader = ufFind(graph.minSetLeader);
  }
  if (graph.maxSetLeader != null) {
    graph.maxSetLeader = ufFind(graph.maxSetLeader);
  }

  const maxLeader = graph.maxSetLeader ?? null;
  if (maxLeader != null) {
    const outEdges = graph.edges.filter(e => ufFind(e.from) === maxLeader);
    for (const e of outEdges) {
      const tmp = e.from;
      e.from = e.to;
      e.to = tmp;
      e.reversed = !e.reversed;
    }
  }

  const minLeader = graph.minSetLeader ?? null;
  if (minLeader != null) {
    const inEdges = graph.edges.filter(e => ufFind(e.to) === minLeader);
    for (const e of inEdges) {
      const tmp = e.from;
      e.from = e.to;
      e.to = tmp;
      e.reversed = !e.reversed;
    }
  }
}

// minmax_edges2 — rank.c:421-444
// Adds zero-weight constraint edges from minSetLeader to nodes with no
// in-edges, and from nodes with no out-edges to maxSetLeader.
function minmax_edges2(graph: DotWorkingGraph): void {
  const minLeader = graph.minSetLeader ? ufFind(graph.minSetLeader) : null;
  const maxLeader = graph.maxSetLeader ? ufFind(graph.maxSetLeader) : null;
  if (!minLeader && !maxLeader) return;
  const slenX = minLeader?.ranktype === 'source' ? 1 : 0;
  const slenY = maxLeader?.ranktype === 'sink'   ? 1 : 0;
  for (const n of graph.nodes) {
    if (ufFind(n) !== n) continue;
    const hasOut = graph.edges.some(e => ufFind(e.from) === n);
    const hasIn  = graph.edges.some(e => ufFind(e.to)   === n);
    if (!hasOut && maxLeader && n !== maxLeader)
      graph.edges.push({ id: `__mm2_max_${n.id}`, from: n, to: maxLeader,
                         weight: 0, minLen: slenY, reversed: false, points: [] });
    if (!hasIn && minLeader && n !== minLeader)
      graph.edges.push({ id: `__mm2_min_${n.id}`, from: minLeader, to: n,
                         weight: 0, minLen: slenX, reversed: false, points: [] });
  }
}

// ---------------------------------------------------------------------------
// Network simplex context
// ---------------------------------------------------------------------------

interface NSCtx {
  nodes: DotNode[];
  edges: DotEdge[];
  treeEdges: DotEdge[];
  S_i: number; // search index for leave_edge
  searchSize: number;
  /** per-node adjacency list for x_val computation */
  nodeEdges: WeakMap<DotNode, DotEdge[]>;
}

// ---------------------------------------------------------------------------
// Helpers: SLACK, TREE_EDGE
// ---------------------------------------------------------------------------

function edgeSlack(e: DotEdge): number {
  return e.to.rank - e.from.rank - e.minLen;
}

function isTreeEdge(e: DotEdge): boolean {
  return (e.treeIndex ?? -1) >= 0;
}

// ---------------------------------------------------------------------------
// add_tree_edge
// ---------------------------------------------------------------------------

function add_tree_edge(ctx: NSCtx, e: DotEdge): void {
  e.treeIndex = ctx.treeEdges.length;
  ctx.treeEdges.push(e);

  const tail = e.from;
  if (tail.treeOut == null) tail.treeOut = [];
  tail.treeOut.push(e);
  tail.mark = true;

  const head = e.to;
  if (head.treeIn == null) head.treeIn = [];
  head.treeIn.push(e);
  head.mark = true;
}

// ---------------------------------------------------------------------------
// exchange_tree_edges — swap leave edge e with enter edge f in the tree
// ---------------------------------------------------------------------------

function exchange_tree_edges(ctx: NSCtx, e: DotEdge, f: DotEdge): void {
  const idx = e.treeIndex!;
  f.treeIndex = idx;
  ctx.treeEdges[idx] = f;
  e.treeIndex = -1;

  const tailE = e.from;
  tailE.treeOut = (tailE.treeOut ?? []).filter(te => te !== e);

  const headE = e.to;
  headE.treeIn = (headE.treeIn ?? []).filter(te => te !== e);

  const tailF = f.from;
  if (tailF.treeOut == null) tailF.treeOut = [];
  tailF.treeOut.push(f);

  const headF = f.to;
  if (headF.treeIn == null) headF.treeIn = [];
  headF.treeIn.push(f);
}

// ---------------------------------------------------------------------------
// init_rank — topological-order rank assignment (longest path)
// ---------------------------------------------------------------------------

function init_rank(ctx: NSCtx): void {
  for (const v of ctx.nodes) {
    v.priority = 0;
    v.rank = 0;
  }
  for (const e of ctx.edges) {
    e.to.priority = (e.to.priority ?? 0) + 1;
  }

  const queue: DotNode[] = [];
  for (const v of ctx.nodes) {
    if ((v.priority ?? 0) === 0) {
      queue.push(v);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const v = queue[head++]!;
    v.rank = 0;
    for (const e of ctx.edges) {
      if (e.to === v) {
        v.rank = Math.max(v.rank, e.from.rank + e.minLen);
      }
    }
    for (const e of ctx.edges) {
      if (e.from === v) {
        const w = e.to;
        w.priority = (w.priority ?? 1) - 1;
        if ((w.priority ?? 0) <= 0) {
          queue.push(w);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Subtree union-find for feasible_tree construction
// ---------------------------------------------------------------------------

const SIZE_MAX_SENTINEL = -1;

function stSetFind(n: DotNode): Subtree {
  let s = n.subtree!;
  while (s.par !== null && s.par !== s) {
    if (s.par.par !== null) s.par = s.par.par;
    s = s.par;
  }
  return s;
}

function stSetUnion(s0: Subtree, s1: Subtree): Subtree {
  let r0 = s0;
  while (r0.par !== null && r0.par !== r0) r0 = r0.par;
  let r1 = s1;
  while (r1.par !== null && r1.par !== r1) r1 = r1.par;
  if (r0 === r1) return r0;

  const onHeap0 = r0.heapIndex !== SIZE_MAX_SENTINEL;
  const onHeap1 = r1.heapIndex !== SIZE_MAX_SENTINEL;

  let r: Subtree;
  if (!onHeap1) r = r0;
  else if (!onHeap0) r = r1;
  else if (r1.size < r0.size) r = r0;
  else r = r1;

  r0.par = r;
  r1.par = r;
  r.size = r0.size + r1.size;
  return r;
}

// ---------------------------------------------------------------------------
// tight_subtree_search — find initial tight subtrees reachable from v
// ---------------------------------------------------------------------------

function tight_subtree_search(
  ctx: NSCtx,
  startNode: DotNode,
  st: Subtree,
): number {
  interface TstState {
    v: DotNode;
    inIdx: number;
    outIdx: number;
    rv: number;
  }

  const todo: TstState[] = [{ v: startNode, inIdx: 0, outIdx: 0, rv: 1 }];
  startNode.subtree = st;
  let rv = 1;

  while (todo.length > 0) {
    const top = todo[todo.length - 1]!;
    let updated = false;

    const inEdges = ctx.edges.filter(e => e.to === top.v);
    while (top.inIdx < inEdges.length) {
      const e = inEdges[top.inIdx]!;
      top.inIdx++;
      if (isTreeEdge(e)) continue;
      const tail = e.from;
      if (tail.subtree == null && edgeSlack(e) === 0) {
        add_tree_edge(ctx, e);
        tail.subtree = st;
        todo.push({ v: tail, inIdx: 0, outIdx: 0, rv: 1 });
        updated = true;
        break;
      }
    }
    if (updated) continue;

    const outEdges = ctx.edges.filter(e => e.from === top.v);
    while (top.outIdx < outEdges.length) {
      const e = outEdges[top.outIdx]!;
      top.outIdx++;
      if (isTreeEdge(e)) continue;
      const head = e.to;
      if (head.subtree == null && edgeSlack(e) === 0) {
        add_tree_edge(ctx, e);
        head.subtree = st;
        todo.push({ v: head, inIdx: 0, outIdx: 0, rv: 1 });
        updated = true;
        break;
      }
    }
    if (updated) continue;

    const last = todo.pop()!;
    if (todo.length === 0) {
      rv = last.rv;
    } else {
      todo[todo.length - 1]!.rv += last.rv;
    }
  }

  return rv;
}

// ---------------------------------------------------------------------------
// inter_tree_edge_search — find tightest edge from tree to another component
// ---------------------------------------------------------------------------

function inter_tree_edge_search(
  ctx: NSCtx,
  startNode: DotNode,
): DotEdge | null {
  const ts = stSetFind(startNode);

  interface State {
    v: DotNode;
    from: DotNode | null;
    outIdx: number;
    inIdx: number;
  }

  const todo: State[] = [{ v: startNode, from: null, outIdx: 0, inIdx: 0 }];
  let best: DotEdge | null = null;

  while (todo.length > 0) {
    const s = todo[todo.length - 1]!;

    if (s.outIdx === 0 && s.inIdx === 0 && best !== null && edgeSlack(best) === 0) {
      todo.pop();
      continue;
    }

    let updated = false;

    const outEdges = ctx.edges.filter(e => e.from === s.v);
    while (s.outIdx < outEdges.length) {
      const e = outEdges[s.outIdx]!;
      s.outIdx++;
      if (isTreeEdge(e)) {
        if (e.to === s.from) continue;
        todo.push({ v: e.to, from: s.v, outIdx: 0, inIdx: 0 });
        updated = true;
        break;
      } else {
        if (stSetFind(e.to) !== ts) {
          const sl = edgeSlack(e);
          if (best === null || sl < edgeSlack(best)) best = e;
        }
      }
    }
    if (updated) continue;

    const inEdges = ctx.edges.filter(e => e.to === s.v);
    while (s.inIdx < inEdges.length) {
      const e = inEdges[s.inIdx]!;
      s.inIdx++;
      if (isTreeEdge(e)) {
        if (e.from === s.from) continue;
        todo.push({ v: e.from, from: s.v, outIdx: 0, inIdx: 0 });
        updated = true;
        break;
      } else {
        if (stSetFind(e.from) !== ts) {
          const sl = edgeSlack(e);
          if (best === null || sl < edgeSlack(best)) best = e;
        }
      }
    }
    if (updated) continue;

    todo.pop();
  }

  return best;
}

// ---------------------------------------------------------------------------
// tree_adjust — shift ranks of all nodes in a subtree by delta
// ---------------------------------------------------------------------------

function tree_adjust(v: DotNode, from: DotNode | null, delta: number): void {
  const stack: Array<{ v: DotNode; from: DotNode | null }> = [{ v, from }];
  while (stack.length > 0) {
    const { v: cur, from: parent } = stack.pop()!;
    cur.rank += delta;
    for (const e of cur.treeIn ?? []) {
      const w = e.from;
      if (w !== parent) stack.push({ v: w, from: cur });
    }
    for (const e of cur.treeOut ?? []) {
      const w = e.to;
      if (w !== parent) stack.push({ v: w, from: cur });
    }
  }
}

// ---------------------------------------------------------------------------
// merge_trees — connect two subtrees via entering edge e
// ---------------------------------------------------------------------------

function merge_trees(ctx: NSCtx, e: DotEdge): Subtree | null {
  const t0 = stSetFind(e.from);
  const t1 = stSetFind(e.to);

  const onHeap0 = t0.heapIndex !== SIZE_MAX_SENTINEL;

  if (!onHeap0) {
    const delta = edgeSlack(e);
    if (delta !== 0) tree_adjust(t0.rep, null, delta);
  } else {
    const delta = -edgeSlack(e);
    if (delta !== 0) tree_adjust(t1.rep, null, delta);
  }

  add_tree_edge(ctx, e);
  return stSetUnion(t0, t1);
}

// ---------------------------------------------------------------------------
// Heap operations for STheap
// ---------------------------------------------------------------------------

function stheapify(heap: Subtree[], i: number): void {
  const elt = heap;
  for (;;) {
    const left = 2 * (i + 1) - 1;
    const right = 2 * (i + 1);
    let smallest = i;
    if (left < elt.length && elt[left]!.size < elt[smallest]!.size)
      smallest = left;
    if (right < elt.length && elt[right]!.size < elt[smallest]!.size)
      smallest = right;
    if (smallest !== i) {
      const tmp = elt[i]!;
      elt[i] = elt[smallest]!;
      elt[smallest] = tmp;
      elt[i]!.heapIndex = i;
      elt[smallest]!.heapIndex = smallest;
      i = smallest;
    } else {
      break;
    }
  }
}

function stBuildHeap(trees: Subtree[]): Subtree[] {
  const heap = [...trees];
  for (let i = 0; i < heap.length; i++) {
    heap[i]!.heapIndex = i;
  }
  for (let i = Math.floor(heap.length / 2) - 1; i >= 0; i--) {
    stheapify(heap, i);
  }
  return heap;
}

function stExtractMin(heap: Subtree[]): Subtree {
  const rv = heap[0]!;
  rv.heapIndex = SIZE_MAX_SENTINEL;
  const last = heap[heap.length - 1]!;
  heap[0] = last;
  last.heapIndex = 0;
  heap.pop();
  if (heap.length > 0) stheapify(heap, 0);
  return rv;
}

// ---------------------------------------------------------------------------
// dfs_range_init — initialize DFS range attributes (par, low, lim) on tree
// ---------------------------------------------------------------------------

function dfs_range_init(root: DotNode): number {
  let lim = 0;

  interface DfsState {
    v: DotNode;
    par: DotEdge | null;
    lim: number;
    treeOutI: number;
    treeInI: number;
  }

  root.par = null;
  root.low = 1;

  const todo: DfsState[] = [
    { v: root, par: null, lim: 1, treeOutI: 0, treeInI: 0 },
  ];

  while (todo.length > 0) {
    let pushedNew = false;
    const s = todo[todo.length - 1]!;
    const treeOut = s.v.treeOut ?? [];
    const treeIn = s.v.treeIn ?? [];

    while (s.treeOutI < treeOut.length) {
      const e = treeOut[s.treeOutI]!;
      s.treeOutI++;
      if (e !== s.par) {
        const n = e.to;
        n.par = e;
        n.low = s.lim;
        todo.push({ v: n, par: e, lim: s.lim, treeOutI: 0, treeInI: 0 });
        pushedNew = true;
        break;
      }
    }
    if (pushedNew) continue;

    while (s.treeInI < treeIn.length) {
      const e = treeIn[s.treeInI]!;
      s.treeInI++;
      if (e !== s.par) {
        const n = e.from;
        n.par = e;
        n.low = s.lim;
        todo.push({ v: n, par: e, lim: s.lim, treeOutI: 0, treeInI: 0 });
        pushedNew = true;
        break;
      }
    }
    if (pushedNew) continue;

    s.v.lim = s.lim;
    lim = s.lim;
    todo.pop();
    if (todo.length > 0) {
      todo[todo.length - 1]!.lim = lim + 1;
    }
  }

  return lim + 1;
}

// ---------------------------------------------------------------------------
// dfs_range — incremental update of DFS range attributes
// ---------------------------------------------------------------------------

function dfs_range(v: DotNode, par: DotEdge | null, low: number): number {
  if (v.par === par && v.low === low) {
    return (v.lim ?? 0) + 1;
  }

  let lim = 0;

  interface DfsState {
    v: DotNode;
    par: DotEdge | null;
    lim: number;
    treeOutI: number;
    treeInI: number;
  }

  v.par = par;
  v.low = low;

  const todo: DfsState[] = [
    { v, par, lim: low, treeOutI: 0, treeInI: 0 },
  ];

  while (todo.length > 0) {
    let processedChild = false;
    const s = todo[todo.length - 1]!;
    const treeOut = s.v.treeOut ?? [];
    const treeIn = s.v.treeIn ?? [];

    while (s.treeOutI < treeOut.length) {
      const e = treeOut[s.treeOutI]!;
      s.treeOutI++;
      if (e !== s.par) {
        const n = e.to;
        if (n.par === e && n.low === s.lim) {
          s.lim = (n.lim ?? 0) + 1;
        } else {
          n.par = e;
          n.low = s.lim;
          todo.push({ v: n, par: e, lim: s.lim, treeOutI: 0, treeInI: 0 });
        }
        processedChild = true;
        break;
      }
    }
    if (processedChild) continue;

    while (s.treeInI < treeIn.length) {
      const e = treeIn[s.treeInI]!;
      s.treeInI++;
      if (e !== s.par) {
        const n = e.from;
        if (n.par === e && n.low === s.lim) {
          s.lim = (n.lim ?? 0) + 1;
        } else {
          n.par = e;
          n.low = s.lim;
          todo.push({ v: n, par: e, lim: s.lim, treeOutI: 0, treeInI: 0 });
        }
        processedChild = true;
        break;
      }
    }
    if (processedChild) continue;

    s.v.lim = s.lim;
    lim = s.lim;
    todo.pop();
    if (todo.length > 0) {
      todo[todo.length - 1]!.lim = lim + 1;
    }
  }

  return lim + 1;
}

// ---------------------------------------------------------------------------
// SEQ — range check: a <= b <= c
// ---------------------------------------------------------------------------

function SEQ(a: number, b: number, c: number): boolean {
  return a <= b && b <= c;
}

// ---------------------------------------------------------------------------
// x_val — contribution of edge e to cut value of parent tree edge,
// from the perspective of node v in direction dir
// ---------------------------------------------------------------------------

function x_val(e: DotEdge, v: DotNode, dir: number): number {
  const other = e.from === v ? e.to : e.from;
  const vLow = v.low ?? 0;
  const vLim = v.lim ?? 0;
  const otherLim = other.lim ?? 0;

  let rv: number;
  let f: number;

  if (!SEQ(vLow, otherLim, vLim)) {
    f = 1;
    rv = e.weight;
  } else {
    f = 0;
    if (isTreeEdge(e)) {
      rv = e.cutValue ?? 0;
    } else {
      rv = 0;
    }
    rv -= e.weight;
  }

  let d: number;
  if (dir > 0) {
    d = e.to === v ? 1 : -1;
  } else {
    d = e.from === v ? 1 : -1;
  }

  if (f !== 0) d = -d;
  if (d < 0) rv = -rv;
  return rv;
}

// ---------------------------------------------------------------------------
// x_cutval — compute cut value of tree edge f
// ---------------------------------------------------------------------------

function x_cutval(f: DotEdge, nodeEdges: WeakMap<DotNode, DotEdge[]>): void {
  let v: DotNode;
  let dir: number;

  // set v to the node on the side already searched (i.e., the child side)
  if (f.from.par === f) {
    v = f.from;
    dir = 1;
  } else {
    v = f.to;
    dir = -1;
  }

  let sum = 0;
  const allEdges = nodeEdges.get(v) ?? [];
  for (const e of allEdges) {
    sum += x_val(e, v, dir);
  }
  f.cutValue = sum;
}

// ---------------------------------------------------------------------------
// dfs_cutval — DFS post-order computation of cut values
// ---------------------------------------------------------------------------

function dfs_cutval(
  root: DotNode,
  nodeEdges: WeakMap<DotNode, DotEdge[]>,
): void {
  interface State {
    v: DotNode;
    par: DotEdge | null;
    outI: number;
    inI: number;
  }

  const todo: State[] = [{ v: root, par: null, outI: 0, inI: 0 }];

  while (todo.length > 0) {
    const top = todo[todo.length - 1]!;
    let updated = false;

    const treeOut = top.v.treeOut ?? [];
    while (top.outI < treeOut.length) {
      const e = treeOut[top.outI]!;
      top.outI++;
      if (e !== top.par) {
        todo.push({ v: e.to, par: e, outI: 0, inI: 0 });
        updated = true;
        break;
      }
    }
    if (updated) continue;

    const treeIn = top.v.treeIn ?? [];
    while (top.inI < treeIn.length) {
      const e = treeIn[top.inI]!;
      top.inI++;
      if (e !== top.par) {
        todo.push({ v: e.from, par: e, outI: 0, inI: 0 });
        updated = true;
        break;
      }
    }
    if (updated) continue;

    if (top.par !== null) {
      x_cutval(top.par, nodeEdges);
    }
    todo.pop();
  }
}

// ---------------------------------------------------------------------------
// init_cutvalues — initialize DFS ranges, then compute cut values
// ---------------------------------------------------------------------------

function init_cutvalues(ctx: NSCtx): void {
  if (ctx.nodes.length === 0) return;
  dfs_range_init(ctx.nodes[0]!);
  dfs_cutval(ctx.nodes[0]!, ctx.nodeEdges);
}

// ---------------------------------------------------------------------------
// feasible_tree — construct initial feasible spanning tree
// ---------------------------------------------------------------------------

function feasible_tree(ctx: NSCtx): void {
  const nodes = ctx.nodes;
  if (nodes.length === 0) return;

  for (const n of nodes) {
    n.subtree = null;
  }

  const trees: Subtree[] = [];

  for (const n of nodes) {
    if (n.subtree == null) {
      const st: Subtree = {
        rep: n,
        size: 0,
        heapIndex: 0,
        par: null,
      };
      st.par = st; // self-referential root
      st.size = tight_subtree_search(ctx, n, st);
      trees.push(st);
    }
  }

  if (trees.length === 1) {
    init_cutvalues(ctx);
    return;
  }

  const heap = stBuildHeap(trees);

  while (heap.length > 1) {
    const tree0 = stExtractMin(heap);
    const ee = inter_tree_edge_search(ctx, tree0.rep);
    if (ee == null) {
      // disconnected graph — stop merging
      break;
    }
    const merged = merge_trees(ctx, ee);
    if (merged == null) break;
    if (merged.heapIndex >= 0 && merged.heapIndex < heap.length) {
      stheapify(heap, merged.heapIndex);
    }
  }

  init_cutvalues(ctx);
}

// ---------------------------------------------------------------------------
// leave_edge — find tree edge with most-negative cut value
// ---------------------------------------------------------------------------

function leave_edge(ctx: NSCtx): DotEdge | null {
  let rv: DotEdge | null = null;
  let cnt = 0;

  const j = ctx.S_i;
  while (ctx.S_i < ctx.treeEdges.length) {
    const f = ctx.treeEdges[ctx.S_i]!;
    if ((f.cutValue ?? 0) < 0) {
      if (rv !== null) {
        if ((rv.cutValue ?? 0) > (f.cutValue ?? 0)) rv = f;
      } else {
        rv = f;
      }
      if (++cnt >= ctx.searchSize) return rv;
    }
    ctx.S_i++;
  }

  if (j > 0) {
    ctx.S_i = 0;
    while (ctx.S_i < j) {
      const f = ctx.treeEdges[ctx.S_i]!;
      if ((f.cutValue ?? 0) < 0) {
        if (rv !== null) {
          if ((rv.cutValue ?? 0) > (f.cutValue ?? 0)) rv = f;
        } else {
          rv = f;
        }
        if (++cnt >= ctx.searchSize) return rv;
      }
      ctx.S_i++;
    }
  }

  return rv;
}

// ---------------------------------------------------------------------------
// dfs_enter_outedge / dfs_enter_inedge — find min-slack non-tree edge
// crossing the cut defined by removing leave edge e
// ---------------------------------------------------------------------------

function dfs_enter_outedge(
  ctx: NSCtx,
  startNode: DotNode,
  Low: number,
  Lim: number,
): DotEdge | null {
  let Enter: DotEdge | null = null;
  let Slack = Number.MAX_SAFE_INTEGER;

  const todo: DotNode[] = [startNode];

  while (todo.length > 0) {
    const v = todo.pop()!;

    for (const e of ctx.edges.filter(ed => ed.from === v)) {
      if (!isTreeEdge(e)) {
        if (!SEQ(Low, e.to.lim ?? 0, Lim)) {
          const slack = edgeSlack(e);
          if (slack < Slack || Enter === null) {
            Enter = e;
            Slack = slack;
          }
        }
      } else if ((e.to.lim ?? 0) < (v.lim ?? 0)) {
        todo.push(e.to);
      }
    }

    if (Slack > 0) {
      for (const e of v.treeIn ?? []) {
        if ((e.from.lim ?? 0) < (v.lim ?? 0)) {
          todo.push(e.from);
        }
      }
    }
  }

  return Enter;
}

function dfs_enter_inedge(
  ctx: NSCtx,
  startNode: DotNode,
  Low: number,
  Lim: number,
): DotEdge | null {
  let Enter: DotEdge | null = null;
  let Slack = Number.MAX_SAFE_INTEGER;

  const todo: DotNode[] = [startNode];

  while (todo.length > 0) {
    const v = todo.pop()!;

    for (const e of ctx.edges.filter(ed => ed.to === v)) {
      if (!isTreeEdge(e)) {
        if (!SEQ(Low, e.from.lim ?? 0, Lim)) {
          const slack = edgeSlack(e);
          if (slack < Slack || Enter === null) {
            Enter = e;
            Slack = slack;
          }
        }
      } else if ((e.from.lim ?? 0) < (v.lim ?? 0)) {
        todo.push(e.from);
      }
    }

    if (Slack > 0) {
      for (const e of v.treeOut ?? []) {
        if ((e.to.lim ?? 0) < (v.lim ?? 0)) {
          todo.push(e.to);
        }
      }
    }
  }

  return Enter;
}

// ---------------------------------------------------------------------------
// enter_edge — find entering non-tree edge for the leave edge e
// ---------------------------------------------------------------------------

function enter_edge(ctx: NSCtx, e: DotEdge): DotEdge | null {
  const tailLim = e.from.lim ?? 0;
  const headLim = e.to.lim ?? 0;

  // v is the "down node" (deeper in the DFS tree, smaller lim = the child side).
  // Matches graphviz ns.c enter_edge:
  //   tail.lim < head.lim → v = tail, inedge (search IN-edges of tail's subtree from outside)
  //   else               → v = head, outedge (search OUT-edges of head's subtree to outside)
  if (tailLim < headLim) {
    return dfs_enter_inedge(ctx, e.from, e.from.low ?? 0, tailLim);
  } else {
    return dfs_enter_outedge(ctx, e.to, e.to.low ?? 0, headLim);
  }
}

// ---------------------------------------------------------------------------
// invalidate_path — mark DFS low = -1 on path from node to LCA
// ---------------------------------------------------------------------------

function invalidate_path(lca: DotNode, toNode: DotNode): void {
  let cur = toNode;
  while (true) {
    if ((cur.low ?? 0) === -1) break;
    cur.low = -1;

    const ep = cur.par;
    if (ep == null) break;

    const curLim = cur.lim ?? 0;
    const lcaLim = lca.lim ?? 0;
    if (curLim >= lcaLim) break;

    const tailLim = ep.from.lim ?? 0;
    const headLim = ep.to.lim ?? 0;
    cur = tailLim > headLim ? ep.from : ep.to;
  }
}

// ---------------------------------------------------------------------------
// treeupdate — walk from v to LCA(v,w), updating cut values
// ---------------------------------------------------------------------------

function treeupdate(
  v: DotNode,
  w: DotNode,
  cutvalue: number,
  dir: boolean,
): DotNode {
  const wLim = w.lim ?? 0;

  while (!SEQ(v.low ?? 0, wLim, v.lim ?? 0)) {
    const e = v.par!;
    const d = v === e.from ? dir : !dir;
    if (d) {
      e.cutValue = (e.cutValue ?? 0) + cutvalue;
    } else {
      e.cutValue = (e.cutValue ?? 0) - cutvalue;
    }
    const tailLim = e.from.lim ?? 0;
    const headLim = e.to.lim ?? 0;
    v = tailLim > headLim ? e.from : e.to;
  }
  return v;
}

// ---------------------------------------------------------------------------
// rerank — shift ranks from node v by -delta (follows tree edges)
// ---------------------------------------------------------------------------

function rerank(v: DotNode, delta: number): void {
  const stack: DotNode[] = [v];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    cur.rank -= delta;
    for (const e of cur.treeOut ?? []) {
      if (e !== cur.par) stack.push(e.to);
    }
    for (const e of cur.treeIn ?? []) {
      if (e !== cur.par) stack.push(e.from);
    }
  }
}

// ---------------------------------------------------------------------------
// update — perform a pivot: swap leave edge e with enter edge f
// ---------------------------------------------------------------------------

function update(ctx: NSCtx, e: DotEdge, f: DotEdge): void {
  const delta = edgeSlack(f);

  if (delta > 0) {
    const sTailSize =
      (e.from.treeIn ?? []).length + (e.from.treeOut ?? []).length;
    if (sTailSize === 1) {
      rerank(e.from, delta);
    } else {
      const sHeadSize =
        (e.to.treeIn ?? []).length + (e.to.treeOut ?? []).length;
      if (sHeadSize === 1) {
        rerank(e.to, -delta);
      } else {
        const tailLim = e.from.lim ?? 0;
        const headLim = e.to.lim ?? 0;
        if (tailLim < headLim) {
          rerank(e.from, delta);
        } else {
          rerank(e.to, -delta);
        }
      }
    }
  }

  const cutvalue = e.cutValue ?? 0;
  const lca = treeupdate(f.from, f.to, cutvalue, true);
  treeupdate(f.to, f.from, cutvalue, false);

  const lcaLow = lca.low ?? 0;
  invalidate_path(lca, f.to);
  invalidate_path(lca, f.from);

  f.cutValue = -cutvalue;
  e.cutValue = 0;
  exchange_tree_edges(ctx, e, f);
  dfs_range(lca, lca.par ?? null, lcaLow);
}

// ---------------------------------------------------------------------------
// scan_and_normalize — shift all ranks so minimum is 0
// ---------------------------------------------------------------------------

function scan_and_normalize(nodes: DotNode[]): void {
  if (nodes.length === 0) return;
  let minRank = Number.MAX_SAFE_INTEGER;
  for (const n of nodes) {
    if (n.rank < minRank) minRank = n.rank;
  }
  if (minRank !== 0) {
    for (const n of nodes) {
      n.rank -= minRank;
    }
  }
}

// ---------------------------------------------------------------------------
// expand_ranksets — copy leader's rank to all union-find members
// ---------------------------------------------------------------------------

function expand_ranksets(graph: DotWorkingGraph): void {
  for (const n of graph.nodes) {
    if (n.ufParent !== undefined && n.ufParent !== n) {
      const leader = ufFind(n);
      n.rank = leader.rank;
    }
  }
}

// ---------------------------------------------------------------------------
// rank1 — run network simplex on the working graph
// ---------------------------------------------------------------------------

function rank1(graph: DotWorkingGraph): void {
  const nodes = graph.nodes;
  if (nodes.length === 0) return;

  // Build per-node adjacency map for x_val computation
  const nodeEdges = new WeakMap<DotNode, DotEdge[]>();
  for (const n of nodes) {
    nodeEdges.set(n, []);
    n.treeIn = [];
    n.treeOut = [];
    n.par = null;
    n.low = 0;
    n.lim = 0;
    n.mark = false;
    n.subtree = null;
  }
  for (const e of graph.edges) {
    e.treeIndex = -1;
    e.cutValue = 0;
    nodeEdges.get(e.from)!.push(e);
    nodeEdges.get(e.to)!.push(e);
  }

  const ctx: NSCtx = {
    nodes,
    edges: graph.edges,
    treeEdges: [],
    S_i: 0,
    searchSize: SEARCHSIZE,
    nodeEdges,
  };

  // initial rank assignment (longest path / topological)
  init_rank(ctx);

  // build feasible spanning tree
  feasible_tree(ctx);

  // network simplex pivot loop
  let leaveE: DotEdge | null;
  while ((leaveE = leave_edge(ctx)) !== null) {
    const enterE = enter_edge(ctx, leaveE);
    if (enterE == null) break;
    update(ctx, leaveE, enterE);
  }

  // normalize: shift min rank to 0
  scan_and_normalize(nodes);
}

// C: TB_balance() rank.c:314-360
// Post-NS quality pass: shift equal-degree nodes toward rank midpoint.
function TB_balance(graph: DotWorkingGraph): void {
  const { nodes, edges } = graph;
  const ranks = nodes.map((n) => n.rank);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  const span = maxRank - minRank;
  if (span === 0) return;

  // Count nodes per rank for population-based tie-breaking.
  const rankPop = new Map<number, number>();
  for (const n of nodes) rankPop.set(n.rank, (rankPop.get(n.rank) ?? 0) + 1);

  for (const node of nodes) {
    // Count non-flat (cross-rank) in and out edges.
    const inDeg  = edges.filter((e) => e.to   === node && e.from.rank !== e.to.rank).length;
    const outDeg = edges.filter((e) => e.from === node && e.from.rank !== e.to.rank).length;
    if (inDeg !== outDeg) continue;

    // Only shift nodes below the diagram midpoint.
    const mid = minRank + span / 2;
    if (node.rank >= mid) continue;

    // Earliest feasible rank: max(from.rank + minLen) over all in-edges.
    const earliest = edges
      .filter((e) => e.to === node && e.from.rank < node.rank)
      .reduce((m, e) => Math.max(m, e.from.rank + e.minLen), minRank);

    // Latest feasible rank: min(to.rank - minLen) over all out-edges.
    const latest = edges
      .filter((e) => e.from === node && e.to.rank > node.rank)
      .reduce((m, e) => Math.min(m, e.to.rank - e.minLen), maxRank);

    // Shift to the least-populated rank between current+1 and latest.
    for (let r = latest; r > node.rank; r--) {
      if (r < earliest) break;
      const pop = rankPop.get(r) ?? 0;
      const curPop = rankPop.get(node.rank) ?? 0;
      if (pop < curPop) {
        rankPop.set(node.rank, curPop - 1);
        rankPop.set(r, pop + 1);
        node.rank = r;
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// assignRanks — public entry point (signature unchanged)
// ---------------------------------------------------------------------------

export function assignRanks(graph: DotWorkingGraph): void {
  if (graph.nodes.length === 0) {
    return;
  }

  // initialize union-find singletons
  for (const n of graph.nodes) {
    n.ufParent = n;
    n.ufSize = 1;
  }

  // process rank-constraint subgraphs
  collapse_sets(graph);

  // enforce min/max rank constraints via edge reversal
  minmax_edges(graph);
  minmax_edges2(graph);

  // run network simplex on the working graph
  rank1(graph);

  // propagate ranks to non-leader members of collapsed sets
  expand_ranksets(graph);

  // normalize after expand (leaders may have shifted)
  scan_and_normalize(graph.nodes);

  // C: TB_balance() rank.c:512 — post-NS rank quality improvement
  TB_balance(graph);

  // -------------------------------------------------------------------------
  // Virtual node insertion for long edges (span > 1)
  // When an edge has a label, the midpoint virtual node gets the label's
  // actual pixel dimensions so the horizontal constraint solver keeps label
  // nodes apart from siblings.  This mirrors Graphviz make_chain (class2.c:65).
  // -------------------------------------------------------------------------
  const edgesToAdd: DotEdge[] = [];
  const edgesToRemove = new Set<string>();

  for (const edge of graph.edges) {
    const span = edge.to.rank - edge.from.rank;
    if (span > 1) {
      const virtualNodes: DotNode[] = [];
      const intermediateCount = span - 1;

      // Compute midpoint rank for label node placement (Graphviz make_chain).
      const labelRank =
        edge.label !== undefined && edge.label.length > 0
          ? Math.floor((edge.from.rank + edge.to.rank) / 2)
          : -1;

      for (let i = 1; i <= intermediateCount; i++) {
        const absRank = edge.from.rank + i;
        const isLabelSlot = absRank === labelRank;
        const vnId = isLabelSlot
          ? `__ln_${edge.id}_${i}`
          : `__vn_${edge.id}_${i}`;
        const vn: DotNode = {
          id: vnId,
          // class2.c:44-46: plain virtual node gets nodeSep as reserved width;
          // label virtual node gets nodeSep (left half) + labelWidth (right half).
          width: isLabelSlot
            ? graph.nodeSep + (edge.labelWidth ?? 0)
            : graph.nodeSep,
          height: isLabelSlot ? (edge.labelHeight ?? 0) : 0,
          rank: absRank,
          order: -1,
          x: 0,
          y: 0,
          virtual: true,
        };
        if (isLabelSlot) {
          edge.labelNode = vn;
        }
        virtualNodes.push(vn);
        graph.nodes.push(vn);
      }

      edge.virtualNodes = virtualNodes;
      edgesToRemove.add(edge.id);

      const chain: DotNode[] = [edge.from, ...virtualNodes, edge.to];
      for (let i = 0; i < chain.length - 1; i++) {
        const segFrom = chain[i]!;
        const segTo = chain[i + 1]!;
        edgesToAdd.push({
          id: `__ve_${edge.id}_${i}`,
          from: segFrom,
          to: segTo,
          weight: edge.weight,
          minLen: 1,
          reversed: false,
          points: [],
        });
      }
    }
  }

  graph.longEdges = graph.edges.filter(e => edgesToRemove.has(e.id));
  graph.edges = graph.edges.filter(e => !edgesToRemove.has(e.id));
  for (const e of edgesToAdd) {
    graph.edges.push(e);
  }
}

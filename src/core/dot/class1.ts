/**
 * class1.ts — DFS edge classification + tight spanning tree construction.
 *
 * Port of graphviz lib/dotgen/class1.c (edge classification) combined with
 * the feasible-tree setup from ns.c / rank.c.
 *
 * Phase:
 *   1. DFS-classify every edge as 'tree' | 'forward' | 'back' | 'cross'.
 *   2. Build a tight spanning tree (slack = 0) by greedy BFS/union-find.
 *   3. Compute cut values on all tree edges (used by network simplex in rank.ts).
 *
 * After class1() returns:
 *   - Every edge in graph.edges has edge.type set.
 *   - Tree edges have edge.inTree = true, edge.treeIndex >= 0.
 *   - All tree edges have edge.cutValue set to a finite number.
 *
 * Internal contract: class1() resets treeIn, treeOut, par, low, lim,
 * mark, subtree on every node before delegating to helpers. Helpers
 * therefore use non-null assertions (!) on those fields — any caller
 * other than class1() must ensure the same initialisation.
 */

import type { DotWorkingGraph, DotNode, DotEdge } from './types.js';

// ---------------------------------------------------------------------------
// Node visit state for DFS
// ---------------------------------------------------------------------------

const WHITE = 0; // unvisited
const GRAY  = 1; // in current DFS stack (ancestor)
const BLACK = 2; // fully visited (finished)

// ---------------------------------------------------------------------------
// Internal tree adjacency helpers
// Precondition: node.treeOut / node.treeIn are initialised arrays (class1 guarantees this).
// ---------------------------------------------------------------------------

function addTreeEdge(e: DotEdge, treeEdges: DotEdge[]): void {
  e.inTree = true;
  e.treeIndex = treeEdges.length;
  treeEdges.push(e);
  e.from.treeOut!.push(e);
  e.to.treeIn!.push(e);
}

// ---------------------------------------------------------------------------
// DFS edge classification
//
// Classic DFS coloring: WHITE → GRAY → BLACK.
//   - Edge to WHITE node   → tree
//   - Edge to GRAY node    → back  (ancestor in current stack)
//   - Edge to BLACK node   → forward (if other is a descendant per DFS order)
//                            or cross  (otherwise)
//
// "Descendant" detection: we track DFS entry time (dfsIn). A BLACK target
// with dfsIn[target] > dfsIn[source] is a descendant → forward edge.
// ---------------------------------------------------------------------------

function classifyEdges(graph: DotWorkingGraph): void {
  const { nodes, edges } = graph;
  const color = new Map<DotNode, number>();
  const dfsIn = new Map<DotNode, number>();

  for (const n of nodes) {
    color.set(n, WHITE);
  }

  // Build adjacency list (out-edges per node) for efficient DFS
  const outEdges = new Map<DotNode, DotEdge[]>();
  for (const n of nodes) outEdges.set(n, []);
  for (const e of edges) {
    outEdges.get(e.from)!.push(e);
  }

  let timer = 0;

  // Iterative DFS to avoid call-stack overflow on large graphs
  interface DfsFrame {
    v:  DotNode;
    ei: number; // index into outEdges[v]
  }

  for (const start of nodes) {
    if (color.get(start) !== WHITE) continue;

    const stack: DfsFrame[] = [{ v: start, ei: 0 }];
    color.set(start, GRAY);
    dfsIn.set(start, timer++);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const { v } = frame;
      const vOut = outEdges.get(v)!;

      if (frame.ei < vOut.length) {
        const e = vOut[frame.ei]!;
        frame.ei++;
        const w = e.to;
        const wColor = color.get(w)!;

        if (wColor === WHITE) {
          e.type = 'tree';
          color.set(w, GRAY);
          dfsIn.set(w, timer++);
          stack.push({ v: w, ei: 0 });
        } else if (wColor === GRAY) {
          // back edge: target is an ancestor in the current stack
          e.type = 'back';
        } else {
          // BLACK: already fully visited
          // forward if w was entered after v (v → descendant)
          // cross   otherwise
          const vIn = dfsIn.get(v)!;
          const wIn = dfsIn.get(w)!;
          e.type = wIn > vIn ? 'forward' : 'cross';
        }
      } else {
        // Done with v — pop and mark finished
        color.set(v, BLACK);
        stack.pop();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Union-find for spanning-tree construction.
// Precondition: every node is registered in both comp and rank before use,
// and ufUnion is only called when ufFind(a) !== ufFind(b).
// ---------------------------------------------------------------------------

function ufFind(comp: Map<DotNode, DotNode>, n: DotNode): DotNode {
  // Walk up to the root
  let root = comp.get(n)!;
  while (root !== comp.get(root)!) {
    root = comp.get(root)!;
  }
  // Path compression: make every visited node point directly to root
  let cur = n;
  while (cur !== root) {
    const next = comp.get(cur)!;
    comp.set(cur, root);
    cur = next;
  }
  return root;
}

function ufUnion(
  comp: Map<DotNode, DotNode>,
  rank: Map<DotNode, number>,
  a: DotNode,
  b: DotNode,
): void {
  const ra = ufFind(comp, a);
  const rb = ufFind(comp, b);
  const rankA = rank.get(ra)!;
  const rankB = rank.get(rb)!;
  if (rankA < rankB) {
    comp.set(ra, rb);
  } else if (rankA > rankB) {
    comp.set(rb, ra);
  } else {
    comp.set(rb, ra);
    rank.set(ra, rankA + 1);
  }
}

// ---------------------------------------------------------------------------
// buildTightTree
//
// Greedy spanning tree from zero-slack edges, following graphviz
// feasible_tree() semantics: prefer DFS-classified tree edges first (they
// form the initial subtrees), then repeatedly add the minimum-slack edge
// connecting two different components.
// ---------------------------------------------------------------------------

function edgeSlack(e: DotEdge): number {
  return e.to.rank - e.from.rank - e.minLen;
}

function buildTightTree(
  graph: DotWorkingGraph,
  treeEdges: DotEdge[],
): void {
  const { nodes, edges } = graph;

  // Initialize union-find: each node is its own component with rank 0
  const comp = new Map<DotNode, DotNode>();
  const ufRank = new Map<DotNode, number>();
  for (const n of nodes) {
    comp.set(n, n);
    ufRank.set(n, 0);
  }

  // First pass: add all zero-slack tree-classified edges
  for (const e of edges) {
    if (e.type === 'tree' && edgeSlack(e) === 0) {
      const ra = ufFind(comp, e.from);
      const rb = ufFind(comp, e.to);
      if (ra !== rb) {
        addTreeEdge(e, treeEdges);
        ufUnion(comp, ufRank, e.from, e.to);
      }
    }
  }

  // Second pass: if graph is not yet spanned, add min-slack non-back edges
  // that connect different components.  Repeat until we cannot add more
  // (disconnected graph) or all nodes are in one tree.
  let changed = true;
  while (changed) {
    changed = false;

    let best: DotEdge | null = null;
    let bestSlack = Infinity;

    for (const e of edges) {
      if (e.inTree === true) continue;
      if (e.type === 'back') continue; // never include back edges in spanning tree

      const ra = ufFind(comp, e.from);
      const rb = ufFind(comp, e.to);
      if (ra === rb) continue; // same component

      const sl = edgeSlack(e);
      if (sl < bestSlack) {
        bestSlack = sl;
        best = e;
      }
    }

    if (best !== null) {
      addTreeEdge(best, treeEdges);
      ufUnion(comp, ufRank, best.from, best.to);
      changed = true;
    }
  }
}

// ---------------------------------------------------------------------------
// DFS range initialization (low / lim) — sets par, low, lim on spanning tree.
// Precondition: node.treeOut and node.treeIn are initialised (class1 guarantees this).
// ---------------------------------------------------------------------------

function dfsRangeInit(root: DotNode): void {
  interface Frame {
    v:        DotNode;
    par:      DotEdge | null;
    lim:      number;
    treeOutI: number;
    treeInI:  number;
  }

  root.par = null;
  root.low = 1;

  const todo: Frame[] = [{ v: root, par: null, lim: 1, treeOutI: 0, treeInI: 0 }];

  while (todo.length > 0) {
    let pushed = false;
    const s = todo[todo.length - 1]!;
    const treeOut = s.v.treeOut!;
    const treeIn = s.v.treeIn!;

    while (s.treeOutI < treeOut.length) {
      const e = treeOut[s.treeOutI]!;
      s.treeOutI++;
      if (e !== s.par) {
        const n = e.to;
        n.par = e;
        n.low = s.lim;
        todo.push({ v: n, par: e, lim: s.lim, treeOutI: 0, treeInI: 0 });
        pushed = true;
        break;
      }
    }
    if (pushed) continue;

    while (s.treeInI < treeIn.length) {
      const e = treeIn[s.treeInI]!;
      s.treeInI++;
      if (e !== s.par) {
        const n = e.from;
        n.par = e;
        n.low = s.lim;
        todo.push({ v: n, par: e, lim: s.lim, treeOutI: 0, treeInI: 0 });
        pushed = true;
        break;
      }
    }
    if (pushed) continue;

    s.v.lim = s.lim;
    const curLim = s.lim;
    todo.pop();
    if (todo.length > 0) {
      todo[todo.length - 1]!.lim = curLim + 1;
    }
  }
}

// ---------------------------------------------------------------------------
// SEQ helper
// ---------------------------------------------------------------------------

function SEQ(a: number, b: number, c: number): boolean {
  return a <= b && b <= c;
}

// ---------------------------------------------------------------------------
// x_val — contribution of edge e to cut value of the tree edge of node v
// in direction dir.  Mirrors rank.ts x_val exactly.
// Precondition: v.low and v.lim are set (class1/dfsRangeInit guarantees this).
// ---------------------------------------------------------------------------

function xVal(e: DotEdge, v: DotNode, dir: number): number {
  const other = e.from === v ? e.to : e.from;
  const vLow = v.low!;
  const vLim = v.lim!;
  const otherLim = other.lim!;

  let rv: number;
  let f: number;

  if (!SEQ(vLow, otherLim, vLim)) {
    f = 1;
    rv = e.weight;
  } else {
    f = 0;
    // Tree edge within subtree: use its cut value; non-tree edge: zero contribution.
    rv = e.inTree === true ? e.cutValue! : 0;
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
// xCutval — compute cut value for a single tree edge f.
// ---------------------------------------------------------------------------

function xCutval(
  f: DotEdge,
  nodeEdges: Map<DotNode, DotEdge[]>,
): void {
  let v: DotNode;
  let dir: number;

  if (f.from.par === f) {
    v = f.from;
    dir = 1;
  } else {
    v = f.to;
    dir = -1;
  }

  let sum = 0;
  for (const e of nodeEdges.get(v)!) {
    sum += xVal(e, v, dir);
  }
  f.cutValue = sum;
}

// ---------------------------------------------------------------------------
// dfsCutval — post-order DFS that computes cut values bottom-up.
// Precondition: node.treeOut and node.treeIn are initialised.
// ---------------------------------------------------------------------------

function dfsCutval(
  root: DotNode,
  nodeEdges: Map<DotNode, DotEdge[]>,
): void {
  interface State {
    v:    DotNode;
    par:  DotEdge | null;
    outI: number;
    inI:  number;
  }

  const todo: State[] = [{ v: root, par: null, outI: 0, inI: 0 }];

  while (todo.length > 0) {
    const top = todo[todo.length - 1]!;
    let updated = false;

    const treeOut = top.v.treeOut!;
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

    const treeIn = top.v.treeIn!;
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
      xCutval(top.par, nodeEdges);
    }
    todo.pop();
  }
}

// ---------------------------------------------------------------------------
// initCutvalues — initialize DFS ranges then compute all cut values.
// For disconnected spanning forests, processes each tree root separately.
// Precondition: nodes.length > 0 (class1 guards this).
// ---------------------------------------------------------------------------

function initCutvalues(
  nodes: DotNode[],
  allEdges: DotEdge[],
): void {
  // Build per-node adjacency list (all edges, not just tree edges)
  const nodeEdges = new Map<DotNode, DotEdge[]>();
  for (const n of nodes) nodeEdges.set(n, []);
  for (const e of allEdges) {
    nodeEdges.get(e.from)?.push(e);
    nodeEdges.get(e.to)?.push(e);
  }

  // Process each tree root.  class1 resets all pars to null before calling us;
  // dfsRangeInit sets par on children as it traverses the spanning tree.
  // The visited set ensures each node is processed exactly once across all
  // trees in the spanning forest.
  const visited = new Set<DotNode>();

  for (const n of nodes) {
    if (visited.has(n)) continue;

    // Run DFS range init from this root
    dfsRangeInit(n);

    // Mark all nodes reachable via tree edges as visited
    const stack: DotNode[] = [n];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const e of cur.treeOut!) stack.push(e.to);
      for (const e of cur.treeIn!) stack.push(e.from);
    }

    // Compute cut values bottom-up for this tree
    dfsCutval(n, nodeEdges);
  }
}

// ---------------------------------------------------------------------------
// class1 — public entry point
//
// After this function:
//   - Every edge has edge.type set to 'tree' | 'forward' | 'back' | 'cross'.
//   - Tree edges have edge.inTree = true.
//   - All tree edges have edge.cutValue set.
// ---------------------------------------------------------------------------

export function class1(graph: DotWorkingGraph): void {
  const { nodes, edges } = graph;

  // Reset tree state on all nodes and edges.
  // Helpers assume these fields are initialized — do not skip this loop.
  for (const n of nodes) {
    n.treeIn = [];
    n.treeOut = [];
    n.par = null;
    n.low = 0;
    n.lim = 0;
    n.mark = false;
    n.subtree = null;
  }
  for (const e of edges) {
    e.inTree = false;
    e.treeIndex = -1;
    e.cutValue = 0;
    delete e.type;
  }

  if (nodes.length === 0) return;

  // Phase 1: DFS edge classification
  classifyEdges(graph);

  // Phase 2: build tight spanning tree
  const treeEdges: DotEdge[] = [];
  buildTightTree(graph, treeEdges);

  // Phase 3: compute cut values on tree edges
  initCutvalues(nodes, edges);
}

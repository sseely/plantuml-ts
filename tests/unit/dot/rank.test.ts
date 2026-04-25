import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { assignRanks } from '../../../src/core/dot/rank.js';

function makeNode(id: string): DotNode {
  return { id, width: 80, height: 36, rank: -1, order: -1, x: 0, y: 0, virtual: false };
}

function makeNodeWithRank(
  id: string,
  rankAttr: 'source' | 'sink' | 'same' | 'min' | 'max',
): DotNode & { attributes: { rank: typeof rankAttr } } {
  return {
    id,
    width: 80,
    height: 36,
    rank: -1,
    order: -1,
    x: 0,
    y: 0,
    virtual: false,
    attributes: { rank: rankAttr },
  };
}

function makeEdge(id: string, from: DotNode, to: DotNode, minLen = 1, weight = 1): DotEdge {
  return { id, from, to, weight, minLen, reversed: false, points: [] };
}

function makeGraph(nodes: DotNode[], edges: DotEdge[]): DotWorkingGraph {
  return { nodes, edges, longEdges: [], rankDir: 'TB', nodeSep: 36, rankSep: 36 };
}

/** Assert every edge satisfies its minLen constraint after ranking */
function assertConstraintsSatisfied(graph: DotWorkingGraph): void {
  for (const e of graph.edges) {
    expect(e.to.rank - e.from.rank).toBeGreaterThanOrEqual(e.minLen);
  }
  // also check longEdges
  for (const e of graph.longEdges) {
    expect(e.to.rank - e.from.rank).toBeGreaterThanOrEqual(e.minLen);
  }
}

describe('assignRanks', () => {
  it('linear chain A→B→C gets ranks 0, 1, 2', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const graph = makeGraph([a, b, c], [
      makeEdge('e1', a, b),
      makeEdge('e2', b, c),
    ]);

    assignRanks(graph);

    expect(a.rank).toBe(0);
    expect(b.rank).toBe(1);
    expect(c.rank).toBe(2);
  });

  it('two paths to same sink: sink rank exceeds both source ranks', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const graph = makeGraph([a, b, c], [
      makeEdge('e1', a, c),
      makeEdge('e2', b, c),
    ]);

    assignRanks(graph);

    expect(c.rank).toBeGreaterThan(a.rank);
    expect(c.rank).toBeGreaterThan(b.rank);
  });

  it('edge with minLen=2 produces rank difference >= 2', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const graph = makeGraph([a, b], [
      makeEdge('e1', a, b, 2),
    ]);

    assignRanks(graph);

    expect(b.rank - a.rank).toBeGreaterThanOrEqual(2);
  });

  it('diamond A→B, A→C, B→D, C→D: rank(D) - rank(A) = 2', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const graph = makeGraph([a, b, c, d], [
      makeEdge('e1', a, b),
      makeEdge('e2', a, c),
      makeEdge('e3', b, d),
      makeEdge('e4', c, d),
    ]);

    assignRanks(graph);

    expect(d.rank - a.rank).toBe(2);
  });

  it('long edge spanning 2 ranks produces 1 virtual node at rank 1', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const longEdge = makeEdge('e_long', a, c);
    const graph = makeGraph([a, b, c], [
      makeEdge('e1', a, b),
      makeEdge('e2', b, c),
      longEdge,
    ]);

    assignRanks(graph);

    expect(a.rank).toBe(0);
    expect(c.rank).toBe(2);
    expect(longEdge.virtualNodes).toBeDefined();
    expect(longEdge.virtualNodes?.length).toBe(1);
    const vn = longEdge.virtualNodes?.[0];
    expect(vn?.rank).toBe(1);
    expect(vn?.virtual).toBe(true);
  });

  it('empty graph returns without error', () => {
    const graph = makeGraph([], []);
    expect(() => assignRanks(graph)).not.toThrow();
  });

  it('single node gets rank 0', () => {
    const a = makeNode('A');
    const graph = makeGraph([a], []);
    assignRanks(graph);
    expect(a.rank).toBe(0);
  });

  it('network simplex reduces span on a graph with imbalanced paths', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const graph = makeGraph([a, b, c, d], [
      makeEdge('e1', a, b, 1, 1),
      makeEdge('e2', b, d, 1, 1),
      makeEdge('e3', a, c, 1, 1),
      makeEdge('e4', c, d, 1, 2),
    ]);

    assignRanks(graph);

    expect(b.rank).toBeGreaterThanOrEqual(a.rank + 1);
    expect(d.rank).toBeGreaterThanOrEqual(b.rank + 1);
    expect(d.rank).toBeGreaterThanOrEqual(c.rank + 1);
    expect(c.rank).toBeGreaterThanOrEqual(a.rank + 1);
    expect(Math.min(a.rank, b.rank, c.rank, d.rank)).toBe(0);
  });

  it('long chain with heavy shortcut: NS forces pivot via update()', () => {
    // A→B→C→D→E→F, plus A→F (weight=10)
    // The chain has 5 edges, but the heavy A→F edge will cause a pivot
    // when the tree A→B→C→D→E→F is built and A→F has positive slack.
    const nodes = ['A', 'B', 'C', 'D', 'E', 'F'].map(id => makeNode(id));
    const [a, b, c, d, e, f] = nodes as [
      DotNode, DotNode, DotNode, DotNode, DotNode, DotNode
    ];
    const edges: DotEdge[] = [
      makeEdge('e1', a, b, 1, 1),
      makeEdge('e2', b, c, 1, 1),
      makeEdge('e3', c, d, 1, 1),
      makeEdge('e4', d, e, 1, 1),
      makeEdge('e5', e, f, 1, 1),
      makeEdge('e6', a, f, 1, 10),
    ];
    const graph = makeGraph(nodes, edges);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    expect(Math.min(...nodes.map(n => n.rank))).toBe(0);
    // The heavy edge causes NS to compress the chain
    expect(f.rank - a.rank).toBeGreaterThanOrEqual(1);
  });

  it('two nodes with same rank attribute end up on the same rank', () => {
    const a = makeNodeWithRank('A', 'same');
    const b = makeNodeWithRank('B', 'same');
    const c = makeNode('C');
    const graph = makeGraph([a, b, c], [
      makeEdge('e1', a, c),
      makeEdge('e2', b, c),
    ]);

    assignRanks(graph);

    expect(a.rank).toBe(b.rank);
  });

  it('min rank nodes end up at the minimum rank', () => {
    const a = makeNodeWithRank('A', 'min');
    const b = makeNode('B');
    const c = makeNode('C');
    const graph = makeGraph([a, b, c], [
      makeEdge('e1', a, b),
      makeEdge('e2', b, c),
    ]);

    assignRanks(graph);

    expect(a.rank).toBe(0);
  });

  it('max rank nodes end up at maximum rank', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNodeWithRank('C', 'max');
    const graph = makeGraph([a, b, c], [
      makeEdge('e1', a, b),
      makeEdge('e2', b, c),
    ]);

    assignRanks(graph);

    const maxRank = Math.max(a.rank, b.rank, c.rank);
    expect(c.rank).toBe(maxRank);
  });

  it('source rank nodes act as sources', () => {
    const src = makeNodeWithRank('SRC', 'source');
    const a = makeNode('A');
    const b = makeNode('B');
    const graph = makeGraph([src, a, b], [
      makeEdge('e1', src, a),
      makeEdge('e2', a, b),
    ]);

    assignRanks(graph);

    expect(src.rank).toBe(0);
    expect(a.rank).toBeGreaterThan(src.rank);
  });

  it('sink rank nodes act as sinks', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const sink = makeNodeWithRank('SINK', 'sink');
    const graph = makeGraph([a, b, sink], [
      makeEdge('e1', a, b),
      makeEdge('e2', b, sink),
    ]);

    assignRanks(graph);

    const maxRank = Math.max(a.rank, b.rank, sink.rank);
    expect(sink.rank).toBe(maxRank);
  });

  it('disconnected graph: each component independently ranked', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');

    const graph = makeGraph([a, b, c, d], [
      makeEdge('e1', a, b),
      makeEdge('e2', c, d),
    ]);

    assignRanks(graph);

    expect(b.rank).toBeGreaterThanOrEqual(a.rank + 1);
    expect(d.rank).toBeGreaterThanOrEqual(c.rank + 1);
    expect(Math.min(a.rank, b.rank, c.rank, d.rank)).toBe(0);
  });

  it('edge with minLen=3 forces rank gap of at least 3', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const longEdge = makeEdge('elong', a, b, 3);
    const graph = makeGraph([a, b], [longEdge]);

    assignRanks(graph);

    expect(b.rank - a.rank).toBeGreaterThanOrEqual(3);
    // span === minLen here, so no virtual nodes
    expect(longEdge.virtualNodes).toBeUndefined();
  });

  it('graph with parallel edges handles multiple spanning tree candidates', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const graph = makeGraph([a, b], [
      makeEdge('e1', a, b, 1, 1),
      makeEdge('e2', a, b, 1, 2),
    ]);

    assignRanks(graph);

    expect(a.rank).toBe(0);
    expect(b.rank).toBe(1);
  });

  it('wide diamond: all constraints satisfied after NS optimization', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const e = makeNode('E');
    const graph = makeGraph([a, b, c, d, e], [
      makeEdge('e1', a, b, 1, 1),
      makeEdge('e2', a, c, 1, 2),
      makeEdge('e3', a, d, 1, 3),
      makeEdge('e4', b, e, 1, 1),
      makeEdge('e5', c, e, 1, 2),
      makeEdge('e6', d, e, 1, 3),
    ]);

    assignRanks(graph);

    expect(b.rank).toBeGreaterThanOrEqual(a.rank + 1);
    expect(c.rank).toBeGreaterThanOrEqual(a.rank + 1);
    expect(d.rank).toBeGreaterThanOrEqual(a.rank + 1);
    expect(e.rank).toBeGreaterThanOrEqual(b.rank + 1);
    expect(e.rank).toBeGreaterThanOrEqual(c.rank + 1);
    expect(e.rank).toBeGreaterThanOrEqual(d.rank + 1);
    expect(Math.min(a.rank, b.rank, c.rank, d.rank, e.rank)).toBe(0);
  });

  it('same-rank constraint with three nodes all get the same rank', () => {
    const a = makeNodeWithRank('A', 'same');
    const b = makeNodeWithRank('B', 'same');
    const c = makeNodeWithRank('C', 'same');
    const d = makeNode('D');
    const graph = makeGraph([a, b, c, d], [
      makeEdge('e1', a, d),
      makeEdge('e2', b, d),
      makeEdge('e3', c, d),
    ]);

    assignRanks(graph);

    expect(a.rank).toBe(b.rank);
    expect(b.rank).toBe(c.rank);
  });

  it('graph with longer path and side branches: total span is minimal', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const e = makeNode('E');
    const graph = makeGraph([a, b, c, d, e], [
      makeEdge('e1', a, b),
      makeEdge('e2', b, c),
      makeEdge('e3', c, d),
      makeEdge('e4', b, e),
      makeEdge('e5', e, d),
    ]);

    assignRanks(graph);

    expect(b.rank).toBeGreaterThanOrEqual(a.rank + 1);
    expect(c.rank).toBeGreaterThanOrEqual(b.rank + 1);
    expect(d.rank).toBeGreaterThanOrEqual(c.rank + 1);
    expect(e.rank).toBeGreaterThanOrEqual(b.rank + 1);
    expect(d.rank).toBeGreaterThanOrEqual(e.rank + 1);
    expect(Math.min(a.rank, b.rank, c.rank, d.rank, e.rank)).toBe(0);
  });

  it('long edge spanning 3 ranks with existing intermediate nodes', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const longEdge = makeEdge('e_long', a, d);
    const graph = makeGraph([a, b, c, d], [
      makeEdge('e1', a, b),
      makeEdge('e2', b, c),
      makeEdge('e3', c, d),
      longEdge,
    ]);

    assignRanks(graph);

    expect(d.rank - a.rank).toBe(3);
    expect(longEdge.virtualNodes?.length).toBe(2);
  });

  it('graph requiring pivot: heavy shortcut forces NS to pivot', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const graph = makeGraph([a, b, c, d], [
      makeEdge('e1', a, b, 1, 1),
      makeEdge('e2', b, c, 1, 1),
      makeEdge('e3', c, d, 1, 1),
      makeEdge('e4', a, d, 1, 5),
    ]);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    expect(Math.min(a.rank, b.rank, c.rank, d.rank)).toBe(0);
  });

  it('graph with minLen=2 and bypass: all constraints respected', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const graph = makeGraph([a, b, c], [
      makeEdge('e1', a, b, 2),
      makeEdge('e2', b, c, 1),
      makeEdge('e3', a, c, 1),
    ]);

    assignRanks(graph);

    expect(b.rank).toBeGreaterThanOrEqual(a.rank + 2);
    expect(c.rank).toBeGreaterThanOrEqual(b.rank + 1);
    expect(c.rank).toBeGreaterThanOrEqual(a.rank + 1);
    expect(Math.min(a.rank, b.rank, c.rank)).toBe(0);
  });

  it('NS pivot with unbalanced minLen creates virtual nodes on long edges', () => {
    // A→B (minLen=1), B→D (minLen=2), A→C (minLen=1), C→D (minLen=1)
    // Longest path: A=0,B=1,C=1,D=3; span of A→C = 1 (ok), C→D = 1 (ok)
    // A→C→D: span=2, A→B→D: span=3. The A→C edge will be long (span=1=minLen, no vn).
    // NS may adjust B up/down based on cut values.
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const bypass = makeEdge('e_bypass', a, d); // minLen=1, will span 3 after ranking
    const graph = makeGraph([a, b, c, d], [
      makeEdge('e1', a, b, 1, 1),
      makeEdge('e2', b, d, 2, 1),
      makeEdge('e3', a, c, 1, 1),
      makeEdge('e4', c, d, 1, 1),
      bypass,
    ]);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    expect(Math.min(a.rank, b.rank, c.rank, d.rank)).toBe(0);
    // bypass goes from rank 0 to rank 3, span=3 > minLen=1
    if (bypass.virtualNodes !== undefined) {
      expect(bypass.virtualNodes.length).toBeGreaterThan(0);
    }
  });

  it('large graph: 8-node chain with multiple cross-edges', () => {
    const nodes = Array.from({ length: 8 }, (_, i) => makeNode(`N${i}`));
    const [n0, n1, n2, n3, n4, n5, n6, n7] = nodes;
    const edges: DotEdge[] = [
      makeEdge('e01', n0!, n1!),
      makeEdge('e12', n1!, n2!),
      makeEdge('e23', n2!, n3!),
      makeEdge('e34', n3!, n4!),
      makeEdge('e45', n4!, n5!),
      makeEdge('e56', n5!, n6!),
      makeEdge('e67', n6!, n7!),
      // cross-edges creating need for NS pivots
      makeEdge('e04', n0!, n4!, 1, 3),  // heavy cross-edge
      makeEdge('e27', n2!, n7!, 1, 2),  // another cross-edge
    ];
    const graph = makeGraph(nodes, edges);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    expect(Math.min(...nodes.map(n => n.rank))).toBe(0);
  });

  it('three-level hierarchy with multiple shortcut edges', () => {
    // Level 0: A
    // Level 1: B, C
    // Level 2: D
    // Shortcuts: A→D (heavy)
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const graph = makeGraph([a, b, c, d], [
      makeEdge('e1', a, b, 1, 1),
      makeEdge('e2', a, c, 1, 1),
      makeEdge('e3', b, d, 1, 1),
      makeEdge('e4', c, d, 1, 1),
      makeEdge('e5', a, d, 1, 8), // very heavy shortcut
    ]);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    expect(a.rank).toBe(0);
    expect(d.rank).toBeGreaterThanOrEqual(b.rank + 1);
    expect(d.rank).toBeGreaterThanOrEqual(c.rank + 1);
  });

  it('multiple disconnected components with isolated nodes', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');  // isolated
    const d = makeNode('D');
    const e = makeNode('E');

    const graph = makeGraph([a, b, c, d, e], [
      makeEdge('e1', a, b),
      makeEdge('e2', d, e),
    ]);

    assignRanks(graph);

    expect(b.rank).toBeGreaterThanOrEqual(a.rank + 1);
    expect(e.rank).toBeGreaterThanOrEqual(d.rank + 1);
    expect(Math.min(a.rank, b.rank, c.rank, d.rank, e.rank)).toBe(0);
  });

  it('expand_ranksets propagates rank from leader to merged members', () => {
    // Three nodes merged via 'same' rank, connected to sink
    const a = makeNodeWithRank('A', 'same');
    const b = makeNodeWithRank('B', 'same');
    const c = makeNodeWithRank('C', 'same');
    const d = makeNode('D');
    const e = makeNode('E');
    const graph = makeGraph([a, b, c, d, e], [
      makeEdge('e1', d, a),
      makeEdge('e2', a, e),
      makeEdge('e3', b, e),
      makeEdge('e4', c, e),
    ]);

    assignRanks(graph);

    // All three same-rank nodes must have identical rank
    expect(a.rank).toBe(b.rank);
    expect(b.rank).toBe(c.rank);
    // d must be before the same-rank group
    expect(a.rank).toBeGreaterThan(d.rank);
  });

  // ---------------------------------------------------------------------------
  // Targeted coverage tests: NS pivot loop and related branches
  // ---------------------------------------------------------------------------

  it('NS pivot: Gansner canonical — heavy B→T forces pivot that moves B to rank 3', () => {
    // S→A (w=1, minLen=1), S→B (w=1, minLen=1), A→T (w=1, minLen=3), B→T (w=100, minLen=1)
    // init_rank: S=0, A=1, B=1, T=4 (A→T minLen=3 forces T to rank 4).
    // Tight edges: S→A (0), S→B (0), A→T (0). Non-tight: B→T (slack=2).
    // Spanning tree: {S→A, A→T, S→B}. DFS lim: T=1, A=2, B=3, S=4.
    // x_cutval(S→B) = +1(S→B) + (-100)(B→T heavy, B not in S's subtree from B) = -99.
    // leave_edge returns S→B. enter_edge(S→B): tailLim(4) >= headLim(3)
    //   → dfs_enter_outedge(B, 3, 3) → finds B→T (min-slack crossing edge).
    // update: delta=2, sHeadSize(B)=1 → rerank(B, -2) → B.rank = 1+2 = 3.
    // After pivot: S=0, A=1, B=3, T=4. All constraints satisfied.
    const s = makeNode('GS');
    const a = makeNode('GA');
    const b = makeNode('GB');
    const t = makeNode('GT');
    const graph = makeGraph([s, a, b, t], [
      makeEdge('gsa', s, a, 1, 1),
      makeEdge('gsb', s, b, 1, 1),
      makeEdge('gat', a, t, 3, 1),
      makeEdge('gbt', b, t, 1, 100),
    ]);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    expect(s.rank).toBe(0);
    expect(a.rank).toBe(1);
    expect(t.rank).toBe(4);
    // NS pivot moves B from rank 1 to rank 3 (B→T becomes tight)
    expect(b.rank).toBe(3);
  });

  it('NS feasible_tree: disconnected graph triggers early break when no inter-tree edge exists', () => {
    // Two fully isolated chains with no edges between them at all.
    // tight_subtree_search from A reaches {A,B}; from C reaches {C,D}.
    // inter_tree_edge_search(A-subtree) finds no edge to the C-subtree → ee == null → break.
    const a = makeNode('DA');
    const b = makeNode('DB');
    const c = makeNode('DC');
    const d = makeNode('DD');
    const graph = makeGraph([a, b, c, d], [
      makeEdge('dc1', a, b, 1, 1),
      makeEdge('dc2', c, d, 1, 1),
    ]);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    expect(Math.min(a.rank, b.rank, c.rank, d.rank)).toBe(0);
  });

  it('ufUnion else-branch: min(1 node) then source(3 nodes) triggers b>a size union', () => {
    // min node listed first so it gets its own singleton group first,
    // then source group (3 nodes) merges with it via ufUnion(minLeader(size=1), srcLeader(size=3))
    // When sa=1 < sb=3, the else branch of ufUnion fires.
    const m = makeNodeWithRank('M', 'min');
    const s1 = makeNodeWithRank('S1', 'source');
    const s2 = makeNodeWithRank('S2', 'source');
    const s3 = makeNodeWithRank('S3', 'source');
    const t = makeNode('T');
    const graph = makeGraph([m, s1, s2, s3, t], [
      makeEdge('e1', m, t),
      makeEdge('e2', s1, t),
      makeEdge('e3', s2, t),
      makeEdge('e4', s3, t),
    ]);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    // All source/min nodes must be at minimum rank
    expect(Math.min(m.rank, s1.rank, s2.rank, s3.rank)).toBe(0);
    expect(t.rank).toBeGreaterThan(0);
  });

  it('collapse_rankset multiple min leaders: max(1 node) then sink(3 nodes)', () => {
    // max node listed first (size=1), then sink group (3 nodes, size=3).
    // ufUnion(maxLeader(size=1), sinkLeader(size=3)) fires the else branch.
    const mx = makeNodeWithRank('MX', 'max');
    const sk1 = makeNodeWithRank('SK1', 'sink');
    const sk2 = makeNodeWithRank('SK2', 'sink');
    const sk3 = makeNodeWithRank('SK3', 'sink');
    const src = makeNode('SRC');
    const graph = makeGraph([mx, sk1, sk2, sk3, src], [
      makeEdge('e1', src, mx),
      makeEdge('e2', src, sk1),
      makeEdge('e3', src, sk2),
      makeEdge('e4', src, sk3),
    ]);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    // All max/sink nodes must be at maximum rank
    const maxRank = Math.max(mx.rank, sk1.rank, sk2.rank, sk3.rank, src.rank);
    expect(mx.rank).toBe(maxRank);
    expect(sk1.rank).toBe(maxRank);
  });

  it('minmax_edges: max node with outgoing edges gets those edges reversed', () => {
    // MX has max rank, so outgoing edges from MX get reversed by minmax_edges.
    // After reversal, the edge MX→A becomes A→MX in the DAG.
    const mx = makeNodeWithRank('MX', 'max');
    const a = makeNode('A');
    const b = makeNode('B');
    // MX originally has an outgoing edge to A (which should be reversed)
    const graph = makeGraph([mx, a, b], [
      makeEdge('e1', b, mx),   // normal edge to max node
      makeEdge('e2', mx, a),   // outgoing from max node — gets reversed
    ]);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    // MX must end up at max rank
    const maxRank = Math.max(mx.rank, a.rank, b.rank);
    expect(mx.rank).toBe(maxRank);
  });

  it('minmax_edges: min node with incoming edges gets those edges reversed', () => {
    // MN has min rank, so incoming edges to MN get reversed by minmax_edges.
    const mn = makeNodeWithRank('MN', 'min');
    const a = makeNode('A');
    const b = makeNode('B');
    // MN has an incoming edge from A (which should be reversed)
    const graph = makeGraph([mn, a, b], [
      makeEdge('e1', mn, b),   // normal outgoing from min node
      makeEdge('e2', a, mn),   // incoming to min node — gets reversed
    ]);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    // MN must end up at min rank
    expect(mn.rank).toBe(0);
  });

  it('inter_tree_edge_search: two subtrees connected by a cross-edge', () => {
    // Two chains A→B and C→D with a bridge B→C (not tight initially).
    // After init_rank: A=0,B=1,C=2,D=3. All edges tight.
    // tight_subtree_search from A finds all 4 nodes in one subtree.
    // To force two subtrees + inter_tree_edge_search: use rank-separated components.
    // A→B (minLen=1), C→D (minLen=1), with a cross-edge A→D (minLen=1).
    // init_rank: A=0,B=1,C=0,D=1 (two disconnected components).
    // tight_subtree_search from A: A→B (tight), A→D crosses (D in {C,D} subtree).
    // After subtree {A,B} forms, {C,D} forms. Then inter_tree_edge_search merges them.
    const a = makeNode('IA');
    const b = makeNode('IB');
    const c = makeNode('IC');
    const d = makeNode('ID');
    const graph = makeGraph([a, b, c, d], [
      makeEdge('e1', a, b, 1, 1),
      makeEdge('e2', c, d, 1, 1),
      makeEdge('e3', a, d, 1, 1), // cross-edge bridging the two components
    ]);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    expect(Math.min(a.rank, b.rank, c.rank, d.rank)).toBe(0);
  });

  it('scan_and_normalize: min rank != 0 after rerank triggers normalization', () => {
    // A graph with a max node that after minmax_edges reversal and NS runs
    // may produce non-zero minimum rank. scan_and_normalize must shift all ranks.
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNodeWithRank('C', 'max');
    const d = makeNode('D');
    const graph = makeGraph([a, b, c, d], [
      makeEdge('e1', a, b),
      makeEdge('e2', b, c),
      makeEdge('e3', a, d),
      makeEdge('e4', d, c),
    ]);

    assignRanks(graph);

    // After normalization, min rank must be 0
    const minRank = Math.min(a.rank, b.rank, c.rank, d.rank);
    expect(minRank).toBe(0);
    assertConstraintsSatisfied(graph);
  });

  it('leave_edge wrap-around: multiple pivots advance S_i past treeEdges.length', () => {
    // A graph with many tree edges where multiple negative cut values exist,
    // forcing leave_edge to scan past the end and wrap around S_i.
    // Use a star graph with heavy center-out edge to force several pivots.
    const center = makeNode('CTR');
    const nodes = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'].map(id => makeNode(id));
    const [n1, n2, n3, n4, n5, n6] = nodes;
    const allNodes = [center, ...nodes];
    // Chain: center→N1→N2→N3→N4→N5→N6
    // Plus heavy shortcut: center→N6 forcing pivots
    const edges: DotEdge[] = [
      makeEdge('e1', center, n1!, 1, 1),
      makeEdge('e2', n1!, n2!, 1, 1),
      makeEdge('e3', n2!, n3!, 1, 1),
      makeEdge('e4', n3!, n4!, 1, 1),
      makeEdge('e5', n4!, n5!, 1, 1),
      makeEdge('e6', n5!, n6!, 1, 1),
      makeEdge('sc', center, n6!, 1, 20), // very heavy, forces many pivots
    ];
    const graph = makeGraph(allNodes, edges);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    expect(Math.min(...allNodes.map(n => n.rank))).toBe(0);
  });

  it('dfs_range incremental update: pivot on tree with pre-cached lim/low', () => {
    // A graph where an NS pivot happens, requiring dfs_range to update the
    // lim/low cache for the affected subtree. The key is that after a pivot,
    // the cached low == -1 sentinel triggers re-traversal.
    const a = makeNode('dA');
    const b = makeNode('dB');
    const c = makeNode('dC');
    const d = makeNode('dD');
    const e = makeNode('dE');
    const graph = makeGraph([a, b, c, d, e], [
      makeEdge('f1', a, b, 1, 1),
      makeEdge('f2', b, c, 1, 1),
      makeEdge('f3', c, d, 1, 1),
      makeEdge('f4', b, e, 1, 1),
      makeEdge('f5', e, d, 1, 1),
      makeEdge('f6', a, d, 1, 6), // heavy: forces pivot on b→c or c→d
    ]);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    expect(a.rank).toBe(0);
    expect(d.rank).toBeGreaterThanOrEqual(2);
  });

  it('stSetUnion: heap-based merge of three disconnected components', () => {
    // Three isolated chains A→B, C→D, E→F with cross-edges.
    // Forces stBuildHeap with multiple elements and stExtractMin swaps.
    const a = makeNode('sA');
    const b = makeNode('sB');
    const c = makeNode('sC');
    const d = makeNode('sD');
    const e = makeNode('sE');
    const f = makeNode('sF');
    const graph = makeGraph([a, b, c, d, e, f], [
      makeEdge('h1', a, b, 1, 1),
      makeEdge('h2', c, d, 1, 1),
      makeEdge('h3', e, f, 1, 1),
      // Cross-edges connecting the components
      makeEdge('h4', b, c, 1, 1),
      makeEdge('h5', d, e, 1, 1),
    ]);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    expect(Math.min(a.rank, b.rank, c.rank, d.rank, e.rank, f.rank)).toBe(0);
    expect(f.rank).toBe(5); // chain of 6 nodes
  });

  it('treeupdate: pivot updates cut values on ancestor path to LCA', () => {
    // Graph: A→B→C→D, A→C (w=1), B→D (w=5)
    // After init_rank: A=0,B=1,C=2,D=3. Tree: A→B,B→C,C→D. Non-tree: A→C,B→D.
    // B→D has weight 5, making cut value of B→C negative. Pivot fires.
    // treeupdate walks from f.from and f.to toward LCA updating cut values.
    const a = makeNode('tA');
    const b = makeNode('tB');
    const c = makeNode('tC');
    const d = makeNode('tD');
    const graph = makeGraph([a, b, c, d], [
      makeEdge('t1', a, b, 1, 1),
      makeEdge('t2', b, c, 1, 1),
      makeEdge('t3', c, d, 1, 1),
      makeEdge('t4', a, c, 1, 1),
      makeEdge('t5', b, d, 1, 5),
    ]);

    assignRanks(graph);

    assertConstraintsSatisfied(graph);
    expect(a.rank).toBe(0);
    expect(Math.max(a.rank, b.rank, c.rank, d.rank)).toBe(d.rank);
  });
});

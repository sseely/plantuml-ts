import type { DotWorkingGraph, DotNode, DotEdge } from './types.js';

let _concNodeSeq = 0;

function makeConcNode(rank: number): DotNode {
  return {
    id: `__conc_${_concNodeSeq++}`,
    width: 0,
    height: 0,
    rank,
    order: -1,
    x: 0,
    y: 0,
    virtual: true,
  };
}

function makeConcEdge(
  id: string,
  from: DotNode,
  to: DotNode,
  weight: number,
  minLen: number,
  reversed: boolean,
): DotEdge {
  return { id, from, to, weight, minLen, reversed, points: [] };
}

function edgeKey(e: DotEdge): string {
  return `${e.from.id}\0${e.to.id}`;
}

export function concentrate(graph: DotWorkingGraph): void {
  const groups = new Map<string, DotEdge[]>();
  for (const e of graph.edges) {
    const key = edgeKey(e);
    const bucket = groups.get(key);
    if (bucket !== undefined) {
      bucket.push(e);
    } else {
      groups.set(key, [e]);
    }
  }

  const toRemove = new Set<DotEdge>();
  const toAddNodes: DotNode[] = [];
  const toAddEdges: DotEdge[] = [];

  for (const [, parallel] of groups) {
    if (parallel.length < 2) continue;

    const first = parallel[0]!;
    const from = first.from;
    const to = first.to;

    const totalWeight = parallel.reduce((sum, e) => sum + e.weight, 0);
    const reversed = first.reversed;

    const concRank = Math.floor((from.rank + to.rank) / 2);
    const c = makeConcNode(concRank);
    toAddNodes.push(c);

    const minLenToC = concRank - from.rank;
    const minLenFromC = to.rank - concRank;

    toAddEdges.push(
      makeConcEdge(
        `__conc_in_${c.id}`,
        from,
        c,
        totalWeight,
        minLenToC > 0 ? minLenToC : 1,
        reversed,
      ),
    );
    toAddEdges.push(
      makeConcEdge(
        `__conc_out_${c.id}`,
        c,
        to,
        totalWeight,
        minLenFromC > 0 ? minLenFromC : 1,
        reversed,
      ),
    );

    for (const e of parallel) {
      toRemove.add(e);
    }
  }

  if (toRemove.size === 0) return;

  graph.nodes.push(...toAddNodes);
  graph.edges = graph.edges.filter((e) => !toRemove.has(e));
  graph.edges.push(...toAddEdges);
}

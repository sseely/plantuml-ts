import type { DotInputGraph, DotLayoutResult } from './dot/types.js';
import { layout as dotLayout } from './dot/index.js';
import { layout as neatoLayout } from './neato/index.js';
import { layout as fdpLayout } from './fdp/index.js';
import { layout as sfdpLayout } from './sfdp/index.js';
import { layout as twopiLayout } from './twopi/index.js';
import { layout as circoLayout } from './circo/index.js';
import { layout as osageLayout } from './osage/index.js';

export type EngineId = 'dot' | 'neato' | 'fdp' | 'sfdp' | 'twopi' | 'circo' | 'osage';

export interface TopologyMetrics {
  nodeCount: number;
  edgeCount: number;
  componentCount: number;
  /** BFS depth from the highest-degree node. */
  maxDepth: number;
  isDAG: boolean;
  /** Ratio of actual edges to maximum possible undirected edges. */
  density: number;
  /** (n - components) / e — equals 1.0 for a spanning forest, < 1 for cyclic graphs. */
  treeness: number;
  /** 2 * edgeCount / nodeCount, treating all edges as undirected. */
  avgDegree: number;
}

export function analyzeTopology(input: DotInputGraph): TopologyMetrics {
  const n = input.nodes.length;
  const e = input.edges.length;

  if (n === 0) {
    return { nodeCount: 0, edgeCount: 0, componentCount: 0, maxDepth: 0, isDAG: true, density: 0, treeness: 0, avgDegree: 0 };
  }

  const nodeIds = new Set(input.nodes.map((nd) => nd.id));

  const undirAdj = new Map<string, Set<string>>();
  const dirAdj = new Map<string, Set<string>>();
  for (const nd of input.nodes) {
    undirAdj.set(nd.id, new Set());
    dirAdj.set(nd.id, new Set());
  }
  for (const edge of input.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    undirAdj.get(edge.from)!.add(edge.to);
    undirAdj.get(edge.to)!.add(edge.from);
    dirAdj.get(edge.from)!.add(edge.to);
  }

  // Connected components via undirected BFS.
  const visited = new Set<string>();
  let componentCount = 0;
  for (const nd of input.nodes) {
    if (visited.has(nd.id)) continue;
    componentCount++;
    const queue = [nd.id];
    visited.add(nd.id);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const nb of undirAdj.get(curr)!) {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
      }
    }
  }

  // Max BFS depth from the highest-degree node.
  let rootId = input.nodes[0]!.id;
  let maxDeg = 0;
  for (const nd of input.nodes) {
    const deg = undirAdj.get(nd.id)!.size;
    if (deg > maxDeg || (deg === maxDeg && nd.id < rootId)) {
      maxDeg = deg; rootId = nd.id;
    }
  }
  let maxDepth = 0;
  {
    const seen = new Set<string>([rootId]);
    const q: [string, number][] = [[rootId, 0]];
    while (q.length > 0) {
      const [curr, d] = q.shift()!;
      if (d > maxDepth) maxDepth = d;
      for (const nb of undirAdj.get(curr)!) {
        if (!seen.has(nb)) { seen.add(nb); q.push([nb, d + 1]); }
      }
    }
  }

  // DAG check: DFS with 3-colour marking on directed edges.
  let isDAG = true;
  {
    const white = new Set<string>(input.nodes.map((nd) => nd.id));
    const gray = new Set<string>();

    const hasCycle = (id: string): boolean => {
      white.delete(id);
      gray.add(id);
      for (const next of dirAdj.get(id)!) {
        if (gray.has(next)) return true;
        if (white.has(next) && hasCycle(next)) return true;
      }
      gray.delete(id);
      return false;
    };

    for (const nd of input.nodes) {
      if (!white.has(nd.id)) continue;
      if (hasCycle(nd.id)) { isDAG = false; break; }
    }
  }

  const maxPossible = (n * (n - 1)) / 2;
  const density = maxPossible > 0 ? e / maxPossible : 0;
  const treeness = e > 0 ? (n - componentCount) / e : 0;
  const avgDegree = (2 * e) / n;

  return { nodeCount: n, edgeCount: e, componentCount, maxDepth, isDAG, density, treeness, avgDegree };
}

/**
 * Map topology metrics to the most appropriate layout engine.
 *
 * Priority order (first match wins):
 *   sfdp  — large graphs (≥ 50 nodes) benefit from multilevel coarsening
 *   osage — multiple disconnected components pack better than dot
 *   twopi — near-trees with depth ≥ 3 read naturally as radial layouts
 *   circo — low-degree cyclic graphs are ring-like
 *   dot   — clear directed hierarchy (DAG, depth ≥ 3)
 *   fdp   — medium-sized dense undirected graphs
 *   neato — everything else (flat, weakly directed, small undirected)
 */
export function selectEngine(metrics: TopologyMetrics): EngineId {
  const { nodeCount: n, componentCount, treeness, maxDepth, isDAG, avgDegree, density } = metrics;

  if (n === 0) return 'dot';
  if (n >= 50) return 'sfdp';
  if (componentCount >= 2 && n >= 4) return 'osage';
  if (treeness >= 0.85 && maxDepth >= 3) return 'twopi';
  if (avgDegree <= 2.1 && !isDAG && density >= 0.1) return 'circo';
  if (isDAG) return 'dot';
  if (n >= 15 && density >= 0.35) return 'fdp';
  return 'neato';
}

export function autoLayout(input: DotInputGraph): DotLayoutResult {
  const engine = selectEngine(analyzeTopology(input));
  switch (engine) {
    case 'neato':  return neatoLayout(input);
    case 'fdp':    return fdpLayout(input);
    case 'sfdp':   return sfdpLayout(input);
    case 'twopi':  return twopiLayout(input);
    case 'circo':  return circoLayout(input);
    case 'osage':  return osageLayout(input);
    default:       return dotLayout(input);
  }
}

import type { DotInputGraph, DotLayoutResult } from '../dot/types.js';

export interface NeatoConfig {
  /** Ideal distance scale: ideal_dist(i,j) = K * graph_distance(i,j). Default: 60 */
  K?: number;
  /** Convergence threshold: stop when max displacement in an iteration is < epsilon. Default: 0.0001 */
  epsilon?: number;
  /** Maximum iterations. Default: 200 */
  maxIter?: number;
  /** Pseudo-random seed for initial positions. Default: 42 */
  seed?: number;
}

function makeLcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function bfsDistances(start: number, n: number, adj: number[][]): number[] {
  const dist = new Array<number>(n).fill(n + 1);
  dist[start] = 0;
  const queue: number[] = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    for (const nb of adj[cur]!) {
      if (dist[nb] === n + 1) {
        dist[nb] = dist[cur]! + 1;
        queue.push(nb);
      }
    }
  }
  return dist;
}

export function layout(input: DotInputGraph, config?: NeatoConfig): DotLayoutResult {
  if (input.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const K = config?.K ?? 60;
  const epsilon = config?.epsilon ?? 0.0001;
  const maxIter = config?.maxIter ?? 200;
  const rand = makeLcg(config?.seed ?? 42);

  const n = input.nodes.length;
  const nodeIndex = new Map<string, number>(input.nodes.map((nd, i) => [nd.id, i]));

  // Build undirected adjacency list
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const edge of input.edges) {
    const u = nodeIndex.get(edge.from);
    const v = nodeIndex.get(edge.to);
    if (u !== undefined && v !== undefined && u !== v) {
      adj[u]!.push(v);
      adj[v]!.push(u);
    }
  }

  // All-pairs shortest paths via BFS; disconnected pairs get distance n+1
  const shortestPath: number[][] = Array.from({ length: n }, (_, i) => bfsDistances(i, n, adj));

  // Ideal distances and weights
  const d: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => K * shortestPath[i]![j]!),
  );

  const w: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => {
      if (i === j) return 0;
      const dij = d[i]![j]!;
      return dij > 0 ? 1 / (dij * dij) : 0;
    }),
  );

  // Initial positions: random scatter in [0, K*sqrt(n)) square
  const side = K * Math.sqrt(n);
  const x = Array.from({ length: n }, () => rand() * side);
  const y = Array.from({ length: n }, () => rand() * side);

  // Kamada-Kawai stress majorization
  for (let iter = 0; iter < maxIter; iter++) {
    let maxUpdate = 0;

    for (let m = 0; m < n; m++) {
      // Compute gradient magnitude delta_m to check convergence pre-update
      let dEdx = 0;
      let dEdy = 0;
      for (let j = 0; j < n; j++) {
        if (j === m) continue;
        const dx = x[m]! - x[j]!;
        const dy = y[m]! - y[j]!;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.0001) continue;
        const wmj = w[m]![j]!;
        const dmj = d[m]![j]!;
        const factor = wmj * (1 - dmj / dist);
        dEdx += factor * dx;
        dEdy += factor * dy;
      }
      const deltam = Math.hypot(dEdx, dEdy);
      if (deltam < epsilon) continue;

      // Single-node Kamada-Kawai update
      let numX = 0;
      let numY = 0;
      let denom = 0;
      for (let j = 0; j < n; j++) {
        if (j === m) continue;
        const dx = x[m]! - x[j]!;
        const dy = y[m]! - y[j]!;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.0001) continue;
        const wmj = w[m]![j]!;
        const dmj = d[m]![j]!;
        numX += wmj * (x[j]! + dmj * dx / dist);
        numY += wmj * (y[j]! + dmj * dy / dist);
        denom += wmj;
      }

      if (denom < 1e-12) continue;

      const newX = numX / denom;
      const newY = numY / denom;
      const update = Math.hypot(newX - x[m]!, newY - y[m]!);
      if (update > maxUpdate) maxUpdate = update;
      x[m] = newX;
      y[m] = newY;
    }

    if (maxUpdate < epsilon) break;
  }

  // Translate so min x,y (accounting for node half-sizes) >= 12
  let minX = Infinity;
  let minY = Infinity;
  for (let i = 0; i < n; i++) {
    const nd = input.nodes[i]!;
    const left = x[i]! - nd.width / 2;
    const top = y[i]! - nd.height / 2;
    if (left < minX) minX = left;
    if (top < minY) minY = top;
  }

  const offsetX = 12 - minX;
  const offsetY = 12 - minY;

  const finalNodes = input.nodes.map((nd, i) => ({
    id: nd.id,
    x: x[i]! + offsetX,
    y: y[i]! + offsetY,
    width: nd.width,
    height: nd.height,
  }));

  const centerMap = new Map<string, { x: number; y: number }>(
    finalNodes.map((nd) => [nd.id, { x: nd.x, y: nd.y }]),
  );

  const edges: DotLayoutResult['edges'] = [];
  for (const edge of input.edges) {
    const src = centerMap.get(edge.from);
    const dst = centerMap.get(edge.to);
    if (src === undefined || dst === undefined) continue;
    edges.push({
      id: edge.id,
      points: [
        { x: src.x, y: src.y },
        { x: dst.x, y: dst.y },
      ],
    });
  }

  let maxRight = 0;
  let maxBottom = 0;
  for (const nd of finalNodes) {
    const r = nd.x + nd.width / 2;
    const b = nd.y + nd.height / 2;
    if (r > maxRight) maxRight = r;
    if (b > maxBottom) maxBottom = b;
  }

  return {
    nodes: finalNodes,
    edges,
    width: maxRight + 12,
    height: maxBottom + 12,
  };
}

import type { DotInputGraph, DotLayoutResult } from '../dot/types.js';

export interface SfdpConfig {
  /** Spring constant / ideal edge length in pixels. Default: 60 */
  K?: number;
  /** Max FR iterations per level. Default: 100 */
  maxIter?: number;
  /** Number of coarsening levels. Default: auto = Math.max(1, Math.floor(Math.log2(n))) */
  levels?: number;
  /** Pseudo-random seed for initial positions. Default: 42 */
  seed?: number;
}

interface Vec2 {
  x: number;
  y: number;
}

interface WorkingNode {
  id: string;
  width: number;
  height: number;
  pos: Vec2;
  disp: Vec2;
}

/**
 * One level in the coarsening hierarchy.
 * fineIdxs[i] = list of indices into the *previous* (finer) level's nodes
 * that were contracted into supernode i.
 */
interface LevelGraph {
  nodes: WorkingNode[];
  /** adjacency: node index → list of [neighbor index, weight] */
  adj: Array<Array<[number, number]>>;
  /** fineIdxs[i] = indices into the immediately finer level's nodes */
  fineIdxs: number[][];
}

function makeLcg(seed: number): () => number {
  let s = seed;
  return (): number => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function runFR(
  nodes: WorkingNode[],
  adj: Array<Array<[number, number]>>,
  K: number,
  maxIter: number,
): void {
  const n = nodes.length;
  if (n === 0) return;
  const area = K * Math.sqrt(n);
  let t = area;

  for (let iter = 0; iter < maxIter; iter++) {
    if (t < 0.01) break;

    for (const nd of nodes) {
      nd.disp.x = 0;
      nd.disp.y = 0;
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ni = nodes[i]!;
        const nj = nodes[j]!;
        const dx = ni.pos.x - nj.pos.x;
        const dy = ni.pos.y - nj.pos.y;
        const dist = Math.max(Math.hypot(dx, dy), 0.01);
        const fr = (K * K) / dist;
        const ux = dx / dist;
        const uy = dy / dist;
        ni.disp.x += ux * fr;
        ni.disp.y += uy * fr;
        nj.disp.x -= ux * fr;
        nj.disp.y -= uy * fr;
      }
    }

    for (let u = 0; u < n; u++) {
      for (const [v, w] of adj[u]!) {
        if (v <= u) continue;
        const nu = nodes[u]!;
        const nv = nodes[v]!;
        const dx = nu.pos.x - nv.pos.x;
        const dy = nu.pos.y - nv.pos.y;
        const dist = Math.max(Math.hypot(dx, dy), 0.01);
        const fa = ((dist * dist) / K) * w;
        const ux = dx / dist;
        const uy = dy / dist;
        nu.disp.x -= ux * fa;
        nu.disp.y -= uy * fa;
        nv.disp.x += ux * fa;
        nv.disp.y += uy * fa;
      }
    }

    for (const nd of nodes) {
      const dispLen = Math.max(Math.hypot(nd.disp.x, nd.disp.y), 0.0001);
      const clamp = Math.min(dispLen, t);
      nd.pos.x += (nd.disp.x / dispLen) * clamp;
      nd.pos.y += (nd.disp.y / dispLen) * clamp;
    }

    t *= 0.9;
  }
}

/**
 * Heavy-edge matching: contract pairs of nodes into supernodes.
 * Returns null when no further reduction is possible (all nodes already singletons or n <= 4).
 */
function coarsen(finer: LevelGraph, rand: () => number): LevelGraph | null {
  const n = finer.nodes.length;
  if (n <= 4) return null;

  const matched = new Uint8Array(n);
  const supernodeOf = new Int32Array(n).fill(-1);
  const fineIdxs: number[][] = [];

  const order = shuffle(
    Array.from({ length: n }, (_, i) => i),
    rand,
  );

  for (const u of order) {
    if (matched[u]) continue;

    let bestV = -1;
    let bestW = -Infinity;
    for (const [v, w] of finer.adj[u]!) {
      if (!matched[v] && w > bestW) {
        bestW = w;
        bestV = v;
      }
    }

    if (bestV !== -1) {
      const sn = fineIdxs.length;
      matched[u] = 1;
      matched[bestV] = 1;
      supernodeOf[u] = sn;
      supernodeOf[bestV] = sn;
      fineIdxs.push([u, bestV]);
    }
  }

  for (let u = 0; u < n; u++) {
    if (supernodeOf[u] === -1) {
      supernodeOf[u] = fineIdxs.length;
      fineIdxs.push([u]);
    }
  }

  const newN = fineIdxs.length;
  if (newN === n) return null;

  const newNodes: WorkingNode[] = fineIdxs.map((memberIdxs, si) => {
    let sumX = 0;
    let sumY = 0;
    let maxW = 0;
    let maxH = 0;
    for (const idx of memberIdxs) {
      const nd = finer.nodes[idx]!;
      sumX += nd.pos.x;
      sumY += nd.pos.y;
      if (nd.width > maxW) maxW = nd.width;
      if (nd.height > maxH) maxH = nd.height;
    }
    return {
      id: `sn${si}`,
      width: maxW,
      height: maxH,
      pos: { x: sumX / memberIdxs.length, y: sumY / memberIdxs.length },
      disp: { x: 0, y: 0 },
    };
  });

  const edgeMap = new Map<string, number>();
  const newAdj: Array<Array<[number, number]>> = Array.from(
    { length: newN },
    () => [],
  );

  for (let u = 0; u < n; u++) {
    const su = supernodeOf[u]!;
    for (const [v, w] of finer.adj[u]!) {
      const sv = supernodeOf[v]!;
      if (su === sv) continue;
      const key = su < sv ? `${su}:${sv}` : `${sv}:${su}`;
      const existing = edgeMap.get(key);
      if (existing === undefined) {
        edgeMap.set(key, w);
        newAdj[su]!.push([sv, w]);
        newAdj[sv]!.push([su, w]);
      } else {
        const newW = existing + w;
        edgeMap.set(key, newW);
        const esu = newAdj[su]!.find((e) => e[0] === sv);
        const esv = newAdj[sv]!.find((e) => e[0] === su);
        if (esu) esu[1] = newW;
        if (esv) esv[1] = newW;
      }
    }
  }

  return { nodes: newNodes, adj: newAdj, fineIdxs };
}

function bfsComponents(
  n: number,
  adj: Array<Array<[number, number]>>,
): number[][] {
  const visited = new Uint8Array(n);
  const components: number[][] = [];

  for (let start = 0; start < n; start++) {
    if (visited[start]) continue;
    const comp: number[] = [];
    const queue = [start];
    visited[start] = 1;
    let head = 0;
    while (head < queue.length) {
      const u = queue[head++]!;
      comp.push(u);
      for (const [v] of adj[u]!) {
        if (!visited[v]) {
          visited[v] = 1;
          queue.push(v);
        }
      }
    }
    components.push(comp);
  }

  return components;
}

function layoutComponent(
  nodes: WorkingNode[],
  adj: Array<Array<[number, number]>>,
  K: number,
  maxIter: number,
  levels: number,
  rand: () => number,
): void {
  const n = nodes.length;

  const area = K * Math.sqrt(n);
  for (const nd of nodes) {
    nd.pos.x = (rand() - 0.5) * area;
    nd.pos.y = (rand() - 0.5) * area;
  }

  if (n <= 2) {
    runFR(nodes, adj, K, maxIter);
    return;
  }

  const base: LevelGraph = { nodes, adj, fineIdxs: nodes.map((_, i) => [i]) };
  const stack: LevelGraph[] = [base];

  let current = base;
  for (let lvl = 0; lvl < levels; lvl++) {
    const coarser = coarsen(current, rand);
    if (coarser === null) break;
    current = coarser;
    stack.push(current);
  }

  const coarsest = stack[stack.length - 1]!;
  runFR(coarsest.nodes, coarsest.adj, K, maxIter);

  for (let lvl = stack.length - 2; lvl >= 0; lvl--) {
    const coarser = stack[lvl + 1]!;
    const finer = stack[lvl]!;

    for (let sn = 0; sn < coarser.fineIdxs.length; sn++) {
      const snPos = coarser.nodes[sn]!.pos;
      for (const fineIdx of coarser.fineIdxs[sn]!) {
        finer.nodes[fineIdx]!.pos.x = snPos.x + (rand() - 0.5) * 4;
        finer.nodes[fineIdx]!.pos.y = snPos.y + (rand() - 0.5) * 4;
      }
    }

    const refineIter = Math.max(10, Math.floor(maxIter / 4));
    runFR(finer.nodes, finer.adj, K, refineIter);
  }
}

export function layout(input: DotInputGraph, config?: SfdpConfig): DotLayoutResult {
  if (input.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const K = config?.K ?? 60;
  const maxIter = config?.maxIter ?? 100;
  const n = input.nodes.length;
  const levels = config?.levels ?? Math.max(1, Math.floor(Math.log2(n)));
  const rand = makeLcg(config?.seed ?? 42);

  const nodeIdSet = new Set(input.nodes.map((nd) => nd.id));

  const workingNodes: WorkingNode[] = input.nodes.map((nd) => ({
    id: nd.id,
    width: nd.width,
    height: nd.height,
    pos: { x: 0, y: 0 },
    disp: { x: 0, y: 0 },
  }));

  const nodeIndex = new Map<string, number>(
    workingNodes.map((nd, i) => [nd.id, i]),
  );

  const validEdges = input.edges.filter(
    (e) => nodeIdSet.has(e.from) && nodeIdSet.has(e.to),
  );

  const globalAdj: Array<Array<[number, number]>> = Array.from(
    { length: n },
    () => [],
  );
  for (const e of validEdges) {
    const u = nodeIndex.get(e.from)!;
    const v = nodeIndex.get(e.to)!;
    globalAdj[u]!.push([v, 1]);
    globalAdj[v]!.push([u, 1]);
  }

  const components = bfsComponents(n, globalAdj);

  let packOffsetX = 0;

  for (const compIdxs of components) {
    const compNodes = compIdxs.map((i) => workingNodes[i]!);

    const localIdxMap = new Map<number, number>(
      compIdxs.map((globalIdx, localIdx) => [globalIdx, localIdx]),
    );

    const localAdj: Array<Array<[number, number]>> = Array.from(
      { length: compIdxs.length },
      () => [],
    );
    for (const globalU of compIdxs) {
      const localU = localIdxMap.get(globalU)!;
      for (const [globalV, w] of globalAdj[globalU]!) {
        const localV = localIdxMap.get(globalV)!;
        localAdj[localU]!.push([localV, w]);
      }
    }

    layoutComponent(compNodes, localAdj, K, maxIter, levels, rand);

    let minX = Infinity;
    for (const nd of compNodes) {
      const left = nd.pos.x - nd.width / 2;
      if (left < minX) minX = left;
    }

    for (const nd of compNodes) {
      nd.pos.x += packOffsetX - minX;
    }

    let maxRight = -Infinity;
    for (const nd of compNodes) {
      const right = nd.pos.x + nd.width / 2;
      if (right > maxRight) maxRight = right;
    }

    packOffsetX = maxRight + 40;
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const nd of workingNodes) {
    const left = nd.pos.x - nd.width / 2;
    const top = nd.pos.y - nd.height / 2;
    if (left < minX) minX = left;
    if (top < minY) minY = top;
  }

  const offsetX = 12 - minX;
  const offsetY = 12 - minY;

  const finalNodes = workingNodes.map((nd) => ({
    id: nd.id,
    x: nd.pos.x + offsetX,
    y: nd.pos.y + offsetY,
    width: nd.width,
    height: nd.height,
  }));

  const centerMap = new Map<string, Vec2>(
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

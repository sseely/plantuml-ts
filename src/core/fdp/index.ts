import type { DotInputGraph, DotLayoutResult } from '../dot/types.js';

export interface FdpConfig {
  /** Ideal edge length / spring equilibrium distance in pixels. Default: 60 */
  K?: number;
  /** Maximum iterations. Default: 500 */
  maxIter?: number;
  /** Pseudo-random seed for initial node placement. Default: 42 */
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

function makeLcg(initialSeed: number): () => number {
  let seed = initialSeed;
  return (): number => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };
}

export function layout(input: DotInputGraph, config?: FdpConfig): DotLayoutResult {
  if (input.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const K = config?.K ?? 60;
  const maxIter = config?.maxIter ?? 500;
  const rand = makeLcg(config?.seed ?? 42);

  const n = input.nodes.length;
  const area = K * Math.sqrt(n);

  const nodeIdSet = new Set(input.nodes.map((nd) => nd.id));

  const nodes: WorkingNode[] = input.nodes.map((nd) => ({
    id: nd.id,
    width: nd.width,
    height: nd.height,
    pos: {
      x: (rand() - 0.5) * area,
      y: (rand() - 0.5) * area,
    },
    disp: { x: 0, y: 0 },
  }));

  const nodeIndex = new Map<string, number>(nodes.map((nd, i) => [nd.id, i]));

  const validEdges = input.edges.filter(
    (e) => nodeIdSet.has(e.from) && nodeIdSet.has(e.to),
  );

  let t = area;

  for (let iter = 0; iter < maxIter; iter++) {
    if (t < 0.01) break;

    for (const nd of nodes) {
      nd.disp.x = 0;
      nd.disp.y = 0;
    }

    // Repulsive forces between all pairs
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

    // Attractive forces along edges
    for (const edge of validEdges) {
      const ui = nodeIndex.get(edge.from)!;
      const vi = nodeIndex.get(edge.to)!;
      const nu = nodes[ui]!;
      const nv = nodes[vi]!;
      const dx = nu.pos.x - nv.pos.x;
      const dy = nu.pos.y - nv.pos.y;
      const dist = Math.max(Math.hypot(dx, dy), 0.01);
      const fa = (dist * dist) / K;
      const ux = dx / dist;
      const uy = dy / dist;
      nu.disp.x -= ux * fa;
      nu.disp.y -= uy * fa;
      nv.disp.x += ux * fa;
      nv.disp.y += uy * fa;
    }

    // Apply displacements clamped to temperature
    for (const nd of nodes) {
      const dispLen = Math.max(Math.hypot(nd.disp.x, nd.disp.y), 0.0001);
      const clamp = Math.min(dispLen, t);
      nd.pos.x += (nd.disp.x / dispLen) * clamp;
      nd.pos.y += (nd.disp.y / dispLen) * clamp;
    }

    t *= 0.9;
  }

  // Identify nodes that participate in at least one valid edge
  const connectedIds = new Set<string>();
  for (const edge of validEdges) {
    connectedIds.add(edge.from);
    connectedIds.add(edge.to);
  }

  // Isolated nodes (no edges) are placed in a column to the right of the cluster
  // so they don't collide with the force-directed region.
  if (connectedIds.size > 0 && connectedIds.size < n) {
    let clusterMaxX = -Infinity;
    for (const nd of nodes) {
      if (connectedIds.has(nd.id)) {
        const right = nd.pos.x + nd.width / 2;
        if (right > clusterMaxX) clusterMaxX = right;
      }
    }

    const gap = K;
    let isoY = 0;
    for (const nd of nodes) {
      if (!connectedIds.has(nd.id)) {
        nd.pos.x = clusterMaxX + gap + nd.width / 2;
        nd.pos.y = isoY + nd.height / 2;
        isoY += nd.height + gap * 0.5;
      }
    }
  }

  // Translate so min x,y (accounting for half-extents) are >= 12
  let minX = Infinity;
  let minY = Infinity;
  for (const nd of nodes) {
    const left = nd.pos.x - nd.width / 2;
    const top = nd.pos.y - nd.height / 2;
    if (left < minX) minX = left;
    if (top < minY) minY = top;
  }

  const offsetX = 12 - minX;
  const offsetY = 12 - minY;

  const finalNodes = nodes.map((nd) => ({
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

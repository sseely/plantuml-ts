import type { DotInputGraph, DotLayoutResult } from '../dot/types.js';

export interface TwopiConfig {
  /** Distance between ring centers in pixels. Default: 80 */
  ranksep?: number;
  /** Root node id. Default: node with max degree (in+out edges); ties broken by lexicographic id sort */
  root?: string;
  /** Start angle in radians for ring nodes. Default: -Math.PI / 2 (top) */
  startAngle?: number;
}

interface PlacedNode {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

function selectRoot(
  nodeIds: string[],
  degreeMap: Map<string, number>,
  preferred?: string,
): string {
  if (preferred !== undefined && nodeIds.includes(preferred)) {
    return preferred;
  }
  let best = nodeIds[0]!;
  for (const id of nodeIds) {
    const d = degreeMap.get(id) ?? 0;
    const bd = degreeMap.get(best) ?? 0;
    if (d > bd || (d === bd && id < best)) {
      best = id;
    }
  }
  return best;
}

function bfs(
  rootId: string,
  adjacency: Map<string, Set<string>>,
  nodeSet: Set<string>,
): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(rootId, 0);
  const queue: string[] = [rootId];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++]!;
    const currentDist = dist.get(current)!;
    const neighbors = adjacency.get(current);
    if (neighbors === undefined) continue;
    for (const neighbor of neighbors) {
      if (!nodeSet.has(neighbor)) continue;
      if (!dist.has(neighbor)) {
        dist.set(neighbor, currentDist + 1);
        queue.push(neighbor);
      }
    }
  }
  return dist;
}

function layoutComponent(
  nodeIds: string[],
  widthMap: Map<string, number>,
  heightMap: Map<string, number>,
  adjacency: Map<string, Set<string>>,
  degreeMap: Map<string, number>,
  ranksep: number,
  startAngle: number,
  preferredRoot?: string,
): PlacedNode[] {
  const nodeSet = new Set(nodeIds);
  const rootId = selectRoot(nodeIds, degreeMap, preferredRoot);
  const dist = bfs(rootId, adjacency, nodeSet);

  // Group nodes by ring
  const rings = new Map<number, string[]>();
  for (const id of nodeIds) {
    const ring = dist.get(id) ?? Infinity;
    const r = ring === Infinity ? 0 : ring;
    const existing = rings.get(r);
    if (existing !== undefined) {
      existing.push(id);
    } else {
      rings.set(r, [id]);
    }
  }

  // Sort rings by number for determinism; sort nodes within ring lex
  const ringNumbers = [...rings.keys()].sort((a, b) => a - b);

  const placed: PlacedNode[] = [];

  for (const ring of ringNumbers) {
    const members = rings.get(ring)!.sort();
    if (ring === 0) {
      // Root (or unreachable nodes folded to ring 0)
      for (const id of members) {
        placed.push({ id, width: widthMap.get(id)!, height: heightMap.get(id)!, x: 0, y: 0 });
      }
      continue;
    }

    // Compute radius large enough so nodes on this ring don't overlap
    let sumDiameter = 0;
    for (const id of members) {
      const w = widthMap.get(id)!;
      const h = heightMap.get(id)!;
      sumDiameter += Math.max(w, h);
    }
    const minRadius = sumDiameter / (2 * Math.PI);
    const geometricRadius = ring * ranksep;
    const radius = Math.max(geometricRadius, minRadius + ranksep * 0.5);

    const count = members.length;
    for (let i = 0; i < count; i++) {
      const id = members[i]!;
      const angle = startAngle + (2 * Math.PI * i) / count;
      placed.push({
        id,
        width: widthMap.get(id)!,
        height: heightMap.get(id)!,
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      });
    }
  }

  return placed;
}

function boundingBox(nodes: PlacedNode[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const hw = n.width / 2;
    const hh = n.height / 2;
    if (n.x - hw < minX) minX = n.x - hw;
    if (n.y - hh < minY) minY = n.y - hh;
    if (n.x + hw > maxX) maxX = n.x + hw;
    if (n.y + hh > maxY) maxY = n.y + hh;
  }
  return { minX, minY, maxX, maxY };
}

export function layout(input: DotInputGraph, config?: TwopiConfig): DotLayoutResult {
  if (input.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const ranksep = config?.ranksep ?? 80;
  const startAngle = config?.startAngle ?? -Math.PI / 2;

  // Build adjacency and degree maps (undirected)
  const adjacency = new Map<string, Set<string>>();
  const degreeMap = new Map<string, number>();

  for (const node of input.nodes) {
    adjacency.set(node.id, new Set());
    degreeMap.set(node.id, 0);
  }

  const nodeIdSet = new Set(input.nodes.map((n) => n.id));

  for (const edge of input.edges) {
    if (!nodeIdSet.has(edge.from) || !nodeIdSet.has(edge.to)) continue;
    adjacency.get(edge.from)!.add(edge.to);
    adjacency.get(edge.to)!.add(edge.from);
    degreeMap.set(edge.from, degreeMap.get(edge.from)! + 1);
    degreeMap.set(edge.to, degreeMap.get(edge.to)! + 1);
  }

  const widthMap = new Map(input.nodes.map((n) => [n.id, n.width]));
  const heightMap = new Map(input.nodes.map((n) => [n.id, n.height]));

  // Find connected components via BFS on undirected graph
  const visited = new Set<string>();
  const components: string[][] = [];

  const allNodeIds = input.nodes.map((n) => n.id).sort();

  for (const startId of allNodeIds) {
    if (visited.has(startId)) continue;
    const componentDist = bfs(startId, adjacency, nodeIdSet);
    const component = [...componentDist.keys()].sort();
    for (const id of component) visited.add(id);
    components.push(component);
  }

  // Layout each component independently
  const componentLayouts: PlacedNode[][] = [];
  for (const component of components) {
    const placed = layoutComponent(
      component,
      widthMap,
      heightMap,
      adjacency,
      degreeMap,
      ranksep,
      startAngle,
      config?.root,
    );
    componentLayouts.push(placed);
  }

  // Arrange components horizontally with 40px separation
  const componentSep = 40;
  let cursorX = 0;
  const allPlaced: PlacedNode[] = [];

  for (const compNodes of componentLayouts) {
    if (compNodes.length === 0) continue;
    const box = boundingBox(compNodes);
    const shiftX = cursorX - box.minX;
    const shiftY = -box.minY;
    const shifted = compNodes.map((n) => ({ ...n, x: n.x + shiftX, y: n.y + shiftY }));
    allPlaced.push(...shifted);
    const newBox = boundingBox(shifted);
    cursorX = newBox.maxX + componentSep;
  }

  // Translate all nodes so minX and minY are both >= 12
  const globalBox = boundingBox(allPlaced);
  const offsetX = 12 - globalBox.minX;
  const offsetY = 12 - globalBox.minY;

  const finalNodes = allPlaced.map((n) => ({
    id: n.id,
    x: n.x + offsetX,
    y: n.y + offsetY,
    width: n.width,
    height: n.height,
  }));

  // Build node center map for edge routing
  const centerMap = new Map<string, { x: number; y: number }>();
  for (const n of finalNodes) {
    centerMap.set(n.id, { x: n.x, y: n.y });
  }

  // Edges: 2 points from source center to dest center; skip edges with unknown endpoints
  const edges: Array<{ id: string; points: Array<{ x: number; y: number }> }> = [];
  for (const edge of input.edges) {
    const src = centerMap.get(edge.from);
    const dst = centerMap.get(edge.to);
    if (src === undefined || dst === undefined) continue;
    edges.push({ id: edge.id, points: [{ x: src.x, y: src.y }, { x: dst.x, y: dst.y }] });
  }

  // Total bounds
  let maxX = 0;
  let maxY = 0;
  for (const n of finalNodes) {
    const hw = n.width / 2;
    const hh = n.height / 2;
    if (n.x + hw > maxX) maxX = n.x + hw;
    if (n.y + hh > maxY) maxY = n.y + hh;
  }

  return {
    nodes: finalNodes,
    edges,
    width: maxX + 12,
    height: maxY + 12,
  };
}

import type { DotInputGraph, DotLayoutResult } from '../dot/types.js';

export interface CircoConfig {
  /** Minimum arc gap (pixels) between adjacent node boundaries on the circle. Default: 30 */
  mindist?: number;
}

interface PlacedNode {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

function buildAdjacency(
  nodes: DotInputGraph['nodes'],
  edges: DotInputGraph['edges'],
): { adjacency: Map<string, Set<string>>; degreeMap: Map<string, number> } {
  const adjacency = new Map<string, Set<string>>();
  const degreeMap = new Map<string, number>();
  const nodeIdSet = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    adjacency.set(node.id, new Set());
    degreeMap.set(node.id, 0);
  }

  for (const edge of edges) {
    if (!nodeIdSet.has(edge.from) || !nodeIdSet.has(edge.to)) continue;
    adjacency.get(edge.from)!.add(edge.to);
    adjacency.get(edge.to)!.add(edge.from);
    degreeMap.set(edge.from, (degreeMap.get(edge.from) ?? 0) + 1);
    degreeMap.set(edge.to, (degreeMap.get(edge.to) ?? 0) + 1);
  }

  return { adjacency, degreeMap };
}

function findComponents(
  nodeIds: string[],
  adjacency: Map<string, Set<string>>,
): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];
  const sorted = [...nodeIds].sort();

  for (const startId of sorted) {
    if (visited.has(startId)) continue;
    const component: string[] = [];
    const queue: string[] = [startId];
    visited.add(startId);
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++]!;
      component.push(current);
      const neighbors = adjacency.get(current);
      if (neighbors === undefined) continue;
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  return components;
}

function bfsOrder(
  startId: string,
  componentIds: string[],
  adjacency: Map<string, Set<string>>,
): string[] {
  const componentSet = new Set(componentIds);
  const visited = new Set<string>();
  const order: string[] = [];
  const queue: string[] = [startId];
  visited.add(startId);
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++]!;
    order.push(current);
    const neighbors = adjacency.get(current);
    if (neighbors === undefined) continue;
    const sortedNeighbors = [...(neighbors ?? [])].filter((n) => componentSet.has(n)).sort();
    for (const neighbor of sortedNeighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return order;
}

function layoutComponent(
  componentIds: string[],
  widthMap: Map<string, number>,
  heightMap: Map<string, number>,
  adjacency: Map<string, Set<string>>,
  degreeMap: Map<string, number>,
  mindist: number,
): PlacedNode[] {
  if (componentIds.length === 1) {
    const id = componentIds[0]!;
    return [{ id, width: widthMap.get(id)!, height: heightMap.get(id)!, x: 0, y: 0 }];
  }

  // Select the highest-degree node as BFS root; ties broken by lex id
  let rootId = componentIds[0]!;
  for (const id of componentIds) {
    const d = degreeMap.get(id) ?? 0;
    const bd = degreeMap.get(rootId) ?? 0;
    if (d > bd || (d === bd && id < rootId)) {
      rootId = id;
    }
  }

  const orderedIds = bfsOrder(rootId, componentIds, adjacency);

  // Compute circumference and radius
  let circumference = 0;
  for (const id of orderedIds) {
    const w = widthMap.get(id)!;
    const h = heightMap.get(id)!;
    circumference += Math.max(w, h) + mindist;
  }

  const radius = circumference / (2 * Math.PI);

  // Place nodes around the circle
  const placed: PlacedNode[] = [];
  let cumArc = 0;

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]!;
    const angle = -Math.PI / 2 + 2 * Math.PI * (cumArc / circumference);
    placed.push({
      id,
      width: widthMap.get(id)!,
      height: heightMap.get(id)!,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
    const w = widthMap.get(id)!;
    const h = heightMap.get(id)!;
    cumArc += Math.max(w, h) + mindist;
  }

  return placed;
}

function boundingBox(
  nodes: PlacedNode[],
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const hw = Math.max(n.width, n.height) / 2;
    if (n.x - hw < minX) minX = n.x - hw;
    if (n.y - hw < minY) minY = n.y - hw;
    if (n.x + hw > maxX) maxX = n.x + hw;
    if (n.y + hw > maxY) maxY = n.y + hw;
  }
  return { minX, minY, maxX, maxY };
}

export function layout(input: DotInputGraph, config?: CircoConfig): DotLayoutResult {
  if (input.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const mindist = config?.mindist ?? 30;

  const { adjacency, degreeMap } = buildAdjacency(input.nodes, input.edges);

  const widthMap = new Map(input.nodes.map((n) => [n.id, n.width]));
  const heightMap = new Map(input.nodes.map((n) => [n.id, n.height]));

  const nodeIds = input.nodes.map((n) => n.id);
  const components = findComponents(nodeIds, adjacency);

  const componentLayouts: PlacedNode[][] = [];
  for (const component of components) {
    const placed = layoutComponent(component, widthMap, heightMap, adjacency, degreeMap, mindist);
    componentLayouts.push(placed);
  }

  // Pack components horizontally with 40px separation
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

  // Build center map for edge routing
  const centerMap = new Map<string, { x: number; y: number }>();
  for (const n of finalNodes) {
    centerMap.set(n.id, { x: n.x, y: n.y });
  }

  // Edges: 2 points; skip edges with unknown endpoints
  const edges: Array<{ id: string; points: Array<{ x: number; y: number }> }> = [];
  for (const edge of input.edges) {
    const src = centerMap.get(edge.from);
    const dst = centerMap.get(edge.to);
    if (src === undefined || dst === undefined) continue;
    edges.push({ id: edge.id, points: [{ x: src.x, y: src.y }, { x: dst.x, y: dst.y }] });
  }

  // Total bounds from node edges (x ± w/2, y ± h/2)
  let maxRight = 0;
  let maxBottom = 0;
  for (const n of finalNodes) {
    const r = n.x + n.width / 2;
    const b = n.y + n.height / 2;
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

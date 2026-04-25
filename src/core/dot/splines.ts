import type { DotWorkingGraph, DotEdge, DotNode } from './types.js';

type Point = { x: number; y: number };

function exitPoint(node: DotNode, rankDir: DotWorkingGraph['rankDir']): Point {
  if (rankDir === 'LR') {
    return { x: node.x + node.width, y: node.y + node.height / 2 };
  }
  if (rankDir === 'RL') {
    return { x: node.x, y: node.y + node.height / 2 };
  }
  if (rankDir === 'BT') {
    return { x: node.x + node.width / 2, y: node.y };
  }
  return { x: node.x + node.width / 2, y: node.y + node.height };
}

function entryPoint(node: DotNode, rankDir: DotWorkingGraph['rankDir']): Point {
  if (rankDir === 'LR') {
    return { x: node.x, y: node.y + node.height / 2 };
  }
  if (rankDir === 'RL') {
    return { x: node.x + node.width, y: node.y + node.height / 2 };
  }
  if (rankDir === 'BT') {
    return { x: node.x + node.width / 2, y: node.y + node.height };
  }
  return { x: node.x + node.width / 2, y: node.y };
}

function center(node: DotNode): Point {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

function smoothPolyline(waypoints: Point[]): Point[] {
  if (waypoints.length <= 2) return waypoints;

  const result: Point[] = [waypoints[0]!];
  for (let i = 1; i < waypoints.length - 1; i++) {
    const curr = waypoints[i]!;
    const next = waypoints[i + 1]!;
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    result.push({ x: midX, y: midY });
  }
  result.push(waypoints[waypoints.length - 1]!);
  return result;
}

function routeSelfLoop(edge: DotEdge): void {
  const node = edge.from;
  const start: Point = { x: node.x + node.width, y: node.y + node.height / 2 };
  const cp1: Point = { x: node.x + node.width + 30, y: node.y + node.height / 2 };
  const cp2: Point = { x: node.x + node.width + 30, y: node.y - 10 };
  const end: Point = { x: node.x + node.width / 2, y: node.y };
  edge.points = [start, cp1, cp2, end];
}

const PARALLEL_OFFSET = 40;

function routeShortEdge(
  edge: DotEdge,
  rankDir: DotWorkingGraph['rankDir'],
): void {
  const start = exitPoint(edge.from, rankDir);
  const end = entryPoint(edge.to, rankDir);
  edge.points = [start, end];
}

function routeParallelEdge(
  edge: DotEdge,
  rankDir: DotWorkingGraph['rankDir'],
  idx: number,
  total: number,
): void {
  const start = exitPoint(edge.from, rankDir);
  const end = entryPoint(edge.to, rankDir);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular unit vector (rotate 90°)
  const perpX = -dy / len;
  const perpY = dx / len;
  // Symmetric offsets: edges spread evenly around the straight-line midpoint
  const offset = (idx - (total - 1) / 2) * PARALLEL_OFFSET;
  const midX = (start.x + end.x) / 2 + perpX * offset;
  const midY = (start.y + end.y) / 2 + perpY * offset;
  edge.points = [start, { x: midX, y: midY }, end];
}

function routeLongEdge(
  edge: DotEdge,
  rankDir: DotWorkingGraph['rankDir'],
): void {
  const virtualNodes = edge.virtualNodes!;
  const waypoints: Point[] = [
    exitPoint(edge.from, rankDir),
    ...virtualNodes.map(center),
    entryPoint(edge.to, rankDir),
  ];
  edge.points = smoothPolyline(waypoints);
}

/**
 * Axis-aligned bounding box for a node, used by channel-based edge routing
 * to avoid routing edges through node interiors.
 *
 * Ported from graphviz dotsplines.c `maximal_bbox()` (simplified for
 * PlantUML's symmetric nodes where lw=rw=width/2 and ht1=ht2=height/2).
 */
export type ObstaclePolygon = {
  /** Left edge of the obstacle bounding box (node.x). */
  x: number;
  /** Top edge of the obstacle bounding box (node.y). */
  y: number;
  /** Total width of the bounding box (node.width). */
  width: number;
  /** Total height of the bounding box (node.height). */
  height: number;
};

/**
 * Build obstacle polygons for all real (non-virtual) nodes in the layout.
 *
 * Virtual nodes (width === 0 && height === 0) are dummy waypoints inserted
 * during long-edge splitting — they carry no geometry and must be excluded
 * so that edge routing does not treat them as obstructions.
 *
 * Simplified from graphviz `maximal_bbox()`: for symmetric nodes the FUDGE
 * expansion, cluster-hull, and neighbour-adjacency adjustments collapse to
 * a plain node bbox.
 */
export function buildObstaclePolygons(nodes: DotNode[]): ObstaclePolygon[] {
  const polygons: ObstaclePolygon[] = [];
  for (const node of nodes) {
    if (node.width === 0 && node.height === 0) continue;
    polygons.push({
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    });
  }
  return polygons;
}

export function routeEdges(graph: DotWorkingGraph): void {
  const { rankDir } = graph;

  // Count parallel short edges that share the same (from.id → to.id) pair after
  // acyclic reversal so they can be fanned out rather than overlapping.
  const parallelCount = new Map<string, number>();
  const parallelIdx = new Map<DotEdge, number>();
  for (const edge of graph.edges) {
    if (edge.from.virtual || edge.to.virtual) continue;
    if (edge.from.id === edge.to.id) continue;
    const key = `${edge.from.id}→${edge.to.id}`;
    const idx = parallelCount.get(key) ?? 0;
    parallelIdx.set(edge, idx);
    parallelCount.set(key, idx + 1);
  }

  for (const edge of graph.edges) {
    if (edge.from.virtual || edge.to.virtual) continue;

    if (edge.from.id === edge.to.id) {
      routeSelfLoop(edge);
    } else {
      const key = `${edge.from.id}→${edge.to.id}`;
      const total = parallelCount.get(key) ?? 1;
      if (total > 1) {
        routeParallelEdge(edge, rankDir, parallelIdx.get(edge) ?? 0, total);
      } else {
        routeShortEdge(edge, rankDir);
      }
    }

    if (edge.reversed) {
      edge.points = edge.points.slice().reverse();
    }
  }

  // Long edges were removed from graph.edges and stored in graph.longEdges.
  // Route them through their virtual node positions now that coordinates are set.
  for (const edge of graph.longEdges) {
    routeLongEdge(edge, rankDir);
    if (edge.reversed) {
      edge.points = edge.points.slice().reverse();
    }
  }
}

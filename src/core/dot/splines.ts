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

// Returns the point at fractional position t ∈ (0,1) along a node's exit or
// entry face. For TB: exit=bottom face, entry=top face, t varies x.
// For LR: exit=right face, entry=left face, t varies y.
function spreadFacePoint(
  node: DotNode,
  rankDir: DotWorkingGraph['rankDir'],
  face: 'exit' | 'entry',
  t: number,
): Point {
  if (rankDir === 'LR') {
    const x = face === 'exit' ? node.x + node.width : node.x;
    return { x, y: node.y + t * node.height };
  }
  if (rankDir === 'RL') {
    const x = face === 'exit' ? node.x : node.x + node.width;
    return { x, y: node.y + t * node.height };
  }
  if (rankDir === 'BT') {
    const y = face === 'exit' ? node.y : node.y + node.height;
    return { x: node.x + t * node.width, y };
  }
  // TB (default)
  const y = face === 'exit' ? node.y + node.height : node.y;
  return { x: node.x + t * node.width, y };
}

// Sort key for ordering edges at a node face: the transverse center of the
// neighboring real node (or nearest virtual node for long edges).
function neighborSortKey(
  edge: DotEdge,
  face: 'exit' | 'entry',
  rankDir: DotWorkingGraph['rankDir'],
): number {
  let neighbor: DotNode;
  if (face === 'exit') {
    neighbor =
      edge.virtualNodes && edge.virtualNodes.length > 0
        ? edge.virtualNodes[0]!
        : edge.to;
  } else {
    neighbor =
      edge.virtualNodes && edge.virtualNodes.length > 0
        ? edge.virtualNodes[edge.virtualNodes.length - 1]!
        : edge.from;
  }
  if (rankDir === 'TB' || rankDir === 'BT') {
    return neighbor.x + neighbor.width / 2;
  }
  return neighbor.y + neighbor.height / 2;
}

// Precomputes spread entry/exit points for every real edge (short + long).
// Groups edges by the real node they touch, sorts by neighbor position, and
// distributes at t = (i+1)/(n+1) so arrows fan across the face rather than
// all converging at center.
function computeSpreadPoints(
  shortEdges: DotEdge[],
  longEdges: DotEdge[],
  rankDir: DotWorkingGraph['rankDir'],
): Map<DotEdge, { start: Point; end: Point }> {
  const allReal = [...shortEdges, ...longEdges];
  const result = new Map<DotEdge, { start: Point; end: Point }>();

  // Seed every edge with center-based defaults
  for (const edge of allReal) {
    result.set(edge, {
      start: exitPoint(edge.from, rankDir),
      end: entryPoint(edge.to, rankDir),
    });
  }

  // Spread exit faces
  const exitGroups = new Map<string, DotEdge[]>();
  for (const edge of allReal) {
    const id = edge.from.id;
    const group = exitGroups.get(id) ?? [];
    group.push(edge);
    exitGroups.set(id, group);
  }
  for (const group of exitGroups.values()) {
    if (group.length < 2) continue;
    group.sort(
      (a, b) =>
        neighborSortKey(a, 'exit', rankDir) -
        neighborSortKey(b, 'exit', rankDir),
    );
    const n = group.length;
    for (let i = 0; i < n; i++) {
      const edge = group[i]!;
      const t = (i + 1) / (n + 1);
      const existing = result.get(edge)!;
      result.set(edge, {
        start: spreadFacePoint(edge.from, rankDir, 'exit', t),
        end: existing.end,
      });
    }
  }

  // Spread entry faces
  const entryGroups = new Map<string, DotEdge[]>();
  for (const edge of allReal) {
    const id = edge.to.id;
    const group = entryGroups.get(id) ?? [];
    group.push(edge);
    entryGroups.set(id, group);
  }
  for (const group of entryGroups.values()) {
    if (group.length < 2) continue;
    group.sort(
      (a, b) =>
        neighborSortKey(a, 'entry', rankDir) -
        neighborSortKey(b, 'entry', rankDir),
    );
    const n = group.length;
    for (let i = 0; i < n; i++) {
      const edge = group[i]!;
      const t = (i + 1) / (n + 1);
      const existing = result.get(edge)!;
      result.set(edge, {
        start: existing.start,
        end: spreadFacePoint(edge.to, rankDir, 'entry', t),
      });
    }
  }

  return result;
}

export function routeEdges(graph: DotWorkingGraph): void {
  const { rankDir } = graph;

  const shortRealEdges = graph.edges.filter(
    e => !e.from.virtual && !e.to.virtual && e.from.id !== e.to.id,
  );
  const spreadPoints = computeSpreadPoints(
    shortRealEdges,
    graph.longEdges,
    rankDir,
  );

  for (const edge of graph.edges) {
    if (edge.from.virtual || edge.to.virtual) continue;

    if (edge.from.id === edge.to.id) {
      routeSelfLoop(edge);
    } else {
      const sp = spreadPoints.get(edge)!;
      edge.points = [sp.start, sp.end];
    }

    if (edge.reversed) {
      edge.points = edge.points.slice().reverse();
    }
  }

  for (const edge of graph.longEdges) {
    const sp = spreadPoints.get(edge)!;
    const waypoints: Point[] = [
      sp.start,
      ...edge.virtualNodes!.map(center),
      sp.end,
    ];
    edge.points = smoothPolyline(waypoints);
    if (edge.reversed) {
      edge.points = edge.points.slice().reverse();
    }
  }
}

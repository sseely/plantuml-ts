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

function routeShortEdge(
  edge: DotEdge,
  rankDir: DotWorkingGraph['rankDir'],
): void {
  const start = exitPoint(edge.from, rankDir);
  const end = entryPoint(edge.to, rankDir);
  edge.points = [start, end];
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

export function routeEdges(graph: DotWorkingGraph): void {
  const { rankDir } = graph;

  for (const edge of graph.edges) {
    if (edge.from.virtual || edge.to.virtual) continue;

    if (edge.from.id === edge.to.id) {
      routeSelfLoop(edge);
    } else {
      routeShortEdge(edge, rankDir);
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

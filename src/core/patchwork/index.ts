import type { DotInputGraph, DotLayoutResult } from '../dot/types.js';

export interface PatchworkConfig {
  /** Target layout aspect ratio (width / height). Default: 1.4 */
  aspectRatio?: number;
  /** Gap between tiles in pixels. Default: 4 */
  gap?: number;
}

interface Item {
  id: string;
  area: number;
}

interface Tile {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function worst(row: Item[], side: number): number {
  const rowArea = row.reduce((s, it) => s + it.area, 0);
  let max = 0;
  for (const it of row) {
    const tileLen = (it.area / rowArea) * side;
    const otherLen = rowArea / side;
    const r = tileLen > otherLen ? tileLen / otherLen : otherLen / tileLen;
    if (r > max) max = r;
  }
  return max;
}

function layoutRow(
  row: Item[],
  x: number,
  y: number,
  w: number,
  h: number,
  tiles: Tile[],
): { x: number; y: number; w: number; h: number } {
  const rowArea = row.reduce((s, it) => s + it.area, 0);
  if (w <= h) {
    const rowH = rowArea / w;
    let cx = x;
    for (const it of row) {
      const tileW = (it.area / rowArea) * w;
      tiles.push({ id: it.id, x: cx, y, w: tileW, h: rowH });
      cx += tileW;
    }
    return { x, y: y + rowH, w, h: h - rowH };
  } else {
    const rowW = rowArea / h;
    let cy = y;
    for (const it of row) {
      const tileH = (it.area / rowArea) * h;
      tiles.push({ id: it.id, x, y: cy, w: rowW, h: tileH });
      cy += tileH;
    }
    return { x: x + rowW, y, w: w - rowW, h };
  }
}

function squarify(
  items: Item[],
  x: number,
  y: number,
  w: number,
  h: number,
  tiles: Tile[],
): void {
  if (items.length === 0) return;
  if (items.length === 1) {
    layoutRow(items, x, y, w, h, tiles);
    return;
  }

  let row: Item[] = [];
  let remaining = { x, y, w, h };
  let idx = 0;

  while (idx < items.length) {
    const item = items[idx]!;
    const side = Math.min(remaining.w, remaining.h);
    const candidate = [...row, item];

    if (row.length === 0 || worst(candidate, side) <= worst(row, side)) {
      row = candidate;
      idx++;
    } else {
      remaining = layoutRow(row, remaining.x, remaining.y, remaining.w, remaining.h, tiles);
      row = [];
    }
  }

  if (row.length > 0) {
    layoutRow(row, remaining.x, remaining.y, remaining.w, remaining.h, tiles);
  }
}

export function layout(input: DotInputGraph, config?: PatchworkConfig): DotLayoutResult {
  if (input.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const aspectRatio = config?.aspectRatio ?? 1.4;
  const gap = config?.gap ?? 4;

  const items: Item[] = input.nodes
    .map((n) => ({ id: n.id, area: n.width * n.height }))
    .sort((a, b) => b.area - a.area);

  const totalArea = items.reduce((s, it) => s + it.area, 0);
  const targetW = Math.sqrt(totalArea * aspectRatio);
  const targetH = totalArea / targetW;

  const tiles: Tile[] = [];
  squarify(items, 0, 0, targetW, targetH, tiles);

  const half = gap / 2;
  const outputNodes = tiles.map((t) => ({
    id: t.id,
    x: t.x + half,
    y: t.y + half,
    width: Math.max(0, t.w - gap),
    height: Math.max(0, t.h - gap),
  }));

  const nodeCenter = new Map<string, { x: number; y: number }>();
  for (const t of tiles) {
    nodeCenter.set(t.id, { x: t.x + t.w / 2, y: t.y + t.h / 2 });
  }

  const outputEdges = [];
  for (const edge of input.edges) {
    const src = nodeCenter.get(edge.from);
    const dst = nodeCenter.get(edge.to);
    if (src === undefined || dst === undefined) continue;
    outputEdges.push({ id: edge.id, points: [src, dst] });
  }

  return {
    nodes: outputNodes,
    edges: outputEdges,
    width: targetW + 12,
    height: targetH + 12,
  };
}

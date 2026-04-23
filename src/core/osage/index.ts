import type { DotInputGraph, DotLayoutResult } from '../dot/types.js';
import { layout as dotLayout } from '../dot/index.js';

export interface OsageConfig {
  /** Separation between packed components in pixels. Default: 40 */
  sep?: number;
}

interface Component {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  result: DotLayoutResult;
}

function findComponents(input: DotInputGraph): Array<{ nodeIds: Set<string>; edgeIds: Set<string> }> {
  const parent = new Map<string, string>();

  function find(id: string): string {
    let root = id;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    let cur = id;
    while (cur !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    parent.set(find(a), find(b));
  }

  for (const node of input.nodes) {
    parent.set(node.id, node.id);
  }

  for (const edge of input.edges) {
    if (parent.has(edge.from) && parent.has(edge.to)) {
      union(edge.from, edge.to);
    }
  }

  const groups = new Map<string, Set<string>>();
  for (const node of input.nodes) {
    const root = find(node.id);
    const group = groups.get(root) ?? new Set<string>();
    group.add(node.id);
    groups.set(root, group);
  }

  const edgeGroups = new Map<string, Set<string>>();
  for (const edge of input.edges) {
    if (!parent.has(edge.from) || !parent.has(edge.to)) continue;
    const root = find(edge.from);
    const group = edgeGroups.get(root) ?? new Set<string>();
    group.add(edge.id);
    edgeGroups.set(root, group);
  }

  return [...groups.entries()].map(([root, nodeIds]) => ({
    nodeIds,
    edgeIds: edgeGroups.get(root) ?? new Set<string>(),
  }));
}

interface PackedComponent {
  result: DotLayoutResult;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  offsetX: number;
  offsetY: number;
}

function packComponents(
  components: Component[],
  sep: number,
): PackedComponent[] {
  if (components.length === 0) return [];

  const sorted = [...components].sort((a, b) => b.result.height - a.result.height);

  const totalWidth = sorted.reduce((s, c) => s + c.result.width, 0);
  const avgWidth = totalWidth / sorted.length;
  const cols = Math.ceil(Math.sqrt(sorted.length));
  const targetRowWidth = cols * avgWidth;

  const packed: PackedComponent[] = [];
  let rowX = 0;
  let rowY = 0;
  let rowMaxH = 0;

  for (const comp of sorted) {
    if (rowX > 0 && rowX + comp.result.width > targetRowWidth) {
      rowY += rowMaxH + sep;
      rowX = 0;
      rowMaxH = 0;
    }

    packed.push({
      result: comp.result,
      nodeIds: comp.nodeIds,
      edgeIds: comp.edgeIds,
      offsetX: rowX,
      offsetY: rowY,
    });

    rowX += comp.result.width + sep;
    if (comp.result.height > rowMaxH) rowMaxH = comp.result.height;
  }

  return packed;
}

export function layout(input: DotInputGraph, config?: OsageConfig): DotLayoutResult {
  if (input.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const sep = config?.sep ?? 40;

  const componentDefs = findComponents(input);

  const nodeById = new Map(input.nodes.map((n) => [n.id, n]));
  const edgeById = new Map(input.edges.map((e) => [e.id, e]));

  const components: Component[] = componentDefs.map((def) => {
    const subNodes = [...def.nodeIds].map((id) => nodeById.get(id)!);
    const subEdges = [...def.edgeIds].map((id) => edgeById.get(id)!);
    const subGraph: DotInputGraph = {
      nodes: subNodes,
      edges: subEdges,
      ...(input.rankDir !== undefined ? { rankDir: input.rankDir } : {}),
      ...(input.nodeSep !== undefined ? { nodeSep: input.nodeSep } : {}),
      ...(input.rankSep !== undefined ? { rankSep: input.rankSep } : {}),
    };
    return {
      nodeIds: def.nodeIds,
      edgeIds: def.edgeIds,
      result: dotLayout(subGraph),
    };
  });

  const packed = packComponents(components, sep);

  const nodeIdToComponent = new Map<string, PackedComponent>();
  for (const pc of packed) {
    for (const id of pc.nodeIds) {
      nodeIdToComponent.set(id, pc);
    }
  }

  const rawNodes = packed.flatMap((pc) =>
    pc.result.nodes.map((n) => ({
      id: n.id,
      x: n.x + pc.offsetX,
      y: n.y + pc.offsetY,
      width: n.width,
      height: n.height,
    })),
  );

  let minX = Infinity;
  let minY = Infinity;
  for (const n of rawNodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
  }

  const margin = 12;
  const shiftX = margin - minX;
  const shiftY = margin - minY;

  const outputNodes = rawNodes.map((n) => ({
    id: n.id,
    x: n.x + shiftX,
    y: n.y + shiftY,
    width: n.width,
    height: n.height,
  }));

  const nodeCenter = new Map<string, { x: number; y: number }>();
  for (const n of outputNodes) {
    nodeCenter.set(n.id, { x: n.x + n.width / 2, y: n.y + n.height / 2 });
  }

  const intraEdges = packed.flatMap((pc) =>
    pc.result.edges.map((e) => ({
      id: e.id,
      points: e.points.map((p) => ({
        x: p.x + pc.offsetX + shiftX,
        y: p.y + pc.offsetY + shiftY,
      })),
    })),
  );

  const intraEdgeIds = new Set(intraEdges.map((e) => e.id));

  const crossEdges = input.edges
    .filter((e) => !intraEdgeIds.has(e.id))
    .filter((e) => nodeCenter.has(e.from) && nodeCenter.has(e.to))
    .map((e) => ({
      id: e.id,
      points: [nodeCenter.get(e.from)!, nodeCenter.get(e.to)!],
    }));

  const outputEdges = [...intraEdges, ...crossEdges];

  let maxRight = 0;
  let maxBottom = 0;
  for (const n of outputNodes) {
    const r = n.x + n.width;
    const b = n.y + n.height;
    if (r > maxRight) maxRight = r;
    if (b > maxBottom) maxBottom = b;
  }

  return {
    nodes: outputNodes,
    edges: outputEdges,
    width: maxRight + margin,
    height: maxBottom + margin,
  };
}

/**
 * Oracle DOT-parity helpers (DOT-level, normalized).
 *
 * Both sides are reduced to one model by the SAME parser: the oracle's
 * `svek-*.dot` is parsed directly; our `DotInputGraph` is first run through the
 * Svek emitter (`toSvekDot`) and then parsed — so the comparison exercises the
 * emitter and is genuinely apples-to-apples. Synthetic ids/colors are ignored;
 * we compare graph attrs, node count + shape multiset, edge topology + minlen +
 * label presence, and cluster membership. `width`/`height` are tolerant metrics
 * (Java vs plantuml-ts text measurement) — reported, not asserted.
 *
 * Svek DOT is graphviz-emitter-regular, so focused regexes suffice rather than a
 * full DOT grammar. Clusters use a brace-stack scan that normalizes Svek's
 * protection nesting (clusterNp0/clusterN/clusterNp1) to the logical `clusterN`.
 */
import type { DotInputGraph } from '../../src/core/graph-layout.js';
import { toSvekDot } from '../../src/core/svek-dot-emit.js';

export interface StructuralNode {
  id: string;
  shape: string;
  width: number; // inches
  height: number;
}
export interface StructuralEdge {
  from: string;
  to: string;
  minlen: number;
  hasLabel: boolean;
  hasTailLabel: boolean;
  hasHeadLabel: boolean;
}
export interface StructuralCluster {
  memberCount: number;
  labelW: number | undefined;
  labelH: number | undefined;
}
export interface StructuralGraph {
  nodes: StructuralNode[];
  edges: StructuralEdge[];
  clusters: StructuralCluster[];
  nodesep: number | undefined;
  ranksep: number | undefined;
  remincross: boolean;
  searchsize: number | undefined;
  rankdir: string | undefined;
}

const attr = (attrs: string, name: string): string | undefined =>
  new RegExp(`\\b${name}=([0-9.]+)`).exec(attrs)?.[1];

const numAttr = (dot: string, name: string): number | undefined => {
  const v = new RegExp(`(?:^|\\n|\\s)${name}=([0-9.]+)`).exec(dot)?.[1];
  return v === undefined ? undefined : Number(v);
};

/** Node shape, normalizing `shape=rect,style=rounded` to `rounded`. */
function nodeShape(attrs: string): string {
  const shape = /\bshape=(\w+)/.exec(attrs)?.[1] ?? 'rect';
  return shape === 'rect' && /\bstyle=rounded\b/.test(attrs) ? 'rounded' : shape;
}

function parseEdges(dot: string): StructuralEdge[] {
  const edges: StructuralEdge[] = [];
  const edgeRe = /(\w+)(?::\w+)?\s*->\s*(\w+)(?::\w+)?\s*\[([^\]]*)\]/g;
  for (let m = edgeRe.exec(dot); m !== null; m = edgeRe.exec(dot)) {
    const a = m[3]!;
    edges.push({
      from: m[1]!,
      to: m[2]!,
      minlen: Number(attr(a, 'minlen') ?? '1'),
      hasLabel: /(?:^|,)label=</.test(a),
      hasTailLabel: /taillabel=</.test(a),
      hasHeadLabel: /headlabel=</.test(a),
    });
  }
  return edges;
}

function parseNodes(dot: string): StructuralNode[] {
  // Drop edge spans first so an edge's `[...]` is never reparsed as a node.
  const withoutEdges = dot.replace(/(\w+)(?::\w+)?\s*->\s*(\w+)(?::\w+)?\s*\[[^\]]*\]/g, '');
  const nodes: StructuralNode[] = [];
  const nodeRe = /(\w+)\s*\[(shape=[^\]]*)\]/g;
  for (let m = nodeRe.exec(withoutEdges); m !== null; m = nodeRe.exec(withoutEdges)) {
    const a = m[2]!;
    nodes.push({
      id: m[1]!,
      shape: nodeShape(a),
      width: Number(attr(a, 'width') ?? '0'),
      height: Number(attr(a, 'height') ?? '0'),
    });
  }
  return nodes;
}

interface ClusterFrame {
  name: string;
  members: Set<string>;
  labelW: number | undefined;
  labelH: number | undefined;
}

/** Brace-stack scan: logical clusters are subgraphs named exactly `clusterN`
 *  (Svek's protection wrappers clusterNp0/p1/a/i are skipped); a cluster's
 *  members are all leaf node ids in its subtree; its label is its title TABLE. */
function parseClusters(dot: string): StructuralCluster[] {
  const tokenRe =
    /subgraph\s+(\w+)\s*\{|(\})|label=<<TABLE[^>]*?WIDTH="(\d+)"\s+HEIGHT="(\d+)"|(\w+)\s*\[shape=/g;
  const stack: ClusterFrame[] = [];
  const out: StructuralCluster[] = [];
  for (let m = tokenRe.exec(dot); m !== null; m = tokenRe.exec(dot)) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) {
      stack.push({ name: m[1], members: new Set(), labelW: undefined, labelH: undefined });
    } else if (m[2] !== undefined) {
      const f = stack.pop();
      if (f === undefined) continue;
      const parent = stack[stack.length - 1];
      if (parent !== undefined) for (const id of f.members) parent.members.add(id);
      if (/^cluster\d+$/.test(f.name)) {
        out.push({ memberCount: f.members.size, labelW: f.labelW, labelH: f.labelH });
      }
    } else if (m[3] !== undefined) {
      if (top !== undefined && top.labelW === undefined) {
        top.labelW = Number(m[3]);
        top.labelH = Number(m[4]);
      }
    } else if (m[5] !== undefined && top !== undefined) {
      top.members.add(m[5]);
    }
  }
  return out;
}

/** Parse Svek DOT (oracle or our own emission) into the structural model. */
export function parseSvekDot(dot: string): StructuralGraph {
  return {
    nodes: parseNodes(dot),
    edges: parseEdges(dot),
    clusters: parseClusters(dot),
    nodesep: numAttr(dot, 'nodesep'),
    ranksep: numAttr(dot, 'ranksep'),
    remincross: /remincross=true/.test(dot),
    searchsize: numAttr(dot, 'searchsize'),
    rankdir: /rankdir=(\w+)/.exec(dot)?.[1],
  };
}

/** Project plantuml-ts's layout input through the emitter, then parse — so the
 *  candidate model is exactly what our Svek DOT says (and the emitter is tested). */
export function dotInputToStructural(input: DotInputGraph): StructuralGraph {
  return parseSvekDot(toSvekDot(input));
}

/** Sorted undirected degree multiset — an id-agnostic topology signature. */
export function degreeSequence(g: StructuralGraph): number[] {
  const deg = new Map<string, number>();
  for (const n of g.nodes) deg.set(n.id, 0);
  for (const e of g.edges) {
    deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
    deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
  }
  return [...deg.values()].sort((a, b) => a - b);
}

const eqNum = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);
const eqStr = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const sortedShapes = (g: StructuralGraph): string[] => g.nodes.map((n) => n.shape).sort();
const sortedMinlens = (g: StructuralGraph): number[] => g.edges.map((e) => e.minlen).sort((a, b) => a - b);
const labelCounts = (g: StructuralGraph): [number, number, number] => [
  g.edges.filter((e) => e.hasLabel).length,
  g.edges.filter((e) => e.hasTailLabel).length,
  g.edges.filter((e) => e.hasHeadLabel).length,
];
const sortedClusterSizes = (g: StructuralGraph): number[] =>
  g.clusters.map((c) => c.memberCount).sort((a, b) => a - b);

/** Epsilon for numeric graph-attr comparisons: both sides print 6-decimal inches. */
const NUM_ATTR_EPSILON = 1e-6;

/** absent==absent equal; absent vs present mismatch; else numeric within epsilon. */
function numAttrOk(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return Math.abs(a - b) < NUM_ATTR_EPSILON;
}

/** rankdir: textual equality; absent==absent equal (svek omits it for the TB
 *  default — do NOT treat absent as equal to the literal string "TB"). */
function rankdirOk(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a === b;
}

export interface StructuralDiff {
  nodeCountOk: boolean;
  edgeCountOk: boolean;
  degreeOk: boolean;
  minlenOk: boolean;
  shapeOk: boolean;
  labelOk: boolean;
  clusterOk: boolean;
  /** rankdir: textual equality; absent==absent equal; absent vs present mismatches. */
  rankdirOk: boolean;
  /** nodesep: numeric equality (epsilon 1e-6); absent==absent equal. */
  nodesepOk: boolean;
  /** ranksep: numeric equality (epsilon 1e-6); absent==absent equal. */
  ranksepOk: boolean;
  /** All structural checks hold — the DOT-level parity bar (ids/colors/sizes excluded). */
  structurallyEqual: boolean;
  oracle: { nodes: number; edges: number; degree: number[]; clusters: number };
  candidate: { nodes: number; edges: number; degree: number[]; clusters: number };
  /** Tolerant metric note: largest single node-dimension delta (inches). */
  maxSizeDeltaIn: number;
  /** Tolerant metric note: median single node-dimension delta (inches). */
  medianSizeDeltaIn: number;
  attrs: {
    oracle: [number | undefined, number | undefined];
    candidate: [number | undefined, number | undefined];
  };
}

/** Sorted, paired per-index abs deltas of node width+height (inches), same
 *  pairing logic used by both maxSizeDelta and medianSizeDelta. */
function sizeDeltas(oracle: StructuralGraph, candidate: StructuralGraph): number[] {
  const sizes = (g: StructuralGraph): number[] =>
    [...g.nodes.map((n) => n.width), ...g.nodes.map((n) => n.height)].sort((a, b) => a - b);
  const os = sizes(oracle);
  const cs = sizes(candidate);
  const deltas: number[] = [];
  for (let i = 0; i < Math.min(os.length, cs.length); i++) {
    deltas.push(Math.abs(os[i]! - cs[i]!));
  }
  return deltas;
}

function maxSizeDelta(oracle: StructuralGraph, candidate: StructuralGraph): number {
  const deltas = sizeDeltas(oracle, candidate);
  return deltas.length === 0 ? 0 : Math.max(...deltas);
}

function medianSizeDelta(oracle: StructuralGraph, candidate: StructuralGraph): number {
  const deltas = sizeDeltas(oracle, candidate).sort((a, b) => a - b);
  if (deltas.length === 0) return 0;
  const mid = Math.floor(deltas.length / 2);
  return deltas.length % 2 === 0 ? (deltas[mid - 1]! + deltas[mid]!) / 2 : deltas[mid]!;
}

export function compareStructural(
  oracle: StructuralGraph,
  candidate: StructuralGraph,
): StructuralDiff {
  const od = degreeSequence(oracle);
  const cd = degreeSequence(candidate);

  const nodeCountOk = oracle.nodes.length === candidate.nodes.length;
  const edgeCountOk = oracle.edges.length === candidate.edges.length;
  const degreeOk = eqNum(od, cd);
  const minlenOk = eqNum(sortedMinlens(oracle), sortedMinlens(candidate));
  const shapeOk = eqStr(sortedShapes(oracle), sortedShapes(candidate));
  const labelOk = eqNum(labelCounts(oracle), labelCounts(candidate));
  const clusterOk = eqNum(sortedClusterSizes(oracle), sortedClusterSizes(candidate));
  const rdOk = rankdirOk(oracle.rankdir, candidate.rankdir);
  const nsOk = numAttrOk(oracle.nodesep, candidate.nodesep);
  const rsOk = numAttrOk(oracle.ranksep, candidate.ranksep);

  return {
    nodeCountOk,
    edgeCountOk,
    degreeOk,
    minlenOk,
    shapeOk,
    labelOk,
    clusterOk,
    rankdirOk: rdOk,
    nodesepOk: nsOk,
    ranksepOk: rsOk,
    structurallyEqual:
      nodeCountOk &&
      edgeCountOk &&
      degreeOk &&
      minlenOk &&
      shapeOk &&
      labelOk &&
      clusterOk &&
      rdOk &&
      nsOk &&
      rsOk,
    oracle: {
      nodes: oracle.nodes.length,
      edges: oracle.edges.length,
      degree: od,
      clusters: oracle.clusters.length,
    },
    candidate: {
      nodes: candidate.nodes.length,
      edges: candidate.edges.length,
      degree: cd,
      clusters: candidate.clusters.length,
    },
    maxSizeDeltaIn: maxSizeDelta(oracle, candidate),
    medianSizeDeltaIn: medianSizeDelta(oracle, candidate),
    attrs: {
      oracle: [oracle.nodesep, oracle.ranksep],
      candidate: [candidate.nodesep, candidate.ranksep],
    },
  };
}

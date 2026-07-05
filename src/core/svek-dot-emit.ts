// Svek-faithful DOT emitter.
//
// Serializes a DotInputGraph into the DOT text PlantUML's Svek feeds graphviz,
// so our generated DOT can be compared (at DOT granularity) against the oracle's
// svek-*.dot dumps. This is for parity inspection/testing only — it is NOT on
// the layout path (the graphviz-ts adapter ignores the emitter-only fields).
//
// Faithful to Svek's shape (see ~/git/plantuml .../svek/{DotStringFactory,
// SvekNode,SvekEdge,ClusterDotString,SvekUtils}.java):
//   digraph unix { nodesep; ranksep; remincross=true; searchsize=500; [rankdir]
//     sh#### [shape=…,label="",width=…,height=…,color="#…"];
//     shA->shB[arrowtail=none,arrowhead=none,minlen=…,color="#…"{,label=<TABLE…>}];
//     subgraph cluster# { label=<TABLE…>; <member nodes> } }
// Synthetic sh-ids / colors come from one counter (Svek's ColorSequence); the
// parity gate normalizes them away, so only their presence/structure matters.

import type {
  DotInputCluster,
  DotInputEdge,
  DotInputGraph,
  DotInputNode,
} from './graph-layout.types.js';

const PX_PER_INCH = 72;
const MIN_NODESEP_PX = 35; // Svek getMinNodeSep() (non-activity)
const MIN_RANKSEP_PX = 60; // Svek getMinRankSep() (non-activity)

const inches = (px: number): string => (px / PX_PER_INCH).toFixed(6);
const hex = (n: number): string => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
const round = (v: number): string => String(Math.round(v));
const shId = (n: number): string => 'sh' + String(n).padStart(4, '0');

const labelTable = (w: number, h: number, color: number): string =>
  `<<TABLE BGCOLOR="${hex(color)}" FIXEDSIZE="TRUE" WIDTH="${round(w)}" HEIGHT="${round(h)}">` +
  `<TR><TD></TD></TR></TABLE>>`;

/** Svek's ColorSequence: a counter whose value is both the `sh####` id suffix
 *  and the `color="#……"` back-reference tag (first value is 2). */
class Seq {
  private n = 1;
  next(): number {
    this.n += 1;
    return this.n;
  }
}

interface NodeRec {
  sh: string;
  color: number;
}

type EdgeAttrs = NonNullable<DotInputEdge['attributes']>;

function graphAttrLines(input: DotInputGraph): string[] {
  const ns = Math.max(input.nodeSep ?? 0, MIN_NODESEP_PX);
  const rs = Math.max(input.rankSep ?? 0, MIN_RANKSEP_PX);
  const lines = [
    `nodesep=${inches(ns)};`,
    `ranksep=${inches(rs)};`,
    'remincross=true;',
    'searchsize=500;',
  ];
  if (input.rankDir === 'LR') lines.push('rankdir=LR;');
  return lines;
}

function shapeAttr(node: DotInputNode): string {
  const shape = node.shape ?? 'rect';
  if (shape === 'rounded') return 'shape=rect,style=rounded';
  return `shape=${shape}`;
}

// SvekNode.appendLabelHtml: shield table for a shielded description entity
// (hideText symbols, e.g. INTERFACE lollipops) -- 3x3 grid, center cell
// holds the real icon box with PORT="h"; margin cells reserve space for the
// name/stereotype text drawn outside the icon. Exact text-metric margins
// are D1 tolerance territory (width/height are reported, not asserted, and
// the comparator never reads inside a label=<...> value) -- nominal
// constants stand in for the real measured shield here.
const SHIELD_MARGIN_X = 1;
const SHIELD_MARGIN_Y = 16;

function shieldTable(node: DotInputNode, color: number): string {
  const w = round(node.width);
  const h = round(node.height);
  const my = String(SHIELD_MARGIN_Y);
  const mx = String(SHIELD_MARGIN_X);
  return (
    '<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="0">' +
    `<TR><TD></TD><TD FIXEDSIZE="TRUE" WIDTH="1" HEIGHT="${my}"></TD><TD></TD></TR>` +
    `<TR><TD FIXEDSIZE="TRUE" WIDTH="${mx}" HEIGHT="1"></TD>` +
    `<TD BGCOLOR="${hex(color)}" FIXEDSIZE="TRUE" WIDTH="${w}" HEIGHT="${h}" PORT="h"></TD>` +
    `<TD FIXEDSIZE="TRUE" WIDTH="${mx}" HEIGHT="1"></TD></TR>` +
    `<TR><TD></TD><TD FIXEDSIZE="TRUE" WIDTH="1" HEIGHT="${my}"></TD><TD></TD></TR>` +
    '</TABLE>'
  );
}

function nodeLine(node: DotInputNode, rec: NodeRec): string {
  const shape = node.shape ?? 'rect';
  if (shape === 'point') {
    return `${rec.sh} [shape=point,width=.01,label=""];`;
  }
  if (shape === 'plaintext') {
    return `${rec.sh} [shape=plaintext,label=<${shieldTable(node, rec.color)}>];`;
  }
  return (
    `${rec.sh} [${shapeAttr(node)},label="",` +
    `width=${inches(node.width)},height=${inches(node.height)},color="${hex(rec.color)}"];`
  );
}

/** Bibliotekon.getNodeUid: every DOT reference to a shielded node's uid gets
 *  a ":h" port suffix (the shield table's colored center cell). */
function edgeRef(id: string, recs: Map<string, NodeRec>, nodeById: Map<string, DotInputNode>): string {
  const rec = recs.get(id)!;
  return (nodeById.get(id)?.shape ?? 'rect') === 'plaintext' ? `${rec.sh}:h` : rec.sh;
}

/** Optional edge label / taillabel / headlabel parts (Svek HTML tables). */
function edgeLabelParts(a: EdgeAttrs, seq: Seq): string[] {
  const parts: string[] = [];
  if (a.label !== undefined && a.labelWidth !== undefined && a.labelHeight !== undefined) {
    parts.push(`label=${labelTable(a.labelWidth, a.labelHeight, seq.next())}`);
  }
  if (a.tailLabelWidth !== undefined && a.tailLabelHeight !== undefined) {
    parts.push(`taillabel=${labelTable(a.tailLabelWidth, a.tailLabelHeight, seq.next())}`);
  }
  if (a.headLabelWidth !== undefined && a.headLabelHeight !== undefined) {
    parts.push(`headlabel=${labelTable(a.headLabelWidth, a.headLabelHeight, seq.next())}`);
  }
  return parts;
}

function edgeLine(edge: DotInputEdge, fromSh: string, toSh: string, seq: Seq): string {
  const a = edge.attributes ?? {};
  const parts = [
    'arrowtail=none',
    'arrowhead=none',
    `minlen=${a.minLen ?? 1}`,
    `color="${hex(seq.next())}"`,
    ...edgeLabelParts(a, seq),
  ];
  if (a.invis === true) parts.push('style=invis');
  return `${fromSh}->${toSh}[${parts.join(',')}];`;
}

interface ClusterTree {
  clusteredIds: Set<string>;
  childrenOf: Map<string | undefined, DotInputCluster[]>;
}

function buildClusterTree(clusters: DotInputCluster[]): ClusterTree {
  const clusteredIds = new Set(clusters.flatMap((c) => c.nodeIds));
  const childrenOf = new Map<string | undefined, DotInputCluster[]>();
  for (const c of clusters) {
    const arr = childrenOf.get(c.parentId) ?? [];
    arr.push(c);
    childrenOf.set(c.parentId, arr);
  }
  return { clusteredIds, childrenOf };
}

/** Emit a cluster subgraph (clean form): title table, member nodes, nested children. */
function clusterBlock(
  cluster: DotInputCluster,
  childrenOf: ClusterTree['childrenOf'],
  recs: Map<string, NodeRec>,
  nodeById: Map<string, DotInputNode>,
  seq: Seq,
): string[] {
  const label =
    cluster.labelWidth !== undefined && cluster.labelHeight !== undefined
      ? `labeljust="c";label=${labelTable(cluster.labelWidth, cluster.labelHeight, seq.next())};`
      : 'label="";';
  const out = [`subgraph ${cluster.id} {style=solid;color="${hex(seq.next())}";${label}`];
  for (const id of cluster.nodeIds) {
    const node = nodeById.get(id);
    const rec = recs.get(id);
    if (node !== undefined && rec !== undefined) out.push(nodeLine(node, rec));
  }
  for (const child of childrenOf.get(cluster.id) ?? []) {
    out.push(...clusterBlock(child, childrenOf, recs, nodeById, seq));
  }
  out.push('}');
  return out;
}

function rankLines(input: DotInputGraph, recs: Map<string, NodeRec>): string[] {
  const groups = new Map<string, string[]>();
  for (const n of input.nodes) {
    const r = n.attributes?.rank;
    if (r === undefined) continue;
    const arr = groups.get(r) ?? [];
    arr.push(recs.get(n.id)!.sh);
    groups.set(r, arr);
  }
  return [...groups].map(([rank, shs]) => `{rank=${rank}; ${shs.join('; ')}}`);
}

function assignRecs(
  input: DotInputGraph,
  seq: Seq,
): { recs: Map<string, NodeRec>; nodeById: Map<string, DotInputNode> } {
  const recs = new Map<string, NodeRec>();
  const nodeById = new Map<string, DotInputNode>();
  for (const n of input.nodes) {
    const color = seq.next();
    recs.set(n.id, { sh: shId(color), color });
    nodeById.set(n.id, n);
  }
  return { recs, nodeById };
}

function emitBody(
  input: DotInputGraph,
  recs: Map<string, NodeRec>,
  nodeById: Map<string, DotInputNode>,
  tree: ClusterTree,
  seq: Seq,
): string[] {
  const body = [...graphAttrLines(input)];
  for (const n of input.nodes) {
    if (!tree.clusteredIds.has(n.id)) body.push(nodeLine(n, recs.get(n.id)!));
  }
  for (const top of tree.childrenOf.get(undefined) ?? []) {
    body.push(...clusterBlock(top, tree.childrenOf, recs, nodeById, seq));
  }
  body.push(...rankLines(input, recs));
  for (const e of input.edges) {
    if (!recs.has(e.from) || !recs.has(e.to)) continue;
    body.push(edgeLine(e, edgeRef(e.from, recs, nodeById), edgeRef(e.to, recs, nodeById), seq));
  }
  return body;
}

/** Serialize a DotInputGraph to Svek-shaped DOT text. */
export function toSvekDot(input: DotInputGraph): string {
  const seq = new Seq();
  const { recs, nodeById } = assignRecs(input, seq);
  const tree = buildClusterTree(input.clusters ?? []);
  const body = emitBody(input, recs, nodeById, tree, seq);
  return `digraph unix {\n${body.join('\n')}\n}\n`;
}

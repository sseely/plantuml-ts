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

/** Explicit skinparam overrides skip the minimum floor
 *  (DotStringFactory.java:117-133); computed defaults keep it. */
function resolveSep(
  value: number | undefined,
  explicit: boolean | undefined,
  floorPx: number,
): number {
  if (explicit) return value ?? floorPx;
  return Math.max(value ?? 0, floorPx);
}

function graphAttrLines(input: DotInputGraph): string[] {
  const lines: string[] = [];
  if (input.omitSepAttrs !== true) {
    const ns = resolveSep(input.nodeSep, input.nodeSepExplicit, MIN_NODESEP_PX);
    const rs = resolveSep(input.rankSep, input.rankSepExplicit, MIN_RANKSEP_PX);
    lines.push(`nodesep=${inches(ns)};`, `ranksep=${inches(rs)};`);
  }
  lines.push('remincross=true;', 'searchsize=500;');
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

/** SvekNode.appendLabelHtmlSpecialForPortHtml: a port entity whose label
 *  text is wide enough (>40px, `isPortLabelWide`) renders as an HTML table
 *  with a bordered PORT="P" cell (the compass point `edgeRef` attaches to)
 *  flanked by blank padding cells sized to the overflow width. */
function portTable(node: DotInputNode, color: number): string {
  const w = round(node.width);
  const h = round(node.height);
  const pad = String(node.portPad ?? 10);
  return (
    '<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="0">' +
    `<TR><TD WIDTH="${pad}" HEIGHT="1" COLSPAN="3"></TD></TR>` +
    `<TR><TD></TD><TD FIXEDSIZE="TRUE" PORT="P" BORDER="1" COLOR="${hex(color)}" ` +
    `WIDTH="${w}" HEIGHT="${h}"></TD><TD></TD></TR>` +
    `<TR><TD WIDTH="${pad}" HEIGHT="1" COLSPAN="3"></TD></TR>` +
    '</TABLE>'
  );
}

function nodeLine(node: DotInputNode, rec: NodeRec): string {
  const shape = node.shape ?? 'rect';
  if (shape === 'point') {
    return `${rec.sh} [shape=point,width=.01,label=""];`;
  }
  // ClusterDotString.empty() port placeholder — a tiny `.01in` rect whose
  // label is the owning cluster's own title table (see graph-layout.types
  // DotInputNode.titleLabelWidth). Checked before the generic 'rect' branch
  // since it shares that default shape value.
  if (node.titleLabelWidth !== undefined && node.titleLabelHeight !== undefined) {
    // ClusterDotString.java:148-149 — the plain point anchor declaration is
    // ALWAYS emitted first when the group itself is also a real edge target
    // (thereALinkFromOrToGroup2), independently of hasPort(); graphviz lets
    // a node id be redeclared, and the comparator dedupes by first-seen
    // shape, so both lines matter (see graph-layout.types.ts).
    const pointDecl = node.groupAnchorAlsoPoint === true
      ? `${rec.sh} [shape=point,width=.01,label=""];`
      : '';
    return `${pointDecl}${rec.sh} [shape=rect,width=.01,height=.01,label=${
      labelTable(node.titleLabelWidth, node.titleLabelHeight, rec.color)
    }];`;
  }
  if (shape === 'plaintext') {
    if (node.isPort === true) {
      return `${rec.sh} [shape=plaintext,label=<${portTable(node, rec.color)}>];`;
    }
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
  const node = nodeById.get(id);
  // Link.getEntityPort: a port entity always gets the ":P" compass suffix,
  // regardless of which shape branch (HTML table vs plain small rect) its
  // OWN node line took.
  if (node?.isPort === true) return `${rec.sh}:P`;
  return (node?.shape ?? 'rect') === 'plaintext' ? `${rec.sh}:h` : rec.sh;
}

/** Optional edge label / taillabel / headlabel parts (Svek HTML tables). */
function edgeLabelParts(a: EdgeAttrs, seq: Seq): string[] {
  const parts: string[] = [];
  if (a.label !== undefined && a.labelWidth !== undefined && a.labelHeight !== undefined) {
    parts.push(`label=${labelTable(a.labelWidth, a.labelHeight, seq.next())}`);
  }
  // linetype ortho routes the label through xlabel (SvekEdge.java:434-441).
  if (a.xlabel !== undefined && a.xlabelWidth !== undefined && a.xlabelHeight !== undefined) {
    parts.push(`xlabel=${labelTable(a.xlabelWidth, a.xlabelHeight, seq.next())}`);
  }
  if (a.tailLabelWidth !== undefined && a.tailLabelHeight !== undefined) {
    parts.push(`taillabel=${labelTable(a.tailLabelWidth, a.tailLabelHeight, seq.next())}`);
  }
  if (a.headLabelWidth !== undefined && a.headLabelHeight !== undefined) {
    parts.push(`headlabel=${labelTable(a.headLabelWidth, a.headLabelHeight, seq.next())}`);
  }
  // #lizard forgives — faithful port of SvekEdge's fixed label-attr order
  // (SvekEdge.java:391-483); each branch is one upstream attribute.
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

/** ClusterDotString.printRanks' port rank-chain: one `A->B->C
 *  [arrowhead=none]` statement per rank present, then `C->anchor;`
 *  (bare, bracket-less — matching Svek's `empty()` link exactly). */
function portChainLines(cluster: DotInputCluster, recs: Map<string, NodeRec>): string[] {
  if (cluster.portRanks === undefined || cluster.portAnchorId === undefined) return [];
  const anchorRec = recs.get(cluster.portAnchorId);
  if (anchorRec === undefined) return [];
  const lines: string[] = [];
  for (const { nodeIds } of cluster.portRanks) {
    const shs = nodeIds.map((id) => recs.get(id)?.sh).filter((sh): sh is string => sh !== undefined);
    if (shs.length === 0) continue;
    lines.push(`${shs.join('->')} [arrowhead=none];`);
    lines.push(`${shs[shs.length - 1]!}->${anchorRec.sh};`);
  }
  return lines;
}

/** ClusterDotString.printRanks: `{rank=source;shA;shB;}` groups emitted as the
 *  FIRST content inside a ports cluster (matching Svek's exact text — the
 *  in-cluster anonymous braces are part of the oracle's byte shape). */
function portRankGroups(cluster: DotInputCluster, recs: Map<string, NodeRec>): string {
  return (cluster.portRanks ?? [])
    .map(({ rank, nodeIds }) => {
      const shs = nodeIds
        .map((id) => recs.get(id)?.sh)
        .filter((sh): sh is string => sh !== undefined);
      return shs.length > 0 ? `{rank=${rank};${shs.join(';')};}` : '';
    })
    .join('');
}

/** ClusterDotString port branch: labeljust only (no label attr — the title
 *  table moves onto the ee-placeholder), rank groups first, port nodes +
 *  bare constraint chains in the outer cluster, then `clusterNee` wrapping
 *  the placeholder and normal members (hasPort() → subgraphClusterNoLabel
 *  ID_EE + the trailing `empty()` rect, ClusterDotString.java:134-184). */
function portClusterBlock(
  cluster: DotInputCluster,
  childrenOf: ClusterTree['childrenOf'],
  recs: Map<string, NodeRec>,
  nodeById: Map<string, DotInputNode>,
  seq: Seq,
): string[] {
  const labelOnEe = cluster.portRanksLabelOnEe === true;
  const attrs = cluster.labelWidth !== undefined ? 'labeljust="c";' : '';
  const out = [
    `subgraph ${cluster.id} {style=solid;color="${hex(seq.next())}";${attrs}` +
      portRankGroups(cluster, recs),
  ];
  const emitLine = (id: string): void => {
    const node = nodeById.get(id);
    const rec = recs.get(id);
    if (node !== undefined && rec !== undefined) out.push(nodeLine(node, rec));
  };
  const isPortId = (id: string): boolean => nodeById.get(id)?.isPort === true;
  for (const id of cluster.nodeIds) if (isPortId(id)) emitLine(id);
  // Entry/exit border points (state diagrams, mechanisms.md §2's WithLabel
  // branch) never chain to the anchor — only genuine PORTIN/PORTOUT
  // (NoLabel branch) do (ClusterDotString.java's hasPort() split).
  if (!labelOnEe) out.push(...portChainLines(cluster, recs));
  const eeLabel =
    labelOnEe && cluster.labelWidth !== undefined && cluster.labelHeight !== undefined
      ? `label=${labelTable(cluster.labelWidth, cluster.labelHeight, seq.next())};`
      : 'label="";';
  out.push(`subgraph ${cluster.id}ee {${eeLabel}`);
  for (const id of cluster.nodeIds) if (!isPortId(id)) emitLine(id);
  for (const child of childrenOf.get(cluster.id) ?? []) {
    out.push(...clusterBlock(child, childrenOf, recs, nodeById, seq));
  }
  out.push('}');
  out.push('}');
  return out;
}

/** Emit a cluster subgraph (clean form): title table, member nodes, nested children. */
function clusterBlock(
  cluster: DotInputCluster,
  childrenOf: ClusterTree['childrenOf'],
  recs: Map<string, NodeRec>,
  nodeById: Map<string, DotInputNode>,
  seq: Seq,
): string[] {
  if (cluster.portRanks !== undefined && cluster.portRanks.length > 0) {
    return portClusterBlock(cluster, childrenOf, recs, nodeById, seq);
  }
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
  out.push(...portChainLines(cluster, recs));
  for (const child of childrenOf.get(cluster.id) ?? []) {
    out.push(...clusterBlock(child, childrenOf, recs, nodeById, seq));
  }
  out.push('}');
  // #lizard forgives — faithful port of Cluster/ClusterDotString's nested
  // subgraph emission; the branch count mirrors upstream's cases.
  return out;
}

function rankLines(input: DotInputGraph, recs: Map<string, NodeRec>): string[] {
  // Port nodes' ranks are emitted inside their cluster (portRankGroups) —
  // ClusterDotString.printRanks, not a top-level rank group.
  const portIds = new Set(
    (input.clusters ?? []).flatMap((c) => (c.portRanks ?? []).flatMap((r) => r.nodeIds)),
  );
  const groups = new Map<string, string[]>();
  for (const n of input.nodes) {
    const r = n.attributes?.rank;
    if (r === undefined || portIds.has(n.id)) continue;
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

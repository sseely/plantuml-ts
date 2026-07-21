/**
 * graphviz-ts builder construction for `layoutGraph()` — split from
 * `graph-layout.ts` (500-line file cap). Owns the input→builder projection:
 * graph attrs, node declarations (shape mirroring `svek-dot-emit.ts#nodeLine`),
 * rank subgraphs, cluster subgraphs, and edge declarations with the
 * (tail,head)→id EdgeIndex the snapshot mapper consumes.
 */
import type { GvGraphBuilder } from 'graphviz-ts';
import type {
  DotInputCluster,
  DotInputEdge,
  DotInputGraph,
  DotInputNode,
} from './graph-layout.types.js';

/** graphviz width/height/nodesep/ranksep attrs are in inches; our measured
 *  sizes are in pixels. getLayout returns points (inches × 72), so dividing px
 *  by 72 on the way in round-trips: output points == original pixel value. */
export const PX_PER_INCH = 72;


/** `plantuml.skin`'s `arrow { FontSize 13 }` block (`svek/GraphvizImageBuilder
 *  .java#getStyleArrowCardinality` resolves the `arrow.cardinality` style,
 *  which falls through to the plain `arrow` block — no diagram in the corpus
 *  overrides `cardinality` specifically) — the font graphviz-ts must measure
 *  `tailLabel`/`headLabel` text with so its `xladjust` placement search uses
 *  the same box size jar's own `cardinalityFont` would. */
export const CARDINALITY_FONT_SIZE = 13;

/** Maps graphviz-ts (tail,head)-keyed edges back to our edge ids. */
export interface EdgeIndex {
  /** (tail,head) → our edge ids, in input order (consumed left-to-right). */
  idQueues: Map<string, string[]>;
  inputEdgeById: Map<string, DotInputEdge>;
}

export const edgeKey = (tail: string, head: string): string => `${tail} ${head}`;

export function applyGraphAttrs(b: GvGraphBuilder, input: DotInputGraph): void {
  if (input.rankDir !== undefined) b.setAttr('rankdir', input.rankDir);
  if (input.nodeSep !== undefined) {
    b.setAttr('nodesep', (input.nodeSep / PX_PER_INCH).toString());
  }
  if (input.rankSep !== undefined) {
    b.setAttr('ranksep', (input.rankSep / PX_PER_INCH).toString());
  }
  if (input.aspect !== undefined) b.setAttr('aspect', input.aspect.toString());
}

/** Layout-side mirror of `svek-dot-emit.ts#nodeLine`'s shape handling: the
 *  jar feeds graphviz the emitter's DOT, so layout must feed the SAME shape
 *  or spline clipping at node boundaries solves differently (proven on
 *  bunuce-10-vere519: laying the 4px `circle` couple points out as `box`
 *  reproduces the exact 0.03-1.1px path/@d drift previously mis-attributed
 *  to graphviz-ts getLayout; honoring `circle` matches the jar byte-exact).
 *  `plaintext` and title-label nodes still lay out as boxes — their emitter
 *  form is an HTML label table, which layout does not model yet. */
function layoutShape(n: DotInputNode): string {
  const shape = n.shape ?? 'rect';
  if (shape === 'rect' || shape === 'rounded' || shape === 'plaintext') return 'box';
  return shape;
}

export function addNodes(b: GvGraphBuilder, input: DotInputGraph): void {
  for (const n of input.nodes) {
    if (n.shape === 'point' && n.titleLabelWidth === undefined) {
      // emitter: `[shape=point,width=.01,label=""]` — width OVERRIDES the
      // caller's measured size, exactly as ClusterDotString emits anchors.
      b.addNode(n.id, { shape: 'point', width: '.01', label: '' });
      continue;
    }
    b.addNode(n.id, {
      shape: layoutShape(n),
      fixedsize: 'true',
      // Empty label: plantuml renders node text itself, so graphviz must not
      // measure the implicit name-label (its default "Times,serif" has no LUT
      // metrics and would warn). fixedsize keeps the caller's measured size.
      label: '',
      width: (n.width / PX_PER_INCH).toString(),
      height: (n.height / PX_PER_INCH).toString(),
    });
  }
  // Rank constraints (rank=source|sink|same|min|max): graphviz groups nodes by
  // a subgraph carrying `rank=`. Declaring an existing node id inside the
  // subgraph references it (DOT semantics — no duplicate node is created).
  const rankGroups = new Map<string, string[]>();
  for (const n of input.nodes) {
    const r = n.attributes?.rank;
    if (r === undefined) continue;
    const arr = rankGroups.get(r) ?? [];
    arr.push(n.id);
    rankGroups.set(r, arr);
  }
  let rankSubId = 0;
  for (const [rank, ids] of rankGroups) {
    const sub = b.addSubgraph(`__rank_${rankSubId++}`, { rank });
    for (const id of ids) sub.addNode(id);
  }
}

/** Maps graphviz-ts's own `cluster<N>` subgraph name back to OUR
 *  `DotInputCluster.id` (G5 C2: threaded so `layoutGraph()` can re-key
 *  `getLayout()`'s new `clusters` snapshot entries — graphviz-ts 0.1.26072115,
 *  docs/graphviz-issues/06-cluster-bbox-not-in-getlayout.md's RESOLVED note —
 *  into the caller's own id space; see `DotLayoutResult.clusters`). */
export interface ClusterIndex {
  /** graphviz-ts cluster name (`cluster0`, `cluster1`, …) → our cluster id. */
  idByName: Map<string, string>;
}

/**
 * Forward `input.clusters` to graphviz-ts as `cluster<N>` subgraphs so dot
 * lays out container members together (contained) and routes splines across
 * cluster boundaries — the faithful upstream model (one graph, cluster
 * subgraphs, single pass). Nesting is honored via `parentId`. Member ids
 * reference nodes already added by addNodes (DOT semantics: declaring an
 * existing id in a subgraph references it — no duplicate node), mirroring the
 * rank-subgraph code above.
 *
 * Subgraph names are assigned as `cluster0`, `cluster1`, … (a fresh numeric
 * index per cluster) rather than `cluster_${c.id}` — graphviz only requires
 * the `cluster` prefix, but a digits-only suffix additionally matches the
 * DOT-parity oracle comparator's `parseClusters` regex (`^cluster\d+$`,
 * tests/oracle/svek-dot.ts:109), keeping this emission consistent with the
 * Svek-DOT emitter's own `clusterN` naming (src/core/svek-dot-emit.ts) even
 * though that emitter is a separate code path (it serializes `input.clusters`
 * directly and never calls this function).
 *
 * Returns the `ClusterIndex` (G5 C2) so `layoutGraph()` can re-key the
 * `getLayout()` snapshot's own `clusters` array (graphviz-ts's `cluster<N>`
 * naming) back to `input.clusters[].id`. Additive: callers that pass no
 * `clusters` are unaffected (the field was previously emitter-only) — they
 * get back an empty `idByName` map, which `layoutGraph()` uses to omit
 * `DotLayoutResult.clusters` entirely.
 */
export function addClusters(b: GvGraphBuilder, input: DotInputGraph): ClusterIndex {
  const idByName = new Map<string, string>();
  const clusters = input.clusters;
  if (clusters === undefined || clusters.length === 0) return { idByName };
  const byId = new Map<string, DotInputCluster>(
    clusters.map((c) => [c.id, c]),
  );
  const builderById = new Map<string, GvGraphBuilder>();
  const nameById = new Map<string, string>();
  let nextIndex = 0;
  const nameFor = (c: DotInputCluster): string => {
    const cached = nameById.get(c.id);
    if (cached !== undefined) return cached;
    const name = `cluster${nextIndex++}`;
    nameById.set(c.id, name);
    idByName.set(name, c.id);
    return name;
  };
  const builderFor = (c: DotInputCluster): GvGraphBuilder => {
    const cached = builderById.get(c.id);
    if (cached !== undefined) return cached;
    const parent =
      c.parentId !== undefined && byId.has(c.parentId)
        ? builderFor(byId.get(c.parentId)!)
        : b;
    const hasTitleTable = c.titleTableWidth !== undefined && c.titleTableHeight !== undefined;
    const attrs = !hasTitleTable && c.label !== undefined ? { label: c.label } : {};
    const sg = parent.addSubgraph(nameFor(c), attrs);
    // G5 C3, mechanism 16 shape half: a jar-real HTML `<TABLE FIXEDSIZE=
    // "TRUE" ...>` label, via graphviz-ts 0.1.26072117's public `setHtmlAttr`
    // (docs/graphviz-issues/07's RESOLVED note) -- ONLY for callers that
    // supply BOTH dims (`titleTableWidth`/`Height`'s own doc comment,
    // graph-layout.types.ts, has the full jar-calibration derivation).
    // Callers that don't (every pre-C3 cluster, and every C3-ineligible
    // one) keep the prior plain-text `label` attr above, unchanged.
    if (hasTitleTable) {
      sg.setHtmlAttr(
        'label',
        `<TABLE FIXEDSIZE="TRUE" WIDTH="${Math.round(c.titleTableWidth!)}" ` +
          `HEIGHT="${Math.round(c.titleTableHeight!)}"><TR><TD></TD></TR></TABLE>`,
      );
    }
    builderById.set(c.id, sg);
    return sg;
  };
  for (const c of clusters) {
    const sg = builderFor(c);
    const levels = c.innerMarginLevels;
    if (levels === undefined) {
      for (const id of c.nodeIds) sg.addNode(id);
      continue;
    }
    // G5 C7, mechanism 16 margin half: mirror jar's ClusterDotString "i"/
    // "p1" protection-wrapper nesting (see DotInputCluster.innerMarginLevels'
    // own doc comment for the full jar-source derivation) -- each extra
    // `subgraph cluster*` level gets graphviz's own default CL_OFFSET(8pt)
    // margin around ITS children, compounding to jar's real 16/24px side
    // margin. Names deliberately do NOT match the oracle comparator's
    // `^cluster\d+$` pattern (tests/oracle/svek-dot.ts#parseClusters skips
    // exactly this "clusterNp0/clusterN/clusterNp1" shape, by design, per
    // that file's own doc comment) -- so this nesting is structurally
    // invisible to the DOT-parity gate, same as jar's own protection wrappers.
    const outerName = nameFor(c);
    let inner = sg;
    if (levels === 2) inner = inner.addSubgraph(`${outerName}i`, {});
    inner = inner.addSubgraph(`${outerName}p1`, {});
    for (const id of c.nodeIds) {
      (id === c.unwrappedNodeId ? sg : inner).addNode(id);
    }
  }
  return { idByName };
}

export function addEdges(b: GvGraphBuilder, input: DotInputGraph): EdgeIndex {
  const nodeIds = new Set(input.nodes.map((n) => n.id));
  const idQueues = new Map<string, string[]>();
  const inputEdgeById = new Map<string, DotInputEdge>();
  for (const e of input.edges) {
    // Defensive: skip edges to/from unknown nodes (the old engine dropped
    // dangling edges in buildWorkingGraph).
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    // I9 mechanism (plans/g1-description-svg/ledger.md): callers that draw
    // arrowheads manually (`DotInputGraph.manualArrowheads` — currently only
    // `description`'s SvekEdge/extremity polygons) must tell graphviz-ts the
    // same `arrowhead=none`/`arrowtail=none` the Svek-DOT text emitter
    // already writes for every diagram type, or it defaults to
    // `arrowhead=normal` and reserves an arrow-length gap when clipping the
    // spline to the target node's boundary — shortening the routed edge by
    // ~10-11px versus both real graphviz and the jar's own layout (verified
    // by feeding one fixture's exact node/edge geometry to both `dot -Txdot`
    // and this seam — splines matched only once the attrs below were added).
    // NOT applied unconditionally: `class`/`state`/`dot`/`json` draw their
    // arrowhead via an SVG `marker-end` sitting at the raw spline endpoint
    // and rely on graphviz's default reservation to leave room for it
    // without overlapping the target box (see `DotInputGraph
    // .manualArrowheads`'s own doc comment) — scoped to avoid regressing
    // their already-correct, already-tested output.
    const a = e.attributes;
    const attrs: Record<string, string> = input.manualArrowheads === true || a?.noArrow === true
      ? { arrowtail: 'none', arrowhead: 'none' }
      : {};
    if (a?.weight !== undefined) attrs.weight = a.weight.toString();
    if (a?.minLen !== undefined) attrs.minlen = a.minLen.toString();
    if (a?.label !== undefined) {
      attrs.label = a.label;
      // Measure with a LUT-known font (graphviz's default "Times,serif" warns).
      attrs.fontname = 'Times';
    }
    // G2/N25: feed the ACTUAL text (not just DOT-gate sizing) into the real
    // layout call so graphviz-ts's own `placeLabels`/`xladjust` (`label/
    // xlabels.ts`, a faithful port of `lib/label/xlabels.c`) computes the
    // same external-label position real graphviz would — see
    // `DotInputEdge.attributes.tailLabel`'s own doc comment for why the
    // angle/distance formula never applies here. `layoutGraph()` extracts
    // the computed position back out via `extractPortLabelPositions` (no
    // public snapshot API exposes it directly — ADR-1 in graphviz-ts hides
    // the internal `Edge` model).
    if (a?.tailLabel !== undefined) {
      attrs.taillabel = a.tailLabel;
      attrs.labelfontname = 'Times';
      attrs.labelfontsize = CARDINALITY_FONT_SIZE.toString();
    }
    if (a?.headLabel !== undefined) {
      attrs.headlabel = a.headLabel;
      attrs.labelfontname = 'Times';
      attrs.labelfontsize = CARDINALITY_FONT_SIZE.toString();
    }
    b.addEdge(e.from, e.to, attrs);

    const k = edgeKey(e.from, e.to);
    const q = idQueues.get(k) ?? [];
    q.push(e.id);
    idQueues.set(k, q);
    inputEdgeById.set(e.id, e);
  }
  return { idQueues, inputEdgeById };
  // #lizard forgives -- pre-existing (unmodified by G5 C7) faithful mirror
  // of SvekEdge's per-edge attr assembly; each branch below is one
  // independently-conditional DOT attr (label/tailLabel/headLabel/weight/
  // minlen/arrowhead override), not decision complexity to simplify.
}

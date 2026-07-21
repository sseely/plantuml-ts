// Consumer-facing graph-layout types.
//
// Relocated verbatim (names + shapes) from the deleted `src/core/dot/types.ts`
// per plans/burn-graphviz-engines/decisions.md#d4. These are the only types the
// six graph diagram renderers read; the engine-internal working types (DotNode,
// DotEdge, DotWorkingGraph) died with the in-house engines.

/** Node outline Svek emits as the graphviz `shape` (and `style=rounded`).
 *  Absent ⇒ treated as `rect` (Svek's default for boxed entities). */
export type DotInputNodeShape =
  | 'rect'
  | 'rounded'
  | 'circle'
  | 'ellipse'
  | 'diamond'
  | 'octagon'
  | 'hexagon'
  | 'point'
  | 'plaintext';

export interface DotInputNode {
  id: string;
  width: number;
  height: number;
  /** Svek-faithful node outline. Layout ignores this (all nodes lay out as a
   *  box); only the Svek-DOT emitter reads it. Absent ⇒ rect. */
  shape?: DotInputNodeShape;
  xlabel?: string;
  xlabelWidth?: number;
  xlabelHeight?: number;
  attributes?: {
    rank?: 'source' | 'sink' | 'same' | 'min' | 'max';
  };
  /** Svek EntityPosition PORTIN/PORTOUT (abel/EntityPosition.java) — edges
   *  referencing this node get Svek's `:P` compass suffix (`Link
   *  .getEntityPort` -> `EntityPort.forPort`, abel/Link.java:227-231)
   *  regardless of which shape branch below is chosen, and it participates
   *  in its owning cluster's rank-chain (`ClusterDotString.printRanks`).
   *  Emitter-only. */
  isPort?: true;
  /** Only meaningful when `isPort` && `shape:'plaintext'` — the blank
   *  flanking-cell width for the PORT="P" HTML table
   *  (`SvekNode.appendLabelHtmlSpecialForPortHtml`'s `fullWidth`, clamped to
   *  a 10px floor). Emitter-only. */
  portPad?: number;
  /** Svek `ClusterDotString.empty()` port placeholder: reuses the
   *  group-anchor id as a tiny `.01in` rect carrying the OWNING cluster's
   *  own title HTML as its label, instead of the plain `shape:'point'`
   *  anchor used when no port forces this (ClusterDotString.java:177-184).
   *  Only ever set together with `shape:'rect'`. Emitter-only. */
  titleLabelWidth?: number;
  titleLabelHeight?: number;
  /** ClusterDotString.java:148-149: `thereALinkFromOrToGroup2` -- true when
   *  some OTHER edge in the graph also targets this cluster's group entity
   *  directly (a note or link attached to the group, not one of its port
   *  children). Independently of `hasPort()`, upstream ALWAYS emits the
   *  plain `id [shape=point,width=.01,label=""];` anchor declaration first
   *  in that case; the ee-placeholder's `shape=rect` + title-table line
   *  (driven by `titleLabelWidth`/`titleLabelHeight` above) still follows.
   *  Only meaningful together with `titleLabelWidth`/`titleLabelHeight`.
   *  Emitter-only. */
  groupAnchorAlsoPoint?: true;
}

export interface DotInputEdge {
  id: string;
  from: string;
  to: string;
  attributes?: {
    weight?: number;
    minLen?: number;
    /** Normalized port y-offset on the tail (FROM) node.
     *  -0.5 = top edge of node, 0 = vertical center, +0.5 = bottom edge. */
    tailportY?: number;
    label?: string;
    labelWidth?: number;
    labelHeight?: number;
    /** Tail/head end labels (association cardinality/roles). Sizing-only
     *  (`tailLabelWidth`/`tailLabelHeight`/`headLabelWidth`/`headLabelHeight`)
     *  is emitter-only (Svek-DOT text, `svek-dot-emit.ts`); the DOT-gate
     *  comparator never checks pixel widths, so these do not need to match
     *  `tailLabel`/`headLabel` exactly. */
    tailLabelWidth?: number;
    tailLabelHeight?: number;
    headLabelWidth?: number;
    headLabelHeight?: number;
    /**
     * G2/N25: the actual multiplicity/cardinality/role TEXT for the tail
     * (FROM-side) and head (TO-side) edge-end labels
     * (`SvekEdge.java:447-468`'s `taillabel=<TABLE>`/`headlabel=<TABLE>`
     * DOT attrs). Unlike the `*Width`/`*Height` pair above, these ARE fed
     * into the real graphviz-ts layout call (`graph-layout.ts#addEdges`)
     * so its own faithfully-ported external-label placement algorithm
     * (`label/xlabels.ts`, `lib/label/xlabels.c:placeLabels`/`xladjust`)
     * computes the position graphviz would — upstream never sets
     * `labelangle`/`labeldistance` on any class-diagram edge (`LinkArg`
     * carries both fields but no `net/` call site ever reads them for DOT
     * emission — dead upstream), so `place_portlabel`'s early-return always
     * fires and every tail/head label is placed via the external-label
     * force-search path, not a closed-form angle/distance formula. Absent
     * for every other diagram type — additive, no other caller sets this. */
    tailLabel?: string;
    headLabel?: string;
    /** Invisible constraint edge (Svek `style=invis`). Emitter-only. */
    invis?: boolean;
    xlabel?: string;
    xlabelWidth?: number;
    xlabelHeight?: number;
    /**
     * G2/N14: per-edge override of `DotInputGraph.manualArrowheads` — this
     * edge draws NO arrowhead at all (a class-diagram note connector,
     * merged into the note's own Opale outline, `SvekEdge#drawU`'s `if
     * (opale) return;`), so graphviz-ts must NOT reserve its default
     * ~10-11px arrow-length clip gap when trimming the routed spline to the
     * target node's boundary (`graph-layout.ts#addEdges`'s own doc comment
     * — the SAME mechanism `manualArrowheads` already handles graph-wide,
     * scoped here to a single edge so it doesn't touch the arrowhead-marker
     * clip behavior every OTHER class-diagram edge already relies on).
     */
    noArrow?: boolean;
  };
}

/** A cluster (graphviz `subgraph cluster*`) the Svek-DOT emitter renders.
 *  Carries membership + title geometry; layout ignores it for now. */
export interface DotInputCluster {
  id: string;
  label?: string;
  labelWidth?: number;
  labelHeight?: number;
  /** Member node ids declared directly in this cluster (not nested children). */
  nodeIds: string[];
  /** Enclosing cluster id for nesting; absent ⇒ top-level. */
  parentId?: string;
  /** Svek `ClusterDotString.printRanks`' port rank-chain (EntityPosition
   *  PORTIN/PORTOUT children only) — one entry per rank present among this
   *  cluster's own port children, node ids in declaration order. The
   *  emitter chains them in ONE `A->B->C [arrowhead=none]` statement
   *  (Svek's own syntax, faithfully reproduced: the DOT-parity comparator's
   *  regex-based edge parser only extracts the LAST hop of a multi-hop
   *  chain statement, so matching this syntax exactly keeps both sides of
   *  the comparison symmetric) then links the last node to `portAnchorId`.
   *  Emitter-only. */
  portRanks?: { rank: 'source' | 'sink'; nodeIds: string[] }[];
  /** DOT id of this cluster's shared group-anchor node (`groupAnchorNodeId`
   *  / Svek's `Cluster.getSpecialPointId`) — required whenever `portRanks`
   *  is set; the last node of each rank-chain links to it
   *  (`ClusterDotString.empty()`). Emitter-only. */
  portAnchorId?: string;
  /** Mission A4/T4, mechanisms.md §2: state-diagram entry/exit border
   *  points (`EntityPosition.usePortP()` true for ENTRY_POINT/EXIT_POINT,
   *  not just PORTIN/PORTOUT) reuse the SAME `portRanks`/`portAnchorId`
   *  rank-group + `${id}ee` nesting shape as genuine ports (needed so the
   *  DOT-parity comparator's `{rank=...}` brace-stack quirk zeroes the
   *  cluster's member count on BOTH sides symmetrically — see
   *  tests/oracle/svek-dot.ts's `parseClusters`), but their rendered DOT
   *  differs from `hasPort()`'s (PORTIN/PORTOUT) NoLabel branch in two
   *  ways, verified on bitaxo-18-tamo974: (1) the real cluster TITLE moves
   *  onto the `${id}ee` subgraph's `label=` instead of staying blank
   *  (`ClusterDotString`'s WithLabel branch, `!hasPort()`), and (2) there
   *  is NO `A->B->anchor` rank-chain edge — the anchor sits unconnected
   *  inside `${id}ee`. When true, the emitter takes this WithLabel/no-chain
   *  shape instead of the NoLabel/chained one; additive — absent (the
   *  class/component/description PORTIN/PORTOUT precedent) is unaffected. */
  portRanksLabelOnEe?: true;
}

export interface DotInputGraph {
  nodes: DotInputNode[];
  edges: DotInputEdge[];
  rankDir?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSep?: number;
  rankSep?: number;
  /** When true, nodeSep is an explicit `skinparam nodesep` override and the
   *  emitter must NOT apply the 35px minimum floor — a nonzero skinparam
   *  value replaces the min-clamped default outright
   *  (svek/DotStringFactory.java:117-124). Absent = clamp as before. */
  nodeSepExplicit?: boolean;
  /** Same as nodeSepExplicit for ranksep and its 60px floor
   *  (DotStringFactory.java:125-133). */
  rankSepExplicit?: boolean;
  /** Svek child-pass attr omission (mission A4/T4, mechanisms.md §3):
   *  `GroupMakerState`'s inner `GraphvizImageBuilder.buildImage` calls pass a
   *  caller-supplied EMPTY `dotStrings[]` placeholder array, so
   *  `DotStringFactory.createDotString`'s nodesep/ranksep substitution never
   *  fires — the emitted DOT for an autonom composite's own child pass has
   *  NO nodesep/ranksep line at all (not even the floor). When true, the
   *  emitter skips both lines unconditionally, ignoring `nodeSep`/`rankSep`/
   *  the *Explicit flags entirely. Absent/false = prior behavior (floor or
   *  explicit value always printed) — additive, no existing caller sets
   *  this (D3; class/object/description sibling ratchets unaffected). */
  omitSepAttrs?: true;
  aspect?: number;
  /** Cluster structure for Svek-DOT emission. Layout ignores it (clusters are
   *  still resolved post-layout); only the emitter reads it. Emitter-only. */
  clusters?: DotInputCluster[];
  /** `!pragma kermor on` (skin/PragmaKey.java:55) — svek's alternate
   *  cluster/note DOT-emission path (svek/ClusterDotStringKermor.java,
   *  Cluster.java:595-609 `printCluster3_forKermor`). Changes the ranksep
   *  floor/divisor (DotStringFactory.java:111-114,247-249: 40px floor,
   *  dzeta÷100 instead of dzeta÷10 — nodesep is untouched) and the cluster
   *  body shape (no `ee`-wrapped port subgraph, no port anchor/rank-chain,
   *  an `${id}empty` point placeholder when a cluster's direct non-port
   *  members are empty). Emitter- and spacing-only; description is the only
   *  engine that ever sets this (see description/layout.ts, ast.ts's
   *  `kermor` field, description-dot-100 decision-journal.md I2) — absent
   *  for every other diagram engine, so this is additive/no-op for them. */
  kermor?: true;
  /** True when every edge's arrowhead/decoration is drawn manually by the
   *  caller's own renderer (e.g. `core/svek/SvekEdge.ts`'s per-end
   *  `Extremity` polygons — see `svek-edge-extremity.ts`), rather than via
   *  an SVG `marker-end` sitting at the raw spline endpoint. The Svek-DOT
   *  text emitter already reflects this faithfully for EVERY diagram type
   *  (`svek-dot-emit.ts`: every edge line carries
   *  `arrowtail=none,arrowhead=none`, confirmed universal across the whole
   *  cached-fixture corpus) — but `layoutGraph()`'s graphviz-ts seam only
   *  honors it when this flag is set, because callers that draw arrowheads
   *  via `marker-end` (class/state/dot/json — see each renderer's own
   *  `markerEnd`/`targetMarker` call sites) rely on graphviz's *default*
   *  arrowhead-length spline-clip reservation to leave room for that marker
   *  without overlapping the target node's box; only `description`
   *  (component/usecase) sets this today. Absent/false = prior behavior
   *  (graphviz reserves arrow-length space when clipping every spline to
   *  its target node) — additive, no existing non-description caller sets
   *  this. */
  manualArrowheads?: true;
}

export interface DotLayoutResult {
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number; xlabelX?: number; xlabelY?: number }>;
  edges: Array<{
    id: string;
    points: Array<{ x: number; y: number }>;
    labelX?: number;
    labelY?: number;
    labelWidth?: number;
    labelHeight?: number;
    /** G2/N25: computed position for `attributes.tailLabel`/`.headLabel`
     *  (see that field's own doc comment) — the CENTER point of the label
     *  box graphviz-ts's own `xladjust` placed, in the same origin-shifted
     *  frame as `points`/`labelX`/`labelY`. Absent when the input edge did
     *  not carry `tailLabel`/`headLabel`. */
    tailLabelX?: number;
    tailLabelY?: number;
    headLabelX?: number;
    headLabelY?: number;
    spline?: boolean;
    reversed?: boolean;
  }>;
  width: number;
  height: number;
  /** G5 C2: real per-cluster bbox from graphviz's own subgraph-cluster
   *  layout (graphviz-ts 0.1.26072115's `getLayout().clusters`, see
   *  docs/graphviz-issues/06-cluster-bbox-not-in-getlayout.md's RESOLVED
   *  note) — keyed by `DotInputCluster.id` (re-mapped from graphviz-ts's own
   *  `cluster<N>` naming by `graph-layout-build.ts#addClusters`'s
   *  `ClusterIndex`, NOT graphviz-ts's internal name). `x`/`y` are the
   *  top-left corner in the SAME origin-shifted frame as `nodes`/`edges`
   *  (`shiftToOrigin` applies the identical node/edge-derived translation to
   *  these boxes too — clusters never participate in DERIVING that
   *  translation, only in receiving it, so pre-existing node/edge output is
   *  byte-identical for every caller that ignores this field). Absent when
   *  the input graph carried no `clusters` (mirrors `DotInputGraph.clusters`
   *  itself being optional) — additive, no existing consumer reads this yet.
   *  Replaces the entity-vs-cluster wrap APPROXIMATION named in G4 §S1/S3/S6
   *  ("mechanism 16") and `state-composite-geo.ts#materializeCluster`'s own
   *  fixed-`BOX_PAD` bounding box. */
  clusters?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
}

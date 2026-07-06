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
    /** Tail/head end labels (association cardinality/roles). Emitter-only. */
    tailLabelWidth?: number;
    tailLabelHeight?: number;
    headLabelWidth?: number;
    headLabelHeight?: number;
    /** Invisible constraint edge (Svek `style=invis`). Emitter-only. */
    invis?: boolean;
    xlabel?: string;
    xlabelWidth?: number;
    xlabelHeight?: number;
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
}

export interface DotInputGraph {
  nodes: DotInputNode[];
  edges: DotInputEdge[];
  rankDir?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSep?: number;
  rankSep?: number;
  aspect?: number;
  /** Cluster structure for Svek-DOT emission. Layout ignores it (clusters are
   *  still resolved post-layout); only the emitter reads it. Emitter-only. */
  clusters?: DotInputCluster[];
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
    spline?: boolean;
    reversed?: boolean;
  }>;
  width: number;
  height: number;
}

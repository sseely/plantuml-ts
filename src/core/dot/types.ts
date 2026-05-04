export interface DotInputNode {
  id: string;
  width: number;
  height: number;
  attributes?: {
    rank?: 'source' | 'sink' | 'same' | 'min' | 'max';
  };
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
  };
}

export interface DotInputGraph {
  nodes: DotInputNode[];
  edges: DotInputEdge[];
  rankDir?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSep?: number;
  rankSep?: number;
  aspect?: number;
}

export interface DotNode {
  id: string;
  width: number;
  height: number;
  rank: number;
  order: number;
  x: number;
  y: number;
  virtual: boolean;
  /** Cluster identifier — set when this node belongs to a named cluster. */
  clusterId?: string;
  // rank constraint support (union-find)
  ranktype?: 'same' | 'min' | 'max' | 'source' | 'sink';
  ufParent?: DotNode;
  ufSize?: number;
  // network simplex tree metadata
  /** parent tree edge in the spanning tree */
  par?: DotEdge | null;
  /** DFS low index (min DFS index in subtree) */
  low?: number;
  /** DFS lim index (max DFS index in subtree) */
  lim?: number;
  /** in-degree counter used during init_rank topological scan */
  priority?: number;
  /** tree-in adjacency list (tree edges with this node as head) */
  treeIn?: DotEdge[];
  /** tree-out adjacency list (tree edges with this node as tail) */
  treeOut?: DotEdge[];
  /** mark flag (used during feasible tree construction) */
  mark?: boolean;
  /** subtree pointer during feasible tree construction */
  subtree?: Subtree | null;
  // flat (same-rank) edge arrays — populated by agflatten(), cleared by unflatten()
  /** outgoing flat edges (both endpoints on same rank) — C: ND_flat_out */
  flatOut?: DotEdge[];
  /** incoming flat edges (both endpoints on same rank) — C: ND_flat_in */
  flatIn?: DotEdge[];
}

export interface DotEdge {
  id: string;
  from: DotNode;
  to: DotNode;
  weight: number;
  minLen: number;
  reversed: boolean;
  /** Carried from DotInputEdge.attributes.tailportY */
  tailportY?: number;
  virtualNodes?: DotNode[];
  points: Array<{ x: number; y: number }>;
  // network simplex fields
  /** true if part of feasible spanning tree */
  inTree?: boolean;
  /** index in Tree_edge array; -1 if not a tree edge */
  treeIndex?: number;
  /** cut value for this tree edge */
  cutValue?: number;
  /** cached slack: to.rank - from.rank - minLen */
  slack?: number;
  // label placement
  label?: string;
  labelWidth?: number;
  labelHeight?: number;
  labelNode?: DotNode;
  labelX?: number;
  labelY?: number;
  // spline routing
  spline?: boolean;
  /**
   * DFS edge classification — set by class1().
   * Architecture decision D2: string literal union, not a numeric enum.
   *   'tree'    — edge used to discover a new (unvisited) node
   *   'forward' — edge from ancestor to already-finished descendant
   *   'back'    — edge to an ancestor in the current DFS stack
   *   'cross'   — edge to an already-finished non-ancestor node
   */
  type?: 'tree' | 'forward' | 'back' | 'cross';
  /** Compound edge: redirect head to this named cluster's border node. */
  lhead?: string;
  /** Compound edge: redirect tail to this named cluster's border node. */
  ltail?: string;
}

/** Union-find subtree record used during feasible_tree construction */
export interface Subtree {
  rep: DotNode;
  size: number;
  heapIndex: number;
  par: Subtree | null;
}

/** Min/max rank bounds for a cluster, computed by dot_clust(). */
export interface ClusterBounds {
  minRank: number;
  maxRank: number;
}

export interface DotWorkingGraph {
  nodes: DotNode[];
  edges: DotEdge[];
  /** Long edges (rank span > 1) removed from edges and replaced by virtual segment edges. */
  longEdges: DotEdge[];
  rankDir: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSep: number;
  rankSep: number;
  /** True when edgelabel_ranks() doubled minLen to insert interleaved label ranks. */
  hasEdgeLabels?: boolean;
  // rank constraint sets
  minSetLeader?: DotNode | null;
  maxSetLeader?: DotNode | null;
  /** Cluster rank bounds computed by dot_clust(); populated after removeAcyclic. */
  clusters?: Map<string, ClusterBounds>;
}

export interface DotLayoutResult {
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>;
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

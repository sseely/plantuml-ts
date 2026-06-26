// Consumer-facing graph-layout types.
//
// Relocated verbatim (names + shapes) from the deleted `src/core/dot/types.ts`
// per plans/burn-graphviz-engines/decisions.md#d4. These are the only types the
// six graph diagram renderers read; the engine-internal working types (DotNode,
// DotEdge, DotWorkingGraph) died with the in-house engines.

export interface DotInputNode {
  id: string;
  width: number;
  height: number;
  xlabel?: string;
  xlabelWidth?: number;
  xlabelHeight?: number;
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
    xlabel?: string;
    xlabelWidth?: number;
    xlabelHeight?: number;
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

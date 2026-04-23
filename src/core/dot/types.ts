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
  };
}

export interface DotInputGraph {
  nodes: DotInputNode[];
  edges: DotInputEdge[];
  rankDir?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSep?: number;
  rankSep?: number;
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
}

export interface DotEdge {
  id: string;
  from: DotNode;
  to: DotNode;
  weight: number;
  minLen: number;
  reversed: boolean;
  virtualNodes?: DotNode[];
  points: Array<{ x: number; y: number }>;
}

export interface DotWorkingGraph {
  nodes: DotNode[];
  edges: DotEdge[];
  rankDir: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSep: number;
  rankSep: number;
}

export interface DotLayoutResult {
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  edges: Array<{ id: string; points: Array<{ x: number; y: number }> }>;
  width: number;
  height: number;
}

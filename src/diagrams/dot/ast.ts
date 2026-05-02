import type { Theme } from '../../core/theme.js';

export type DotGraphType = 'digraph' | 'graph';
export type DotNodeShape = 'ellipse' | 'box' | 'circle' | 'diamond' | 'plaintext';

export interface DotNodeDef {
  id: string;
  label: string;       // defaults to id if not specified
  shape: DotNodeShape; // defaults to 'ellipse'
  widthIn: number | null;  // DOT width attr in inches; null = use measurement
  heightIn: number | null;
  rank: 'source' | 'sink' | 'same' | 'min' | 'max' | null;
}

export interface DotEdgeDef {
  id: string;    // generated: `e${index}`
  from: string;
  to: string;
  label: string | null;
  weight: number | null;
  minLen: number | null;
}

export interface DotDiagramAST {
  graphType: DotGraphType;
  strict: boolean;
  name: string | null;
  title: string | null;
  rankDir: 'TB' | 'LR' | 'BT' | 'RL' | null;
  nodeSep: number | null;
  rankSep: number | null;
  skinparamLines: string[];
  /** Raw <style> block strings extracted by the preprocessor. */
  rawStyles: readonly string[];
  nodes: DotNodeDef[];
  edges: DotEdgeDef[];
}

// Geometry types (defined here to avoid circular imports — used by layout.ts and renderer.ts)
export interface DotNodeGeo {
  id: string;
  label: string;
  shape: DotNodeShape;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DotEdgeGeo {
  id: string;
  from: string;
  to: string;
  label: string | null;
  points: Array<{ x: number; y: number }>;
  directed: boolean;
}

export interface DotGeometry {
  nodes: DotNodeGeo[];
  edges: DotEdgeGeo[];
  title: string | null;
  totalWidth: number;
  totalHeight: number;
  /** Resolved theme (after skinparam / style overrides). Renderer prefers this over the base theme. */
  resolvedTheme?: Theme;
}

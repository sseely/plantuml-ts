import type { Theme } from '../../core/theme.js';
import type { DiagramAnnotations } from '../../core/annotations/index.js';

export type DotGraphType = 'digraph' | 'graph';
export type DotNodeShape = 'ellipse' | 'box' | 'circle' | 'diamond' | 'plaintext';

export interface DotNodeDef {
  id: string;
  label: string;       // defaults to id if not specified
  shape: DotNodeShape; // defaults to 'ellipse'
  widthIn: number | null;  // DOT width attr in inches; null = use measurement
  heightIn: number | null;
  rank: 'source' | 'sink' | 'same' | 'min' | 'max' | null;
  /** Node-level color attributes (C: N_color, N_fillcolor). */
  nodeColor?: string;
  fillColor?: string;
  /** True when style=filled is set (C: istyle.filled). */
  styleFilled?: boolean;
}

export interface DotEdgeDef {
  id: string;    // generated: `e${index}`
  from: string;
  to: string;
  label: string | null;
  weight: number | null;
  minLen: number | null;
  dir?: 'forward' | 'back' | 'both' | 'none';
  edgeStyle?: 'dashed' | 'dotted' | 'bold';
}

export interface DotClusterDef {
  id: string;
  label: string | null;
  nodeIds: string[];
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
  clusters: DotClusterDef[];
  /**
   * caption/legend/header/footer/mainframe chrome (mission G0b/T6). `title`
   * is deliberately NOT routed through this yet -- dot's bespoke `title`
   * field above stays authoritative until T8 migrates it to shared chrome.
   * Always populated by `parseDot` (default `createAnnotations()`).
   */
  annotations?: DiagramAnnotations;
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
  nodeColor?: string;
  fillColor?: string;
  styleFilled?: boolean;
}

export interface DotEdgeGeo {
  id: string;
  from: string;
  to: string;
  label: string | null;
  points: Array<{ x: number; y: number }>;
  directed: boolean;
  dir?: 'forward' | 'back' | 'both' | 'none';
  edgeStyle?: 'dashed' | 'dotted' | 'bold';
  labelX?: number;
  labelY?: number;
  labelWidth?: number;
  labelHeight?: number;
  spline?: boolean;
}

export interface DotClusterGeo {
  id: string;
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Measured pixel height of the label text (absent when label is null). */
  labelHeight?: number;
  /** Measured pixel width of the label text (absent when label is null). */
  labelWidth?: number;
}

export interface DotGeometry {
  nodes: DotNodeGeo[];
  edges: DotEdgeGeo[];
  clusters: DotClusterGeo[];
  title: string | null;
  totalWidth: number;
  totalHeight: number;
  titleWidth?: number;
  /** Resolved theme (after skinparam / style overrides). Renderer prefers this over the base theme. */
  resolvedTheme?: Theme;
}

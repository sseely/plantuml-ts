import type { Theme } from '../../core/theme.js';
import type { DiagramAnnotations } from '../../core/annotations/index.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';

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
   * title/caption/legend/header/footer/mainframe chrome (mission G0b/T8).
   * `title` used to live on a bespoke `ast.title` field with its own
   * TITLE_HEIGHT band in the renderer (decisions.md D10); T8 removed that
   * chain entirely -- title now flows through here like the other five and
   * is drawn once, centrally, by `applyChrome` (src/index.ts).
   *
   * IMPORTANT (jar-verified, T8): decisions.md D10's premise -- "upstream
   * directdot ... [is a] `TitledDiagram`" -- does NOT hold for `dot`. Java
   * `net.sourceforge.plantuml.directdot.PSystemDot` extends
   * `DirectOsDiagram`: it shells out to the real `dot` binary and streams
   * its raw SVG through unmodified, entirely bypassing
   * `DiagramChromeFactory`. `PSystemDotFactory.executeLine` also requires
   * the FIRST content line after `@startdot` to itself match the bare
   * GraphViz header (`(strict )?(di)?graph <name>? {`); a `title ...` line
   * before it is unparseable and the jar reports a syntax error (verified
   * against oracle/dist/plantuml-oracle.jar). So `title` support for
   * `@startdot` is -- and always was, pre-mission -- a plantuml-ts-only
   * addition with no upstream reference to preserve or jar-verify against;
   * this migration only consolidates that pre-existing addition onto the
   * SAME shared chrome mechanism already jar-verified for json/chart/
   * sequence/class, per D10's still-valid general intent (one chrome
   * implementation, not three).
   * Always populated by `parseDot` (default `createAnnotations()`).
   */
  annotations?: DiagramAnnotations;
  /**
   * `sprite $name [WxH/N[z]] { ... }` definitions (mission SI5b/T4),
   * populated by {@link matchSpriteCommand} at the SAME dispatch position
   * as {@link matchAnnotationCommand} (tried immediately after it, mirroring
   * upstream's `CommonCommands.addTitleCommands` then `addCommonCommands2`
   * registration order). Optional so hand-authored AST literal fixtures
   * compile unchanged; a real `parseDot()` call always sets it via
   * `createSpriteRegistry()`.
   */
  sprites?: SpriteRegistry;
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
  totalWidth: number;
  totalHeight: number;
  /** Resolved theme (after skinparam / style overrides). Renderer prefers this over the base theme. */
  resolvedTheme?: Theme;
}

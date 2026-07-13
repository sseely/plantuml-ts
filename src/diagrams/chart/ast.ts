import type { DiagramAnnotations } from '../../core/annotations/index.js';

export type SeriesType = 'bar' | 'line' | 'area' | 'scatter';
export type MarkerShape = 'circle' | 'square' | 'triangle';
export type LegendPosition = 'none' | 'left' | 'right' | 'top' | 'bottom';
export type GridMode = 'off' | 'major';
export type StackMode = 'grouped' | 'stacked';
export type Orientation = 'vertical' | 'horizontal';
export type LabelPosition = 'default' | 'top' | 'right';

export interface ChartAxisDef {
  title: string;
  min: number;
  max: number;
  autoScale: boolean; // true until explicit range is set
  labels: string[]; // categorical labels (empty = numeric mode)
  customTicks: Map<number, string> | null;
  tickSpacing: number | null;
  labelPosition: LabelPosition;
  gridMode: GridMode;
}

export interface ChartSeriesDef {
  name: string;
  type: SeriesType;
  values: number[]; // y-values
  xValues: number[] | null; // null = index-based; non-null = coordinate pairs
  color: string | null; // raw hex e.g. '#FF0000', or null for default
  useSecondaryAxis: boolean;
  showLabels: boolean;
  markerShape: MarkerShape;
  markerSize: number | null; // null = use default (8px diameter)
}

export interface ChartAnnotationDef {
  text: string;
  xPos: number | string; // number for numeric h-axis, string for categorical
  yPos: number;
  hasArrow: boolean;
}

export interface ChartDiagramAST {
  hAxis: ChartAxisDef;
  vAxis: ChartAxisDef;
  v2Axis: ChartAxisDef | null;
  series: ChartSeriesDef[];
  legendPosition: LegendPosition;
  stackMode: StackMode;
  orientation: Orientation;
  annotations: ChartAnnotationDef[];
  errors: string[]; // validation errors; non-empty = render error diagram
  /**
   * title/caption/legend/header/footer/mainframe chrome (mission G0b/T6,
   * T8). Named `chrome`, NOT `annotations` -- this type already has an
   * unrelated pre-existing `annotations: ChartAnnotationDef[]` field
   * (plot text/arrow callouts), so the usual `annotations`/
   * `DiagramAnnotations` naming convention used by every other engine's
   * AST would collide here. `title` used to live on a separate bespoke
   * `title: string` field (drawn in a fixed TITLE_SPACE band, T6); T8
   * removed that field -- title now flows through `chrome.title` like
   * the other five and is drawn once, centrally, by `applyChrome`
   * (src/index.ts). Always populated by `parseChart` (default
   * `createAnnotations()`).
   */
  chrome?: DiagramAnnotations;
}

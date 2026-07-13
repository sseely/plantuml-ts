import type { DiagramAnnotations } from '../../core/annotations/index.js';

export interface ChronologyEvent {
  name: string;
  timestampMs: number;
}

export interface ChronologyDiagramAST {
  events: ChronologyEvent[];
  /** title/caption/legend/header/footer/mainframe chrome (mission G0b).
   * Always populated by `parseChronology` (default `createAnnotations()`). */
  annotations?: DiagramAnnotations;
}

export interface EventGeometry {
  name: string;
  x: number;
  labelAbove: boolean;
}

export interface DayTick {
  x: number;
  label: string;
}

export interface ChronologyGeometry {
  events: EventGeometry[];
  dayTicks: DayTick[];
  totalWidth: number;
  totalHeight: number;
  baselineY: number;
  headerHeight: number;
}

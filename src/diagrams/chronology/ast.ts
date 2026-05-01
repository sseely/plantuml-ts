export interface ChronologyEvent {
  name: string;
  timestampMs: number;
}

export interface ChronologyDiagramAST {
  events: ChronologyEvent[];
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

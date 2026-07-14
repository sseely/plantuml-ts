import type { DiagramAnnotations } from '../../core/annotations/index.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';

export interface ChronologyEvent {
  name: string;
  timestampMs: number;
}

export interface ChronologyDiagramAST {
  events: ChronologyEvent[];
  /** title/caption/legend/header/footer/mainframe chrome (mission G0b).
   * Always populated by `parseChronology` (default `createAnnotations()`). */
  annotations?: DiagramAnnotations;
  /**
   * `sprite $name [WxH/N[z]] { ... }` definitions (mission SI5b/T4),
   * populated by {@link matchSpriteCommand} at the SAME dispatch position
   * as {@link matchAnnotationCommand} (tried immediately after it, mirroring
   * upstream's `CommonCommands.addTitleCommands` then `addCommonCommands2`
   * registration order). Optional so hand-authored AST literal fixtures
   * compile unchanged; a real `parseChronology()` call always sets it via
   * `createSpriteRegistry()`.
   */
  sprites?: SpriteRegistry;
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

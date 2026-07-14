import type { DiagramAnnotations } from '../../core/annotations/index.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';

export type ScaleDirection = 'ltr' | 'rtl';

export interface PacketItem {
  bitStart: number;
  bitEnd: number;
  width: number;
  height: number;
  label: string;
}

export interface PacketBlock {
  width: number;
  height: number;
  label: string;
  leftOpen: boolean;
  rightOpen: boolean;
}

export interface PacketIndicator {
  bitNumber: number;
  full: boolean;
  numbered: boolean;
}

export interface PacketDiagramAST {
  colWidth: number;
  bitHeight: number;
  scaleDirection: ScaleDirection;
  scaleInterval: number | null;
  sameHeight: boolean;
  items: PacketItem[];
  /** title/caption/legend/header/footer/mainframe chrome (mission G0b).
   * Always populated by `parsePacket` (default `createAnnotations()`). */
  annotations?: DiagramAnnotations;
  /**
   * `sprite $name [WxH/N[z]] { ... }` definitions (mission SI5b/T4),
   * populated by {@link matchSpriteCommand} at the SAME dispatch position
   * as {@link matchAnnotationCommand} (tried immediately after it, mirroring
   * upstream's `CommonCommands.addTitleCommands` then `addCommonCommands2`
   * registration order). Optional so hand-authored AST literal fixtures
   * compile unchanged; a real `parsePacket()` call always sets it via
   * `createSpriteRegistry()`.
   */
  sprites?: SpriteRegistry;
}

export interface PacketGeometry {
  grid: PacketBlock[][];
  indicators: PacketIndicator[];
  colWidth: number;
  bitWidth: number;
  bitHeight: number;
  indicatorHeight: number;
  totalWidth: number;
  totalHeight: number;
}

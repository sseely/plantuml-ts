import type { DiagramAnnotations } from '../../core/annotations/index.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';

export interface BoardNode {
  name: string;
  stage: number;
  children: BoardNode[];
}

export interface BoardActivity {
  name: string;
  root: BoardNode;
}

export interface BoardDiagramAST {
  activities: BoardActivity[];
  /** title/caption/legend/header/footer/mainframe chrome (mission G0b).
   * Always populated by `parseBoard` (default `createAnnotations()`). */
  annotations?: DiagramAnnotations;
  /**
   * `sprite $name [WxH/N[z]] { ... }` definitions (mission SI5b/T4),
   * populated by {@link matchSpriteCommand} at the SAME dispatch position
   * as {@link matchAnnotationCommand} (tried immediately after it, mirroring
   * upstream's `CommonCommands.addTitleCommands` then `addCommonCommands2`
   * registration order). Optional so hand-authored AST literal fixtures
   * compile unchanged; a real `parseBoard()` call always sets it via
   * `createSpriteRegistry()`.
   */
  sprites?: SpriteRegistry;
}

export interface CardGeometry {
  label: string;
  dx: number;
  dy: number;
}

export interface ActivityGeometry {
  xOffset: number;
  fullWidth: number;
  cards: CardGeometry[];
}

export interface BoardGeometry {
  activities: ActivityGeometry[];
  totalWidth: number;
  maxStage: number;
}

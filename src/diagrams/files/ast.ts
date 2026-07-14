import type { DiagramAnnotations } from '../../core/annotations/index.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';

export type FileEntryType = 'folder' | 'file' | 'note';

export interface FileEntry {
  type: FileEntryType;
  name: string;          // empty string for root; note lines stored separately
  children: FileEntry[];
  noteLines?: string[];  // only set when type === 'note'
}

export interface FilesDiagramAST {
  root: FileEntry;       // root.children are the top-level entries
  /** title/caption/legend/header/footer/mainframe chrome (mission G0b).
   * Always populated by `parseFiles` (default `createAnnotations()`). */
  annotations?: DiagramAnnotations;
  /**
   * `sprite $name [WxH/N[z]] { ... }` definitions (mission SI5b/T4),
   * populated by {@link matchSpriteCommand} at the SAME dispatch position
   * as {@link matchAnnotationCommand} (tried immediately after it, mirroring
   * upstream's `CommonCommands.addTitleCommands` then `addCommonCommands2`
   * registration order). Optional so hand-authored AST literal fixtures
   * compile unchanged; a real `parseFiles()` call always sets it via
   * `createSpriteRegistry()`.
   */
  sprites?: SpriteRegistry;
}

export interface EntryGeometry {
  type: FileEntryType;
  name: string;
  depth: number;
  x: number;             // left pixel (depth * INDENT)
  y: number;             // top pixel (rowIndex * ROW_HEIGHT)
  noteLines?: string[];
  labelWidth: number;    // measured pixel width of icon + space + name
}

export interface FilesGeometry {
  entries: EntryGeometry[];
  totalWidth: number;
  totalHeight: number;
}

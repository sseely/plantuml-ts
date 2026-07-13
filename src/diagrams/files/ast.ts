import type { DiagramAnnotations } from '../../core/annotations/index.js';

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

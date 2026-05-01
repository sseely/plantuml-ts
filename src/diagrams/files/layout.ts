import type { FileEntry, FilesDiagramAST, EntryGeometry, FilesGeometry } from './ast.js';
import type { StringMeasurer } from '../../core/measurer.js';

const ROW_HEIGHT = 22;
const INDENT = 20;
const PADDING = 10;
const FONT_SIZE = 14;
const FONT_FAMILY = 'sans-serif';

/** Returns the display prefix (icon + space) for folder and file entries. */
function iconPrefix(type: 'folder' | 'file'): string {
  return type === 'folder' ? '📂 ' : '📄 ';
}

function measureNoteWidth(noteLines: string[], measurer: StringMeasurer): number {
  if (noteLines.length === 0) return 0;
  let max = 0;
  for (const line of noteLines) {
    const { width } = measurer.measure(line, { family: FONT_FAMILY, size: FONT_SIZE });
    if (width > max) max = width;
  }
  return max;
}

function traverse(
  node: FileEntry,
  depth: number,
  state: { row: number },
  measurer: StringMeasurer,
  out: EntryGeometry[],
): void {
  let labelWidth: number;
  if (node.type === 'note') {
    labelWidth = measureNoteWidth(node.noteLines ?? [], measurer);
  } else {
    const prefix = iconPrefix(node.type);
    ({ width: labelWidth } = measurer.measure(prefix + node.name, {
      family: FONT_FAMILY,
      size: FONT_SIZE,
    }));
  }

  out.push({
    type: node.type,
    name: node.name,
    depth,
    x: depth * INDENT,
    y: state.row * ROW_HEIGHT,
    ...(node.noteLines !== undefined ? { noteLines: node.noteLines } : {}),
    labelWidth,
  });

  state.row += 1;

  for (const child of node.children) {
    traverse(child, depth + 1, state, measurer, out);
  }
}

export function layoutFiles(ast: FilesDiagramAST, measurer: StringMeasurer): FilesGeometry {
  if (ast.root.children.length === 0) {
    return { entries: [], totalWidth: 0, totalHeight: 0 };
  }

  const entries: EntryGeometry[] = [];
  const state = { row: 0 };

  for (const child of ast.root.children) {
    traverse(child, 0, state, measurer, entries);
  }

  const totalWidth = Math.max(...entries.map((e) => e.x + e.labelWidth)) + PADDING * 2;
  const totalHeight = entries.length * ROW_HEIGHT;

  return { entries, totalWidth, totalHeight };
}

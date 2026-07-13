import { text, noteBox } from '../../core/svg.js';
import type { FilesGeometry, EntryGeometry } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { RenderFragment } from '../../core/dispatcher.js';

const PADDING = 10;
const BASELINE_OFFSET = 4;

const NOTE_STROKE = '#AAAAAA';
const NOTE_FONT = 12;
const NOTE_PAD = 6;
const NOTE_LINE_H = 16;
const NOTE_FALLBACK_WIDTH = 120;

const MIN_WIDTH = 200;

function renderFileOrFolder(entry: EntryGeometry): string {
  const icon = entry.type === 'folder' ? '📂' : '📄';
  const label = icon + ' ' + entry.name;
  return text(entry.x + PADDING, entry.y + BASELINE_OFFSET, label, {
    fontFamily: 'sans-serif',
    fontSize: 14,
    dominantBaseline: 'hanging',
    fill: '#000000',
  });
}

function renderNote(entry: EntryGeometry): string {
  const lines = entry.noteLines ?? [];
  const n = lines.length;
  const boxHeight = n === 0
    ? NOTE_PAD * 2
    : NOTE_PAD * 2 + (n - 1) * NOTE_LINE_H + NOTE_FONT;
  const rawWidth = entry.labelWidth > 0 ? entry.labelWidth : NOTE_FALLBACK_WIDTH;
  const boxWidth = rawWidth + NOTE_PAD * 2;

  const bx = entry.x + PADDING;
  const by = entry.y + 2;

  const box = noteBox(bx, by, boxWidth, boxHeight, { stroke: NOTE_STROKE });

  const lineEls = lines.map((line, i) =>
    text(
      entry.x + PADDING + NOTE_PAD,
      entry.y + 2 + NOTE_PAD + i * NOTE_LINE_H,
      line,
      {
        fontSize: NOTE_FONT,
        fontFamily: 'sans-serif',
        dominantBaseline: 'hanging',
        fill: '#000000',
      },
    ),
  );

  return box + lineEls.join('');
}

function renderEntry(entry: EntryGeometry): string {
  if (entry.type === 'note') {
    return renderNote(entry);
  }
  return renderFileOrFolder(entry);
}

export function renderFiles(geo: FilesGeometry, theme: Theme): RenderFragment {
  const parts: string[] = geo.entries.map(renderEntry);

  const width = Math.max(geo.totalWidth, MIN_WIDTH);
  const height = Math.max(geo.totalHeight, 40);
  return {
    body: parts.join(''),
    width,
    height,
    background: theme.colors.background,
  };
}

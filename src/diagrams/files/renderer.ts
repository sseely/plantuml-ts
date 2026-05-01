import { text, svgRoot } from '../../core/svg.js';
import type { FilesGeometry, EntryGeometry } from './ast.js';
import type { Theme } from '../../core/theme.js';

const PADDING = 10;
const BASELINE_OFFSET = 4;

const NOTE_FILL = '#FEFECE';
const NOTE_STROKE = '#AAAAAA';
const NOTE_FONT = 12;
const NOTE_PAD = 6;
const NOTE_LINE_H = 16;
const NOTE_FALLBACK_WIDTH = 120;
const DOG_EAR = 10;

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
  // Extra 2px at the bottom compensates for font metrics: with dominantBaseline
  // 'hanging', the cap-height doesn't fill the full font-size slot, so the
  // visual gap below the last glyph appears smaller than the top pad.
  const boxHeight = n === 0
    ? NOTE_PAD * 2
    : NOTE_PAD * 2 + (n - 1) * NOTE_LINE_H + NOTE_FONT + 2;
  const rawWidth = entry.labelWidth > 0 ? entry.labelWidth : NOTE_FALLBACK_WIDTH;
  const boxWidth = rawWidth + NOTE_PAD * 2;

  const bx = entry.x + PADDING;
  const by = entry.y + 2;
  const W = boxWidth;
  const H = boxHeight;
  const D = DOG_EAR;

  // Pentagon with top-right corner cut for the dog ear
  const pts = `${bx},${by} ${bx + W - D},${by} ${bx + W},${by + D} ${bx + W},${by + H} ${bx},${by + H}`;
  const body = `<polygon points="${pts}" fill="${NOTE_FILL}" stroke="${NOTE_STROKE}" stroke-width="1"/>`;

  // Inner fold lines showing the dog ear crease
  const ear = `<polyline points="${bx + W - D},${by} ${bx + W - D},${by + D} ${bx + W},${by + D}" fill="none" stroke="${NOTE_STROKE}" stroke-width="1"/>`;

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

  return body + ear + lineEls.join('');
}

function renderEntry(entry: EntryGeometry): string {
  if (entry.type === 'note') {
    return renderNote(entry);
  }
  return renderFileOrFolder(entry);
}

export function renderFiles(geo: FilesGeometry, theme: Theme): string {
  const parts: string[] = geo.entries.map(renderEntry);

  const width = Math.max(geo.totalWidth, MIN_WIDTH);
  const height = Math.max(geo.totalHeight, 40);
  return svgRoot(width, height, parts, theme.colors.background);
}

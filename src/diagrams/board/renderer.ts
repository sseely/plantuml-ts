import { rect, line, text, svgRoot } from '../../core/svg.js';
import type { BoardGeometry } from './ast.js';
import type { Theme } from '../../core/theme.js';

const CARD_W = 150;
const CARD_H = 70;
const CELL_H = 90;
const INSET = 10;

function renderCard(cx: number, cy: number, label: string): string {
  const shadow = rect(cx + 1, cy + 1, CARD_W, CARD_H, { fill: '#AAAAAA' });
  const box = rect(cx, cy, CARD_W, CARD_H, {
    fill: '#D3D3D3',
    stroke: '#000000',
    strokeWidth: 1,
  });
  const labelEl = text(cx + 3, cy + 3, label, {
    fontFamily: 'sans-serif',
    fontSize: 14,
    dominantBaseline: 'hanging',
    fill: '#000000',
  });
  return shadow + box + labelEl;
}

export function renderBoard(geo: BoardGeometry, theme: Theme): string {
  const parts: string[] = [];

  for (const activity of geo.activities) {
    const ox = activity.xOffset;
    const headerLabel = activity.cards[0]?.label ?? '';

    // Header card drawn first (mirrors Java Activity.getBox().drawU()) — Decision E
    parts.push(renderCard(ox + INSET, INSET, headerLabel));

    // All BArray cards, including root at (dx=0, dy=0) — root drawn twice per Decision E
    for (const card of activity.cards) {
      parts.push(renderCard(ox + card.dx + INSET, card.dy + INSET, card.label));
    }
  }

  // Horizontal dashed row separator lines (BoardDiagram.drawMe)
  for (let i = 0; i < geo.maxStage; i++) {
    const y = (i + 1) * CELL_H - 10;
    parts.push(
      line(0, y, geo.totalWidth, y, {
        stroke: '#000000',
        strokeWidth: 0.5,
        strokeDasharray: '5 5',
      }),
    );
  }

  const width = geo.totalWidth || 10;
  const height = (geo.maxStage + 1) * CELL_H || 10;
  return svgRoot(width, height, parts, theme.colors.background);
}

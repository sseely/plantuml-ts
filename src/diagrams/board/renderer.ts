import { rect, line, text, svgRoot } from '../../core/svg.js';
import type { BoardGeometry } from './ast.js';
import type { Theme } from '../../core/theme.js';

const CARD_W = 150;
const CARD_H = 70;
const CELL_H = 90;
const MARGIN = 10;
const SHADOW_ID = 'board-card-shadow';

const SHADOW_FILTER =
  `<filter id="${SHADOW_ID}" x="-1" y="-1" width="300%" height="300%">` +
  `<feGaussianBlur result="blurOut" stdDeviation="2"/>` +
  `<feColorMatrix type="matrix" in="blurOut" result="blurOut2" ` +
  `values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .4 0"/>` +
  `<feOffset result="blurOut3" in="blurOut2" dx="4" dy="4"/>` +
  `<feBlend in="SourceGraphic" in2="blurOut3" mode="normal"/>` +
  `</filter>`;

function renderCard(cx: number, cy: number, label: string): string {
  const box = rect(cx, cy, CARD_W, CARD_H, {
    fill: '#D3D3D3',
    stroke: '#000000',
    strokeWidth: 1,
    filter: `url(#${SHADOW_ID})`,
  });
  const labelEl = text(cx + 3, cy + 3, label, {
    fontFamily: 'sans-serif',
    fontSize: 14,
    dominantBaseline: 'hanging',
    fill: '#000000',
  });
  return box + labelEl;
}

export function renderBoard(geo: BoardGeometry, theme: Theme): string {
  const parts: string[] = [];

  for (const activity of geo.activities) {
    const ox = activity.xOffset;
    const headerLabel = activity.cards[0]?.label ?? '';

    // Header card drawn first (mirrors Java Activity.getBox().drawU()) — Decision E
    parts.push(renderCard(ox + MARGIN, MARGIN, headerLabel));

    // All BArray cards, including root at (dx=0, dy=0) — root drawn twice per Decision E
    for (const card of activity.cards) {
      parts.push(renderCard(ox + card.dx + MARGIN, card.dy + MARGIN, card.label));
    }
  }

  // Horizontal dashed row separator lines (BoardDiagram.drawMe)
  for (let i = 0; i < geo.maxStage; i++) {
    const y = (i + 1) * CELL_H - 10 + MARGIN;
    parts.push(
      line(MARGIN, y, geo.totalWidth + MARGIN, y, {
        stroke: '#000000',
        strokeWidth: 0.5,
        strokeDasharray: '5 5',
      }),
    );
  }

  const width = (geo.totalWidth || 10) + 2 * MARGIN;
  const height = ((geo.maxStage + 1) * CELL_H || 10) + 2 * MARGIN;
  return svgRoot(width, height, parts, theme.colors.background, SHADOW_FILTER);
}

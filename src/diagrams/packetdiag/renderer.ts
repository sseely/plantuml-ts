import { rect, line, text } from '../../core/svg.js';
import type { Theme } from '../../core/theme.js';
import type { PacketGeometry } from './ast.js';
import type { RenderFragment } from '../../core/dispatcher.js';
import {
  INDICATOR_HEIGHT,
  V_LINE_SHORT,
  V_MARGIN,
  FONT_ASCENT,
  blockRenderedHeight,
} from './layout.js';

const FONT_SIZE = 14;
const FONT_FAMILY = 'sans-serif';
const BLOCK_FILL = '#F1F1F1';
const BLOCK_STROKE = '#181818';
const BLOCK_STROKE_WIDTH = 0.5;
const TICK_STROKE = '#181818';
const TICK_STROKE_WIDTH = 0.5;
const TEXT_FILL = '#000000';

// Vertical position of the tick line bottom
const TICK_BOTTOM = INDICATOR_HEIGHT; // 56

// Vertical position of full-tick top (below number area)
const NUMBER_HEIGHT = 24;
// Short tick top = NUMBER_HEIGHT + V_LINE_SHORT
const SHORT_TICK_TOP = NUMBER_HEIGHT + V_LINE_SHORT; // 40

// Text baseline for numbers:
// full indicator: 24 - 14 + 11 ≈ 21 (vMargin=10, ascent=11 → ~top of text at y=10, baseline at 21)
const NUMBER_FULL_Y = NUMBER_HEIGHT - FONT_SIZE + FONT_ASCENT; // 24 - 14 + 11 = 21
// short indicator number sits V_LINE_SHORT lower
const NUMBER_SHORT_Y = NUMBER_FULL_Y + V_LINE_SHORT; // 37

const MARGIN_LEFT = 10;

export function renderPacket(geo: PacketGeometry, theme: Theme): RenderFragment {
  const { grid, indicators, bitWidth, bitHeight, indicatorHeight, totalWidth, totalHeight } = geo;
  const parts: string[] = [];

  // --- Indicator row ---
  for (let j = 0; j < indicators.length; j++) {
    const ind = indicators[j]!;
    const tickX = MARGIN_LEFT + j * bitWidth;
    const tickY1 = ind.full ? NUMBER_HEIGHT : SHORT_TICK_TOP;

    if (ind.numbered) {
      const numY = ind.full ? NUMBER_FULL_Y : NUMBER_SHORT_Y;
      parts.push(
        text(tickX, numY, String(ind.bitNumber), {
          fontFamily: FONT_FAMILY,
          fontSize: FONT_SIZE,
          fill: TEXT_FILL,
          textAnchor: 'middle',
        }),
      );
    }

    parts.push(
      line(tickX, tickY1, tickX, TICK_BOTTOM, {
        stroke: TICK_STROKE,
        strokeWidth: TICK_STROKE_WIDTH,
      }),
    );
  }

  // --- Block grid ---
  let rowY = indicatorHeight;
  for (const row of grid) {
    let maxHeightUnits = 1;
    for (const b of row) maxHeightUnits = Math.max(maxHeightUnits, b.height);
    const rowH = blockRenderedHeight(maxHeightUnits, bitHeight);

    let blockX = MARGIN_LEFT;
    for (const block of row) {
      const blockW = block.width * bitWidth;

      if (blockW > 0) {
        parts.push(
          rect(blockX, rowY, blockW, rowH, {
            fill: BLOCK_FILL,
            stroke: BLOCK_STROKE,
            strokeWidth: BLOCK_STROKE_WIDTH,
          }),
        );

        if (block.label !== '') {
          const totalSpare = Math.max(0, rowH - FONT_SIZE - 2 * V_MARGIN);
          const topSpare = totalSpare / 2;
          const labelY = rowY + V_MARGIN + topSpare + FONT_ASCENT;
          const labelX = blockX + blockW / 2;
          parts.push(
            text(labelX, labelY, block.label, {
              fontFamily: FONT_FAMILY,
              fontSize: FONT_SIZE,
              fill: TEXT_FILL,
              textAnchor: 'middle',
            }),
          );
        }
      }

      blockX += blockW;
    }

    rowY += rowH;
  }

  return {
    body: parts.join(''),
    width: totalWidth,
    height: totalHeight,
    background: theme.colors.background,
  };
}

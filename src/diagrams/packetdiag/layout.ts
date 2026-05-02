import type {
  PacketBlock,
  PacketDiagramAST,
  PacketGeometry,
  PacketIndicator,
  PacketItem,
  ScaleDirection,
} from './ast.js';

const FONT_SIZE = 14;
const BIT_SCALE = 3.0;
const V_LINE_FULL = 32;
export const V_LINE_SHORT = 16;
const NUMBER_HEIGHT = 24;
export const INDICATOR_HEIGHT = NUMBER_HEIGHT + V_LINE_FULL;
const MARGIN_LEFT = 10;
const MARGIN_RIGHT = 11;
const MARGIN_BOTTOM = 11;
export const V_MARGIN = 10;
export const FONT_ASCENT = 11;

export function blockRenderedHeight(heightUnits: number, bitHeight: number): number {
  return Math.max(heightUnits * bitHeight, FONT_SIZE + 2 * V_MARGIN);
}

function fullIndicatorInterval(colWidth: number): number {
  return colWidth >= 4 ? Math.floor(colWidth / 4) : colWidth;
}

function buildGrid(
  items: PacketItem[],
  colWidth: number,
  sameHeight: boolean,
  scaleDirection: ScaleDirection,
): PacketBlock[][] {
  const grid: PacketBlock[][] = [];
  let currRow: PacketBlock[] = [];
  let remainRowWidth = colWidth;

  for (const item of items) {
    if (item.width <= 0) {
      currRow.push({
        width: 0,
        height: item.height,
        label: item.label,
        leftOpen: false,
        rightOpen: false,
      });
      continue;
    }

    const overflow = item.width - remainRowWidth;
    if (overflow > 0) {
      currRow.push({
        width: remainRowWidth,
        height: item.height,
        label: item.label,
        leftOpen: false,
        rightOpen: true,
      });
      grid.push(currRow);
      currRow = [];
      remainRowWidth = colWidth;

      const restWidth = overflow;
      const rowCnt = Math.floor(restWidth / colWidth);
      const remain = restWidth % colWidth;

      for (let i = 0; i < rowCnt; i++) {
        grid.push([
          {
            width: colWidth,
            height: item.height,
            label: item.label,
            leftOpen: true,
            rightOpen: true,
          },
        ]);
      }

      if (remain > 0) {
        currRow.push({
          width: remain,
          height: item.height,
          label: item.label,
          leftOpen: true,
          rightOpen: false,
        });
        remainRowWidth -= remain;
      } else {
        grid[grid.length - 1]![0]!.rightOpen = false;
      }
    } else {
      currRow.push({
        width: item.width,
        height: item.height,
        label: item.label,
        leftOpen: false,
        rightOpen: false,
      });
      remainRowWidth -= item.width;
      if (remainRowWidth === 0) {
        remainRowWidth = colWidth;
        grid.push(currRow);
        currRow = [];
      }
    }
  }

  if (currRow.length > 0) {
    grid.push(currRow);
  }

  for (const row of grid) {
    if (sameHeight) {
      const maxH = row.reduce((m, b) => Math.max(m, b.height), 1);
      for (const b of row) {
        b.height = maxH;
      }
    }
    if (scaleDirection === 'rtl') {
      row.reverse();
    }
  }

  return grid;
}

function buildIndicators(
  colWidth: number,
  scaleInterval: number,
  scaleDirection: ScaleDirection,
): PacketIndicator[] {
  const fullInterval = fullIndicatorInterval(colWidth);
  const indicators: PacketIndicator[] = [];

  for (let j = 0; j <= colWidth; j++) {
    const i = scaleDirection === 'rtl' ? colWidth - j : j;
    const full = fullInterval > 0 ? i % fullInterval === 0 : false;
    const numbered = scaleInterval > 0 ? i % scaleInterval === 0 : false;
    indicators.push({ bitNumber: i, full, numbered });
  }

  return indicators;
}

export function layoutPacket(ast: PacketDiagramAST): PacketGeometry {
  const {
    colWidth: initialColWidth,
    bitHeight,
    scaleDirection,
    scaleInterval: userScaleInterval,
    sameHeight,
    items,
  } = ast;

  const bitWidth = FONT_SIZE * BIT_SCALE;

  // Effective scaleInterval based on ORIGINAL colWidth (before adjustColWidth)
  const effectiveScaleInterval =
    userScaleInterval !== null
      ? Math.min(userScaleInterval, initialColWidth)
      : Math.floor(initialColWidth / 2);

  const grid = buildGrid(items, initialColWidth, sameHeight, scaleDirection);

  // Adjust colWidth: min of first-row total bit-width and declared colWidth.
  // Guard: if first row total is 0 (all 0-width items), keep initialColWidth.
  let colWidth = initialColWidth;
  if (grid.length > 0) {
    const firstRowWidth = grid[0]!.reduce((s, b) => s + b.width, 0);
    if (firstRowWidth > 0) {
      colWidth = Math.min(firstRowWidth, initialColWidth);
    }
  }

  const indicators = buildIndicators(colWidth, effectiveScaleInterval, scaleDirection);

  let totalBlocksHeight = 0;
  for (const row of grid) {
    const maxHeightUnits = row.reduce((m, b) => Math.max(m, b.height), 1);
    totalBlocksHeight += blockRenderedHeight(maxHeightUnits, bitHeight);
  }

  const totalWidth = MARGIN_LEFT + (colWidth + 1) * bitWidth + MARGIN_RIGHT;
  const totalHeight = INDICATOR_HEIGHT + totalBlocksHeight + MARGIN_BOTTOM;

  return {
    grid,
    indicators,
    colWidth,
    bitWidth,
    bitHeight,
    indicatorHeight: INDICATOR_HEIGHT,
    totalWidth,
    totalHeight,
  };
}

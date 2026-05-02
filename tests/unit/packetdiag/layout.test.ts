import { describe, it, expect } from 'vitest';
import { layoutPacket, INDICATOR_HEIGHT, blockRenderedHeight } from '../../../src/diagrams/packetdiag/layout.js';
import type { PacketDiagramAST } from '../../../src/diagrams/packetdiag/ast.js';

function ast(overrides: Partial<PacketDiagramAST> = {}): PacketDiagramAST {
  return {
    colWidth: 16,
    bitHeight: 32,
    scaleDirection: 'ltr',
    scaleInterval: null,
    sameHeight: false,
    items: [],
    ...overrides,
  };
}

// ------------------------------------------------------------------
// blockRenderedHeight helper
// ------------------------------------------------------------------
describe('blockRenderedHeight', () => {
  it('returns max(h*bitHeight, FONT_SIZE + 2*V_MARGIN)', () => {
    // 1 * 32 = 32, FONT_SIZE+2*V_MARGIN = 14+20 = 34  → 34
    expect(blockRenderedHeight(1, 32)).toBe(34);
    // 2 * 32 = 64 > 34 → 64
    expect(blockRenderedHeight(2, 32)).toBe(64);
    // height=0, bitHeight=32 → 0 < 34 → 34
    expect(blockRenderedHeight(0, 32)).toBe(34);
  });
});

// ------------------------------------------------------------------
// indicatorHeight constant
// ------------------------------------------------------------------
describe('INDICATOR_HEIGHT', () => {
  it('is 56 (NUMBER_HEIGHT 24 + V_LINE_FULL 32)', () => {
    expect(INDICATOR_HEIGHT).toBe(56);
  });
});

// ------------------------------------------------------------------
// empty diagram dimensions
// ------------------------------------------------------------------
describe('layoutPacket — empty', () => {
  it('produces correct totalWidth for default colWidth=16', () => {
    const geo = layoutPacket(ast());
    // MARGIN_LEFT(10) + (16+1)*42 + MARGIN_RIGHT(11) = 10 + 714 + 11 = 735
    expect(geo.totalWidth).toBe(735);
  });

  it('produces correct totalHeight for empty items', () => {
    const geo = layoutPacket(ast());
    // INDICATOR_HEIGHT(56) + 0 rows + MARGIN_BOTTOM(11) = 67
    expect(geo.totalHeight).toBe(67);
  });

  it('bitWidth is 42 (FONT_SIZE=14 * BIT_SCALE=3)', () => {
    expect(layoutPacket(ast()).bitWidth).toBe(42);
  });

  it('indicatorHeight is INDICATOR_HEIGHT constant', () => {
    expect(layoutPacket(ast()).indicatorHeight).toBe(INDICATOR_HEIGHT);
  });
});

// ------------------------------------------------------------------
// adjustColWidth: narrows to first-row actual width
// ------------------------------------------------------------------
describe('layoutPacket — adjustColWidth', () => {
  it('colWidth stays 16 when first row fills exactly 16 bits', () => {
    const items = [{ bitStart: 0, bitEnd: 15, width: 16, height: 1, label: 'A' }];
    const geo = layoutPacket(ast({ items }));
    expect(geo.colWidth).toBe(16);
  });

  it('narrows colWidth from 16 to 8 when first row only has 8 bits', () => {
    const items = [{ bitStart: 0, bitEnd: 7, width: 8, height: 1, label: 'A' }];
    const geo = layoutPacket(ast({ items }));
    expect(geo.colWidth).toBe(8);
    // MARGIN_LEFT(10) + (8+1)*42 + MARGIN_RIGHT(11) = 10 + 378 + 11 = 399
    expect(geo.totalWidth).toBe(399);
  });

  it('does not narrow below first-row width when first row is partial', () => {
    // Two items that together are 5 bits (< default 16)
    const items = [
      { bitStart: 0, bitEnd: 2, width: 3, height: 1, label: 'A' },
      { bitStart: 3, bitEnd: 4, width: 2, height: 1, label: 'B' },
    ];
    const geo = layoutPacket(ast({ items }));
    expect(geo.colWidth).toBe(5);
  });

  it('keeps initialColWidth when first row contains only 0-width items', () => {
    const items = [{ bitStart: 0, bitEnd: 0, width: 0, height: 1, label: 'A' }];
    const geo = layoutPacket(ast({ items }));
    expect(geo.colWidth).toBe(16);
  });
});

// ------------------------------------------------------------------
// grid building: single row, multi-row, overflow
// ------------------------------------------------------------------
describe('layoutPacket — grid rows', () => {
  it('places two 8-bit fields in a single row for colWidth=16', () => {
    const items = [
      { bitStart: 0, bitEnd: 7, width: 8, height: 1, label: 'A' },
      { bitStart: 8, bitEnd: 15, width: 8, height: 1, label: 'B' },
    ];
    const geo = layoutPacket(ast({ items }));
    expect(geo.grid).toHaveLength(1);
    expect(geo.grid[0]).toHaveLength(2);
    expect(geo.grid[0]![0]!.label).toBe('A');
    expect(geo.grid[0]![1]!.label).toBe('B');
  });

  it('splits a 32-bit field across two rows of 16', () => {
    const items = [{ bitStart: 0, bitEnd: 31, width: 32, height: 1, label: 'Big' }];
    const geo = layoutPacket(ast({ items }));
    expect(geo.grid).toHaveLength(2);
    expect(geo.grid[0]![0]!.width).toBe(16);
    expect(geo.grid[0]![0]!.rightOpen).toBe(true);
    expect(geo.grid[0]![0]!.leftOpen).toBe(false);
    expect(geo.grid[1]![0]!.width).toBe(16);
    expect(geo.grid[1]![0]!.leftOpen).toBe(true);
    expect(geo.grid[1]![0]!.rightOpen).toBe(false);
  });

  it('splits a 48-bit field into three rows of 16', () => {
    const items = [{ bitStart: 0, bitEnd: 47, width: 48, height: 1, label: 'Big' }];
    const geo = layoutPacket(ast({ items }));
    expect(geo.grid).toHaveLength(3);
    expect(geo.grid[1]![0]!.leftOpen).toBe(true);
    expect(geo.grid[1]![0]!.rightOpen).toBe(true);
    expect(geo.grid[2]![0]!.leftOpen).toBe(true);
    expect(geo.grid[2]![0]!.rightOpen).toBe(false);
  });

  it('starts new row when field fills row exactly', () => {
    const items = [
      { bitStart: 0, bitEnd: 15, width: 16, height: 1, label: 'Row1' },
      { bitStart: 16, bitEnd: 23, width: 8, height: 1, label: 'Row2' },
    ];
    const geo = layoutPacket(ast({ items }));
    expect(geo.grid).toHaveLength(2);
    expect(geo.grid[0]![0]!.label).toBe('Row1');
    expect(geo.grid[1]![0]!.label).toBe('Row2');
  });
});

// ------------------------------------------------------------------
// sameHeight
// ------------------------------------------------------------------
describe('layoutPacket — sameHeight', () => {
  it('without sameHeight, blocks keep their own height', () => {
    const items = [
      { bitStart: 0, bitEnd: 7, width: 8, height: 1, label: 'A' },
      { bitStart: 8, bitEnd: 15, width: 8, height: 3, label: 'B' },
    ];
    const geo = layoutPacket(ast({ items, sameHeight: false }));
    expect(geo.grid[0]![0]!.height).toBe(1);
    expect(geo.grid[0]![1]!.height).toBe(3);
  });

  it('with sameHeight, all blocks in a row adopt max height', () => {
    const items = [
      { bitStart: 0, bitEnd: 7, width: 8, height: 1, label: 'A' },
      { bitStart: 8, bitEnd: 15, width: 8, height: 3, label: 'B' },
    ];
    const geo = layoutPacket(ast({ items, sameHeight: true }));
    expect(geo.grid[0]![0]!.height).toBe(3);
    expect(geo.grid[0]![1]!.height).toBe(3);
  });
});

// ------------------------------------------------------------------
// RTL direction
// ------------------------------------------------------------------
describe('layoutPacket — RTL', () => {
  it('reverses blocks in each row for rtl', () => {
    const items = [
      { bitStart: 0, bitEnd: 7, width: 8, height: 1, label: 'A' },
      { bitStart: 8, bitEnd: 15, width: 8, height: 1, label: 'B' },
    ];
    const geo = layoutPacket(ast({ items, scaleDirection: 'rtl' }));
    expect(geo.grid[0]![0]!.label).toBe('B');
    expect(geo.grid[0]![1]!.label).toBe('A');
  });

  it('indicator numbers count down for rtl', () => {
    const geo = layoutPacket(ast({ colWidth: 4, scaleDirection: 'rtl' }));
    // colWidth=4, so indicators 0..4 with bitNumbers 4,3,2,1,0
    expect(geo.indicators[0]!.bitNumber).toBe(4);
    expect(geo.indicators[4]!.bitNumber).toBe(0);
  });
});

// ------------------------------------------------------------------
// indicators
// ------------------------------------------------------------------
describe('layoutPacket — indicators', () => {
  it('produces colWidth+1 indicators', () => {
    const geo = layoutPacket(ast({ colWidth: 8 }));
    expect(geo.indicators).toHaveLength(9); // 0..8
  });

  it('indicator at i=0 is full for default colWidth=16', () => {
    const geo = layoutPacket(ast());
    // fullInterval = floor(16/4) = 4; 0 % 4 === 0 → full
    expect(geo.indicators[0]!.full).toBe(true);
  });

  it('indicator at i=1 is not full for default colWidth=16', () => {
    const geo = layoutPacket(ast());
    expect(geo.indicators[1]!.full).toBe(false);
  });

  it('indicator at i=4 is full for default colWidth=16 (fullInterval=4)', () => {
    const geo = layoutPacket(ast());
    expect(geo.indicators[4]!.full).toBe(true);
  });

  it('default scaleInterval = floor(colWidth/2), number at 0 and 8 for colWidth=16', () => {
    const geo = layoutPacket(ast());
    // effectiveScaleInterval = floor(16/2) = 8; numbered at j=0 and j=8
    expect(geo.indicators[0]!.numbered).toBe(true);
    expect(geo.indicators[8]!.numbered).toBe(true);
    expect(geo.indicators[4]!.numbered).toBe(false);
  });

  it('explicit scaleInterval=4 numbers every 4th indicator', () => {
    const geo = layoutPacket(ast({ scaleInterval: 4 }));
    expect(geo.indicators[0]!.numbered).toBe(true);
    expect(geo.indicators[4]!.numbered).toBe(true);
    expect(geo.indicators[8]!.numbered).toBe(true);
    expect(geo.indicators[2]!.numbered).toBe(false);
  });

  it('scaleInterval uses original colWidth even after adjustColWidth narrows it', () => {
    // colWidth=16, first row = 8 bits → adjustColWidth sets colWidth=8
    // effectiveScaleInterval = floor(16/2) = 8 (based on original)
    // After adjust, indicators has 9 entries (0..8)
    // indicator at j=8 has bitNumber=8, and 8 % 8 === 0 → numbered
    const items = [{ bitStart: 0, bitEnd: 7, width: 8, height: 1, label: 'A' }];
    const geo = layoutPacket(ast({ items }));
    expect(geo.colWidth).toBe(8);
    expect(geo.indicators).toHaveLength(9);
    expect(geo.indicators[8]!.numbered).toBe(true);
  });

  it('colWidth=3 has fullInterval=3 (< 4 branch)', () => {
    const geo = layoutPacket(ast({ colWidth: 3 }));
    // fullInterval = 3; full at j=0 and j=3
    expect(geo.indicators[0]!.full).toBe(true);
    expect(geo.indicators[3]!.full).toBe(true);
    expect(geo.indicators[1]!.full).toBe(false);
  });
});

// ------------------------------------------------------------------
// totalHeight with rows
// ------------------------------------------------------------------
describe('layoutPacket — totalHeight', () => {
  it('adds one row height for a single-row diagram', () => {
    const items = [{ bitStart: 0, bitEnd: 15, width: 16, height: 1, label: 'A' }];
    const geo = layoutPacket(ast({ items }));
    // INDICATOR_HEIGHT(56) + blockRenderedHeight(1,32)(34) + MARGIN_BOTTOM(11) = 101
    expect(geo.totalHeight).toBe(101);
  });

  it('adds two row heights for a two-row diagram', () => {
    const items = [
      { bitStart: 0, bitEnd: 15, width: 16, height: 1, label: 'A' },
      { bitStart: 16, bitEnd: 31, width: 16, height: 1, label: 'B' },
    ];
    const geo = layoutPacket(ast({ items }));
    // 56 + 34 + 34 + 11 = 135
    expect(geo.totalHeight).toBe(135);
  });

  it('height=2 block uses bitHeight=32: blockRenderedHeight(2,32)=64', () => {
    const items = [{ bitStart: 0, bitEnd: 15, width: 16, height: 2, label: 'A' }];
    const geo = layoutPacket(ast({ items }));
    // 56 + 64 + 11 = 131
    expect(geo.totalHeight).toBe(131);
  });
});

import { describe, it, expect } from 'vitest';
import { renderPacket } from '../../../src/diagrams/packetdiag/renderer.js';
import { assembleSvg } from '../../../src/index.js';
import type { PacketGeometry } from '../../../src/diagrams/packetdiag/ast.js';
import { INDICATOR_HEIGHT } from '../../../src/diagrams/packetdiag/layout.js';
import { defaultTheme } from '../../../src/core/theme.js';

const THEME = defaultTheme;

function geo(overrides: Partial<PacketGeometry> = {}): PacketGeometry {
  return {
    grid: [],
    indicators: [],
    colWidth: 16,
    bitWidth: 42,
    bitHeight: 32,
    indicatorHeight: INDICATOR_HEIGHT,
    totalWidth: 735,
    totalHeight: 67,
    ...overrides,
  };
}

// ------------------------------------------------------------------
// SVG root
// ------------------------------------------------------------------
describe('renderPacket — SVG root', () => {
  it('produces an <svg> string', () => {
    const svg = assembleSvg(renderPacket(geo(), THEME));
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/width="735"/);
    expect(svg).toMatch(/height="67"/);
  });
});

// ------------------------------------------------------------------
// indicator rendering
// ------------------------------------------------------------------
describe('renderPacket — indicators', () => {
  it('renders a <line> for each indicator', () => {
    const indicators = [
      { bitNumber: 0, full: true, numbered: true },
      { bitNumber: 1, full: false, numbered: false },
    ];
    const svg = assembleSvg(renderPacket(geo({ indicators }), THEME));
    const lineCount = (svg.match(/<line /g) ?? []).length;
    expect(lineCount).toBe(2);
  });

  it('renders a <text> for numbered indicators only', () => {
    const indicators = [
      { bitNumber: 0, full: true, numbered: true },
      { bitNumber: 1, full: false, numbered: false },
      { bitNumber: 8, full: false, numbered: true },
    ];
    const svg = assembleSvg(renderPacket(geo({ indicators }), THEME));
    expect(svg).toContain('>0<');
    expect(svg).toContain('>8<');
    expect(svg).not.toContain('>1<');
  });

  it('full indicator line starts at y=24 (NUMBER_HEIGHT)', () => {
    const indicators = [{ bitNumber: 0, full: true, numbered: false }];
    const svg = assembleSvg(renderPacket(geo({ indicators }), THEME));
    expect(svg).toContain('y1="24"');
  });

  it('short indicator line starts at y=40 (NUMBER_HEIGHT + V_LINE_SHORT)', () => {
    const indicators = [{ bitNumber: 1, full: false, numbered: false }];
    const svg = assembleSvg(renderPacket(geo({ indicators }), THEME));
    expect(svg).toContain('y1="40"');
  });

  it('indicator lines end at y=56 (TICK_BOTTOM = INDICATOR_HEIGHT)', () => {
    const indicators = [{ bitNumber: 0, full: true, numbered: false }];
    const svg = assembleSvg(renderPacket(geo({ indicators }), THEME));
    expect(svg).toContain('y2="56"');
  });

  it('full-tick number y is 21 (NUMBER_HEIGHT - FONT_SIZE + FONT_ASCENT)', () => {
    const indicators = [{ bitNumber: 0, full: true, numbered: true }];
    const svg = assembleSvg(renderPacket(geo({ indicators }), THEME));
    expect(svg).toMatch(/y="21"/);
  });

  it('short-tick number y is 37 (21 + V_LINE_SHORT)', () => {
    const indicators = [{ bitNumber: 5, full: false, numbered: true }];
    const svg = assembleSvg(renderPacket(geo({ indicators }), THEME));
    expect(svg).toMatch(/y="37"/);
  });
});

// ------------------------------------------------------------------
// block rendering
// ------------------------------------------------------------------
describe('renderPacket — blocks', () => {
  it('renders a <rect> for each visible block (plus 1 background rect from svgRoot)', () => {
    const grid = [
      [
        { width: 8, height: 1, label: 'A', leftOpen: false, rightOpen: false },
        { width: 8, height: 1, label: 'B', leftOpen: false, rightOpen: false },
      ],
    ];
    const svg = assembleSvg(renderPacket(geo({ grid, totalHeight: 101 }), THEME));
    // +1 for the background rect emitted by svgRoot
    const rectCount = (svg.match(/<rect /g) ?? []).length;
    expect(rectCount).toBe(3);
  });

  it('skips rendering 0-width blocks (only background rect, no block text)', () => {
    const grid = [
      [{ width: 0, height: 1, label: 'Phantom', leftOpen: false, rightOpen: false }],
    ];
    const svg = assembleSvg(renderPacket(geo({ grid }), THEME));
    // Only the background rect from svgRoot should be present
    const rectCount = (svg.match(/<rect /g) ?? []).length;
    expect(rectCount).toBe(1);
    expect(svg).not.toContain('Phantom');
  });

  it('renders block label as centered text', () => {
    const grid = [
      [{ width: 8, height: 1, label: 'Hello', leftOpen: false, rightOpen: false }],
    ];
    const svg = assembleSvg(renderPacket(geo({ grid, totalHeight: 101 }), THEME));
    expect(svg).toContain('Hello');
    expect(svg).toContain('text-anchor="middle"');
  });

  it('omits text element for blocks with empty label', () => {
    const grid = [
      [{ width: 8, height: 1, label: '', leftOpen: false, rightOpen: false }],
    ];
    const svg = assembleSvg(renderPacket(geo({ grid, totalHeight: 101 }), THEME));
    // There should be a rect but no text beyond any indicator text
    const textCount = (svg.match(/<text /g) ?? []).length;
    expect(textCount).toBe(0);
  });

  it('block rect starts at y=indicatorHeight (56)', () => {
    const grid = [
      [{ width: 16, height: 1, label: 'Z', leftOpen: false, rightOpen: false }],
    ];
    const svg = assembleSvg(renderPacket(geo({ grid, totalHeight: 101 }), THEME));
    expect(svg).toContain('y="56"');
  });

  it('block rect x starts at MARGIN_LEFT=10', () => {
    const grid = [
      [{ width: 8, height: 1, label: 'Z', leftOpen: false, rightOpen: false }],
    ];
    const svg = assembleSvg(renderPacket(geo({ grid, totalHeight: 101 }), THEME));
    expect(svg).toContain('x="10"');
  });

  it('block rect width = block.width * bitWidth', () => {
    const grid = [
      [{ width: 8, height: 1, label: 'Z', leftOpen: false, rightOpen: false }],
    ];
    const svg = assembleSvg(renderPacket(geo({ grid, totalHeight: 101 }), THEME));
    // 8 * 42 = 336
    expect(svg).toContain('width="336"');
  });
});

// ------------------------------------------------------------------
// multi-row layout vertical positioning
// ------------------------------------------------------------------
describe('renderPacket — multi-row positioning', () => {
  it('second row starts at indicatorHeight + first row height', () => {
    // row 1: 16 bits wide, height=1 → blockRenderedHeight = 34
    // row 2 starts at 56 + 34 = 90
    const grid = [
      [{ width: 16, height: 1, label: 'Row1', leftOpen: false, rightOpen: false }],
      [{ width: 8, height: 1, label: 'Row2', leftOpen: false, rightOpen: false }],
    ];
    const svg = assembleSvg(renderPacket(
      geo({ grid, colWidth: 16, totalHeight: 135 }),
      THEME,
    ));
    expect(svg).toContain('y="90"');
  });
});

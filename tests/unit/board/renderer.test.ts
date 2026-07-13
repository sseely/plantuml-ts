import { describe, it, expect } from 'vitest';
import { renderBoard } from '../../../src/diagrams/board/renderer.js';
import { assembleSvg } from '../../../src/index.js';
import { boardPlugin } from '../../../src/diagrams/board/index.js';
import { layoutBoard } from '../../../src/diagrams/board/layout.js';
import { parseBoard } from '../../../src/diagrams/board/parser.js';
import { resolveTheme } from '../../../src/core/theme.js';
import type { BoardGeometry, ActivityGeometry, CardGeometry } from '../../../src/diagrams/board/ast.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import { expectNoErrorDiagram } from '../../helpers/error-diagram.js';

const theme = resolveTheme('default');

function makeCard(label: string, dx: number, dy: number): CardGeometry {
  return { label, dx, dy };
}

function makeActivity(xOffset: number, fullWidth: number, cards: CardGeometry[]): ActivityGeometry {
  return { xOffset, fullWidth, cards };
}

function makeGeo(activities: ActivityGeometry[], maxStage: number): BoardGeometry {
  const totalWidth = activities.reduce((s, a) => s + a.fullWidth, 0);
  return { activities, totalWidth, maxStage };
}

describe('renderBoard', () => {
  it('AC1: card at dx=0, dy=0 renders rect at x=10 y=10', () => {
    const geo = makeGeo(
      [makeActivity(0, 170, [makeCard('Root', 0, 0)])],
      0,
    );
    const svg = assembleSvg(renderBoard(geo, theme));
    expect(svg).toContain('x="10" y="10"');
  });

  it('AC2: card at dx=170, dy=90 renders rect at x=180 y=100', () => {
    const root = makeCard('Root', 0, 0);
    const child = makeCard('Child', 170, 90);
    const geo = makeGeo([makeActivity(0, 340, [root, child])], 1);
    const svg = assembleSvg(renderBoard(geo, theme));
    expect(svg).toContain('x="180" y="100"');
  });

  it('AC3: card rect uses drop-shadow filter', () => {
    const root = makeCard('Root', 0, 0);
    const geo = makeGeo([makeActivity(0, 170, [root])], 0);
    const svg = assembleSvg(renderBoard(geo, theme));
    expect(svg).toMatch(/filter="url\(#board-card-shadow-[a-z0-9]+\)"/);
    expect(svg).toContain('feGaussianBlur');
    expect(svg).toContain('feOffset');
  });

  it('AC4: maxStage=2 produces 2 dashed lines at y=90 and y=180', () => {
    const root = makeCard('Root', 0, 0);
    const geo = makeGeo([makeActivity(0, 170, [root])], 2);
    const svg = assembleSvg(renderBoard(geo, theme));
    const dashLines = [...svg.matchAll(/stroke-dasharray="5 5"/g)];
    expect(dashLines.length).toBe(2);
    expect(svg).toContain('y1="90"');
    expect(svg).toContain('y1="180"');
  });

  it('AC5: maxStage=0 produces no dashed lines', () => {
    const root = makeCard('Root', 0, 0);
    const geo = makeGeo([makeActivity(0, 170, [root])], 0);
    const svg = assembleSvg(renderBoard(geo, theme));
    expect(svg).not.toContain('stroke-dasharray');
  });

  it('AC6: second activity cards offset by first activity fullWidth', () => {
    const root1 = makeCard('A', 0, 0);
    const root2 = makeCard('B', 0, 0);
    const geo = makeGeo(
      [makeActivity(0, 170, [root1]), makeActivity(170, 170, [root2])],
      0,
    );
    const svg = assembleSvg(renderBoard(geo, theme));
    // Second activity header at x = 170 + 10 = 180
    const rects = [...svg.matchAll(/x="(\d+)" y="10"/g)];
    const xs = rects.map((m) => Number(m[1]));
    expect(xs).toContain(10);
    expect(xs).toContain(180);
  });

  it('AC7: boardPlugin.accepts returns false', () => {
    expect(boardPlugin.accepts([])).toBe(false);
    expect(boardPlugin.accepts(['World', '+Card'])).toBe(false);
  });

  it('AC8: boardPlugin.type is "board"', () => {
    expect(boardPlugin.type).toBe('board');
  });

  it('AC9: integration — parseBoard+layoutBoard+renderBoard produces SVG', () => {
    const source: UmlSource = {
      lines: ['@startboard', 'World', '+Card', '@endboard'],
      type: 'board',
    };
    const ast = parseBoard(source);
    const geo = layoutBoard(ast);
    const svg = assembleSvg(renderBoard(geo, theme));
    expect(svg).toMatch(/^<svg/);
    expectNoErrorDiagram(svg);
  });

  it('card label appears in SVG text element', () => {
    const root = makeCard('MyLabel', 0, 0);
    const geo = makeGeo([makeActivity(0, 170, [root])], 0);
    const svg = assembleSvg(renderBoard(geo, theme));
    expect(svg).toContain('MyLabel');
  });

  it('empty geometry renders a minimal SVG without crashing', () => {
    const geo: BoardGeometry = { activities: [], totalWidth: 0, maxStage: 0 };
    const svg = assembleSvg(renderBoard(geo, theme));
    expect(svg).toMatch(/^<svg/);
  });

  it('double-draw: header is rendered at same position as root card in BArray', () => {
    const root = makeCard('Root', 0, 0);
    const geo = makeGeo([makeActivity(0, 170, [root])], 0);
    const svg = assembleSvg(renderBoard(geo, theme));
    // x=10, y=10 appears in both the explicit header draw and the BArray loop
    const count = [...svg.matchAll(/x="10" y="10"/g)].length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('row separator y coordinates: (i+1)*90-10+10 for i=0..maxStage-1', () => {
    const root = makeCard('Root', 0, 0);
    const geo = makeGeo([makeActivity(0, 170, [root])], 3);
    const svg = assembleSvg(renderBoard(geo, theme));
    expect(svg).toContain('y1="90"');   // (0+1)*90-10+10
    expect(svg).toContain('y1="180"');  // (1+1)*90-10+10
    expect(svg).toContain('y1="270"');  // (2+1)*90-10+10
  });
});

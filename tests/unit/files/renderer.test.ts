import { describe, it, expect } from 'vitest';
import { renderFiles } from '../../../src/diagrams/files/renderer.js';
import { assembleSvg } from '../../../src/index.js';
import { resolveTheme } from '../../../src/core/theme.js';
import type { FilesGeometry, EntryGeometry } from '../../../src/diagrams/files/ast.js';

const theme = resolveTheme('default');

function makeEntry(overrides: Partial<EntryGeometry> = {}): EntryGeometry {
  return {
    type: 'file',
    name: 'test.ts',
    depth: 0,
    x: 0,
    y: 0,
    labelWidth: 60,
    ...overrides,
  };
}

function makeGeo(entries: EntryGeometry[] = []): FilesGeometry {
  return {
    entries,
    totalWidth: 400,
    totalHeight: entries.length * 22,
  };
}

describe('renderFiles', () => {
  it('AC1: folder entry contains folder emoji', () => {
    const geo = makeGeo([makeEntry({ type: 'folder', name: 'src' })]);
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg).toContain('📂');
  });

  it('AC2: file entry contains file emoji', () => {
    const geo = makeGeo([makeEntry({ type: 'file', name: 'index.ts' })]);
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg).toContain('📄');
  });

  it('AC3: note entry contains a polygon element', () => {
    const geo = makeGeo([
      makeEntry({
        type: 'note',
        name: '',
        noteLines: ['hello', 'world'],
        labelWidth: 80,
      }),
    ]);
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg).toContain('<polygon');
  });

  it('AC4: depth-2 entry has larger x than depth-0 entry', () => {
    const shallow = makeEntry({ type: 'file', name: 'a.ts', depth: 0, x: 0, y: 0 });
    const deep = makeEntry({ type: 'file', name: 'b.ts', depth: 2, x: 40, y: 22 });
    const geo = makeGeo([shallow, deep]);
    const svg = assembleSvg(renderFiles(geo, theme));
    // shallow renders at x=0+PADDING=10, deep at x=40+PADDING=50
    // Both use x attribute on their text element
    const xMatches = [...svg.matchAll(/x="(\d+)"/g)].map((m) => Number(m[1]));
    const shallowX = 0 + 10; // PADDING
    const deepX = 40 + 10;   // entry.x + PADDING
    expect(xMatches).toContain(shallowX);
    expect(xMatches).toContain(deepX);
    expect(deepX).toBeGreaterThan(shallowX);
  });

  it('AC5: svgRoot produces output with width and height attributes', () => {
    const geo = makeGeo([makeEntry()]);
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg).toMatch(/width="\d+"/);
    expect(svg).toMatch(/height="\d+"/);
  });

  it('AC6: note text lines appear in the SVG output', () => {
    const geo = makeGeo([
      makeEntry({
        type: 'note',
        name: '',
        noteLines: ['first line', 'second line'],
        labelWidth: 100,
      }),
    ]);
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg).toContain('first line');
    expect(svg).toContain('second line');
  });

  it('AC7: empty geometry renders without throwing and produces valid SVG', () => {
    const geo = makeGeo([]);
    let svg: string;
    expect(() => { svg = assembleSvg(renderFiles(geo, theme)); }).not.toThrow();
    expect(svg!).toMatch(/^<svg/);
    expect(svg!).toContain('</svg>');
  });

  it('AC8: note rect has fill="#FEFECE" (case-insensitive)', () => {
    const geo = makeGeo([
      makeEntry({
        type: 'note',
        name: '',
        noteLines: ['note content'],
        labelWidth: 80,
      }),
    ]);
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg.toLowerCase()).toContain('fill="#fefece"');
  });

  it('file name appears in SVG text content', () => {
    const geo = makeGeo([makeEntry({ type: 'file', name: 'hello.ts' })]);
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg).toContain('hello.ts');
  });

  it('folder name appears in SVG text content', () => {
    const geo = makeGeo([makeEntry({ type: 'folder', name: 'components' })]);
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg).toContain('components');
  });

  it('note with zero labelWidth falls back to minimum width', () => {
    const geo = makeGeo([
      makeEntry({
        type: 'note',
        name: '',
        noteLines: ['short'],
        labelWidth: 0,
      }),
    ]);
    const svg = assembleSvg(renderFiles(geo, theme));
    // NOTE_FALLBACK_WIDTH=120, NOTE_PAD*2=12, so boxWidth=132. Dog ear at W-D=122.
    // noteBox emits a <path> pentagon and two <line> crease elements.
    // bx=PADDING=10, so path starts at M10,
    expect(svg).toContain('<path');
    expect(svg).toMatch(/d="M10,/);
  });

  it('total width floors at MIN_WIDTH=200 for narrow geometry', () => {
    const geo: FilesGeometry = { entries: [], totalWidth: 50, totalHeight: 40 };
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg).toContain('width="200"');
  });

  it('total height floors at 40 for zero-height geometry', () => {
    const geo: FilesGeometry = { entries: [], totalWidth: 300, totalHeight: 0 };
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg).toContain('height="40"');
  });

  it('note box height scales with number of lines', () => {
    // 3 lines: NOTE_PAD*2 + (3-1)*NOTE_LINE_H + NOTE_FONT = 12 + 32 + 12 = 56
    // Polygon bottom y = entry.y(0) + 2 + 56 = 58. Points include ",58".
    const geo = makeGeo([
      makeEntry({
        type: 'note',
        name: '',
        noteLines: ['a', 'b', 'c'],
        labelWidth: 80,
        y: 0,
      }),
    ]);
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg).toContain('<polygon');
    // bottom-left and bottom-right points both have y=58
    expect(svg).toContain(',58');
  });

  it('note polygon uses correct stroke and has a dog ear polyline', () => {
    const geo = makeGeo([
      makeEntry({
        type: 'note',
        name: '',
        noteLines: ['content'],
        labelWidth: 80,
      }),
    ]);
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg).toContain('stroke="#AAAAAA"');
    expect(svg).toContain('<polyline');
  });

  it('note entry without noteLines renders an empty polygon without throwing', () => {
    // Covers the noteLines ?? [] branch when noteLines is undefined
    const entry: EntryGeometry = {
      type: 'note',
      name: '',
      depth: 0,
      x: 0,
      y: 0,
      labelWidth: 80,
      // noteLines intentionally omitted
    };
    const geo = makeGeo([entry]);
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg).toContain('<polygon');
    // 0 lines: NOTE_PAD*2 = 12. Bottom y = entry.y(0) + 2 + 12 = 14.
    expect(svg).toContain(',14');
  });

  it('multiple entries all appear in SVG', () => {
    const entries = [
      makeEntry({ type: 'folder', name: 'src', x: 0, y: 0 }),
      makeEntry({ type: 'file', name: 'index.ts', x: 20, y: 22 }),
      makeEntry({ type: 'file', name: 'util.ts', x: 20, y: 44 }),
    ];
    const geo = makeGeo(entries);
    const svg = assembleSvg(renderFiles(geo, theme));
    expect(svg).toContain('src');
    expect(svg).toContain('index.ts');
    expect(svg).toContain('util.ts');
  });
});

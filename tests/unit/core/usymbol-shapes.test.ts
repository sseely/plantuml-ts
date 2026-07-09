import { describe, it, expect } from 'vitest';
import {
  renderComponentIcon,
  renderDatabaseIcon,
  renderActorIcon,
  renderUseCaseIcon,
  renderUSymbolIcon,
  type IconGeo,
} from '../../../src/core/usymbol-shapes.js';
import { defaultTheme, deepMergeTheme } from '../../../src/core/theme.js';
import type { Paint } from '../../../src/core/paint.js';

/** A minimal box for the icon under test: x=10, y=20, w=100, h=60. */
const geo = (display: string, over: Partial<IconGeo> = {}): IconGeo => ({
  x: 10,
  y: 20,
  width: 100,
  height: 60,
  display,
  ...over,
});

describe('usymbol-shapes — faithful geometry (T6)', () => {
  it('database → cubic-cap cylinder path with a front-mouth arc + label (AC1)', () => {
    const svg = renderDatabaseIcon(geo('DB'), defaultTheme);
    // Body + mouth are two <path> elements; no ellipse/side-line approximation.
    expect(svg.match(/<path/g)?.length).toBe(2);
    expect(svg).not.toContain('<ellipse');
    expect(svg).not.toContain('<line');
    // Cubic (C) segments present; caps are a FIXED 10px depth (y+10 = 30 here),
    // and the front-mouth lip sits at y+20 = 40.
    expect(svg).toContain('C 10,20'); // top cap control at y (=20)
    expect(svg).toContain('L 110,70'); // right side down to y+h-10 (=70)
    expect(svg).toContain('M 10,30'); // body starts at y+10
    expect(svg).toContain('C 10,40'); // mouth lip control at y+20
    expect(svg).toContain('>DB<');
  });

  it('database cap depth is fixed 10px, independent of height (AC1)', () => {
    const tall = renderDatabaseIcon(geo('DB', { height: 200 }), defaultTheme);
    // Same fixed caps at y+10 / mouth y+20 regardless of the taller box.
    expect(tall).toContain('M 10,30'); // y+10
    expect(tall).toContain('C 10,40'); // mouth y+20
    expect(tall).toContain('L 110,210'); // y+h-10 = 20+200-10
  });

  it('database fills with its own bucket gradient, not the class color (AC3)', () => {
    const grad: Paint = { color1: '#c3d8f4', color2: '#6192d1', policy: '\\' };
    const theme = deepMergeTheme(defaultTheme, {
      colors: { elements: { database: { background: grad } } },
    });
    const svg = renderDatabaseIcon(geo('DB'), theme);
    expect(svg).toContain('<linearGradient');
    expect(svg).toMatch(/fill="url\(#g[0-9a-z]+\)"/);
    expect(svg).not.toContain('#FEFECE'); // not the class background
  });

  it('component → body rect + outer tab (15×10) + two ticks (4×2) + label (AC2)', () => {
    const svg = renderComponentIcon(geo('Comp'), defaultTheme);
    // body + outer tab + 2 ticks = 4 rects.
    expect(svg.match(/<rect/g)?.length).toBe(4);
    // Outer tab 15×10 at (w-20, 5) → (90, 25).
    expect(svg).toContain('x="90" y="25" width="15" height="10"');
    // Two inner ticks 4×2 at (w-22, 7) and (w-22, 11) → (88, 27) / (88, 31).
    expect(svg).toContain('x="88" y="27" width="4" height="2"');
    expect(svg).toContain('x="88" y="31" width="4" height="2"');
    expect(svg).toContain('>Comp<');
  });

  it('actor → Ø16 head + spine/arms/legs at the cited coordinates + label (AC4)', () => {
    const svg = renderActorIcon(geo('User'), defaultTheme);
    // Head is a Ø16 ellipse (rx=ry=8) centred at (cx, y+8) = (60, 28).
    expect(svg).toMatch(/<ellipse cx="60" cy="28" rx="8" ry="8"/);
    // Four stick lines relative to body translation (cx, y+16) = (60, 36).
    expect(svg.match(/<line/g)?.length).toBe(4);
    expect(svg).toContain('x1="60" y1="36" x2="60" y2="63"'); // spine (0,0)->(0,27)
    expect(svg).toContain('x1="47" y1="44" x2="73" y2="44"'); // arms (-13,8)->(13,8)
    expect(svg).toContain('x1="60" y1="63" x2="47" y2="78"'); // left leg ->(-13,42)
    expect(svg).toContain('x1="60" y1="63" x2="73" y2="78"'); // right leg ->(13,42)
    expect(svg).toContain('User');
  });

  it('usecase → single ellipse sized to the box + label', () => {
    const svg = renderUseCaseIcon(geo('Login'), defaultTheme);
    expect(svg.match(/<ellipse/g)?.length).toBe(1);
    expect(svg).toContain('cx="60" cy="50" rx="50" ry="30"');
    expect(svg).toContain('Login');
  });
});

describe('renderUSymbolIcon — keyword dispatch', () => {
  it('dispatches each known keyword to its icon renderer', () => {
    for (const kw of ['database', 'component', 'actor', 'usecase']) {
      expect(renderUSymbolIcon(kw, geo('X'), defaultTheme)).toBeTypeOf('string');
    }
  });

  it('is case-insensitive on the keyword', () => {
    // DATABASE now renders a cubic path (not an ellipse cap).
    expect(renderUSymbolIcon('DATABASE', geo('X'), defaultTheme)).toContain('<path');
  });

  it('returns undefined for a keyword with no distinct icon', () => {
    expect(renderUSymbolIcon('node', geo('X'), defaultTheme)).toBeUndefined();
    expect(renderUSymbolIcon('rectangle', geo('X'), defaultTheme)).toBeUndefined();
  });
});

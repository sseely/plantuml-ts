import { describe, it, expect } from 'vitest';
import {
  renderComponentIcon,
  renderDatabaseIcon,
  renderActorIcon,
  renderUseCaseIcon,
  renderUSymbolIcon,
  type IconGeo,
} from '../../../src/core/usymbol-shapes.js';
import { defaultTheme } from '../../../src/core/theme.js';

/** A minimal box for the icon under test. */
const geo = (display: string): IconGeo => ({
  x: 10,
  y: 20,
  width: 100,
  height: 60,
  display,
});

describe('usymbol-shapes — per-USymbol leaf icons', () => {
  it('component → box + two notch tabs + label', () => {
    const svg = renderComponentIcon(geo('Comp'), defaultTheme);
    // outer box + two icon tabs = three rects; label text present
    expect(svg.match(/<rect/g)?.length).toBe(3);
    expect(svg).toContain('>Comp<');
  });

  it('database → body rect + side lines + bottom arc + top ellipse + label', () => {
    const svg = renderDatabaseIcon(geo('DB'), defaultTheme);
    expect(svg).toContain('<ellipse'); // cylinder cap
    expect(svg).toContain('<path'); // bottom arc
    expect(svg.match(/<line/g)?.length).toBe(2); // two side lines
    expect(svg).toContain('>DB<');
  });

  it('actor → head circle + four stick lines + label', () => {
    const svg = renderActorIcon(geo('User'), defaultTheme);
    expect(svg).toContain('<circle'); // head
    expect(svg.match(/<line/g)?.length).toBe(4); // body, arms, two legs
    expect(svg).toContain('>User<');
  });

  it('usecase → single ellipse + label', () => {
    const svg = renderUseCaseIcon(geo('Login'), defaultTheme);
    expect(svg.match(/<ellipse/g)?.length).toBe(1);
    expect(svg).toContain('>Login<');
  });
});

describe('renderUSymbolIcon — keyword dispatch', () => {
  it('dispatches each known keyword to its icon renderer', () => {
    for (const kw of ['database', 'component', 'actor', 'usecase']) {
      expect(renderUSymbolIcon(kw, geo('X'), defaultTheme)).toBeTypeOf('string');
    }
  });

  it('is case-insensitive on the keyword', () => {
    expect(renderUSymbolIcon('DATABASE', geo('X'), defaultTheme)).toContain(
      '<ellipse',
    );
  });

  it('returns undefined for a keyword with no distinct icon', () => {
    // node/package/rectangle draw a plain box at the call site, not an icon
    expect(renderUSymbolIcon('node', geo('X'), defaultTheme)).toBeUndefined();
    expect(renderUSymbolIcon('rectangle', geo('X'), defaultTheme)).toBeUndefined();
  });
});

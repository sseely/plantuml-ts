import { describe, it, expect } from 'vitest';
import { renderSync } from '../../src/index.js';
import jsonFixtures from '../visual/data/json.json';

function getMarkup(prefix: string): string {
  const f = (jsonFixtures as Array<{ slug: string; markup: string }>).find(
    (x) => x.slug.startsWith(prefix),
  );
  if (!f) throw new Error(`Fixture not found: ${prefix}`);
  return f.markup;
}

function expectSvg(markup: string): string {
  const svg = renderSync(markup);
  expect(svg).toContain('<svg');
  expect(svg.length).toBeGreaterThan(200);
  return svg;
}

// ---------------------------------------------------------------------------
// Primitive root values
// ---------------------------------------------------------------------------

describe('JSON e2e: primitive root values', () => {
  it('bidire-98: null root produces SVG', () => {
    expectSvg(getMarkup('bidire-98'));
  });

  it('giduve-36: number root produces SVG', () => {
    expectSvg(getMarkup('giduve-36'));
  });

  it('karaju-04: string root produces SVG', () => {
    expectSvg(getMarkup('karaju-04'));
  });

  it('xajini-72: boolean root produces SVG', () => {
    expectSvg(getMarkup('xajini-72'));
  });

  it('rutofu-66: mixed-type array root produces SVG', () => {
    expectSvg(getMarkup('rutofu-66'));
  });

  it('tacizo-43: empty array root produces SVG', () => {
    expectSvg(getMarkup('tacizo-43'));
  });

  it('cazuru-97: empty object root produces SVG', () => {
    expectSvg(getMarkup('cazuru-97'));
  });
});

// ---------------------------------------------------------------------------
// Simple objects and arrays
// ---------------------------------------------------------------------------

describe('JSON e2e: simple objects and arrays', () => {
  it('lipuxo-26: three-key object renders all three keys', () => {
    const svg = expectSvg(getMarkup('lipuxo-26'));
    expect(svg).toContain('firstName');
    expect(svg).toContain('lastName');
    expect(svg).toContain('isAlive');
  });

  it('jaramo-16: object with numeric array renders array node', () => {
    expectSvg(getMarkup('jaramo-16'));
  });

  it('nanegu-88: object with string array renders SVG', () => {
    expectSvg(getMarkup('nanegu-88'));
  });

  it('jidata-48: nested empty arrays render without crash', () => {
    expectSvg(getMarkup('jidata-48'));
  });
});

// ---------------------------------------------------------------------------
// JSONC (comments, trailing commas)
// ---------------------------------------------------------------------------

describe('JSON e2e: JSONC extensions', () => {
  it('lulofe-05: inline comments are stripped — Smith renders, comment text does not', () => {
    const svg = expectSvg(getMarkup('lulofe-05'));
    expect(svg).toContain('Smith');
    expect(svg).not.toContain('// Comment');
    expect(svg).not.toContain('// True when alive');
  });
});

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

describe('JSON e2e: title directive', () => {
  it('babico-87: title text appears in SVG', () => {
    const svg = expectSvg(getMarkup('babico-87'));
    expect(svg).toContain('this is a title');
  });
});

// ---------------------------------------------------------------------------
// Highlights — spaced and no-space path separators
// ---------------------------------------------------------------------------

describe('JSON e2e: #highlight directives', () => {
  it('debako-68: top-level and nested highlights produce default highlight color', () => {
    const svg = expectSvg(getMarkup('debako-68'));
    expect(svg).toContain('#CCFF02');
  });

  it('mudumo-73: no-space path separators ("a"/"b") resolve to highlight color', () => {
    const svg = expectSvg(getMarkup('mudumo-73'));
    expect(svg).toContain('#CCFF02');
  });

  it('letada-23: three-level deep path (phoneNumbers/0/number) produces highlight', () => {
    const svg = expectSvg(getMarkup('letada-23'));
    expect(svg).toContain('#CCFF02');
  });
});

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

describe('JSON e2e: !theme directive', () => {
  it('bitepo-72: aws-orange theme produces SVG', () => {
    expectSvg(getMarkup('bitepo-72'));
  });

  it('dapinu-10: amiga theme produces SVG', () => {
    expectSvg(getMarkup('dapinu-10'));
  });
});

// ---------------------------------------------------------------------------
// Deep nesting
// ---------------------------------------------------------------------------

describe('JSON e2e: deep nesting', () => {
  it('pijume-87: three levels of object nesting produces SVG', () => {
    expectSvg(getMarkup('pijume-87'));
  });

  it('cilemo-38: five levels of nesting produces SVG', () => {
    expectSvg(getMarkup('cilemo-38'));
  });

  it('zevaka-35: nested quiz object with arrays produces SVG', () => {
    expectSvg(getMarkup('zevaka-35'));
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('JSON e2e: edge cases', () => {
  it('nixaxa-46: invalid JSON (nested braces) renders without crashing', () => {
    const svg = renderSync(getMarkup('nixaxa-46'));
    expect(svg).toContain('<svg');
  });

  it('nujuke-14: escaped backslash sequences render as SVG', () => {
    expectSvg(getMarkup('nujuke-14'));
  });

  it('gavomi-49: \\n sequences in string values split across rows', () => {
    expectSvg(getMarkup('gavomi-49'));
  });
});

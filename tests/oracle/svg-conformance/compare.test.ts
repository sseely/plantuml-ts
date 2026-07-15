/**
 * Unit tests for the golden-SVG conformance comparator (T1).
 *
 * Ports the acceptance-criteria checks from graphviz-ts's in-source Vitest
 * block (`test/golden/compare.ts`) into this project's standalone
 * `*.test.ts` convention, plus additional coverage for the `d`/`points`/
 * `viewBox`/`transform` structural comparators and the exported tolerance
 * table (D7: `deterministic` band is 0.01, no other classes).
 */
import { describe, test, expect } from 'vitest';
import { compareSvg, TOLERANCES } from './compare.js';

const MINIMAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <g><ellipse cx="50.0" cy="50.0" rx="20" ry="10"/></g>
</svg>`;

describe('TOLERANCES', () => {
  test('D7: exposes only the deterministic 0.01 band', () => {
    expect(TOLERANCES).toEqual({ deterministic: 0.01 });
  });
});

describe('compareSvg', () => {
  // AC1: byte-identical SVGs compare with pass: true, diffs: []
  test('AC1: identical SVGs pass with no diffs', () => {
    const { pass, diffs } = compareSvg(MINIMAL_SVG, MINIMAL_SVG, 'deterministic');
    expect(pass).toBe(true);
    expect(diffs).toEqual([]);
  });

  // AC2: cx drift of 0.009 (within the 0.01 band) passes
  test('AC2: cx drift of 0.009 is within tolerance and passes', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <g><ellipse cx="50.009" cy="50.0" rx="20" ry="10"/></g>
</svg>`;
    const { pass, diffs } = compareSvg(actual, MINIMAL_SVG, 'deterministic');
    expect(pass).toBe(true);
    expect(diffs).toEqual([]);
  });

  // AC2: cx drift of 0.011 (beyond the 0.01 band) fails with exactly one
  // diff carrying a delta and an @cx path.
  test('AC2: cx drift of 0.011 exceeds tolerance and fails with one @cx diff', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <g><ellipse cx="50.011" cy="50.0" rx="20" ry="10"/></g>
</svg>`;
    const { pass, diffs } = compareSvg(actual, MINIMAL_SVG, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.path).toBe('svg/g[1]/ellipse[1]/@cx');
    expect(diffs[0]?.delta).toBeCloseTo(0.011, 5);
    expect(diffs[0]?.tolerance).toBe(0.01);
  });

  test('a text-node child compared against an element child is a type mismatch', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg">hello<g/></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><rect/><g/></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs[0]?.actual).toBe('text');
    expect(diffs[0]?.expected).toBe('element');
  });

  test('missing child element produces a structural childCount diff', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
</svg>`;
    const { pass, diffs } = compareSvg(actual, MINIMAL_SVG, 'deterministic');
    expect(pass).toBe(false);
    const structuralDiff = diffs.find((d) => d.path.includes('childCount'));
    expect(structuralDiff).toBeDefined();
    expect(structuralDiff?.actual).toBe('0');
    expect(structuralDiff?.expected).toBe('1');
  });

  test('mismatched tag name produces a structural diff and stops recursion', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <g><rect cx="50.0" cy="50.0" rx="20" ry="10"/></g>
</svg>`;
    const { pass, diffs } = compareSvg(actual, MINIMAL_SVG, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs).toEqual([
      {
        path: 'svg/g[1]/rect[1]',
        actual: 'rect',
        expected: 'ellipse',
        tolerance: 0.01,
      },
    ]);
  });

  test('path `d` command letters must match structurally', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L1,1"/></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 C1,1 2,2 3,3"/></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs[0]?.path).toBe('svg/path[1]/@d');
  });

  test('path `d` numeric arguments within tolerance pass, beyond it fail', () => {
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L10,10"/></svg>`;
    const within = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L10.005,10"/></svg>`;
    const beyond = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L10.5,10"/></svg>`;

    expect(compareSvg(within, reference, 'deterministic').pass).toBe(true);
    const beyondResult = compareSvg(beyond, reference, 'deterministic');
    expect(beyondResult.pass).toBe(false);
    expect(beyondResult.diffs[0]?.path).toBe('svg/path[1]/@d[2]');
    expect(beyondResult.diffs[0]?.delta).toBeCloseTo(0.5, 5);
  });

  test('path `d` with matching commands but mismatched numeric arg count fails', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L1,1 2,2"/></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L1,1"/></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs[0]?.path).toBe('svg/path[1]/@d');
    expect(diffs[0]?.actual).toBe('M0,0 L1,1 2,2');
    expect(diffs[0]?.expected).toBe('M0,0 L1,1');
  });

  test('points/viewBox mismatched length produces a single diff', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 1,1"/></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 1,1 2,2"/></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.path).toBe('svg/polygon[1]/@points');
  });

  test('viewBox numeric drift beyond tolerance is reported per-number', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100.5 200"></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200"></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs[0]?.path).toBe('svg/@viewBox[2]');
  });

  test('transform with mismatched function type produces a .type diff', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg"><g transform="scale(2)"/></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(2)"/></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs[0]?.path).toBe('svg/g[1]/@transform[0].type');
  });

  test('transform param drift beyond tolerance is reported per-param', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(10.5,0)"/></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(10,0)"/></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs[0]?.path).toBe('svg/g[1]/@transform[0].param[0]');
  });

  test('transform with mismatched function count fails with an @transform diff', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(1,1) scale(2)"/></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(1,1)"/></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs[0]?.path).toBe('svg/g[1]/@transform');
  });

  test('transform with mismatched param count (same type) fails at [i]', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1,0,0,1,5,5)"/></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1,0,0,1,5)"/></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs[0]?.path).toBe('svg/g[1]/@transform[0]');
  });

  test('a non-numeric value on a numeric attr falls through to exact match', () => {
    // width="auto" fails parseNumber (isNaN branch), so the numeric-attr
    // fast path is skipped and the values are compared for exact equality.
    const actual = `<svg xmlns="http://www.w3.org/2000/svg" width="auto"/>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg" width="100"/>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs).toEqual([
      { path: 'svg/@width', actual: 'auto', expected: '100', tolerance: 0.01 },
    ]);
  });

  test('path `d` with no command letters is compared via the empty-commands fallback', () => {
    // Malformed/degenerate d values (no MLZC... letters) exercise
    // extractPathCommands's `?? []` fallback rather than a crash.
    const actual = `<svg xmlns="http://www.w3.org/2000/svg"><path d="1,2"/></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><path d="3,4"/></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    // both sides have zero command letters, so the structural check passes;
    // numeric args (1,2) vs (3,4) both exceed tolerance
    expect(pass).toBe(false);
    expect(diffs.some((d) => d.path === 'svg/path[1]/@d[0]')).toBe(true);
  });

  test('attribute present on only one side compares against an empty string', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red"/></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red" opacity="0.5"/></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs).toEqual([
      { path: 'svg/rect[1]/@opacity', actual: '', expected: '0.5', tolerance: 0.01 },
    ]);
  });

  test('non-numeric attribute mismatch (e.g. fill color) fails exactly', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#FFFFFF"/></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#000000"/></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs).toEqual([
      {
        path: 'svg/rect[1]/@fill',
        actual: '#FFFFFF',
        expected: '#000000',
        tolerance: 0.01,
      },
    ]);
  });

  test('unknown tolerance class falls back to deterministic (0.01)', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg"><ellipse cx="50.011"/></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><ellipse cx="50.0"/></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'nonexistent-class');
    expect(pass).toBe(false);
    expect(diffs[0]?.tolerance).toBe(0.01);
  });

  test('toleranceOverride takes precedence over the named class', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg"><ellipse cx="50.5"/></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><ellipse cx="50.0"/></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic', 1);
    expect(pass).toBe(true);
    expect(diffs).toEqual([]);
  });

  test('text node content mismatch is reported at the text() path', () => {
    const actual = `<svg xmlns="http://www.w3.org/2000/svg"><text>foo</text></svg>`;
    const reference = `<svg xmlns="http://www.w3.org/2000/svg"><text>bar</text></svg>`;
    const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs[0]?.path).toBe('svg/text[1]/text()[1]');
    expect(diffs[0]?.actual).toBe('foo');
    expect(diffs[0]?.expected).toBe('bar');
  });

  // G1 I0: image/@xlink:href is a DELIBERATE byte divergence (DIVERGENCES.md
  // "Sprite and img rasters -- pass-through and browser scaling") -- both
  // sides present-and-nonempty is a match regardless of the actual bytes.
  describe('image/@xlink:href (deliberate raster pass-through divergence)', () => {
    test('differing but both-nonempty data-URI hrefs on an <image> are not a diff', () => {
      const actual = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image width="10" height="10" x="0" y="0" xlink:href="data:image/png;base64,AAAA"/></svg>`;
      const reference = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image width="10" height="10" x="0" y="0" xlink:href="data:image/png;base64,ZZZZZZZZ"/></svg>`;
      const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
      expect(pass).toBe(true);
      expect(diffs).toEqual([]);
    });

    test('geometry (x/y/width/height) on an <image> is still strictly compared', () => {
      const actual = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image width="10" height="10" x="0" y="0" xlink:href="data:image/png;base64,AAAA"/></svg>`;
      const reference = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image width="20" height="10" x="0" y="0" xlink:href="data:image/png;base64,ZZZZ"/></svg>`;
      const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
      expect(pass).toBe(false);
      expect(diffs).toEqual([
        { path: 'svg/image[1]/@width', actual: '10', expected: '20', tolerance: 0.01, delta: 10 },
      ]);
    });

    test('an href present on one side but missing on the other IS a diff (not exempted)', () => {
      const actual = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image width="10" height="10" x="0" y="0"/></svg>`;
      const reference = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image width="10" height="10" x="0" y="0" xlink:href="data:image/png;base64,ZZZZ"/></svg>`;
      const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
      expect(pass).toBe(false);
      expect(diffs).toEqual([
        { path: 'svg/image[1]/@xlink:href', actual: '', expected: 'data:image/png;base64,ZZZZ', tolerance: 0.01 },
      ]);
    });

    test('a same-named href on a NON-image element is still compared exactly (scoped to tag=image only)', () => {
      const actual = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="http://example.com/one"><rect/></a></svg>`;
      const reference = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="http://example.com/two"><rect/></a></svg>`;
      const { pass, diffs } = compareSvg(actual, reference, 'deterministic');
      expect(pass).toBe(false);
      expect(diffs).toEqual([
        {
          path: 'svg/a[1]/@xlink:href',
          actual: 'http://example.com/one',
          expected: 'http://example.com/two',
          tolerance: 0.01,
        },
      ]);
    });
  });
});

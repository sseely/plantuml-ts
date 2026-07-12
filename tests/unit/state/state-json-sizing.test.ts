/**
 * Unit tests for `kind:'json'` state-leaf sizing (state-json-sizing.ts) —
 * mission A4 Phase L iteration 20. Exercises every branch of the recursive
 * dimension formula (scalar/array/object, empty vs populated, nested) plus
 * the stereotype/no-stereotype title split, independent of the parser or
 * layout pipeline (pure function: State + Theme + StringMeasurer -> Dim).
 */
import { describe, it, expect } from 'vitest';
import { measureJsonState } from '../../../src/diagrams/state/state-json-sizing.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';
import { defaultTheme } from '../../../src/core/theme.js';
import type { State } from '../../../src/diagrams/state/ast.js';
import type { JsonNode } from '../../../src/diagrams/state/state-json-ast.js';

const measurer = new WidthTableMeasurer();

function jsonState(id: string, jsonValue?: JsonNode, extra: Partial<State> = {}): State {
  return {
    id,
    display: id,
    kind: 'json',
    children: [],
    concurrentRegions: [],
    transitions: [],
    ...(jsonValue !== undefined ? { jsonValue } : {}),
    ...extra,
  };
}

describe('measureJsonState', () => {
  it('measures a populated one-entry object (maruju-55-soko478 shape) — byte-exact against the pinned oracle dims', () => {
    const value: JsonNode = {
      kind: 'object',
      entries: [{ key: 'foo2', value: { kind: 'scalar', value: 'foo3' } }],
    };
    const dim = measureJsonState(jsonState('foo1', value), defaultTheme, measurer);
    expect(dim).toEqual({ width: 74.42500000000001, height: 36 });
  });

  it('falls back to the empty-object formula when jsonValue is absent (unparsed/never-set body)', () => {
    const withValue = measureJsonState(
      jsonState('e', { kind: 'object', entries: [] }),
      defaultTheme,
      measurer,
    );
    const withoutValue = measureJsonState(jsonState('e', undefined), defaultTheme, measurer);
    expect(withoutValue).toEqual(withValue);
  });

  it('empty object entries area uses the fixed empty-height fallback (13), not 0', () => {
    const dim = measureJsonState(
      jsonState('e', { kind: 'object', entries: [] }),
      defaultTheme,
      measurer,
    );
    // title height (name-only, no stereotype) + 13 fallback fields height.
    const nameHeight = measurer.measure('e', { family: defaultTheme.fontFamily, size: defaultTheme.fontSize }).height;
    expect(dim.height).toBe(nameHeight + 2 * 2 + 13);
  });

  it('top-level scalar jsonValue (single-line `json Name true`-style) measures as one cell', () => {
    const dim = measureJsonState(jsonState('b', { kind: 'scalar', value: true }), defaultTheme, measurer);
    const cell = measurer.measure('true', { family: defaultTheme.fontFamily, size: defaultTheme.fontSize });
    expect(dim.height).toBeGreaterThanOrEqual(cell.height + 2 * 2);
  });

  it('scalar text rendering: null / boolean / number / string all format correctly', () => {
    const cases: { value: JsonNode; text: string }[] = [
      { value: { kind: 'scalar', value: null }, text: 'null' },
      { value: { kind: 'scalar', value: false }, text: 'false' },
      { value: { kind: 'scalar', value: true }, text: 'true' },
      { value: { kind: 'scalar', value: 42 }, text: '42' },
      { value: { kind: 'scalar', value: 'plain' }, text: 'plain' },
    ];
    for (const { value, text } of cases) {
      const dim = measureJsonState(jsonState('s', value), defaultTheme, measurer);
      const expectedCell = measurer.measure(text, { family: defaultTheme.fontFamily, size: defaultTheme.fontSize });
      // fields height dominates title height for a short name in every case.
      expect(dim.height).toBe(
        measurer.measure('s', { family: defaultTheme.fontFamily, size: defaultTheme.fontSize }).height +
          2 * 2 +
          expectedCell.height +
          2 * 2,
      );
    }
  });

  it('empty top-level array measures 0-width/0-height entries area (empty-height fallback applies)', () => {
    const withEmptyArray = measureJsonState(jsonState('a', { kind: 'array', items: [] }), defaultTheme, measurer);
    const withEmptyObject = measureJsonState(jsonState('a', { kind: 'object', entries: [] }), defaultTheme, measurer);
    expect(withEmptyArray).toEqual(withEmptyObject);
  });

  it('populated array: width = max item width, height = sum of item heights (stacked)', () => {
    const value: JsonNode = { kind: 'array', items: [{ kind: 'scalar', value: 'x' }, { kind: 'scalar', value: 'yy' }] };
    const dim = measureJsonState(jsonState('arr', value), defaultTheme, measurer);
    const font = { family: defaultTheme.fontFamily, size: defaultTheme.fontSize };
    const cellX = measurer.measure('x', font);
    const cellYY = measurer.measure('yy', font);
    const expectedFieldsWidth = Math.max(cellX.width, cellYY.width) + 5 * 2;
    const expectedFieldsHeight = cellX.height + cellYY.height + 4 * 2;
    expect(dim.width).toBeGreaterThanOrEqual(expectedFieldsWidth);
    expect(dim.height).toBeGreaterThanOrEqual(expectedFieldsHeight);
  });

  it('nested object-in-object: sub-table recurses instead of a flat scalar cell', () => {
    const value: JsonNode = {
      kind: 'object',
      entries: [
        {
          key: 'outer',
          value: { kind: 'object', entries: [{ key: 'inner', value: { kind: 'scalar', value: 1 } }] },
        },
      ],
    };
    const dim = measureJsonState(jsonState('n', value), defaultTheme, measurer);
    // A flat (non-nested) single scalar entry with the same outer key is
    // strictly narrower (no inner key column) and shorter (no inner-value
    // height contribution beyond one cell) than the nested version.
    const flat: JsonNode = { kind: 'object', entries: [{ key: 'outer', value: { kind: 'scalar', value: 1 } }] };
    const flatDim = measureJsonState(jsonState('n', flat), defaultTheme, measurer);
    expect(dim.width).toBeGreaterThan(flatDim.width);
  });

  it('array of objects: each item recurses through the object formula', () => {
    const value: JsonNode = {
      kind: 'array',
      items: [{ kind: 'object', entries: [{ key: 'k', value: { kind: 'scalar', value: 'v' } }] }],
    };
    const dim = measureJsonState(jsonState('ao', value), defaultTheme, measurer);
    expect(dim.width).toBeGreaterThan(0);
    expect(dim.height).toBeGreaterThan(0);
  });

  it('stereotype widens the title when the guillemet-wrapped label is wider than the name', () => {
    const withoutStereo = measureJsonState(jsonState('x', { kind: 'scalar', value: 1 }), defaultTheme, measurer);
    const withStereo = measureJsonState(
      jsonState('x', { kind: 'scalar', value: 1 }, { stereotype: 'a-fairly-long-stereotype-label' }),
      defaultTheme,
      measurer,
    );
    expect(withStereo.width).toBeGreaterThan(withoutStereo.width);
    expect(withStereo.height).toBeGreaterThan(withoutStereo.height);
  });

  it('short stereotype does not widen the title beyond the name (name stays the max)', () => {
    const withoutStereo = measureJsonState(jsonState('averylongname', { kind: 'scalar', value: 1 }), defaultTheme, measurer);
    const withStereo = measureJsonState(
      jsonState('averylongname', { kind: 'scalar', value: 1 }, { stereotype: 'a' }),
      defaultTheme,
      measurer,
    );
    expect(withStereo.width).toBe(withoutStereo.width);
    // Height still grows -- the stereotype line stacks above the name regardless of width.
    expect(withStereo.height).toBeGreaterThan(withoutStereo.height);
  });
});

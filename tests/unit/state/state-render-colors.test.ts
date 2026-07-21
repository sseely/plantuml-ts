/**
 * Unit tests for state-render-colors.ts's per-node color resolution helpers.
 *
 * G4 S9: `resolveStateBorder` -- the `StateBorderColor<<X>>` cascade
 * (`skinparam StateBorderColor<<meblue>> blue`), jar's `SkinParam
 * #getColor(ColorParam, Stereotype)` direct stereotype-qualified value
 * lookup, mirrored from the class engine's `classBorderThicknessByStereo`
 * precedent (G2 N51) -- see `theme.ts#stateBorderColorByStereo`'s own doc
 * comment for the full derivation.
 */
import { describe, it, expect } from 'vitest';
import { resolveStateBorder, resolveStateFillBucketed } from '../../../src/diagrams/state/state-render-colors.js';
import { defaultTheme, deepMergeTheme } from '../../../src/core/theme.js';

describe('resolveStateBorder', () => {
  it('falls back to theme.colors.border when the node has no stereotype', () => {
    expect(resolveStateBorder({}, defaultTheme)).toBe(defaultTheme.colors.border);
  });

  it('falls back to theme.colors.border when the node has a stereotype but no matching skinparam entry', () => {
    expect(resolveStateBorder({ stereotype: 'unmatched' }, defaultTheme)).toBe(
      defaultTheme.colors.border,
    );
  });

  // jar-verified `semala-31-joji042`: `skinparam StateBorderColor<<meblue>>
  // blue` + `state a<<meblue>>` -> box/divider stroke="#0000FF".
  it('resolves the stereotype-scoped skinparam override to an SVG hex color', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateBorderColorByStereo: { meblue: 'blue' } } },
    });
    expect(resolveStateBorder({ stereotype: 'meblue' }, theme)).toBe('#0000FF');
  });

  it('matches the stereotype label case-insensitively (both sides lowercased)', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateBorderColorByStereo: { meblue: 'blue' } } },
    });
    expect(resolveStateBorder({ stereotype: 'MeBlue' }, theme)).toBe('#0000FF');
  });

  it('does not match a DIFFERENT stereotype not present in the bucket', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateBorderColorByStereo: { meblue: 'blue' } } },
    });
    expect(resolveStateBorder({ stereotype: 'other' }, theme)).toBe(defaultTheme.colors.border);
  });
});

// mission G4 S10: `theme.colors.elements['state'].background` -- the
// generic ELEMENT_BUCKET_SNAMES bucket (core/skinparam.ts's own 'state'
// entry doc comment), plain-`skinparam stateBackgroundColor` form.
describe('resolveStateFillBucketed', () => {
  it('falls back to the hardcoded default when no override/bucket applies', () => {
    expect(resolveStateFillBucketed({}, defaultTheme, '#F1F1F1')).toBe('#F1F1F1');
  });

  it('an inline #color override wins over the bucket', () => {
    const theme = deepMergeTheme(defaultTheme, { colors: { elements: { state: { background: 'yellow' } } } });
    expect(resolveStateFillBucketed({ color: '#red' }, theme, '#F1F1F1')).toBe('#FF0000');
  });

  it('the state-element bucket wins over the hardcoded default', () => {
    const theme = deepMergeTheme(defaultTheme, { colors: { elements: { state: { background: 'yellow' } } } });
    expect(resolveStateFillBucketed({}, theme, '#F1F1F1')).toBe('#FFFF00');
  });

  it('a non-string bucket value (unsupported gradient) falls through to the default', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { elements: { state: { background: { color1: '#FF0000', color2: '#FFFF00', policy: '/' } } } },
    });
    expect(resolveStateFillBucketed({}, theme, '#F1F1F1')).toBe('#F1F1F1');
  });
});

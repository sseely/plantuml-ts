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
import { resolveStateBorder, resolveStateFillBucketed, resolveStateFontColor, resolveStateFontSize, resolveStateArrowLineColor, resolveStateArrowHeadColor, resolveActivityBarForkColor, resolveActivityBarJoinColor } from '../../../src/diagrams/state/state-render-colors.js';
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

  // mission G4 S15: `skinparam stateBackgroundColor<<X>> #color` --
  // jar-verified `laferu-31-tice836`: `skinparam stateBackgroundColor<<Foo>>
  // red` + `state state1 <<Foo>>` -> `fill="#FF0000"`.
  it('the stereotype-scoped skinparam wins over the bare state-element bucket', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: {
        elements: { state: { background: 'yellow' } },
        graph: { stateBackgroundColorByStereo: { foo: 'red' } },
      },
    });
    expect(resolveStateFillBucketed({ stereotype: 'Foo' }, theme, '#F1F1F1')).toBe('#FF0000');
  });

  it('an inline #color override still wins over the stereotype-scoped skinparam', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateBackgroundColorByStereo: { foo: 'red' } } },
    });
    expect(resolveStateFillBucketed({ color: '#blue', stereotype: 'Foo' }, theme, '#F1F1F1')).toBe('#0000FF');
  });

  it('does not match a DIFFERENT stereotype not present in the bucket', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateBackgroundColorByStereo: { foo: 'red' } } },
    });
    expect(resolveStateFillBucketed({ stereotype: 'other' }, theme, '#F1F1F1')).toBe('#F1F1F1');
  });
});

// mission G4 S15: `skinparam stateFontColor<<X>> #color` -- jar-verified
// `laferu-31-tice836`: `skinparam stateFontColor<<Foo>> yellow` + `state
// state1 <<Foo>>` -> label `fill="#FFFF00"`.
describe('resolveStateFontColor', () => {
  it('falls back to the given default when the node has no stereotype', () => {
    expect(resolveStateFontColor({}, defaultTheme, '#000000')).toBe('#000000');
  });

  it('resolves the stereotype-scoped skinparam override to an SVG hex color', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateFontColorByStereo: { foo: 'yellow' } } },
    });
    expect(resolveStateFontColor({ stereotype: 'Foo' }, theme, '#000000')).toBe('#FFFF00');
  });

  it('does not match a DIFFERENT stereotype not present in the bucket', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateFontColorByStereo: { foo: 'yellow' } } },
    });
    expect(resolveStateFontColor({ stereotype: 'other' }, theme, '#000000')).toBe('#000000');
  });
});

// mission G4 S16: `skinparam stateFontSize<<X>> N` -- jar-verified
// `laferu-31-tice836`: `skinparam stateFontSize<<Foo>> 30` + `state state1
// <<Foo>>` -> `font-size="30"` (both header text AND the box's own
// dimensions, since `resolveStateFontSize` is also read at LAYOUT/measure
// time -- state-sizing.test.ts covers the measurement-side threading).
describe('resolveStateFontSize', () => {
  it('falls back to the given default when the node has no stereotype', () => {
    expect(resolveStateFontSize({}, defaultTheme, 14)).toBe(14);
  });

  it('resolves the stereotype-scoped skinparam override', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateFontSizeByStereo: { foo: 30 } } },
    });
    expect(resolveStateFontSize({ stereotype: 'Foo' }, theme, 14)).toBe(30);
  });

  it('does not match a DIFFERENT stereotype not present in the bucket', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateFontSizeByStereo: { foo: 30 } } },
    });
    expect(resolveStateFontSize({ stereotype: 'other' }, theme, 14)).toBe(14);
  });

  it('is case-insensitive on the stereotype label', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateFontSizeByStereo: { meblue: 20 } } },
    });
    expect(resolveStateFontSize({ stereotype: 'MeBlue' }, theme, 14)).toBe(20);
  });
});

// mission G4 S16: <style> stateDiagram { arrow { LineColor HeadColor } } }
// -- jar-verified nanozi-96-foda024: path stroke="#0000FF" (LineColor),
// polygon fill="#FF0000" stroke="#FF0000" (HeadColor).
describe('resolveStateArrowLineColor', () => {
  it('falls back to the given default when no cascade override is set', () => {
    expect(resolveStateArrowLineColor(defaultTheme, '#181818')).toBe('#181818');
  });

  it('resolves the statediagram.arrow LineColor cascade override', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateArrowLineColor: 'blue' } },
    });
    expect(resolveStateArrowLineColor(theme, '#181818')).toBe('#0000FF');
  });
});

describe('resolveStateArrowHeadColor', () => {
  it('falls back to the given default when no cascade override is set', () => {
    expect(resolveStateArrowHeadColor(defaultTheme, '#181818')).toBe('#181818');
  });

  it('resolves the statediagram.arrow HeadColor cascade override', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateArrowHeadColor: 'red' } },
    });
    expect(resolveStateArrowHeadColor(theme, '#181818')).toBe('#FF0000');
  });
});

// mission G4 S16: <style> activityBar { .fork {...} .join {...} } } --
// jar-verified koguvo-74-kubo455: fork bar fill="#008000", join bar
// fill="#FFA500".
describe('resolveActivityBarForkColor', () => {
  it('returns undefined when no cascade override is set', () => {
    expect(resolveActivityBarForkColor(defaultTheme)).toBeUndefined();
  });

  it('resolves the activitybar..fork BackGroundColor cascade override', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { activityBarForkColor: 'green' } },
    });
    expect(resolveActivityBarForkColor(theme)).toBe('#008000');
  });
});

describe('resolveActivityBarJoinColor', () => {
  it('returns undefined when no cascade override is set', () => {
    expect(resolveActivityBarJoinColor(defaultTheme)).toBeUndefined();
  });

  it('resolves the activitybar..join BackGroundColor cascade override', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { activityBarJoinColor: 'orange' } },
    });
    expect(resolveActivityBarJoinColor(theme)).toBe('#FFA500');
  });
});

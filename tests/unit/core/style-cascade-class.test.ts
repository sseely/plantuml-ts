import { describe, it, expect } from 'vitest';
import {
  computeClassStyleCascadeOverrides,
  computeClassTagCascadeGenerations,
  resolveClassTagCascadeEntry,
} from '../../../src/core/style-cascade-class.js';
import { defaultTheme } from '../../../src/core/theme.js';
import type { StyleMap } from '../../../src/core/skinparam.js';

/** Build a StyleMap from a plain object of selector → declarations. */
function styleMap(spec: Record<string, Record<string, string>>): StyleMap {
  const m: StyleMap = new Map();
  for (const [sel, decls] of Object.entries(spec)) {
    m.set(sel, new Map(Object.entries(decls)));
  }
  return m;
}

describe('computeClassStyleCascadeOverrides (G2 N36)', () => {
  it('resolves a bare classDiagram {} BackGroundColor to hex (cilaba-36-zogi212 shape)', () => {
    const override = computeClassStyleCascadeOverrides(
      styleMap({ classdiagram: { backgroundcolor: 'Green' } }),
    );
    expect(override.classCascadeBackground).toBe('#008000');
  });

  it('resolves root/classDiagram/class BackGroundColor/LineColor/FontColor together (bikuka-40-pezi068 shape)', () => {
    const override = computeClassStyleCascadeOverrides(
      styleMap({
        root: { fontcolor: 'Blue', backgroundcolor: 'Red' },
        classdiagram: { backgroundcolor: 'Green', linecolor: 'yellow' },
        class: { linecolor: 'lightblue' },
      }),
    );
    expect(override.classCascadeBackground).toBe('#008000'); // classDiagram wins over root
    expect(override.classCascadeBorder).toBe('#ADD8E6'); // class (lightblue) wins over classDiagram (yellow)
    expect(override.classCascadeFontColor).toBe('#0000FF'); // root only source of FontColor
    expect(override.classCascadeArrowColor).toBe('#FFFF00'); // classDiagram's LineColor, arrow has no class-level override
    expect(override.spotCascadeBackground).toBe('#FF0000'); // root only (classDiagram excluded from spot signature)
    expect(override.spotCascadeFont).toBe('#0000FF');
  });

  it('a nested classDiagram.class selector reaches the same fields as a bare class {} (fumalu/bajula shape)', () => {
    const override = computeClassStyleCascadeOverrides(
      styleMap({ 'classdiagram.class': { fontcolor: 'blue', backgroundcolor: 'yellow' } }),
    );
    expect(override.classCascadeBackground).toBe('#FFFF00');
    expect(override.classCascadeFontColor).toBe('#0000FF');
  });

  it('a header-nested override wins for classCascadeHeaderFontColor but not classCascadeFontColor (momaku-69-duxe918 shape)', () => {
    const override = computeClassStyleCascadeOverrides(
      styleMap({
        'classdiagram.class': { fontcolor: 'blue' },
        'classdiagram.class.header': { fontcolor: 'violet' },
      }),
    );
    expect(override.classCascadeFontColor).toBe('#0000FF');
    expect(override.classCascadeHeaderFontColor).toBe('#EE82EE');
  });

  it('an arrow-scoped nested selector under classDiagram sets classCascadeArrowColor (rakici-44-tivo701 shape)', () => {
    const override = computeClassStyleCascadeOverrides(
      styleMap({ 'classdiagram.arrow': { linecolor: 'blue' } }),
    );
    expect(override.classCascadeArrowColor).toBe('#0000FF');
  });

  it('returns an empty object for a StyleMap with no matching selectors', () => {
    const override = computeClassStyleCascadeOverrides(styleMap({ database: { backgroundcolor: '#000' } }));
    expect(override).toEqual({});
  });

  it('a bare document {} selector never leaks into any class-cascade field', () => {
    const override = computeClassStyleCascadeOverrides(styleMap({ document: { backgroundcolor: 'Navy' } }));
    expect(override).toEqual({});
  });
});

describe('computeClassStyleCascadeOverrides -- unresolvable color guard (G2 N36 regression)', () => {
  // G2 N48 (item 29): `#?light:dark[:transparent]` (`HColorScheme`) is no
  // longer an "unresolvable" token discarded by the N36 guard -- it is now
  // RESOLVED against the classifier's own local background
  // (`cascadeFontColorHex`/`resolveConditionalColor`, `plans/g2-class-svg
  // /ledger.md` N48). These two cases pre-date that mechanism and asserted
  // the OLD "discard, fall back to caller's own default" behavior;
  // corrected in place to the jar-verified resolved values (diagnosis.md:
  // a PRE-fix-encoded test, not a live regression -- both fixtures cited
  // in their own titles, `xalaco-64-vuzu312`/(unnamed), now render
  // zero-diff against the real jar oracle with these exact values).
  it('resolves jar\'s `#?black:white` conditional-color ternary against the DEFAULT classifier background (xalaco-64-vuzu312 shape, no BackgroundColor override -- light, not dark -- picks colorLight)', () => {
    const override = computeClassStyleCascadeOverrides(
      styleMap({ root: { fontcolor: '#?black:white' } }),
    );
    expect(override.classCascadeFontColor).toBe('#000000');
  });

  it('resolves `#?black:white` against an explicit BackgroundColor override on the SAME declaration (Red is dark by YIQ -- picks colorDark)', () => {
    const override = computeClassStyleCascadeOverrides(
      styleMap({ root: { fontcolor: '#?black:white', backgroundcolor: 'Red' } }),
    );
    expect(override.classCascadeFontColor).toBe('#FFFFFF');
    expect(override.classCascadeBackground).toBe('#FF0000');
  });

  it('still resolves the transparent keyword (not swallowed by the unresolvable-color guard)', () => {
    const override = computeClassStyleCascadeOverrides(
      styleMap({ classdiagram: { backgroundcolor: 'transparent' } }),
    );
    expect(override.classCascadeBackground).toBe('#00000000');
  });
});


// ---------------------------------------------------------------------------
// `.tagname` stereotype sub-selector cascade + ancestor-only RoundCorner
// (G2 N37)
// ---------------------------------------------------------------------------
describe('computeClassStyleCascadeOverrides -- classCascadeRoundCorner (G2 N37)', () => {
  it('resolves a bare classDiagram { RoundCorner N } to the ancestor field (dozude Alice1 shape)', () => {
    const override = computeClassStyleCascadeOverrides(styleMap({ classdiagram: { roundcorner: '15' } }));
    expect(override.classCascadeRoundCorner).toBe(15);
  });

  it('ignores a non-numeric RoundCorner value', () => {
    const override = computeClassStyleCascadeOverrides(styleMap({ classdiagram: { roundcorner: 'nope' } }));
    expect(override.classCascadeRoundCorner).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// classCascadeMaximumWidth / classCascadeHeaderMaximumWidth (G2 N65 item 35)
// ---------------------------------------------------------------------------
describe('computeClassStyleCascadeOverrides -- MaximumWidth word-wrap (G2 N65 item 35)', () => {
  it('a bare class { MaximumWidth N } sets BOTH the member and header fields to the same value (nucite/nufini shape)', () => {
    const override = computeClassStyleCascadeOverrides(styleMap({ class: { maximumwidth: '150' } }));
    expect(override.classCascadeMaximumWidth).toBe(150);
    expect(override.classCascadeHeaderMaximumWidth).toBe(150);
  });

  it('a header-nested override wins for classCascadeHeaderMaximumWidth but not classCascadeMaximumWidth', () => {
    const override = computeClassStyleCascadeOverrides(
      styleMap({
        class: { maximumwidth: '150' },
        'class.header': { maximumwidth: '80' },
      }),
    );
    expect(override.classCascadeMaximumWidth).toBe(150);
    expect(override.classCascadeHeaderMaximumWidth).toBe(80);
  });

  it('ignores a non-numeric MaximumWidth value', () => {
    const override = computeClassStyleCascadeOverrides(styleMap({ class: { maximumwidth: 'nope' } }));
    expect(override.classCascadeMaximumWidth).toBeUndefined();
    expect(override.classCascadeHeaderMaximumWidth).toBeUndefined();
  });

  it('absent when no MaximumWidth declaration exists anywhere', () => {
    const override = computeClassStyleCascadeOverrides(styleMap({ class: { backgroundcolor: 'red' } }));
    expect(override.classCascadeMaximumWidth).toBeUndefined();
    expect(override.classCascadeHeaderMaximumWidth).toBeUndefined();
  });
});

describe('computeClassStyleCascadeOverrides -- classTagCascade (G2 N37)', () => {
  it('resolves BackgroundColor/RoundCorner/FontColor/FontStyle for a nested .tagname (dozude shape)', () => {
    const override = computeClassStyleCascadeOverrides(
      styleMap({
        classdiagram: { roundcorner: '15' },
        'classdiagram..mystyle': {
          roundcorner: '5',
          backgroundcolor: 'cyan',
          fontstyle: 'Bold',
          fontcolor: 'red',
        },
      }),
    );
    expect(override.classTagCascade?.mystyle).toEqual({
      background: '#00FFFF',
      roundCorner: 5,
      fontColor: '#FF0000',
      fontBold: true,
      fontItalic: false,
    });
  });

  it('resolves TWO distinct tags to DIFFERENT entries (rakici-44-tivo701 shape)', () => {
    const override = computeClassStyleCascadeOverrides(
      styleMap({
        'classdiagram..x': { backgroundcolor: '#00ffff' },
        'classdiagram..y': { backgroundcolor: '#ff0000' },
      }),
    );
    expect(override.classTagCascade?.x?.background).toBe('#00FFFF');
    expect(override.classTagCascade?.y?.background).toBe('#FF0000');
  });

  it('a tag with NO class-relevant declaration contributes no entry', () => {
    const override = computeClassStyleCascadeOverrides(styleMap({ 'note..faint': { backgroundcolor: 'red' } }));
    expect(override.classTagCascade).toBeUndefined();
  });
});

describe('resolveClassTagCascadeEntry (G2 N37)', () => {
  const cascade = { mystyle: { background: '#00FFFF' }, other: { background: '#FF0000' } };

  it('returns the entry for the first matching label', () => {
    const theme = { ...defaultTheme, colors: { ...defaultTheme.colors, graph: { ...defaultTheme.colors.graph, classTagCascade: cascade } } };
    expect(resolveClassTagCascadeEntry(theme, ['mystyle'])?.background).toBe('#00FFFF');
    expect(resolveClassTagCascadeEntry(theme, ['nomatch', 'other'])?.background).toBe('#FF0000');
  });

  it('returns undefined when no cascade exists or labels is undefined', () => {
    expect(resolveClassTagCascadeEntry(defaultTheme, ['mystyle'])).toBeUndefined();
    const theme = { ...defaultTheme, colors: { ...defaultTheme.colors, graph: { ...defaultTheme.colors.graph, classTagCascade: cascade } } };
    expect(resolveClassTagCascadeEntry(theme, undefined)).toBeUndefined();
  });

  it('picks the position-scoped generation entry over the final classTagCascade when both are set (G2 N39)', () => {
    const generations = [undefined, { a: { background: '#FFC0CB' } }, { a: { background: '#98FB98' } }];
    const theme = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        graph: {
          ...defaultTheme.colors.graph,
          classTagCascade: { a: { background: '#98FB98' } },
          classTagCascadeGenerations: generations,
        },
      },
    };
    expect(resolveClassTagCascadeEntry(theme, ['a'], 1)?.background).toBe('#FFC0CB');
    expect(resolveClassTagCascadeEntry(theme, ['a'], 2)?.background).toBe('#98FB98');
  });

  it('falls back to the plain classTagCascade when styleGeneration is undefined or generations is unset (G2 N39)', () => {
    const generations = [undefined, { a: { background: '#FFC0CB' } }];
    const withGenerations = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        graph: {
          ...defaultTheme.colors.graph,
          classTagCascade: { a: { background: '#98FB98' } },
          classTagCascadeGenerations: generations,
        },
      },
    };
    expect(resolveClassTagCascadeEntry(withGenerations, ['a'])?.background).toBe('#98FB98');
    const theme = { ...defaultTheme, colors: { ...defaultTheme.colors, graph: { ...defaultTheme.colors.graph, classTagCascade: cascade } } };
    expect(resolveClassTagCascadeEntry(theme, ['mystyle'], 0)?.background).toBe('#00FFFF');
  });
});

describe('computeClassTagCascadeGenerations (G2 N39)', () => {
  it('returns undefined for 0 or 1 style blocks (nothing to disambiguate)', () => {
    expect(computeClassTagCascadeGenerations([])).toBeUndefined();
    expect(computeClassTagCascadeGenerations(['.a {BackGroundColor pink}'])).toBeUndefined();
  });

  it('snapshots the SAME selector redefined across two blocks (fexuta-62-piko653 shape)', () => {
    const generations = computeClassTagCascadeGenerations([
      '.a {BackGroundColor pink}',
      '.a {BackGroundColor palegreen}',
    ]);
    expect(generations).toBeDefined();
    expect(generations![0]).toBeUndefined();
    expect(generations![1]?.['a']?.background).toBe('#FFC0CB');
    expect(generations![2]?.['a']?.background).toBe('#98FB98');
  });

  it('carries an UNRELATED selector forward across a later block that does not touch it', () => {
    const generations = computeClassTagCascadeGenerations([
      '.a {BackGroundColor pink}',
      '.b {BackGroundColor yellow}',
    ]);
    expect(generations![1]?.['a']?.background).toBe('#FFC0CB');
    expect(generations![2]?.['a']?.background).toBe('#FFC0CB');
    expect(generations![2]?.['b']?.background).toBe('#FFFF00');
  });
});
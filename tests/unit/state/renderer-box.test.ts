/**
 * Unit tests for renderer-box.ts's `renderNormal` -- mission G4 S16's
 * `stateFontSize<<X>>` render-time threading (the font-size attribute,
 * ascent, and header/body line-step formula all switch to the
 * stereotype-resolved size, not the theme default).
 *
 * Jar-verified `laferu-31-tice836` (`skinparam stateBackgroundColor<<Foo>>
 * red` + `stateFontColor<<Foo>> yellow` + `stateFontSize<<Foo>> 30`, `state
 * state1 <<Foo>>`, no body): `rect width="101.5625" height="50"`, `line
 * x1="7" y1="47" x2="108.5625" y2="47"`, `text x="17" y="35.3333"
 * fill="#FFFF00" font-size="30" textLength="81.5625"`.
 *
 * @see plans/g4-state-svg/ledger.md (S16)
 */
import { describe, it, expect } from 'vitest';
import { renderNormal } from '../../../src/diagrams/state/renderer-box.js';
import type { StateNodeGeo } from '../../../src/diagrams/state/state-geo-types.js';
import { defaultTheme, deepMergeTheme } from '../../../src/core/theme.js';

function makeNode(overrides: Partial<StateNodeGeo> = {}): StateNodeGeo {
  return {
    id: 'state1',
    display: 'state1',
    kind: 'normal',
    x: 7,
    y: 7,
    width: 101.5625,
    height: 50,
    children: [],
    transitions: [],
    headerLines: [{ text: 'state1', width: 81.5625 }],
    ...overrides,
  };
}

describe('renderNormal — stateFontSize<<X>> (mission G4 S16)', () => {
  it('renders the header text at the theme default font-size with no override', () => {
    const svg = renderNormal(makeNode(), defaultTheme);
    expect(svg).toContain(`font-size="${defaultTheme.fontSize}"`);
  });

  it('renders the header text at the stereotype-scoped font-size override', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateFontSizeByStereo: { foo: 30 } } },
    });
    const svg = renderNormal(makeNode({ stereotype: 'Foo' }), theme);
    expect(svg).toContain('font-size="30"');
  });

  it('positions the divider line using the OVERRIDDEN font size (jar-verified laferu-31-tice836: y="47")', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateFontSizeByStereo: { foo: 30 } } },
    });
    const svg = renderNormal(makeNode({ stereotype: 'Foo' }), theme);
    expect(svg).toContain('y1="47"');
  });

  it('positions the header baseline using the OVERRIDDEN font size (jar-verified laferu-31-tice836: y=35.3333, javaRound4-formatted downstream by assembleSvg -- this direct renderNormal() call bypasses that pass, so assert the raw unrounded value)', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateFontSizeByStereo: { foo: 30 } } },
    });
    const svg = renderNormal(makeNode({ stereotype: 'Foo' }), theme);
    const match = /text x="17" y="([\d.]+)"/.exec(svg);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeCloseTo(35.3333, 3);
  });

  it('does not apply the override to a state with a DIFFERENT stereotype', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateFontSizeByStereo: { foo: 30 } } },
    });
    const svg = renderNormal(makeNode({ stereotype: 'bar' }), theme);
    expect(svg).toContain(`font-size="${defaultTheme.fontSize}"`);
  });
});

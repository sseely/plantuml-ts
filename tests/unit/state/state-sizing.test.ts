/**
 * Unit tests for state-sizing.ts's `stateFontSize<<X>>` threading
 * (mission G4 S16) -- `resolveStateFontSize` (state-render-colors.ts) reads
 * `theme.colors.graph.stateFontSizeByStereo` at BOTH `measureState` (feeds
 * the box's own DOT node width/height, the LAYOUT-time concern S9/S14/S15's
 * own queue notes deferred) and `buildStateGeoTextFields` (feeds the
 * per-line measured `StateTextLine.width` the renderer's `textLength`
 * attribute needs -- `renderer-box.test.ts`/`renderer.test.ts` cover the
 * render-time `font-size` attribute + line-step formula separately).
 *
 * Jar-verified `laferu-31-tice836` (`skinparam stateFontSize<<Foo>> 30`,
 * `state state1 <<Foo>>`, no body): box `width="101.5625" height="50"`,
 * `text ... font-size="30" textLength="81.5625"`.
 *
 * @see plans/g4-state-svg/ledger.md (S16)
 */
import { describe, it, expect } from 'vitest';
import { measureState, buildStateGeoTextFields } from '../../../src/diagrams/state/state-sizing.js';
import type { State } from '../../../src/diagrams/state/ast.js';
import { defaultTheme, deepMergeTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';

const measurer = new FormulaMeasurer();

function makeState(overrides: Partial<State> = {}): State {
  return {
    id: 'state1',
    display: 'state1',
    kind: 'normal',
    children: [],
    concurrentRegions: [],
    transitions: [],
    ...overrides,
  };
}

describe('measureState -- stateFontSize<<X>> (mission G4 S16)', () => {
  it('measures at the stereotype-scoped font-size override, widening the box', () => {
    const state = makeState({ stereotype: 'Foo' });
    const theme30 = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateFontSizeByStereo: { foo: 30 } } },
    });
    const atDefault = measureState(makeState(), false, defaultTheme, measurer, 'TB');
    const atOverride = measureState(state, false, theme30, measurer, 'TB');
    // height stays clamped to STATE_MIN_HEIGHT (50) at BOTH font sizes for
    // this single-line, no-body fixture (14pt: 14+20=34 < 50; 30pt: 30+20=50
    // == 50 -- matches laferu-31-tice836's own jar-verified height=50
    // exactly) -- width is the discriminating assertion.
    expect(atOverride.width).toBeGreaterThan(atDefault.width);
    expect(atOverride.height).toBe(50);
  });

  it('does not widen a state with a DIFFERENT (non-matching) stereotype', () => {
    const theme30 = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateFontSizeByStereo: { foo: 30 } } },
    });
    const state = makeState({ stereotype: 'Bar' });
    const atDefault = measureState(makeState(), false, defaultTheme, measurer, 'TB');
    const atOther = measureState(state, false, theme30, measurer, 'TB');
    expect(atOther.width).toBe(atDefault.width);
    expect(atOther.height).toBe(atDefault.height);
  });
});

describe('buildStateGeoTextFields -- stateFontSize<<X>> (mission G4 S16)', () => {
  it('measures headerLines at the overridden font size (wider textLength)', () => {
    const theme30 = deepMergeTheme(defaultTheme, {
      colors: { graph: { stateFontSizeByStereo: { foo: 30 } } },
    });
    const atDefault = buildStateGeoTextFields(makeState(), defaultTheme, measurer);
    const atOverride = buildStateGeoTextFields(makeState({ stereotype: 'Foo' }), theme30, measurer);
    expect(atOverride.headerLines?.[0]?.width).toBeGreaterThan(atDefault.headerLines?.[0]?.width ?? 0);
  });
});

/**
 * Unit tests for `applyStyleMap`'s state-diagram `<style>` selector
 * handling (mission G4 S16) — the `stateDiagram { arrow { LineColor
 * HeadColor } } }` and `activityBar { .fork {...} .join {...} } }` cascade
 * sub-families, previously write-set-blocked (S14/S15's own "confirmed
 * WRITE-SET BLOCKED" finding: `style-map-theme.ts` was outside the g4
 * mission's write-set until this iteration's explicit grant).
 *
 * Jar-verified:
 *   - `nanozi-96-foda024` (`stateDiagram { arrow { LineColor blue
 *     HeadColor red } } }`, `a-->b`): `path stroke="#0000FF"`, `polygon
 *     fill="#FF0000" stroke="#FF0000"`.
 *   - `koguvo-74-kubo455` (`activityBar { .fork { BackGroundColor: green;
 *     } .join { BackGroundColor: orange; } } }`, `state f <<fork>>`/
 *     `state j <<join>>`): fork bar `fill="#008000"`, join bar
 *     `fill="#FFA500"`.
 *
 * @see plans/g4-state-svg/ledger.md (S16)
 */
import { describe, it, expect } from 'vitest';
import { applyStyleMap } from '../../../src/core/style-map-theme.js';
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

describe('applyStyleMap — statediagram.arrow (mission G4 S16)', () => {
  it('maps LineColor to colors.graph.stateArrowLineColor', () => {
    const theme = applyStyleMap(
      styleMap({ 'statediagram.arrow': { linecolor: 'blue' } }),
      defaultTheme,
    );
    expect(theme.colors.graph.stateArrowLineColor).toBe('blue');
  });

  it('maps HeadColor to colors.graph.stateArrowHeadColor', () => {
    const theme = applyStyleMap(
      styleMap({ 'statediagram.arrow': { headcolor: 'red' } }),
      defaultTheme,
    );
    expect(theme.colors.graph.stateArrowHeadColor).toBe('red');
  });

  it('maps both simultaneously (nanozi-96-foda024)', () => {
    const theme = applyStyleMap(
      styleMap({ 'statediagram.arrow': { linecolor: 'blue', headcolor: 'red' } }),
      defaultTheme,
    );
    expect(theme.colors.graph.stateArrowLineColor).toBe('blue');
    expect(theme.colors.graph.stateArrowHeadColor).toBe('red');
  });

  it('leaves the fields unset when no statediagram.arrow selector is present', () => {
    const theme = applyStyleMap(styleMap({}), defaultTheme);
    expect(theme.colors.graph.stateArrowLineColor).toBeUndefined();
    expect(theme.colors.graph.stateArrowHeadColor).toBeUndefined();
  });
});

describe('applyStyleMap — activitybar..fork/activitybar..join (mission G4 S16)', () => {
  it('maps activitybar..fork BackGroundColor to colors.graph.activityBarForkColor', () => {
    const theme = applyStyleMap(
      styleMap({ 'activitybar..fork': { backgroundcolor: 'green' } }),
      defaultTheme,
    );
    expect(theme.colors.graph.activityBarForkColor).toBe('green');
  });

  it('maps activitybar..join BackGroundColor to colors.graph.activityBarJoinColor', () => {
    const theme = applyStyleMap(
      styleMap({ 'activitybar..join': { backgroundcolor: 'orange' } }),
      defaultTheme,
    );
    expect(theme.colors.graph.activityBarJoinColor).toBe('orange');
  });

  it('maps both simultaneously (koguvo-74-kubo455)', () => {
    const theme = applyStyleMap(
      styleMap({
        'activitybar..fork': { backgroundcolor: 'green' },
        'activitybar..join': { backgroundcolor: 'orange' },
      }),
      defaultTheme,
    );
    expect(theme.colors.graph.activityBarForkColor).toBe('green');
    expect(theme.colors.graph.activityBarJoinColor).toBe('orange');
  });
});

/**
 * Feature: `resolveSkinparam`'s `statebackgroundcolor<<X>>`/
 * `statefontcolor<<X>>`/`statefontsize<<X>>` parsing (mission G4 S15/S16).
 *
 * Mirrors `core/skinparam.ts`'s own pre-existing `statebordercolor<<X>>`
 * (mission G4 S9) direct stereotype-qualified value-lookup mechanism
 * (`SkinParam#getColor(ColorParam, Stereotype)`), applied to a state box's
 * own fill/text color/font-size instead of its border. `statefontsize<<X>>`
 * (mission G4 S16) is the SAME direct-value-lookup shape (jar-verified via
 * `FromSkinparamToStyle.java`'s `addConFont("state", SName.state)` ->
 * `getFirstValueNonNullWithSuffix("fontsize" + stereotype, ...)`, NOT the
 * `<style>`-block cascade family this mission's write-set boundary blocks --
 * see `state-render-colors.ts#resolveStateFontSize`'s own doc comment for
 * the full derivation). Kept in `tests/unit/state/` (this mission's own
 * write-set) rather than the top-level `tests/unit/skinparam.test.ts`
 * (outside the write-set) — a state-scoped test of a `core/skinparam.ts`
 * function, same rationale as `state-render-colors.test.ts` testing
 * `theme.ts`-typed color resolution from within this mission's own
 * directory.
 *
 * Jar-verified `laferu-31-tice836` (`skinparam stateBackgroundColor<<Foo>>
 * red` + `skinparam stateFontColor<<Foo>> yellow` + `skinparam
 * stateFontSize<<Foo>> 30`, `state state1 <<Foo>>` -> `fill="#FF0000"`,
 * label `fill="#FFFF00" font-size="30"`).
 *
 * @see plans/g4-state-svg/ledger.md (S15, S16)
 */
import { describe, it, expect } from 'vitest';
import { resolveSkinparam } from '../../../src/core/skinparam.js';
import { defaultTheme } from '../../../src/core/theme.js';

describe('resolveSkinparam — statebackgroundcolor<<X>>/statefontcolor<<X>> (mission G4 S15)', () => {
  it('maps statebackgroundcolor<<stereo>> to colors.graph.stateBackgroundColorByStereo', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['statebackgroundcolor<<Foo>>', 'red']]),
      defaultTheme,
    );
    expect(theme.colors.graph.stateBackgroundColorByStereo).toEqual({ foo: 'red' });
    expect(unknown).toEqual([]);
  });

  it('maps statefontcolor<<stereo>> to colors.graph.stateFontColorByStereo', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['statefontcolor<<Foo>>', 'yellow']]),
      defaultTheme,
    );
    expect(theme.colors.graph.stateFontColorByStereo).toEqual({ foo: 'yellow' });
    expect(unknown).toEqual([]);
  });

  it('lowercases the stereotype label in statebackgroundcolor<<X>>/statefontcolor<<X>>', () => {
    const { theme } = resolveSkinparam(
      new Map([
        ['statebackgroundcolor<<MeBlue>>', '#FF0000'],
        ['statefontcolor<<MeBlue>>', '#FFFF00'],
      ]),
      defaultTheme,
    );
    expect(theme.colors.graph.stateBackgroundColorByStereo).toEqual({ meblue: '#FF0000' });
    expect(theme.colors.graph.stateFontColorByStereo).toEqual({ meblue: '#FFFF00' });
  });

  it('does not confuse statebackgroundcolor<<X>> with the plain stateBackgroundColor bucket', () => {
    const { theme } = resolveSkinparam(
      new Map([
        ['statebackgroundcolor', 'white'],
        ['statebackgroundcolor<<Foo>>', 'red'],
      ]),
      defaultTheme,
    );
    expect(theme.colors.elements?.['state']?.background).toBe('white');
    expect(theme.colors.graph.stateBackgroundColorByStereo).toEqual({ foo: 'red' });
  });

  it('an unrecognized stereotype-qualified key outside these two forms stays unknown', () => {
    const { unknown } = resolveSkinparam(
      new Map([['statesomethingelse<<Foo>>', 'red']]),
      defaultTheme,
    );
    expect(unknown).toEqual(['statesomethingelse<<foo>>']);
  });
});

describe('resolveSkinparam — statefontsize<<X>> (mission G4 S16)', () => {
  it('maps statefontsize<<stereo>> to colors.graph.stateFontSizeByStereo', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['statefontsize<<Foo>>', '30']]),
      defaultTheme,
    );
    expect(theme.colors.graph.stateFontSizeByStereo).toEqual({ foo: 30 });
    expect(unknown).toEqual([]);
  });

  it('lowercases the stereotype label in statefontsize<<X>>', () => {
    const { theme } = resolveSkinparam(
      new Map([['statefontsize<<MeBlue>>', '18']]),
      defaultTheme,
    );
    expect(theme.colors.graph.stateFontSizeByStereo).toEqual({ meblue: 18 });
  });

  it('ignores a non-numeric statefontsize<<X>> value', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['statefontsize<<Foo>>', 'notanumber']]),
      defaultTheme,
    );
    expect(theme.colors.graph.stateFontSizeByStereo).toBeUndefined();
    expect(unknown).toEqual([]);
  });

  it('combines with statebackgroundcolor<<X>>/statefontcolor<<X>> on the same stereotype (laferu-31-tice836)', () => {
    const { theme } = resolveSkinparam(
      new Map([
        ['statebackgroundcolor<<Foo>>', 'red'],
        ['statefontcolor<<Foo>>', 'yellow'],
        ['statefontsize<<Foo>>', '30'],
      ]),
      defaultTheme,
    );
    expect(theme.colors.graph.stateBackgroundColorByStereo).toEqual({ foo: 'red' });
    expect(theme.colors.graph.stateFontColorByStereo).toEqual({ foo: 'yellow' });
    expect(theme.colors.graph.stateFontSizeByStereo).toEqual({ foo: 30 });
  });
});

import { describe, expect, it } from 'vitest';
import { TValue } from '../../../../../src/core/tim/expression/TValue.js';
import { EaterException } from '../../../../../src/core/tim/EaterException.js';
import { Darken } from '../../../../../src/core/tim/builtin/Darken.js';
import { Lighten } from '../../../../../src/core/tim/builtin/Lighten.js';
import { IsDark } from '../../../../../src/core/tim/builtin/IsDark.js';
import { IsLight } from '../../../../../src/core/tim/builtin/IsLight.js';
import { ReverseColor } from '../../../../../src/core/tim/builtin/ReverseColor.js';
import { ReverseHsluvColor } from '../../../../../src/core/tim/builtin/ReverseHsluvColor.js';
import { HslColor } from '../../../../../src/core/tim/builtin/HslColor.js';
import { LOC, NO_NAMED, fakeContext } from '../../../../helpers/tim-builtin.js';

const str = (s: string): TValue => TValue.fromString(s);
const num = (n: number): TValue => TValue.fromInt(n);

describe('Darken / Lighten', () => {
  it('%darken reduces relative HSL luminance', () => {
    const result = new Darken().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [str('#FF0000'), num(50)],
      NO_NAMED,
    );
    expect(result.toString()).toBe('#800000');
  });
  it('%lighten increases relative HSL luminance', () => {
    const result = new Lighten().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [str('#000080'), num(50)],
      NO_NAMED,
    );
    expect(result.toString()).toBe('#0000C0');
  });
  it('%lighten throws for an unresolvable color', () => {
    expect(() =>
      new Lighten().executeReturnFunction(fakeContext(), undefined, LOC, [str('notacolor123'), num(10)], NO_NAMED),
    ).toThrow(EaterException);
  });
  it('%darken throws for an unresolvable color', () => {
    expect(() =>
      new Darken().executeReturnFunction(fakeContext(), undefined, LOC, [str('notacolor123'), num(10)], NO_NAMED),
    ).toThrow(EaterException);
  });
});

describe('IsDark / IsLight', () => {
  it('black is dark, white is light', () => {
    expect(
      new IsDark().executeReturnFunction(fakeContext(), undefined, LOC, [str('#000000')], NO_NAMED).toBoolean(),
    ).toBe(true);
    expect(
      new IsDark().executeReturnFunction(fakeContext(), undefined, LOC, [str('#FFFFFF')], NO_NAMED).toBoolean(),
    ).toBe(false);
    expect(
      new IsLight().executeReturnFunction(fakeContext(), undefined, LOC, [str('#FFFFFF')], NO_NAMED).toBoolean(),
    ).toBe(true);
    expect(
      new IsLight().executeReturnFunction(fakeContext(), undefined, LOC, [str('#000000')], NO_NAMED).toBoolean(),
    ).toBe(false);
  });
  it('both throw for an unresolvable color', () => {
    expect(() =>
      new IsDark().executeReturnFunction(fakeContext(), undefined, LOC, [str('notacolor123')], NO_NAMED),
    ).toThrow(EaterException);
    expect(() =>
      new IsLight().executeReturnFunction(fakeContext(), undefined, LOC, [str('notacolor123')], NO_NAMED),
    ).toThrow(EaterException);
  });
});

describe('ReverseColor', () => {
  it('is the flat per-channel 255-complement', () => {
    expect(
      new ReverseColor().executeReturnFunction(fakeContext(), undefined, LOC, [str('#000000')], NO_NAMED).toString(),
    ).toBe('#FFFFFF');
    expect(
      new ReverseColor().executeReturnFunction(fakeContext(), undefined, LOC, [str('#FFFFFF')], NO_NAMED).toString(),
    ).toBe('#000000');
  });
  it('throws for an unresolvable color', () => {
    expect(() =>
      new ReverseColor().executeReturnFunction(fakeContext(), undefined, LOC, [str('notacolor123')], NO_NAMED),
    ).toThrow(EaterException);
  });
});

describe('ReverseHsluvColor', () => {
  it('matches the ported HSLuv reversal algorithm (golden values)', () => {
    expect(
      new ReverseHsluvColor()
        .executeReturnFunction(fakeContext(), undefined, LOC, [str('#FF0000')], NO_NAMED)
        .toString(),
    ).toBe('#540000');
    expect(
      new ReverseHsluvColor()
        .executeReturnFunction(fakeContext(), undefined, LOC, [str('#0000FF')], NO_NAMED)
        .toString(),
    ).toBe('#AFAFFF');
  });
  it('throws for an unresolvable color', () => {
    expect(() =>
      new ReverseHsluvColor().executeReturnFunction(fakeContext(), undefined, LOC, [str('notacolor123')], NO_NAMED),
    ).toThrow(EaterException);
  });
});

describe('HslColor', () => {
  it('builds red from h=0,s=100,l=50', () => {
    const result = new HslColor().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [num(0), num(100), num(50)],
      NO_NAMED,
    );
    expect(result.toString()).toBe('#FF0000');
  });
  it('builds white from l=100 regardless of hue/saturation', () => {
    const result = new HslColor().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [num(200), num(50), num(100)],
      NO_NAMED,
    );
    expect(result.toString()).toBe('#FFFFFF');
  });
  it('canCover accepts an optional 4th alpha argument', () => {
    const fn = new HslColor();
    expect(fn.canCover(3, new Set())).toBe(true);
    expect(fn.canCover(4, new Set())).toBe(true);
    expect(fn.canCover(2, new Set())).toBe(false);
  });
  it('a 4th (alpha percent) argument produces an alpha-prefixed 8-digit form', () => {
    const result = new HslColor().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [num(0), num(100), num(50), num(50)],
      NO_NAMED,
    );
    expect(result.toString()).toBe('#80ff0000');
  });
});

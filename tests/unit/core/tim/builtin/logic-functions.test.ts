import { describe, expect, it } from 'vitest';
import { TValue } from '../../../../../src/core/tim/expression/TValue.js';
import { EaterException } from '../../../../../src/core/tim/EaterException.js';
import { AlwaysFalse } from '../../../../../src/core/tim/builtin/AlwaysFalse.js';
import { AlwaysTrue } from '../../../../../src/core/tim/builtin/AlwaysTrue.js';
import { LogicalNot } from '../../../../../src/core/tim/builtin/LogicalNot.js';
import { LogicalAnd } from '../../../../../src/core/tim/builtin/LogicalAnd.js';
import { LogicalOr } from '../../../../../src/core/tim/builtin/LogicalOr.js';
import { LogicalXor } from '../../../../../src/core/tim/builtin/LogicalXor.js';
import { LogicalNand } from '../../../../../src/core/tim/builtin/LogicalNand.js';
import { LogicalNor } from '../../../../../src/core/tim/builtin/LogicalNor.js';
import { LogicalNxor } from '../../../../../src/core/tim/builtin/LogicalNxor.js';
import { Modulo } from '../../../../../src/core/tim/builtin/Modulo.js';
import { LOC, NO_NAMED, fakeContext } from '../../../../helpers/tim-builtin.js';

const bools = (...vs: boolean[]): TValue[] => vs.map((v) => TValue.fromBoolean(v));

describe('AlwaysFalse / AlwaysTrue', () => {
  it('%false always returns false', () => {
    expect(new AlwaysFalse().executeReturnFunction(fakeContext(), undefined, LOC, [], NO_NAMED).toBoolean()).toBe(
      false,
    );
  });
  it('%true always returns true', () => {
    expect(new AlwaysTrue().executeReturnFunction(fakeContext(), undefined, LOC, [], NO_NAMED).toBoolean()).toBe(true);
  });
});

describe('LogicalNot', () => {
  it('negates', () => {
    expect(
      new LogicalNot().executeReturnFunction(fakeContext(), undefined, LOC, bools(true), NO_NAMED).toBoolean(),
    ).toBe(false);
    expect(
      new LogicalNot().executeReturnFunction(fakeContext(), undefined, LOC, bools(false), NO_NAMED).toBoolean(),
    ).toBe(true);
  });
});

describe('LogicalAnd / LogicalOr (variadic, >= 2 args)', () => {
  it('%and requires every argument to be true', () => {
    const fn = new LogicalAnd();
    expect(fn.canCover(1, new Set())).toBe(false);
    expect(fn.canCover(2, new Set())).toBe(true);
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, bools(true, true, true), NO_NAMED).toBoolean()).toBe(
      true,
    );
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, bools(true, false, true), NO_NAMED).toBoolean(),
    ).toBe(false);
  });
  it('%or requires at least one argument to be true', () => {
    const fn = new LogicalOr();
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, bools(false, false, true), NO_NAMED).toBoolean(),
    ).toBe(true);
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, bools(false, false, false), NO_NAMED).toBoolean(),
    ).toBe(false);
  });
});

describe('LogicalXor / LogicalNxor (true iff exactly one arg is true)', () => {
  it('%xor', () => {
    const fn = new LogicalXor();
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, bools(true, false, false), NO_NAMED).toBoolean(),
    ).toBe(true);
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, bools(true, true, false), NO_NAMED).toBoolean(),
    ).toBe(false);
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, bools(false, false), NO_NAMED).toBoolean()).toBe(
      false,
    );
  });
  it('%nxor is the negation of %xor', () => {
    const fn = new LogicalNxor();
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, bools(true, false, false), NO_NAMED).toBoolean(),
    ).toBe(false);
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, bools(true, true, false), NO_NAMED).toBoolean(),
    ).toBe(true);
  });
});

describe('LogicalNand / LogicalNor', () => {
  it('%nand is the negation of %and', () => {
    const fn = new LogicalNand();
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, bools(true, true), NO_NAMED).toBoolean()).toBe(
      false,
    );
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, bools(true, false), NO_NAMED).toBoolean()).toBe(
      true,
    );
  });
  it('%nor is the negation of %or', () => {
    const fn = new LogicalNor();
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, bools(false, false), NO_NAMED).toBoolean()).toBe(
      true,
    );
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, bools(true, false), NO_NAMED).toBoolean()).toBe(
      false,
    );
  });
});

describe('Modulo', () => {
  it('computes the remainder', () => {
    const result = new Modulo().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromInt(10), TValue.fromInt(3)],
      NO_NAMED,
    );
    expect(result.toInt()).toBe(1);
  });
  it('throws on division by zero', () => {
    expect(() =>
      new Modulo().executeReturnFunction(
        fakeContext(),
        undefined,
        LOC,
        [TValue.fromInt(10), TValue.fromInt(0)],
        NO_NAMED,
      ),
    ).toThrow(EaterException);
  });
});

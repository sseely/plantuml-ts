import { describe, expect, it } from 'vitest';
import { TValue } from '../../../../../src/core/tim/expression/TValue.js';
import { EaterException } from '../../../../../src/core/tim/EaterException.js';
import { StringFunction } from '../../../../../src/core/tim/builtin/StringFunction.js';
import { Dollar } from '../../../../../src/core/tim/builtin/Dollar.js';
import { Percent } from '../../../../../src/core/tim/builtin/Percent.js';
import { Lower } from '../../../../../src/core/tim/builtin/Lower.js';
import { Upper } from '../../../../../src/core/tim/builtin/Upper.js';
import { Backslash } from '../../../../../src/core/tim/builtin/Backslash.js';
import { LeftAlign } from '../../../../../src/core/tim/builtin/LeftAlign.js';
import { RightAlign } from '../../../../../src/core/tim/builtin/RightAlign.js';
import { Strlen } from '../../../../../src/core/tim/builtin/Strlen.js';
import { Tabulation } from '../../../../../src/core/tim/builtin/Tabulation.js';
import { Newline } from '../../../../../src/core/tim/builtin/Newline.js';
import { NewlineShort } from '../../../../../src/core/tim/builtin/NewlineShort.js';
import { Breakline } from '../../../../../src/core/tim/builtin/Breakline.js';
import { Chr } from '../../../../../src/core/tim/builtin/Chr.js';
import { Ord } from '../../../../../src/core/tim/builtin/Ord.js';
import { Substr } from '../../../../../src/core/tim/builtin/Substr.js';
import { SplitStr } from '../../../../../src/core/tim/builtin/SplitStr.js';
import { SplitStrRegex } from '../../../../../src/core/tim/builtin/SplitStrRegex.js';
import { Strpos } from '../../../../../src/core/tim/builtin/Strpos.js';
import { Dec2hex } from '../../../../../src/core/tim/builtin/Dec2hex.js';
import { Hex2dec } from '../../../../../src/core/tim/builtin/Hex2dec.js';
import { IntVal } from '../../../../../src/core/tim/builtin/IntVal.js';
import { BoolVal } from '../../../../../src/core/tim/builtin/BoolVal.js';
import { GetVersion } from '../../../../../src/core/tim/builtin/GetVersion.js';
import { Eval } from '../../../../../src/core/tim/builtin/Eval.js';
import { createDefaultTimEnvironment } from '../../../../../src/core/tim/builtin/TimEnvironment.js';
import { LOC, NO_MEMORY, NO_NAMED, fakeContext } from '../../../../helpers/tim-builtin.js';

const strs = (...vs: string[]): TValue[] => vs.map((v) => TValue.fromString(v));
const nums = (...vs: number[]): TValue[] => vs.map((v) => TValue.fromInt(v));

describe('StringFunction (%string)', () => {
  it('coerces a number to its string form', () => {
    expect(
      new StringFunction().executeReturnFunction(fakeContext(), undefined, LOC, nums(42), NO_NAMED).toString(),
    ).toBe('42');
  });
  it('canCover requires exactly 1 argument', () => {
    const fn = new StringFunction();
    expect(fn.canCover(1, new Set())).toBe(true);
    expect(fn.canCover(0, new Set())).toBe(false);
  });
});

describe('Dollar / Percent literals', () => {
  it('%dollar returns "$"', () => {
    expect(new Dollar().executeReturnFunction(fakeContext(), undefined, LOC, [], NO_NAMED).toString()).toBe('$');
  });
  it('%percent returns "%"', () => {
    expect(new Percent().executeReturnFunction(fakeContext(), undefined, LOC, [], NO_NAMED).toString()).toBe('%');
  });
});

describe('Lower / Upper', () => {
  it('%lower lowercases', () => {
    expect(new Lower().executeReturnFunction(fakeContext(), undefined, LOC, strs('MiXed'), NO_NAMED).toString()).toBe(
      'mixed',
    );
  });
  it('%upper uppercases', () => {
    expect(new Upper().executeReturnFunction(fakeContext(), undefined, LOC, strs('MiXed'), NO_NAMED).toString()).toBe(
      'MIXED',
    );
  });
});

describe('Sentinel-returning literals', () => {
  it('%backslash returns the BLOCK_E1_REAL_BACKSLASH code point', () => {
    expect(
      new Backslash().executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString().codePointAt(0),
    ).toBe(0xe110);
  });
  it('%left_align returns the BLOCK_E1_NEWLINE_LEFT_ALIGN code point', () => {
    expect(
      new LeftAlign().executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString().codePointAt(0),
    ).toBe(0xe101);
  });
  it('%right_align returns the BLOCK_E1_NEWLINE_RIGHT_ALIGN code point', () => {
    expect(
      new RightAlign().executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString().codePointAt(0),
    ).toBe(0xe102);
  });
  it('%tab returns the BLOCK_E1_REAL_TABULATION code point', () => {
    expect(
      new Tabulation().executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString().codePointAt(0),
    ).toBe(0xe111);
  });
  it('%newline returns the BLOCK_E1_NEWLINE code point', () => {
    expect(
      new Newline().executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString().codePointAt(0),
    ).toBe(0xe100);
  });
  it('%n is an alias for %newline', () => {
    expect(new NewlineShort().executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString()).toBe(
      new Newline().executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString(),
    );
  });
  it('%breakline returns the BLOCK_E1_BREAKLINE code point (distinct from %newline)', () => {
    const bl = new Breakline().executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString();
    expect(bl.codePointAt(0)).toBe(0xe103);
    expect(bl).not.toBe(new Newline().executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString());
  });
});

describe('Strlen', () => {
  it('measures string length', () => {
    expect(new Strlen().executeReturnFunction(fakeContext(), undefined, LOC, strs('hello'), NO_NAMED).toInt()).toBe(5);
  });
});

describe('Chr / Ord', () => {
  it('%chr converts a code point to a character', () => {
    expect(new Chr().executeReturnFunction(fakeContext(), undefined, LOC, nums(65), NO_NAMED).toString()).toBe('A');
  });
  it('%chr returns NUL on an invalid code point', () => {
    expect(new Chr().executeReturnFunction(fakeContext(), undefined, LOC, nums(-1), NO_NAMED).toString()).toBe('\0');
  });
  it('%ord converts the first character to a code point', () => {
    expect(new Ord().executeReturnFunction(fakeContext(), undefined, LOC, strs('Abc'), NO_NAMED).toInt()).toBe(65);
  });
  it('%ord returns 0 for an empty string', () => {
    expect(new Ord().executeReturnFunction(fakeContext(), undefined, LOC, strs(''), NO_NAMED).toInt()).toBe(0);
  });
});

describe('Substr', () => {
  it('extracts from a position to the end (2 args)', () => {
    expect(
      new Substr()
        .executeReturnFunction(
          fakeContext(),
          undefined,
          LOC,
          [TValue.fromString('hello world'), TValue.fromInt(6)],
          NO_NAMED,
        )
        .toString(),
    ).toBe('world');
  });
  it('extracts a bounded length (3 args)', () => {
    expect(
      new Substr()
        .executeReturnFunction(
          fakeContext(),
          undefined,
          LOC,
          [TValue.fromString('hello world'), TValue.fromInt(0), TValue.fromInt(5)],
          NO_NAMED,
        )
        .toString(),
    ).toBe('hello');
  });
  it('returns "" when pos is beyond the string length', () => {
    expect(
      new Substr()
        .executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromString('hi'), TValue.fromInt(10)], NO_NAMED)
        .toString(),
    ).toBe('');
  });
});

describe('SplitStr / SplitStrRegex', () => {
  it('%splitstr tokenizes on any separator character, dropping empty tokens', () => {
    const result = new SplitStr().executeReturnFunction(fakeContext(), undefined, LOC, strs('a,,b;c', ',;'), NO_NAMED);
    expect(result.toJson()).toEqual(['a', 'b', 'c']);
  });
  it('%splitstr_regex splits on a regex', () => {
    const result = new SplitStrRegex().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      strs('a1b22c', '[0-9]+'),
      NO_NAMED,
    );
    expect(result.toJson()).toEqual(['a', 'b', 'c']);
  });
});

describe('Strpos', () => {
  it('finds a substring position', () => {
    expect(
      new Strpos().executeReturnFunction(fakeContext(), undefined, LOC, strs('hello world', 'world'), NO_NAMED).toInt(),
    ).toBe(6);
  });
  it('returns -1 when not found', () => {
    expect(
      new Strpos().executeReturnFunction(fakeContext(), undefined, LOC, strs('hello', 'xyz'), NO_NAMED).toInt(),
    ).toBe(-1);
  });
});

describe('Dec2hex / Hex2dec', () => {
  it('%dec2hex converts decimal to hex', () => {
    expect(new Dec2hex().executeReturnFunction(fakeContext(), undefined, LOC, nums(255), NO_NAMED).toString()).toBe(
      'ff',
    );
  });
  it('%hex2dec converts hex to decimal', () => {
    expect(new Hex2dec().executeReturnFunction(fakeContext(), undefined, LOC, strs('ff'), NO_NAMED).toInt()).toBe(255);
  });
  it('%hex2dec returns 0 for invalid input', () => {
    expect(new Hex2dec().executeReturnFunction(fakeContext(), undefined, LOC, strs('zzz'), NO_NAMED).toInt()).toBe(0);
  });
});

describe('IntVal / BoolVal', () => {
  it('%intval parses a valid integer', () => {
    expect(new IntVal().executeReturnFunction(fakeContext(), undefined, LOC, strs('42'), NO_NAMED).toInt()).toBe(42);
  });
  it('%intval throws on an invalid integer', () => {
    expect(() => new IntVal().executeReturnFunction(fakeContext(), undefined, LOC, strs('abc'), NO_NAMED)).toThrow(
      EaterException,
    );
  });
  it('%boolval accepts "true"/"1"', () => {
    expect(new BoolVal().executeReturnFunction(fakeContext(), undefined, LOC, strs('true'), NO_NAMED).toBoolean()).toBe(
      true,
    );
    expect(new BoolVal().executeReturnFunction(fakeContext(), undefined, LOC, strs('1'), NO_NAMED).toBoolean()).toBe(
      true,
    );
  });
  it('%boolval accepts "false"/"0"', () => {
    expect(
      new BoolVal().executeReturnFunction(fakeContext(), undefined, LOC, strs('false'), NO_NAMED).toBoolean(),
    ).toBe(false);
    expect(new BoolVal().executeReturnFunction(fakeContext(), undefined, LOC, strs('0'), NO_NAMED).toBoolean()).toBe(
      false,
    );
  });
  it('%boolval throws on an unrecognized value', () => {
    expect(() => new BoolVal().executeReturnFunction(fakeContext(), undefined, LOC, strs('maybe'), NO_NAMED)).toThrow(
      EaterException,
    );
  });
});

describe('GetVersion', () => {
  it('returns the seam-provided version string', () => {
    const env = { ...createDefaultTimEnvironment(), getVersionString: () => '1.2.3' };
    expect(new GetVersion(env).executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString()).toBe(
      '1.2.3',
    );
  });
});

describe('Eval', () => {
  it('evaluates an arithmetic expression to an integer', () => {
    const result = new Eval().executeReturnFunction(fakeContext(), NO_MEMORY, LOC, strs('2+3*4'), NO_NAMED);
    expect(result.toInt()).toBe(14);
  });
});

import { describe, expect, it } from 'vitest';
import { TValue } from '../../../../../src/core/tim/expression/TValue.js';
import { EaterException } from '../../../../../src/core/tim/EaterException.js';
import { Now } from '../../../../../src/core/tim/builtin/Now.js';
import { DateFunction } from '../../../../../src/core/tim/builtin/DateFunction.js';
import { Dirpath } from '../../../../../src/core/tim/builtin/Dirpath.js';
import { Filedate } from '../../../../../src/core/tim/builtin/Filedate.js';
import { Filename } from '../../../../../src/core/tim/builtin/Filename.js';
import { FilenameNoExtension } from '../../../../../src/core/tim/builtin/FilenameNoExtension.js';
import { FileExists } from '../../../../../src/core/tim/builtin/FileExists.js';
import { Getenv } from '../../../../../src/core/tim/builtin/Getenv.js';
import { RandomFunction } from '../../../../../src/core/tim/builtin/RandomFunction.js';
import { GetAllStdlib } from '../../../../../src/core/tim/builtin/GetAllStdlib.js';
import { GetAllTheme } from '../../../../../src/core/tim/builtin/GetAllTheme.js';
import { GetCurrentTheme } from '../../../../../src/core/tim/builtin/GetCurrentTheme.js';
import { GetStdlib } from '../../../../../src/core/tim/builtin/GetStdlib.js';
import {
  createDefaultTimEnvironment,
  type TimEnvironment,
} from '../../../../../src/core/tim/builtin/TimEnvironment.js';
import { formatDate } from '../../../../../src/core/tim/builtin/date-format.js';
import { LOC, NO_MEMORY, NO_NAMED, fakeContext } from '../../../../helpers/tim-builtin.js';

describe('createDefaultTimEnvironment', () => {
  it('is fully inert and deterministic', () => {
    const env = createDefaultTimEnvironment();
    expect(env.clock.nowMillis()).toBe(0);
    expect(env.random.nextInt(100)).toBe(0);
    expect(env.getEnvironmentValue('dirpath')).toBeUndefined();
    expect(env.getenv('PATH')).toBeUndefined();
    expect(env.fileExists('/etc/passwd')).toBe(false);
    expect(env.listStdlibFolderNames()).toEqual([]);
    expect(env.listThemeNames()).toEqual([]);
    expect(env.getCurrentThemeMetadata()).toEqual({});
    expect(env.getVersionString()).toBe('unknown');
  });
});

describe('Now (%now)', () => {
  it('returns whole seconds from the injected clock', () => {
    const env: TimEnvironment = { ...createDefaultTimEnvironment(), clock: { nowMillis: () => 12_345_678 } };
    expect(new Now(env).executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toInt()).toBe(12_345);
  });
});

describe('formatDate (SimpleDateFormat subset)', () => {
  it('formats yyyy-MM-dd HH:mm:ss in UTC', () => {
    const epochMillis = Date.UTC(2024, 2, 15, 13, 5, 9); // 2024-03-15T13:05:09Z
    expect(formatDate(epochMillis, 'yyyy-MM-dd HH:mm:ss', 'UTC')).toBe('2024-03-15 13:05:09');
  });
  it('supports MMMM/EEEE full-name tokens', () => {
    const epochMillis = Date.UTC(2024, 2, 15, 0, 0, 0); // a Friday
    expect(formatDate(epochMillis, 'EEEE, MMMM dd yyyy', 'UTC')).toBe('Friday, March 15 2024');
  });
  it('supports yy/MMM/hh/SSS/a and PM hours (12-hour wraparound)', () => {
    const epochMillis = Date.UTC(2024, 2, 15, 23, 5, 9) + 123; // 23:05:09.123 UTC
    expect(formatDate(epochMillis, 'yy MMM hh:mm:ss.SSS a', 'UTC')).toBe('24 Mar 11:05:09.123 PM');
  });
  it('hh renders midnight (hour 0) as 12', () => {
    const epochMillis = Date.UTC(2024, 2, 15, 0, 0, 0);
    expect(formatDate(epochMillis, 'hh', 'UTC')).toBe('12');
  });
  it('passes an unrecognized letter run through literally', () => {
    expect(formatDate(0, 'q', 'UTC')).toBe('q');
  });
});

describe('DateFunction (%date)', () => {
  it('formats via a pattern, epoch seconds, and time zone', () => {
    const env = createDefaultTimEnvironment();
    const epochSeconds = Date.UTC(2024, 2, 15, 13, 5, 9) / 1000;
    const result = new DateFunction(env).executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromString('yyyy-MM-dd'), TValue.fromInt(epochSeconds), TValue.fromString('UTC')],
      NO_NAMED,
    );
    expect(result.toString()).toBe('2024-03-15');
  });
  it('throws for an unrecognized time zone', () => {
    const env = createDefaultTimEnvironment();
    expect(() =>
      new DateFunction(env).executeReturnFunction(
        fakeContext(),
        undefined,
        LOC,
        [TValue.fromString('yyyy'), TValue.fromInt(0), TValue.fromString('Not/AZone')],
        NO_NAMED,
      ),
    ).toThrow(EaterException);
  });
  it('with no arguments, stringifies the injected clock time', () => {
    const env: TimEnvironment = { ...createDefaultTimEnvironment(), clock: { nowMillis: () => 0 } };
    const result = new DateFunction(env).executeReturnFunction(fakeContext(), undefined, LOC, [], NO_NAMED);
    expect(result.toString()).toBe(new Date(0).toString());
  });
});

describe('Dirpath / Filedate / Filename / FilenameNoExtension', () => {
  it('resolve their value once at construction from the seam', () => {
    const env: TimEnvironment = {
      ...createDefaultTimEnvironment(),
      getEnvironmentValue: (name) =>
        ({ dirpath: '/a/b', filedate: '2024-01-01', filename: 'foo.puml', filenameNoExtension: 'foo' })[name],
    };
    expect(new Dirpath(env).executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString()).toBe('/a/b');
    expect(new Filedate(env).executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString()).toBe(
      '2024-01-01',
    );
    expect(new Filename(env).executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString()).toBe(
      'foo.puml',
    );
    expect(
      new FilenameNoExtension(env).executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString(),
    ).toBe('foo');
  });
  it('default to "" when the seam has no value', () => {
    const env = createDefaultTimEnvironment();
    expect(new Dirpath(env).executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString()).toBe('');
    expect(new Filedate(env).executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString()).toBe('');
    expect(new Filename(env).executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString()).toBe('');
    expect(
      new FilenameNoExtension(env).executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED).toString(),
    ).toBe('');
  });
});

describe('FileExists', () => {
  it('delegates to the seam', () => {
    const env: TimEnvironment = { ...createDefaultTimEnvironment(), fileExists: (p) => p === '/exists.txt' };
    const fn = new FileExists(env);
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromString('/exists.txt')], NO_NAMED).toBoolean(),
    ).toBe(true);
    expect(
      fn
        .executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromString('/missing.txt')], NO_NAMED)
        .toBoolean(),
    ).toBe(false);
  });
});

describe('Getenv', () => {
  it('delegates to the seam, defaulting to ""', () => {
    const env: TimEnvironment = {
      ...createDefaultTimEnvironment(),
      getenv: (n) => (n === 'HOME' ? '/home/u' : undefined),
    };
    const fn = new Getenv(env);
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromString('HOME')], NO_NAMED).toString(),
    ).toBe('/home/u');
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromString('MISSING')], NO_NAMED).toString(),
    ).toBe('');
  });
});

describe('RandomFunction', () => {
  it('0 args: nextInt(2)', () => {
    let capturedBound = -1;
    const env: TimEnvironment = {
      ...createDefaultTimEnvironment(),
      random: { nextInt: (b) => ((capturedBound = b), 1) },
    };
    expect(new RandomFunction(env).executeReturnFunction(fakeContext(), undefined, LOC, [], NO_NAMED).toInt()).toBe(1);
    expect(capturedBound).toBe(2);
  });
  it('1 arg: nextInt(max)', () => {
    let capturedBound = -1;
    const env: TimEnvironment = {
      ...createDefaultTimEnvironment(),
      random: { nextInt: (b) => ((capturedBound = b), 0) },
    };
    new RandomFunction(env).executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromInt(10)], NO_NAMED);
    expect(capturedBound).toBe(10);
  });
  it('2 args: min + nextInt(max-min)', () => {
    const env: TimEnvironment = { ...createDefaultTimEnvironment(), random: { nextInt: () => 3 } };
    const result = new RandomFunction(env).executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromInt(5), TValue.fromInt(20)],
      NO_NAMED,
    );
    expect(result.toInt()).toBe(8); // 5 + 3
  });
  it('throws when called with more than 2 arguments', () => {
    const env = createDefaultTimEnvironment();
    expect(() =>
      new RandomFunction(env).executeReturnFunction(
        fakeContext(),
        undefined,
        LOC,
        [TValue.fromInt(1), TValue.fromInt(2), TValue.fromInt(3)],
        NO_NAMED,
      ),
    ).toThrow(EaterException);
  });
});

describe('GetAllStdlib / GetStdlib / GetAllTheme / GetCurrentTheme', () => {
  const env: TimEnvironment = {
    ...createDefaultTimEnvironment(),
    listStdlibFolderNames: () => ['aws', 'azure'],
    getStdlibMetadata: (name) =>
      name === 'aws' ? { version: '1.0', source: 'src1', entries: new Map([['author', 'a']]) } : undefined,
    listThemeNames: () => ['_none_', 'amiga'],
    getCurrentThemeMetadata: () => ({ name: 'amiga' }),
  };

  it('GetAllStdlib() lists folder names', () => {
    const result = new GetAllStdlib(env).executeReturnFunction(fakeContext(), undefined, LOC, [], NO_NAMED);
    expect(result.toJson()).toEqual(['aws', 'azure']);
  });

  it('GetAllStdlib(1) maps folder name to {name,version,source}', () => {
    const result = new GetAllStdlib(env).executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromInt(0)],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual({ aws: { name: 'aws', version: '1.0', source: 'src1' } });
  });

  it('GetAllStdlib throws when called with more than 1 argument', () => {
    expect(() =>
      new GetAllStdlib(env).executeReturnFunction(
        fakeContext(),
        undefined,
        LOC,
        [TValue.fromInt(0), TValue.fromInt(1)],
        NO_NAMED,
      ),
    ).toThrow(EaterException);
  });

  it('GetStdlib() maps every folder to its entries', () => {
    const result = new GetStdlib(env).executeReturnFunction(fakeContext(), undefined, LOC, [], NO_NAMED);
    expect(result.toJson()).toEqual({ aws: { author: 'a' } });
  });

  it("GetStdlib(name) returns that folder's entries", () => {
    const result = new GetStdlib(env).executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromString('aws')],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual({ author: 'a' });
  });

  it('GetStdlib(name, key) falls back to the uppercased key when the lowercase form is absent', () => {
    const upperEnv: TimEnvironment = {
      ...env,
      getStdlibMetadata: () => ({ version: '1.0', source: 's', entries: new Map([['AUTHOR', 'a']]) }),
    };
    const result = new GetStdlib(upperEnv).executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromString('aws'), TValue.fromString('author')],
      NO_NAMED,
    );
    expect(result.toString()).toBe('a');
  });

  it('GetStdlib(name) returns {} for an unknown folder', () => {
    const result = new GetStdlib(env).executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromString('unknown')],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual({});
  });

  it('GetStdlib(name, key) returns "" for an unknown folder', () => {
    const result = new GetStdlib(env).executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromString('unknown'), TValue.fromString('key')],
      NO_NAMED,
    );
    expect(result.toString()).toBe('');
  });

  it('GetAllTheme lists theme names', () => {
    const result = new GetAllTheme(env).executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED);
    expect(result.toJson()).toEqual(['_none_', 'amiga']);
  });

  it('GetCurrentTheme returns the seam metadata', () => {
    const result = new GetCurrentTheme(env).executeReturnFunction(fakeContext(), NO_MEMORY, LOC, [], NO_NAMED);
    expect(result.toJson()).toEqual({ name: 'amiga' });
  });
});

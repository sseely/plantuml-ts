import { describe, expect, it } from 'vitest';
import { TValue } from '../../../../../src/core/tim/expression/TValue.js';
import { EaterException } from '../../../../../src/core/tim/EaterException.js';
import { Str2Json } from '../../../../../src/core/tim/builtin/Str2Json.js';
import { GetJsonType } from '../../../../../src/core/tim/builtin/GetJsonType.js';
import { GetJsonKey } from '../../../../../src/core/tim/builtin/GetJsonKey.js';
import { JsonKeyExists } from '../../../../../src/core/tim/builtin/JsonKeyExists.js';
import { JsonAdd } from '../../../../../src/core/tim/builtin/JsonAdd.js';
import { JsonRemove } from '../../../../../src/core/tim/builtin/JsonRemove.js';
import { JsonMerge } from '../../../../../src/core/tim/builtin/JsonMerge.js';
import { JsonSet } from '../../../../../src/core/tim/builtin/JsonSet.js';
import { LoadJson } from '../../../../../src/core/tim/builtin/LoadJson.js';
import { createDefaultTimEnvironment } from '../../../../../src/core/tim/builtin/TimEnvironment.js';
import { LOC, NO_NAMED, fakeContext } from '../../../../helpers/tim-builtin.js';

describe('Str2Json', () => {
  it('parses valid JSON', () => {
    const result = new Str2Json().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromString('{"a":1}')],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual({ a: 1 });
  });
  it('returns "" on invalid JSON', () => {
    const result = new Str2Json().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromString('not json')],
      NO_NAMED,
    );
    expect(result.toString()).toBe('');
  });
});

describe('GetJsonType', () => {
  const fn = new GetJsonType();
  it('classifies a plain string TValue as "string"', () => {
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromString('x')], NO_NAMED).toString()).toBe(
      'string',
    );
  });
  it('classifies a plain number TValue as "number"', () => {
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromInt(1)], NO_NAMED).toString()).toBe(
      'number',
    );
  });
  it('classifies each JSON kind', () => {
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromJson([1])], NO_NAMED).toString()).toBe(
      'array',
    );
    expect(
      fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromJson({ a: 1 })], NO_NAMED).toString(),
    ).toBe('object');
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromJson(true)], NO_NAMED).toString()).toBe(
      'boolean',
    );
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromJson(5)], NO_NAMED).toString()).toBe(
      'number',
    );
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromJson('s')], NO_NAMED).toString()).toBe(
      'string',
    );
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromJson(null)], NO_NAMED).toString()).toBe(
      'json',
    );
  });
});

describe('GetJsonKey (%get_json_keys)', () => {
  it('returns key names of a JSON object', () => {
    const result = new GetJsonKey().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromJson({ a: 1, b: 2 })],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual(['a', 'b']);
  });
  it('concatenates key names of member objects in a JSON array', () => {
    const result = new GetJsonKey().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromJson([{ a: 1 }, { b: 2 }])],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual(['a', 'b']);
  });
  it('throws for a non-JSON value', () => {
    expect(() =>
      new GetJsonKey().executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromString('x')], NO_NAMED),
    ).toThrow(EaterException);
  });
  it('throws for a JSON scalar', () => {
    expect(() =>
      new GetJsonKey().executeReturnFunction(fakeContext(), undefined, LOC, [TValue.fromJson(5)], NO_NAMED),
    ).toThrow(EaterException);
  });
});

describe('JsonKeyExists', () => {
  const fn = new JsonKeyExists();
  it('true when the object has the key', () => {
    const args = [TValue.fromJson({ a: 1 }), TValue.fromString('a')];
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, args, NO_NAMED).toBoolean()).toBe(true);
  });
  it('false when the object lacks the key', () => {
    const args = [TValue.fromJson({ a: 1 }), TValue.fromString('b')];
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, args, NO_NAMED).toBoolean()).toBe(false);
  });
  it('false for a non-object JSON value', () => {
    const args = [TValue.fromJson([1, 2]), TValue.fromString('a')];
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, args, NO_NAMED).toBoolean()).toBe(false);
  });
  it('false when arg0 is not JSON at all', () => {
    const args = [TValue.fromString('plain'), TValue.fromString('a')];
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, args, NO_NAMED).toBoolean()).toBe(false);
  });
  it('accepts a JSON-wrapped string as the key argument', () => {
    const args = [TValue.fromJson({ a: 1 }), TValue.fromJson('a')];
    expect(fn.executeReturnFunction(fakeContext(), undefined, LOC, args, NO_NAMED).toBoolean()).toBe(true);
  });
});

describe('JsonAdd', () => {
  it('appends to a JSON array', () => {
    const result = new JsonAdd().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromJson([1, 2]), TValue.fromInt(3)],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual([1, 2, 3]);
  });
  it('adds a member to a JSON object', () => {
    const result = new JsonAdd().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromJson({ a: 1 }), TValue.fromString('b'), TValue.fromInt(2)],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual({ a: 1, b: 2 });
  });
  it('does not mutate the source value', () => {
    const source = TValue.fromJson([1]);
    new JsonAdd().executeReturnFunction(fakeContext(), undefined, LOC, [source, TValue.fromInt(2)], NO_NAMED);
    expect(source.toJson()).toEqual([1]);
  });
  it('throws for non-JSON data', () => {
    expect(() =>
      new JsonAdd().executeReturnFunction(
        fakeContext(),
        undefined,
        LOC,
        [TValue.fromString('x'), TValue.fromInt(1)],
        NO_NAMED,
      ),
    ).toThrow(EaterException);
  });
});

describe('JsonRemove', () => {
  it('removes an array index', () => {
    const result = new JsonRemove().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromJson([1, 2, 3]), TValue.fromInt(1)],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual([1, 3]);
  });
  it('is a no-op for an out-of-range index', () => {
    const result = new JsonRemove().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromJson([1, 2]), TValue.fromInt(9)],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual([1, 2]);
  });
  it('removes an object key', () => {
    const result = new JsonRemove().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromJson({ a: 1, b: 2 }), TValue.fromString('a')],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual({ b: 2 });
  });
});

describe('JsonMerge', () => {
  it('concatenates two arrays', () => {
    const result = new JsonMerge().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromJson([1, 2]), TValue.fromJson([3])],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual([1, 2, 3]);
  });
  it('shallow-merges two objects, right side wins on collision', () => {
    const result = new JsonMerge().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromJson({ a: 1, b: 1 }), TValue.fromJson({ b: 2, c: 3 })],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual({ a: 1, b: 2, c: 3 });
  });
  it('returns the left side unchanged on shape mismatch', () => {
    const left = TValue.fromJson([1]);
    const result = new JsonMerge().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [left, TValue.fromJson({ a: 1 })],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual([1]);
  });
});

describe('JsonSet', () => {
  it('deep-merges (2 args) into an object', () => {
    const result = new JsonSet().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromJson({ a: { x: 1 } }), TValue.fromJson({ a: { y: 2 } })],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual({ a: { x: 1, y: 2 } });
  });
  it('sets an array index (3 args)', () => {
    const result = new JsonSet().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromJson([1, 2, 3]), TValue.fromInt(1), TValue.fromInt(99)],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual([1, 99, 3]);
  });
  it('sets an object key (3 args)', () => {
    const result = new JsonSet().executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromJson({ a: 1 }), TValue.fromString('b'), TValue.fromInt(2)],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual({ a: 1, b: 2 });
  });
});

describe('LoadJson', () => {
  it('loads and parses a file resource via the seam', () => {
    const env = { ...createDefaultTimEnvironment(), loadTextResource: () => '{"k":"v"}' };
    const result = new LoadJson(env).executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromString('file.json')],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual({ k: 'v' });
  });
  it('falls back to the default JSON when the resource is missing', () => {
    const env = createDefaultTimEnvironment();
    const result = new LoadJson(env).executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromString('missing.json'), TValue.fromString('{"status":"none"}')],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual({ status: 'none' });
  });
  it('falls back to "{}" when neither resource nor default is supplied', () => {
    const env = createDefaultTimEnvironment();
    const result = new LoadJson(env).executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromString('missing.json')],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual({});
  });
  it('resolves <name> bracket syntax through the stdlib seam', () => {
    const env = {
      ...createDefaultTimEnvironment(),
      getStdlibJsonResource: (name: string) => (name === 'aws' ? { ok: true } : undefined),
    };
    const result = new LoadJson(env).executeReturnFunction(
      fakeContext(),
      undefined,
      LOC,
      [TValue.fromString('<aws>')],
      NO_NAMED,
    );
    expect(result.toJson()).toEqual({ ok: true });
  });
  it('throws a wrapped EaterException on malformed JSON text', () => {
    const env = { ...createDefaultTimEnvironment(), loadTextResource: () => 'not json' };
    expect(() =>
      new LoadJson(env).executeReturnFunction(
        fakeContext(),
        undefined,
        LOC,
        [TValue.fromString('file.json')],
        NO_NAMED,
      ),
    ).toThrow(EaterException);
  });
});

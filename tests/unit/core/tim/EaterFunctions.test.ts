import { describe, expect, it } from 'vitest';
import { EaterDeclareReturnFunction } from '../../../../src/core/tim/EaterDeclareReturnFunction.js';
import { EaterReturn } from '../../../../src/core/tim/EaterReturn.js';
import { EaterLegacyDefine } from '../../../../src/core/tim/EaterLegacyDefine.js';
import { EaterLegacyDefineLong } from '../../../../src/core/tim/EaterLegacyDefineLong.js';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';
import { TFunctionType } from '../../../../src/core/tim/TFunctionType.js';
import { TMemoryGlobal } from '../../../../src/core/tim/TMemoryGlobal.js';
import { fakeContext } from '../../../helpers/tim-context.js';

const LOC = undefined;

describe('EaterDeclareReturnFunction', () => {
  it('parses a plain !function header with a parameter list', () => {
    const e = new EaterDeclareReturnFunction(new StringLocated('!function $f($a, $b)', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.getFunction().getSignature().getFunctionName()).toBe('$f');
    expect(e.getFunction().getSignature().getNbArg()).toBe(2);
    expect(e.getFunction().getFunctionType()).toBe(TFunctionType.RETURN_FUNCTION);
    expect(e.getFinalFlag()).toBe(false);
    expect(e.getFunction().isUnquoted()).toBe(false);
  });

  it('parses !unquoted function', () => {
    const e = new EaterDeclareReturnFunction(new StringLocated('!unquoted function $f()', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.getFunction().isUnquoted()).toBe(true);
  });

  it('parses !final function', () => {
    const e = new EaterDeclareReturnFunction(new StringLocated('!final function $f()', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.getFinalFlag()).toBe(true);
  });

  it('parses !unquoted final function (both flags, either order)', () => {
    const e = new EaterDeclareReturnFunction(new StringLocated('!unquoted final function $f()', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.getFinalFlag()).toBe(true);
    expect(e.getFunction().isUnquoted()).toBe(true);
  });

  it('parses the single-line "return <expr>" shorthand as a synthesized RETURN body line', () => {
    const e = new EaterDeclareReturnFunction(new StringLocated('!function $f() return 1', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.getFunction().doesContainReturn()).toBe(true);
    expect(e.getFunction().hasBody()).toBe(true);
  });
});

describe('EaterReturn', () => {
  it('evaluates and exposes the return value', () => {
    const e = new EaterReturn(new StringLocated('!return 42', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.getValue2().toInt()).toBe(42);
  });
});

describe('EaterLegacyDefine', () => {
  it('parses a macro-style single-line !define with the body as legacy definition text', () => {
    const e = new EaterLegacyDefine(new StringLocated('!define GREET(name) Hello name', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.getFunction().getSignature().getFunctionName()).toBe('GREET');
    expect(e.getFunction().getFunctionType()).toBe(TFunctionType.LEGACY_DEFINE);
  });
});

describe('EaterLegacyDefineLong', () => {
  it('parses a !definelong header (no parenthesis required, body collected elsewhere)', () => {
    const e = new EaterLegacyDefineLong(new StringLocated('!definelong GREETLONG', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.getFunction().getSignature().getFunctionName()).toBe('GREETLONG');
    expect(e.getFunction().getFunctionType()).toBe(TFunctionType.LEGACY_DEFINELONG);
  });
});

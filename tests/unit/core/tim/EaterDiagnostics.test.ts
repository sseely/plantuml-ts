import { describe, expect, it, vi } from 'vitest';
import { EaterDumpMemory } from '../../../../src/core/tim/EaterDumpMemory.js';
import { EaterLog } from '../../../../src/core/tim/EaterLog.js';
import { EaterOption, OptionKey, optionKeyDefaultValue } from '../../../../src/core/tim/EaterOption.js';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';
import { TMemoryGlobal } from '../../../../src/core/tim/TMemoryGlobal.js';
import { fakeContext } from '../../../helpers/tim-context.js';

const LOC = undefined;

describe('EaterDumpMemory', () => {
  it('forwards the remaining text to memory.dumpDebug', () => {
    const memory = new TMemoryGlobal();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    new EaterDumpMemory(new StringLocated('!dump_memory checkpoint 1', LOC)).analyze(fakeContext(), memory);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('checkpoint 1'));
    spy.mockRestore();
  });
});

describe('EaterLog', () => {
  it('applies functions/variables and logs with a [Log] prefix', () => {
    const memory = new TMemoryGlobal();
    const ctx = fakeContext({ applyFunctionsAndVariables: () => 'resolved log text' });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    new EaterLog(new StringLocated('!log $x', LOC)).analyze(ctx, memory);
    expect(spy).toHaveBeenCalledWith('[Log] resolved log text');
    spy.mockRestore();
  });
});

describe('OptionKey', () => {
  it('has default values for HANDWRITTEN and DEBUG only', () => {
    expect(optionKeyDefaultValue(OptionKey.HANDWRITTEN)).toBe('true');
    expect(optionKeyDefaultValue(OptionKey.DEBUG)).toBe('true');
    expect(optionKeyDefaultValue(OptionKey.LANGUAGE)).toBeUndefined();
  });
});

describe('EaterOption', () => {
  it('defines an explicit value for a known key', () => {
    const memory = new TMemoryGlobal();
    const define = vi.fn();
    const ctx = fakeContext({
      getPreprocessingArtifact: () => ({
        addWarning: vi.fn(),
        getOption: () => ({ define }),
      }),
    });
    new EaterOption(new StringLocated('!option language "fr"', LOC)).analyze(ctx, memory);
    expect(define).toHaveBeenCalledWith(OptionKey.LANGUAGE, 'fr');
  });

  it('falls back to the default value when no explicit value is given', () => {
    const memory = new TMemoryGlobal();
    const define = vi.fn();
    const ctx = fakeContext({
      getPreprocessingArtifact: () => ({
        addWarning: vi.fn(),
        getOption: () => ({ define }),
      }),
    });
    new EaterOption(new StringLocated('!option handwritten', LOC)).analyze(ctx, memory);
    expect(define).toHaveBeenCalledWith(OptionKey.HANDWRITTEN, 'true');
  });

  it('warns on an unknown option key', () => {
    const memory = new TMemoryGlobal();
    const addWarning = vi.fn();
    const ctx = fakeContext({
      getPreprocessingArtifact: () => ({
        addWarning,
        getOption: () => ({ define: vi.fn() }),
      }),
    });
    new EaterOption(new StringLocated('!option notarealkey', LOC)).analyze(ctx, memory);
    expect(addWarning).toHaveBeenCalledWith({ message: ['No such !option notarealkey'] });
  });

  it('warns when a known key with no default has no explicit value', () => {
    const memory = new TMemoryGlobal();
    const addWarning = vi.fn();
    const ctx = fakeContext({
      getPreprocessingArtifact: () => ({
        addWarning,
        getOption: () => ({ define: vi.fn() }),
      }),
    });
    new EaterOption(new StringLocated('!option language', LOC)).analyze(ctx, memory);
    expect(addWarning).toHaveBeenCalledWith({ message: ['No default value for language'] });
  });
});

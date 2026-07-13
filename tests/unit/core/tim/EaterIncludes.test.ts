import { describe, expect, it } from 'vitest';
import { EaterImport } from '../../../../src/core/tim/EaterImport.js';
import { EaterInclude, PreprocessorIncludeStrategy } from '../../../../src/core/tim/EaterInclude.js';
import { EaterIncludeDef } from '../../../../src/core/tim/EaterIncludeDef.js';
import { EaterIncludeSprites } from '../../../../src/core/tim/EaterIncludeSprites.js';
import { EaterIncludesub } from '../../../../src/core/tim/EaterIncludesub.js';
import { EaterStartsub } from '../../../../src/core/tim/EaterStartsub.js';
import { EaterTheme } from '../../../../src/core/tim/EaterTheme.js';
import { EaterException } from '../../../../src/core/tim/EaterException.js';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';
import { TMemoryGlobal } from '../../../../src/core/tim/TMemoryGlobal.js';
import { fakeContext } from '../../../helpers/tim-context.js';

const LOC = undefined;
const identity = fakeContext({ applyFunctionsAndVariables: (_m, located: StringLocated) => located.getString() });

describe('EaterImport', () => {
  it('captures the resolved path', () => {
    const e = new EaterImport(new StringLocated('!import path/to/file.puml', LOC));
    e.analyze(identity, new TMemoryGlobal());
    expect(e.getWhat()).toBe('path/to/file.puml');
  });
});

describe('EaterInclude', () => {
  it('defaults to DEFAULT strategy for plain !include', () => {
    const e = new EaterInclude(new StringLocated('!include foo.puml', LOC));
    e.analyze(identity, new TMemoryGlobal());
    expect(e.getWhat()).toBe('foo.puml');
    expect(e.getPreprocessorIncludeStrategy()).toBe(PreprocessorIncludeStrategy.DEFAULT);
  });

  it('parses !includeurl', () => {
    const e = new EaterInclude(new StringLocated('!includeurl http://example.com/x.puml', LOC));
    e.analyze(identity, new TMemoryGlobal());
    expect(e.getWhat()).toBe('http://example.com/x.puml');
  });

  it('parses !include_once', () => {
    const e = new EaterInclude(new StringLocated('!include_once foo.puml', LOC));
    e.analyze(identity, new TMemoryGlobal());
    expect(e.getPreprocessorIncludeStrategy()).toBe(PreprocessorIncludeStrategy.ONCE);
  });

  it('parses !include_many', () => {
    const e = new EaterInclude(new StringLocated('!include_many foo.puml', LOC));
    e.analyze(identity, new TMemoryGlobal());
    expect(e.getPreprocessorIncludeStrategy()).toBe(PreprocessorIncludeStrategy.MANY);
  });
});

describe('EaterIncludeDef', () => {
  it('captures the resolved location', () => {
    const e = new EaterIncludeDef(new StringLocated('!includedef foo.puml', LOC));
    e.analyze(identity, new TMemoryGlobal());
    expect(e.getLocation()).toBe('foo.puml');
  });
});

describe('EaterIncludeSprites', () => {
  it('captures the resolved path', () => {
    const e = new EaterIncludeSprites(new StringLocated('!include_sprites sprites.puml', LOC));
    e.analyze(identity, new TMemoryGlobal());
    expect(e.getWhat()).toBe('sprites.puml');
  });
});

describe('EaterIncludesub', () => {
  it('captures the resolved argument', () => {
    const e = new EaterIncludesub(new StringLocated('!includesub foo.puml!BLOCK', LOC));
    e.analyze(identity, new TMemoryGlobal());
    expect(e.getWhat()).toBe('foo.puml!BLOCK');
  });
});

describe('EaterStartsub', () => {
  it('captures a valid word-only sub name', () => {
    const e = new EaterStartsub(new StringLocated('!startsub BLOCK1', LOC));
    e.analyze(fakeContext(), new TMemoryGlobal());
    expect(e.getSubname()).toBe('BLOCK1');
  });

  it('rejects a non-word sub name', () => {
    expect(() =>
      new EaterStartsub(new StringLocated('!startsub not a word', LOC)).analyze(fakeContext(), new TMemoryGlobal()),
    ).toThrow(EaterException);
    expect(() =>
      new EaterStartsub(new StringLocated('!startsub not a word', LOC)).analyze(fakeContext(), new TMemoryGlobal()),
    ).toThrow('Bad sub name');
  });
});

describe('EaterTheme', () => {
  it('parses a plain theme name', () => {
    const e = new EaterTheme(new StringLocated('!theme cerulean', LOC));
    e.analyze(identity, new TMemoryGlobal());
    expect(e.getName()).toBe('cerulean');
    expect(e.getRealName()).toBe('cerulean');
    expect(e.getFrom()).toBeUndefined();
  });

  it('parses a theme name with a "from" clause', () => {
    const e = new EaterTheme(new StringLocated('!theme mytheme from /path/to/dir', LOC));
    e.analyze(identity, new TMemoryGlobal());
    expect(e.getName()).toBe('mytheme');
    expect(e.getFrom()).toBe('/path/to/dir');
  });
});

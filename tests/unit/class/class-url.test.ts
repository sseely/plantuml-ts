/**
 * G2 N15 (README item #7): `[[url]]` grammar unit tests -- byte-exact
 * against `url/UrlBuilder.java`'s 5-way STRICT-mode regex, jar-verified
 * via `cokeje-99-gede231`'s three bracket forms.
 */
import { describe, it, expect } from 'vitest';
import { parseUrlBracket } from '../../../src/diagrams/class/class-url.js';

describe('parseUrlBracket', () => {
  it('bare link, no tooltip/label -- label and tooltip default to the url ' +
     '(jar-verified cokeje-99-gede231)', () => {
    expect(parseUrlBracket('[[http://plantuml.com]]')).toEqual({
      url: 'http://plantuml.com',
      tooltip: 'http://plantuml.com',
      label: 'http://plantuml.com',
    });
  });

  it('bare link + label, tooltip defaults to the url (jar-verified ' +
     'cokeje-99-gede231)', () => {
    expect(parseUrlBracket('[[http://plantuml.com our web site]]')).toEqual({
      url: 'http://plantuml.com',
      tooltip: 'http://plantuml.com',
      label: 'our web site',
    });
  });

  it('bare link + tooltip + label, all three explicit (jar-verified ' +
     'cokeje-99-gede231)', () => {
    expect(
      parseUrlBracket('[[http://plantuml.com{This is a tip} our web site]]'),
    ).toEqual({
      url: 'http://plantuml.com',
      tooltip: 'This is a tip',
      label: 'our web site',
    });
  });

  it('quoted link, no tooltip/label', () => {
    expect(parseUrlBracket('[["quoted link"]]')).toEqual({
      url: 'quoted link',
      tooltip: 'quoted link',
      label: 'quoted link',
    });
  });

  it('quoted link + tooltip + label', () => {
    expect(parseUrlBracket('[["quoted link"{tip} label]]')).toEqual({
      url: 'quoted link',
      tooltip: 'tip',
      label: 'label',
    });
  });

  it('tooltip only -- url and label are empty', () => {
    expect(parseUrlBracket('[[{just a tooltip}]]')).toEqual({
      url: '',
      tooltip: 'just a tooltip',
      label: '',
    });
  });

  it('tooltip + label, no url', () => {
    expect(parseUrlBracket('[[{tooltip} label only]]')).toEqual({
      url: '',
      tooltip: 'tooltip',
      label: 'label only',
    });
  });

  it('bare link + tooltip, no label -- label defaults to the url', () => {
    expect(parseUrlBracket('[[http://x.com{a tooltip}]]')).toEqual({
      url: 'http://x.com',
      tooltip: 'a tooltip',
      label: 'http://x.com',
    });
  });

  it('malformed bracket content returns undefined', () => {
    expect(parseUrlBracket('[[]]')).toBeUndefined();
  });
});

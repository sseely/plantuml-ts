/**
 * Tests for description/parse-helpers.ts's resolveInlineLinks -- resolving
 * an embedded `[[url label]]` creole link token to its visible label, per
 * `Url.java`'s label-defaulting constructor (`net/sourceforge/plantuml/url/
 * Url.java`) and `CommandCreoleUrl`/`TextLink` (`klimt/creole/command/`).
 * See plans/description-dot-100/decision-journal.md I5.
 */
import { describe, it, expect } from 'vitest';
import { resolveInlineLinks } from '../../../src/diagrams/description/parse-helpers.js';

describe('resolveInlineLinks', () => {
  it('replaces `[[url label]]` with the label text -- malumi-33-safu797', () => {
    const text = 'Thanks Maxime! You can [[http://www.google.com CLICK]] here';
    expect(resolveInlineLinks(text)).toBe('Thanks Maxime! You can CLICK here');
  });

  it('resolves to the url itself when no label is given -- nevuzi-33-duna992', () => {
    expect(resolveInlineLinks('[[http://www.google.com]]')).toBe('http://www.google.com');
  });

  it('strips a `{tooltip}` and keeps the trailing label -- nidozi-08-daxa280', () => {
    const text = 'hello with [[http://plantuml.com/start{Tooltip text} some link]]';
    expect(resolveInlineLinks(text)).toBe('hello with some link');
  });

  it('resolves to the url when only a tooltip is present, no label', () => {
    expect(resolveInlineLinks('[[http://x.com{a tooltip}]]')).toBe('http://x.com');
  });

  it('leaves text with no `[[...]]` token unchanged', () => {
    expect(resolveInlineLinks('plain arrow label')).toBe('plain arrow label');
  });

  it('resolves multiple tokens in the same string independently', () => {
    const text = '[[http://a.com A]] and [[http://b.com]]';
    expect(resolveInlineLinks(text)).toBe('A and http://b.com');
  });
});

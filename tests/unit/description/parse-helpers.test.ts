/**
 * Tests for description/parse-helpers.ts's resolveInlineLinks -- resolving
 * an embedded `[[url label]]` creole link token to its visible label, per
 * `Url.java`'s label-defaulting constructor (`net/sourceforge/plantuml/url/
 * Url.java`) and `CommandCreoleUrl`/`TextLink` (`klimt/creole/command/`).
 * See plans/description-dot-100/decision-journal.md I5.
 *
 * Also covers parseNameSection's quote-aware URL stripping
 * (`plans/si5b-stdlib/batch-4/overview.md` T9, vivido-49-nisu863): a
 * `[[...]]` link embedded WITHIN a quoted display must survive into the
 * entity's id verbatim, not be stripped as a top-level URL attachment
 * (`CommandCreateElementFull`'s `UrlBuilder.OPTIONAL` can only match text
 * after the closing quote -- see `splitLeadingQuote`'s doc comment). `id`
 * and `display` diverge on this fixture as of I4c: `display` also runs
 * through `resolveNewlineEscapes` (a literal `\n` outside the `[[...]]`
 * span becomes a real newline, matching `Display.getWithNewlines`), while
 * `id` (upstream `quark.getName()`) never does.
 */
import { describe, it, expect } from 'vitest';
import { resolveInlineLinks, parseNameSection } from '../../../src/diagrams/description/parse-helpers.js';

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

describe('parseNameSection -- quote-aware URL stripping', () => {
  it('keeps an inline [[url]] link embedded WITHIN the quotes as part of id/display', () => {
    const section = parseNameSection(
      '"something\\nclick the image:[[http://plantuml.com before <$database> after]]"',
    );
    expect(section.id).toBe(
      'something\\nclick the image:[[http://plantuml.com before <$database> after]]',
    );
    // I4c: resolveNewlineEscapes splits the literal `\\n` (outside the
    // `[[...]]` span) into a real newline -- id keeps the raw text.
    expect(section.display).toBe(
      'something\nclick the image:[[http://plantuml.com before <$database> after]]',
    );
  });

  it('gives two labels differing only inside their embedded link DIFFERENT ids (no dedup)', () => {
    const a = parseNameSection(
      '"something\\nclick the image:[[http://plantuml.com before <$database*0.31> after]]"',
    );
    const b = parseNameSection(
      '"something\\nclick the image:[[http://plantuml.com before <$database> after]]"',
    );
    expect(a.id).not.toBe(b.id);
  });

  it('still strips a trailing [[url]] that comes AFTER the closing quote', () => {
    const section = parseNameSection('"Name" [[http://example.com]]');
    expect(section.id).toBe('Name');
    expect(section.display).toBe('Name');
  });

  it('still strips a trailing [[url]] before an "as" alias clause', () => {
    const section = parseNameSection('"Name" [[http://example.com]] as short');
    expect(section.id).toBe('short');
    expect(section.display).toBe('Name');
  });

  it('strips a bare (unquoted) trailing [[url]] as before', () => {
    const section = parseNameSection('foo [[http://example.com]]');
    expect(section.id).toBe('foo');
    expect(section.display).toBe('foo');
  });

  it('preserves the required space before "as" for a single-quoted alias (RE_SQ_AS_ALIAS needs \\s+, not \\s*)', () => {
    // Regression: an earlier version of the quote-boundary fix fully
    // trimmed the tail before re-concatenating, erasing the space between
    // the closing `'` and `as` and gluing them into `'Complex Name'as CN`
    // -- RE_SQ_AS_ALIAS requires `\s+` (unlike the double-quote form's
    // `\s*`), so that glued string failed every alias-form match and fell
    // through to the bare-id fallback.
    const section = parseNameSection("'Complex Name' as CN");
    expect(section.id).toBe('CN');
    expect(section.display).toBe('Complex Name');
  });
});


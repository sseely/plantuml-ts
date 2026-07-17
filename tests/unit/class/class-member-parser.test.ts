import { describe, it, expect } from 'vitest';
import { parseMemberLine } from '../../../src/diagrams/class/class-member-parser.js';

// ---------------------------------------------------------------------------
// Structured shapes (pre-existing behavior, locked in before the G2 N12
// raw-display fallback was added below).
// ---------------------------------------------------------------------------

describe('parseMemberLine — structured shapes', () => {
  it('parses a bare field name', () => {
    expect(parseMemberLine('foo')).toEqual({
      visibility: '+',
      name: 'foo',
      isStatic: false,
      isAbstract: false,
    });
  });

  it('parses an explicit-visibility typed field ("name: Type")', () => {
    expect(parseMemberLine('+name: String')).toEqual({
      visibility: '+',
      name: 'name',
      type: 'String',
      isStatic: false,
      isAbstract: false,
      visibilityExplicit: true,
    });
  });

  it('parses a method with params and a return type', () => {
    expect(parseMemberLine('+getName(a, b): String')).toEqual({
      visibility: '+',
      name: 'getName',
      isStatic: false,
      isAbstract: false,
      params: ['a', 'b'],
      type: 'String',
      visibilityExplicit: true,
    });
  });

  it('parses {static}/{abstract} modifier prefixes', () => {
    expect(parseMemberLine('{static} count: int')).toEqual({
      visibility: '+',
      name: 'count',
      type: 'int',
      isStatic: true,
      isAbstract: false,
    });
  });

  it('returns null for an empty line', () => {
    expect(parseMemberLine('')).toBeNull();
    expect(parseMemberLine('   ')).toBeNull();
  });

  it('returns null when only a visibility char remains', () => {
    expect(parseMemberLine('+')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// G2 N12: raw-display fallback for non-canonical member syntax.
//
// Upstream (`BodierLikeClassOrObject#addFieldOrMethod`/`Member`'s
// constructor) never rejects a member line — it strips a leading visibility
// char and displays the remainder verbatim, no name/type decomposition.
// Jar-verified against `cuxuni-25-doxi736`: `+String a1`/`+Date d;` render
// as the literal strings "String a1"/"Date d;".
// ---------------------------------------------------------------------------

describe('parseMemberLine — G2 N12 raw-display fallback', () => {
  it('falls back to rawDisplay for Java-style "Type name" field syntax', () => {
    expect(parseMemberLine('+String a1')).toEqual({
      visibility: '+',
      name: 'String a1',
      rawDisplay: 'String a1',
      isStatic: false,
      isAbstract: false,
      visibilityExplicit: true,
    });
  });

  it('falls back to rawDisplay for a trailing-semicolon field', () => {
    expect(parseMemberLine('+Date d;')).toEqual({
      visibility: '+',
      name: 'Date d;',
      rawDisplay: 'Date d;',
      isStatic: false,
      isAbstract: false,
      visibilityExplicit: true,
    });
  });

  it('never returns null for a non-empty, non-bare-visibility line', () => {
    expect(parseMemberLine('this does not match any structured shape')).not.toBeNull();
  });

  it('preserves the {static}/{abstract} modifiers on a fallback line', () => {
    expect(parseMemberLine('{static} Map<String,Integer> counts')).toEqual({
      visibility: '+',
      name: 'Map<String,Integer> counts',
      rawDisplay: 'Map<String,Integer> counts',
      isStatic: true,
      isAbstract: false,
    });
  });
});

// ---------------------------------------------------------------------------
// G2 N15/N16: a stripped `[[url]]`/`[[[url]]]` link suffix. N15 tracked
// presence only (`hasOwnUrl: true`, url content discarded); N16 PARSES the
// bracket into a real `UrlInfo` (`ownUrl`) so two DIFFERENT member rows on
// the SAME classifier can carry two DIFFERENT urls -- the render-side
// per-primitive `<a>`-run splitting (`renderer-url.ts`) needs the actual
// value, not just a boolean, to decide which consecutive primitives share
// one `<a>` run.
// ---------------------------------------------------------------------------

describe('parseMemberLine — G2 N16 ownUrl parsing', () => {
  it('parses a structured attribute line with a stripped [[[url]]] suffix', () => {
    const member = parseMemberLine('name[[[http://field]]]');
    expect(member).toMatchObject({
      name: 'name',
      ownUrl: { url: 'http://field', tooltip: 'http://field', label: 'http://field' },
    });
  });

  it('parses a structured method line with a stripped [[[url]]] suffix', () => {
    const member = parseMemberLine('+methods1() [[[http://www.yahoo.com/A1]]]');
    expect(member).toMatchObject({
      name: 'methods1',
      ownUrl: { url: 'http://www.yahoo.com/A1', tooltip: 'http://www.yahoo.com/A1', label: 'http://www.yahoo.com/A1' },
    });
  });

  it('parses a raw-display-fallback line with a stripped url suffix too', () => {
    const member = parseMemberLine('+String a1 [[[http://x.com]]]');
    expect(member).toMatchObject({
      rawDisplay: 'String a1',
      ownUrl: { url: 'http://x.com', tooltip: 'http://x.com', label: 'http://x.com' },
    });
  });

  it('parses a [[[url{tooltip}]]] suffix with a tooltip', () => {
    const member = parseMemberLine('name2 [[[https://example.com/link1{Some tooltip}]]]');
    expect(member).toMatchObject({
      name: 'name2',
      ownUrl: { url: 'https://example.com/link1', tooltip: 'Some tooltip', label: 'https://example.com/link1' },
    });
  });

  it('two DIFFERENT member lines on the same classifier parse two DIFFERENT ownUrl values', () => {
    const m1 = parseMemberLine('name1 [[[https://example.com/link1]]]');
    const m2 = parseMemberLine('name2 [[[https://example.com/link2]]]');
    expect(m1!.ownUrl).toEqual({ url: 'https://example.com/link1', tooltip: 'https://example.com/link1', label: 'https://example.com/link1' });
    expect(m2!.ownUrl).toEqual({ url: 'https://example.com/link2', tooltip: 'https://example.com/link2', label: 'https://example.com/link2' });
  });

  it('omits ownUrl (not undefined-valued) for a member with no url suffix', () => {
    expect(parseMemberLine('foo')!.ownUrl).toBeUndefined();
    expect(Object.keys(parseMemberLine('foo')!)).not.toContain('ownUrl');
  });

  it('strips a bare double-bracket suffix from display text but does not parse it as ownUrl (member-level url grammar is always triple-bracket)', () => {
    const member = parseMemberLine('name[[http://field]]');
    expect(member).toMatchObject({ name: 'name' });
    expect(member!.ownUrl).toBeUndefined();
  });
});

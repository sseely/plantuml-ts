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

  // G2 N31: upstream stores each member line close to verbatim -- a
  // non-canonical `name : Type`/`name:Type` spacing must survive the
  // round-trip, not be normalized to the canonical `': '` (jar-verified:
  // sasito-46-padu855's `+counter : string`).
  it('preserves a non-canonical " : " (space before colon) separator', () => {
    expect(parseMemberLine('+counter : string')).toEqual({
      visibility: '+',
      name: 'counter',
      type: 'string',
      typeSeparator: ' : ',
      isStatic: false,
      isAbstract: false,
      visibilityExplicit: true,
    });
  });

  it('preserves a non-canonical ":" (no space) separator on a method return type', () => {
    expect(parseMemberLine('+getName():String')).toEqual({
      visibility: '+',
      name: 'getName',
      params: [],
      type: 'String',
      typeSeparator: ':',
      isStatic: false,
      isAbstract: false,
      visibilityExplicit: true,
    });
  });

  it('omits typeSeparator for the canonical ": " spacing (no behavior change)', () => {
    const member = parseMemberLine('+name: String');
    expect(member).not.toHaveProperty('typeSeparator');
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
// G2 N43 (sotepe-41-semo054/juxora-90-fisu720, jar-verified): a `name :
// type` shape whose "type" capture contains `(`/`)` must fall to the raw
// fallback rather than a structured attribute match -- upstream's real
// field/method split (`BodierLikeClassOrObject#isMethod`) is a paren-
// containment scan over the WHOLE raw line, applied before ANY structured
// decomposition; a structured attribute match here previously hid that scan
// behind `m.params !== undefined` (always false for an attribute), silently
// misclassifying the member as a field when jar draws it as a method.
// ---------------------------------------------------------------------------

describe('parseMemberLine — G2 N43 paren-bearing "type" falls to raw fallback', () => {
  it('falls back to rawDisplay for a parenthesized function-shaped type ("name : void()")', () => {
    expect(parseMemberLine('+test : void()')).toEqual({
      visibility: '+',
      name: 'test : void()',
      rawDisplay: 'test : void()',
      isStatic: false,
      isAbstract: false,
      visibilityExplicit: true,
    });
  });

  it('falls back to rawDisplay for a bare trailing "(" ("prop4 :(")', () => {
    expect(parseMemberLine('prop4 :(')).toEqual({
      visibility: '+',
      name: 'prop4 :(',
      rawDisplay: 'prop4 :(',
      isStatic: false,
      isAbstract: false,
    });
  });

  it('still parses a normal, paren-free "name : type" as a structured attribute', () => {
    expect(parseMemberLine('+counter : string')).toMatchObject({
      name: 'counter',
      type: 'string',
    });
    expect(parseMemberLine('+counter : string')).not.toHaveProperty('rawDisplay');
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

// ---------------------------------------------------------------------------
// G2 N42: stripVisibility's same-2nd-char guard (VisibilityModifier
// .isVisibilityCharacter requires char[0] != char[1]) -- a `**bold**`
// creole run must not lose its own leading `*` to a spurious visibility
// strip. Mirrors class-object-commands.ts#detectVisibilityChar's
// pre-existing identical guard.
// ---------------------------------------------------------------------------

describe('parseMemberLine — visibility char same-2nd-char exclusion', () => {
  it('does not treat a leading "**" (bold creole) as a visibility marker', () => {
    const member = parseMemberLine('**Bar(Model)**');
    expect(member).toMatchObject({ visibility: '+', rawDisplay: '**Bar(Model)**' });
    expect(member!.visibilityExplicit).toBeUndefined();
  });

  it('still strips a single leading "*" (IE_MANDATORY) when the 2nd char differs', () => {
    const member = parseMemberLine('*IE_MANDATORY');
    expect(member).toMatchObject({ visibility: '*', visibilityExplicit: true });
  });

  it('still strips every other single explicit visibility char normally', () => {
    expect(parseMemberLine('+foo')).toMatchObject({ visibility: '+', visibilityExplicit: true });
    expect(parseMemberLine('-foo')).toMatchObject({ visibility: '-', visibilityExplicit: true });
    expect(parseMemberLine('#foo')).toMatchObject({ visibility: '#', visibilityExplicit: true });
    expect(parseMemberLine('~foo')).toMatchObject({ visibility: '~', visibilityExplicit: true });
  });

  it('does not treat a leading "--" as a visibility marker (block-separator shape)', () => {
    const member = parseMemberLine('--');
    expect(member).toMatchObject({ visibility: '+', rawDisplay: '--' });
    expect(member!.visibilityExplicit).toBeUndefined();
  });
});

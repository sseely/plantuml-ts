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
// G2 N15: `hasOwnUrl` -- a stripped `[[url]]`/`[[[url]]]` link suffix,
// tracked as metadata only (the url content itself is discarded, member-
// level url wrapping is a separate, not-yet-built mechanism). Read by
// `renderer.ts`'s classifier-level url-wrap decision to avoid an incorrect
// whole-box merge.
// ---------------------------------------------------------------------------

describe('parseMemberLine — G2 N15 hasOwnUrl tracking', () => {
  it('marks a structured attribute line with a stripped [[[url]]] suffix', () => {
    const member = parseMemberLine('name[[[http://field]]]');
    expect(member).toMatchObject({ name: 'name', hasOwnUrl: true });
  });

  it('marks a structured method line with a stripped [[url]] suffix', () => {
    const member = parseMemberLine('+methods1() [[[http://www.yahoo.com/A1]]]');
    expect(member).toMatchObject({ name: 'methods1', hasOwnUrl: true });
  });

  it('marks a raw-display-fallback line with a stripped url suffix too', () => {
    const member = parseMemberLine('+String a1 [[[http://x.com]]]');
    expect(member).toMatchObject({ rawDisplay: 'String a1', hasOwnUrl: true });
  });

  it('omits hasOwnUrl (not false) for a member with no url suffix', () => {
    expect(parseMemberLine('foo')!.hasOwnUrl).toBeUndefined();
  });
});

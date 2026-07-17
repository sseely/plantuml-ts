/**
 * G2 N12: `hide|show <visibility[,visibility...]> members|fields|methods`
 * (upstream `CommandHideShowByVisibility`) — a member-level filter keyed on
 * visibility char x field/method-ness, distinct from the fixed `hide
 * members`/`hide empty members` targets and from the entity-selector
 * `hide <name>`/`hide $tag` form (G2 N7).
 *
 * @see ~/git/plantuml/.../classdiagram/command/CommandHideShowByVisibility.java
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#hideOrShowVisibilityModifier
 */
import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import {
  parseHideShowVisibilityDirective,
  applyVisibilityHideShow,
} from '../../../src/diagrams/class/class-directives.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { ClassDiagramAST } from '../../../src/diagrams/class/ast.js';

function parse(source: string): ClassDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

// ---------------------------------------------------------------------------
// parseHideShowVisibilityDirective
// ---------------------------------------------------------------------------

describe('parseHideShowVisibilityDirective', () => {
  it('parses a single visibility + plural portion', () => {
    expect(parseHideShowVisibilityDirective('hide private members')).toEqual({
      kind: 'hideshowvisibility',
      action: 'hide',
      visibilities: ['private'],
      portion: 'member',
    });
  });

  it('parses a singular portion word ("member")', () => {
    expect(parseHideShowVisibilityDirective('hide public member')).toEqual({
      kind: 'hideshowvisibility',
      action: 'hide',
      visibilities: ['public'],
      portion: 'member',
    });
  });

  it('parses comma-separated visibility tokens', () => {
    expect(parseHideShowVisibilityDirective('hide private,public members')).toEqual({
      kind: 'hideshowvisibility',
      action: 'hide',
      visibilities: ['private', 'public'],
      portion: 'member',
    });
  });

  it('parses "fields"/"attributes" and "methods" portions', () => {
    expect(parseHideShowVisibilityDirective('hide private fields')?.portion).toBe('field');
    expect(parseHideShowVisibilityDirective('hide private attributes')?.portion).toBe('field');
    expect(parseHideShowVisibilityDirective('hide protected methods')?.portion).toBe('method');
  });

  it('parses "show" action', () => {
    expect(parseHideShowVisibilityDirective('show package methods')).toEqual({
      kind: 'hideshowvisibility',
      action: 'show',
      visibilities: ['package'],
      portion: 'method',
    });
  });

  it('returns null for a fixed global target (belongs to parseHideShowDirective)', () => {
    expect(parseHideShowVisibilityDirective('hide members')).toBeNull();
    expect(parseHideShowVisibilityDirective('hide empty members')).toBeNull();
  });

  it('returns null for an entity-selector target (belongs to parseHideShowPatternDirective)', () => {
    expect(parseHideShowVisibilityDirective('hide aaa')).toBeNull();
    expect(parseHideShowVisibilityDirective('hide C2 circle')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyVisibilityHideShow — unit-level, direct AST manipulation
// ---------------------------------------------------------------------------

describe('applyVisibilityHideShow', () => {
  it('hides only the matching (visibility, field) members', () => {
    const ast: ClassDiagramAST = {
      classifiers: [
        {
          id: 'Foo',
          display: 'Foo',
          kind: 'class',
          typeParams: [],
          members: [
            { visibility: '+', name: 'a', isStatic: false, isAbstract: false, visibilityExplicit: true },
            { visibility: '-', name: 'b', isStatic: false, isAbstract: false, visibilityExplicit: true },
          ],
        },
      ],
      relationships: [],
      namespaces: [],
      directives: [],
      hideVisibilityDirectives: [
        { kind: 'hideshowvisibility', action: 'hide', visibilities: ['private'], portion: 'field' },
      ],
      notes: [],
    };
    applyVisibilityHideShow(ast);
    expect(ast.classifiers[0]!.members[0]!.hidden).toBeUndefined(); // public 'a' untouched
    expect(ast.classifiers[0]!.members[1]!.hidden).toBe(true); // private 'b' hidden
  });

  it('never hides a member with no explicit visibility char (implicit "+")', () => {
    // Upstream: Member#visibilityModifier is null (not PUBLIC_FIELD) when no
    // char was written -- hideVisibilityModifier.contains(null) is always
    // false, so "hide public fields" must NOT touch an implicit member.
    const ast: ClassDiagramAST = {
      classifiers: [
        {
          id: 'Foo',
          display: 'Foo',
          kind: 'class',
          typeParams: [],
          members: [
            { visibility: '+', name: 'bare', isStatic: false, isAbstract: false }, // no visibilityExplicit
          ],
        },
      ],
      relationships: [],
      namespaces: [],
      directives: [],
      hideVisibilityDirectives: [
        { kind: 'hideshowvisibility', action: 'hide', visibilities: ['public'], portion: 'field' },
      ],
      notes: [],
    };
    applyVisibilityHideShow(ast);
    expect(ast.classifiers[0]!.members[0]!.hidden).toBeUndefined();
  });

  it('"member" portion hides both fields and methods of that visibility', () => {
    const ast: ClassDiagramAST = {
      classifiers: [
        {
          id: 'Foo',
          display: 'Foo',
          kind: 'class',
          typeParams: [],
          members: [
            { visibility: '-', name: 'field1', isStatic: false, isAbstract: false, visibilityExplicit: true },
            { visibility: '-', name: 'method1', params: [], isStatic: false, isAbstract: false, visibilityExplicit: true },
          ],
        },
      ],
      relationships: [],
      namespaces: [],
      directives: [],
      hideVisibilityDirectives: [
        { kind: 'hideshowvisibility', action: 'hide', visibilities: ['private'], portion: 'member' },
      ],
      notes: [],
    };
    applyVisibilityHideShow(ast);
    expect(ast.classifiers[0]!.members[0]!.hidden).toBe(true);
    expect(ast.classifiers[0]!.members[1]!.hidden).toBe(true);
  });

  it('a later "show" removes an earlier "hide" for the same (visibility, portion)', () => {
    const ast: ClassDiagramAST = {
      classifiers: [
        {
          id: 'Foo',
          display: 'Foo',
          kind: 'class',
          typeParams: [],
          members: [
            { visibility: '-', name: 'b', isStatic: false, isAbstract: false, visibilityExplicit: true },
          ],
        },
      ],
      relationships: [],
      namespaces: [],
      directives: [],
      hideVisibilityDirectives: [
        { kind: 'hideshowvisibility', action: 'hide', visibilities: ['private'], portion: 'field' },
        { kind: 'hideshowvisibility', action: 'show', visibilities: ['private'], portion: 'field' },
      ],
      notes: [],
    };
    applyVisibilityHideShow(ast);
    expect(ast.classifiers[0]!.members[0]!.hidden).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// End-to-end via parseClass (dispatch + application)
// ---------------------------------------------------------------------------

describe('hide <visibility> members/fields/methods — end to end (G2 N12)', () => {
  it('jar-verified: benemi-22-dufo622 (hide private members)', () => {
    const ast = parse(`
      class class1 {
        + public_member
        --
        - private_member
      }
      hide private members
    `);
    const members = ast.classifiers[0]!.members;
    expect(members.find((m) => m.name === 'public_member')?.hidden).toBeUndefined();
    expect(members.find((m) => m.name === 'private_member')?.hidden).toBe(true);
  });

  it('jar-verified: kexecu-14-xesa311 (three independent visibility hides)', () => {
    const ast = parse(`
      hide private members
      hide protected members
      hide package members
      class Foo {
        - private
        # protected
        ~ package
      }
    `);
    const members = ast.classifiers[0]!.members;
    expect(members.every((m) => m.hidden === true)).toBe(true);
  });

  it('jar-verified: rotebe-88-nise503 (comma-separated visibilities)', () => {
    const ast = parse(`
      class Dummy {
        +fooH
        -dummyH
        #other
        ~last
        +foo2H()
        -dummy2()
        #other2H()
        ~last2()
      }
      hide private,public members
    `);
    const byName = (n: string): boolean | undefined =>
      ast.classifiers[0]!.members.find((m) => m.name === n)?.hidden;
    expect(byName('fooH')).toBe(true); // public
    expect(byName('dummyH')).toBe(true); // private
    expect(byName('other')).toBeUndefined(); // protected -- untouched
    expect(byName('last')).toBeUndefined(); // package -- untouched
    expect(byName('foo2H')).toBe(true);
    expect(byName('dummy2')).toBe(true);
  });

  it('jar-verified: volexu-59-luva429 (per-portion qualifier forms)', () => {
    const ast = parse(`
      class Dummy {
        +fooH
        -dummyH
        #other
        ~last
        +foo2H()
        -dummy2()
        #other2H()
        ~last2()
      }
      hide private fields
      hide public member
      hide protected methods
    `);
    const byName = (n: string): boolean | undefined =>
      ast.classifiers[0]!.members.find((m) => m.name === n)?.hidden;
    expect(byName('dummyH')).toBe(true); // private field -- hidden
    expect(byName('dummy2')).toBeUndefined(); // private METHOD -- untouched (fields only)
    expect(byName('fooH')).toBe(true); // public field -- hidden (public member = both)
    expect(byName('foo2H')).toBe(true); // public method -- hidden (public member = both)
    expect(byName('other2H')).toBe(true); // protected method -- hidden
    expect(byName('other')).toBeUndefined(); // protected FIELD -- untouched (methods only)
    expect(byName('last')).toBeUndefined(); // package -- untouched entirely
    expect(byName('last2')).toBeUndefined();
  });
});

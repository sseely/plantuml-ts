/**
 * G3/O3 — type-keyword `hide <TYPE_KEYWORD> circle|members|fields|methods`
 * (upstream `CommandHideShowByGender`, GENDER = a diagram-wide kind filter --
 * the OTHER alternative of the same command `class-hide-entity.test.ts`
 * already covers via the entity-id form; that parser explicitly excludes
 * these tokens, see `class-directives.ts#TYPE_KEYWORD_GENDERS`'s own doc
 * comment).
 *
 * Three layers, jar-verified against `beruju-17-jigi548`
 * (`hide object fields` / `object foo { field1, field2 }` -- collapses to a
 * header-only 33.425x18 box, no divider, no member rows):
 *  - `parseHideShowKindDirective` (class-directives.ts): pure parse.
 *  - `applyHideShowKindDirectives`: AST post-processing.
 *  - `renderFixtureClass` (real pipeline): end-to-end byte match.
 */
import { describe, it, expect } from 'vitest';
import {
  parseHideShowKindDirective,
  applyHideShowKindDirectives,
} from '../../../src/diagrams/class/class-directives.js';
import { DeterministicMeasurer } from '../../../src/core/measurer-deterministic.js';
import { renderFixtureClass } from '../../oracle/svg-conformance/render-fixture-class.js';
import type { ClassDiagramAST, Classifier } from '../../../src/diagrams/class/ast.js';

const measurer = new DeterministicMeasurer();

function makeClassifier(id: string, overrides?: Partial<Classifier>): Classifier {
  return { id, display: id, kind: 'class', typeParams: [], members: [], ...overrides };
}

function makeAST(classifiers: Classifier[]): ClassDiagramAST {
  return {
    classifiers, relationships: [], namespaces: [], directives: [], notes: [],
  };
}

// ---------------------------------------------------------------------------
// parseHideShowKindDirective — pure parse
// ---------------------------------------------------------------------------

describe('parseHideShowKindDirective', () => {
  it('parses "hide object fields"', () => {
    expect(parseHideShowKindDirective('hide object fields')).toEqual({
      kind: 'hideshowkind', action: 'hide', classifierKind: 'object', target: 'fields',
    });
  });

  it('parses every ported type keyword (class/abstract/interface/enum/annotation/object)', () => {
    for (const [word, classifierKind] of [
      ['class', 'class'], ['abstract', 'abstract'], ['interface', 'interface'],
      ['enum', 'enum'], ['annotation', 'annotation'], ['object', 'object'],
    ] as const) {
      expect(parseHideShowKindDirective(`hide ${word} circle`)).toMatchObject({ classifierKind });
    }
  });

  it('maps members/member/fields/field/attributes/attribute/methods/method/circle(s)/circled the same way as the entity form', () => {
    expect(parseHideShowKindDirective('hide object members')?.target).toBe('members');
    expect(parseHideShowKindDirective('hide object member')?.target).toBe('members');
    expect(parseHideShowKindDirective('hide object field')?.target).toBe('fields');
    expect(parseHideShowKindDirective('hide object attributes')?.target).toBe('fields');
    expect(parseHideShowKindDirective('hide object attribute')?.target).toBe('fields');
    expect(parseHideShowKindDirective('hide object methods')?.target).toBe('methods');
    expect(parseHideShowKindDirective('hide object method')?.target).toBe('methods');
    expect(parseHideShowKindDirective('hide object circles')?.target).toBe('circle');
    expect(parseHideShowKindDirective('hide object circled')?.target).toBe('circle');
  });

  it('recognizes show as well as hide', () => {
    expect(parseHideShowKindDirective('show object fields')).toMatchObject({ action: 'show' });
  });

  it('is case-insensitive on keyword, kind, and portion word', () => {
    expect(parseHideShowKindDirective('HIDE OBJECT FIELDS')).toMatchObject({
      action: 'hide', classifierKind: 'object', target: 'fields',
    });
  });

  it('rejects an unrecognized type keyword (not one of the 6 ported ones)', () => {
    expect(parseHideShowKindDirective('hide protocol fields')).toBeNull();
    expect(parseHideShowKindDirective('hide record fields')).toBeNull();
  });

  it('rejects an unrecognized portion word', () => {
    expect(parseHideShowKindDirective('hide object sprockets')).toBeNull();
  });

  it('rejects a single-token line', () => {
    expect(parseHideShowKindDirective('hide object')).toBeNull();
  });

  it('rejects a plain entity-id line (owned by parseHideShowEntityDirective, not this parser)', () => {
    expect(parseHideShowKindDirective('hide C2 circle')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyHideShowKindDirectives — AST post-processing
// ---------------------------------------------------------------------------

describe('applyHideShowKindDirectives', () => {
  it('sets suppressFields on EVERY object-kind classifier, and none other', () => {
    const ast = makeAST([
      makeClassifier('foo', { kind: 'object' }),
      makeClassifier('bar', { kind: 'object' }),
      makeClassifier('C1', { kind: 'class' }),
    ]);
    ast.hideKindDirectives = [
      { kind: 'hideshowkind', action: 'hide', classifierKind: 'object', target: 'fields' },
    ];
    applyHideShowKindDirectives(ast);
    expect(ast.classifiers.find((c) => c.id === 'foo')?.suppressFields).toBe(true);
    expect(ast.classifiers.find((c) => c.id === 'bar')?.suppressFields).toBe(true);
    expect(ast.classifiers.find((c) => c.id === 'C1')?.suppressFields).toBeUndefined();
  });

  it('sets BOTH suppressFields and suppressMethods for target=members', () => {
    const ast = makeAST([makeClassifier('X', { kind: 'object' })]);
    ast.hideKindDirectives = [
      { kind: 'hideshowkind', action: 'hide', classifierKind: 'object', target: 'members' },
    ];
    applyHideShowKindDirectives(ast);
    const x = ast.classifiers[0]!;
    expect(x.suppressFields).toBe(true);
    expect(x.suppressMethods).toBe(true);
  });

  it('sets hideCircle for target=circle', () => {
    const ast = makeAST([makeClassifier('C1', { kind: 'class' })]);
    ast.hideKindDirectives = [
      { kind: 'hideshowkind', action: 'hide', classifierKind: 'class', target: 'circle' },
    ];
    applyHideShowKindDirectives(ast);
    expect(ast.classifiers[0]!.hideCircle).toBe(true);
  });

  it('last-writer-wins per (classifierKind, target): a later show cancels an earlier hide', () => {
    const ast = makeAST([makeClassifier('foo', { kind: 'object' })]);
    ast.hideKindDirectives = [
      { kind: 'hideshowkind', action: 'hide', classifierKind: 'object', target: 'fields' },
      { kind: 'hideshowkind', action: 'show', classifierKind: 'object', target: 'fields' },
    ];
    applyHideShowKindDirectives(ast);
    expect(ast.classifiers[0]!.suppressFields).toBeUndefined();
  });

  it('is a no-op when hideKindDirectives is absent', () => {
    const ast = makeAST([makeClassifier('C1')]);
    expect(() => applyHideShowKindDirectives(ast)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// End-to-end render — byte-verified against beruju-17-jigi548's oracle SVG
// ---------------------------------------------------------------------------

describe('renderFixtureClass — "hide object fields" reaches the rendered <rect> (beruju-17-jigi548)', () => {
  it('collapses the object to a header-only box (no divider, no member rows)', () => {
    const svg = renderFixtureClass(
      `@startuml
hide object fields
object foo {
field1
field2
}
@enduml`,
      measurer,
    );
    expect(svg).toMatch(/width="33\.425\d*" height="18"/);
    expect(svg).not.toContain('<line');
    expect(svg).not.toContain('field1');
    expect(svg).not.toContain('field2');
  });

  it('does not affect a plain class classifier (kind-scoped, not diagram-global)', () => {
    const svg = renderFixtureClass(
      `@startuml
hide object fields
class C1 {
+bar : int
}
@enduml`,
      measurer,
    );
    expect(svg).toContain('bar');
  });
});

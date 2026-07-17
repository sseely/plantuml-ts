/**
 * G2 N26 — entity-qualified `hide <entity> circle|members|fields|methods`
 * (upstream `CommandHideShowByGender`, GENDER = a single entity id) — the
 * compound form `HideShowPatternDirective`'s own doc comment named as
 * unported since G2 N7.
 *
 * Three layers, jar-verified where a clean (single-mechanism) fixture
 * exists in `test-results/dot-cache/class/`:
 *  - `parseHideShowEntityDirective` (class-directives.ts): pure parse.
 *  - `applyHideShowEntityDirectives`: AST post-processing.
 *  - `renderFixtureClass` (real pipeline): `dokego-92-zilu832` (entity +
 *    circle) and `nirija-04-veti140` (entity + members) both carry ONLY
 *    this one mechanism (no confounding `hide class circled`/badge/url
 *    directives), so their classifier `<rect>` dimensions are byte-
 *    verifiable end to end.
 */
import { describe, it, expect } from 'vitest';
import {
  parseHideShowEntityDirective,
  applyHideShowEntityDirectives,
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
// parseHideShowEntityDirective — pure parse
// ---------------------------------------------------------------------------

describe('parseHideShowEntityDirective', () => {
  it('parses a bare entity id + circle', () => {
    expect(parseHideShowEntityDirective('hide C2 circle')).toEqual({
      kind: 'hideshowentity', action: 'hide', entityId: 'C2', target: 'circle',
    });
  });

  it('parses a quoted entity id', () => {
    expect(parseHideShowEntityDirective('hide "EventEmitter" circle')).toEqual({
      kind: 'hideshowentity', action: 'hide', entityId: 'EventEmitter', target: 'circle',
    });
  });

  it('maps members/member to the members target', () => {
    expect(parseHideShowEntityDirective('hide X members')?.target).toBe('members');
    expect(parseHideShowEntityDirective('hide X member')?.target).toBe('members');
  });

  it('maps fields/attributes (and singulars) to the fields target', () => {
    expect(parseHideShowEntityDirective('hide Dummy3 fields')?.target).toBe('fields');
    expect(parseHideShowEntityDirective('hide Dummy3 field')?.target).toBe('fields');
    expect(parseHideShowEntityDirective('hide Dummy3 attributes')?.target).toBe('fields');
    expect(parseHideShowEntityDirective('hide Dummy3 attribute')?.target).toBe('fields');
  });

  it('maps methods/method to the methods target', () => {
    expect(parseHideShowEntityDirective('hide Dummy2 methods')?.target).toBe('methods');
    expect(parseHideShowEntityDirective('hide Dummy2 method')?.target).toBe('methods');
  });

  it('maps circles/circled (plural/adjective) to the circle target', () => {
    expect(parseHideShowEntityDirective('hide Foo circles')?.target).toBe('circle');
    expect(parseHideShowEntityDirective('hide Foo circled')?.target).toBe('circle');
  });

  it('recognizes show as well as hide', () => {
    expect(parseHideShowEntityDirective('show C2 circle')).toMatchObject({ action: 'show' });
  });

  it('is case-insensitive on both keyword and portion word', () => {
    expect(parseHideShowEntityDirective('HIDE C2 CIRCLE')).toMatchObject({
      action: 'hide', entityId: 'C2', target: 'circle',
    });
  });

  it('rejects visibility keywords as an entity id (owned by HideShowVisibilityDirective)', () => {
    expect(parseHideShowEntityDirective('hide private members')).toBeNull();
    expect(parseHideShowEntityDirective('hide public fields')).toBeNull();
    expect(parseHideShowEntityDirective('hide protected methods')).toBeNull();
    expect(parseHideShowEntityDirective('hide package members')).toBeNull();
  });

  it('rejects type keywords as an entity id (deferred GENDER form)', () => {
    expect(parseHideShowEntityDirective('hide class circled')).toBeNull();
    expect(parseHideShowEntityDirective('hide interface circled')).toBeNull();
  });

  it('rejects the stereotype portion (owned by parseHideStereotypeDirective\'s own grammar)', () => {
    expect(parseHideShowEntityDirective('hide Dummy2 stereotype')).toBeNull();
  });

  it('rejects a single-token line (owned by parseHideShowPatternDirective)', () => {
    expect(parseHideShowEntityDirective('hide C2')).toBeNull();
    expect(parseHideShowEntityDirective('hide *')).toBeNull();
  });

  it('rejects an unrecognized portion word', () => {
    expect(parseHideShowEntityDirective('hide C2 sprockets')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyHideShowEntityDirectives — AST post-processing
// ---------------------------------------------------------------------------

describe('applyHideShowEntityDirectives', () => {
  it('sets hideCircle only on the targeted classifier', () => {
    const ast = makeAST([makeClassifier('C1'), makeClassifier('C2')]);
    ast.hideEntityDirectives = [
      { kind: 'hideshowentity', action: 'hide', entityId: 'C2', target: 'circle' },
    ];
    applyHideShowEntityDirectives(ast);
    expect(ast.classifiers.find((c) => c.id === 'C1')?.hideCircle).toBeUndefined();
    expect(ast.classifiers.find((c) => c.id === 'C2')?.hideCircle).toBe(true);
  });

  it('sets BOTH suppressFields and suppressMethods for target=members', () => {
    const ast = makeAST([makeClassifier('X')]);
    ast.hideEntityDirectives = [
      { kind: 'hideshowentity', action: 'hide', entityId: 'X', target: 'members' },
    ];
    applyHideShowEntityDirectives(ast);
    const x = ast.classifiers[0]!;
    expect(x.suppressFields).toBe(true);
    expect(x.suppressMethods).toBe(true);
  });

  it('sets only suppressFields for target=fields', () => {
    const ast = makeAST([makeClassifier('Dummy3')]);
    ast.hideEntityDirectives = [
      { kind: 'hideshowentity', action: 'hide', entityId: 'Dummy3', target: 'fields' },
    ];
    applyHideShowEntityDirectives(ast);
    const d = ast.classifiers[0]!;
    expect(d.suppressFields).toBe(true);
    expect(d.suppressMethods).toBeUndefined();
  });

  it('sets only suppressMethods for target=methods', () => {
    const ast = makeAST([makeClassifier('Dummy2')]);
    ast.hideEntityDirectives = [
      { kind: 'hideshowentity', action: 'hide', entityId: 'Dummy2', target: 'methods' },
    ];
    applyHideShowEntityDirectives(ast);
    const d = ast.classifiers[0]!;
    expect(d.suppressMethods).toBe(true);
    expect(d.suppressFields).toBeUndefined();
  });

  it('last-writer-wins per (entityId, target): a later show cancels an earlier hide', () => {
    const ast = makeAST([makeClassifier('C1')]);
    ast.hideEntityDirectives = [
      { kind: 'hideshowentity', action: 'hide', entityId: 'C1', target: 'circle' },
      { kind: 'hideshowentity', action: 'show', entityId: 'C1', target: 'circle' },
    ];
    applyHideShowEntityDirectives(ast);
    expect(ast.classifiers[0]!.hideCircle).toBeUndefined();
  });

  it('is a no-op for an unresolvable entity id', () => {
    const ast = makeAST([makeClassifier('C1')]);
    ast.hideEntityDirectives = [
      { kind: 'hideshowentity', action: 'hide', entityId: 'NoSuchEntity', target: 'circle' },
    ];
    expect(() => applyHideShowEntityDirectives(ast)).not.toThrow();
    expect(ast.classifiers[0]!.hideCircle).toBeUndefined();
  });

  it('is a no-op when hideEntityDirectives is absent', () => {
    const ast = makeAST([makeClassifier('C1')]);
    expect(() => applyHideShowEntityDirectives(ast)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// End-to-end render — byte-verified against real oracle SVGs
// ---------------------------------------------------------------------------

describe('renderFixtureClass — entity-qualified hide reaches the rendered <rect>', () => {
  // dokego-92-zilu832/in.svg: C2's own rect is 23.9375x40 (no badge
  // reservation) once its circle is hidden -- C1 (untouched) keeps its
  // full 49.9375x48 badge-reserving box.
  it('hide <entity> circle shrinks only the targeted classifier\'s box', () => {
    const svg = renderFixtureClass(
      `@startuml
class C1
class C2
hide C2 circle
C1 "1" -- "1" C2
@enduml`,
      measurer,
    );
    expect(svg).toContain('width="49.9375" height="48"');
    expect(svg).toContain('width="23.9375" height="40"');
  });

  // nirija-04-veti140/in.svg: `hide X members` / `hide Y members` fully
  // collapse BOTH classifiers to a header-only 41.3625x32 box (no dividers,
  // no member rows) despite X/Y each declaring 5 real member lines.
  it('hide <entity> members fully collapses that entity\'s box (fields + methods)', () => {
    const svg = renderFixtureClass(
      `@startuml
class X {
  + End() : int
  - Count : int
  __ Messages __
  AnnounceEnd() : int
 Message : String
}
class Y {
  + End() : int
  - Count : int
  '__ Messages __
  AnnounceEnd() : int
 Message : String
}
hide X members
hide Y members
@enduml`,
      measurer,
    );
    expect(svg).toContain('width="41.3625" height="32"');
    expect(svg).not.toContain('<line');
  });

  it('a classifier with no matching directive is unaffected', () => {
    const svg = renderFixtureClass(
      `@startuml
class C1
class C2
hide C2 circle
@enduml`,
      measurer,
    );
    // C1 keeps its ellipse badge (no hide directive targets it).
    expect(svg).toContain('<ellipse');
  });
});

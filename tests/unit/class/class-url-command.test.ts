/**
 * G2 N15: `class Foo [[url]]` inline declaration suffix and the standalone
 * `url [of|for] Foo [is] [[url]]` statement -- full parser integration
 * tests (via `parseClass`, matching this file's peer `class-note-
 * lastentity.test.ts`'s established pattern).
 */
import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function parse(source: string): ReturnType<typeof parseClass> {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

describe('inline `class Foo [[url]]` declaration suffix', () => {
  it('a bare classifier declaration with a url and no body', () => {
    const ast = parse('class Foo [[http://www.google.com]]');
    expect(ast.classifiers[0]).toMatchObject({
      id: 'Foo',
      url: { url: 'http://www.google.com', tooltip: 'http://www.google.com', label: 'http://www.google.com' },
    });
  });

  it('a url on a classifier that also opens a body', () => {
    const ast = parse('class Foo [[http://x.com]] {\n+int a\n}');
    expect(ast.classifiers[0]).toMatchObject({
      id: 'Foo',
      url: { url: 'http://x.com', tooltip: 'http://x.com', label: 'http://x.com' },
    });
    expect(ast.classifiers[0]!.members).toHaveLength(1);
  });

  it('a url coexists with a stereotype and color', () => {
    const ast = parse('class Foo << (R,#FF7700) >> #pink [[http://x.com]]');
    expect(ast.classifiers[0]).toMatchObject({
      id: 'Foo',
      stereotype: '(R,#FF7700)',
      color: '#pink',
      url: { url: 'http://x.com', tooltip: 'http://x.com', label: 'http://x.com' },
    });
  });

  it('a classifier with no `[[url]]` suffix leaves `url` undefined', () => {
    const ast = parse('class Foo');
    expect(ast.classifiers[0]!.url).toBeUndefined();
  });
});

describe('standalone `url [of|for] <Code> [is] [[url]]` statement', () => {
  it('the `of`/`is` form attaches a url to an already-declared classifier', () => {
    const ast = parse('class CarePlan\nurl of CarePlan is [[careplan-definitions.htm#CarePlan]]');
    expect(ast.classifiers[0]).toMatchObject({
      id: 'CarePlan',
      url: {
        url: 'careplan-definitions.htm#CarePlan',
        tooltip: 'careplan-definitions.htm#CarePlan',
        label: 'careplan-definitions.htm#CarePlan',
      },
    });
  });

  it('the bare `url <Code> [[url]]` form (no `of`/`is`) also matches', () => {
    const ast = parse('class Foo\nurl Foo [[http://x.com]]');
    expect(ast.classifiers[0]!.url).toEqual({ url: 'http://x.com', tooltip: 'http://x.com', label: 'http://x.com' });
  });

  it('the `for` keyword is also accepted', () => {
    const ast = parse('class Foo\nurl for Foo is [[http://x.com]]');
    expect(ast.classifiers[0]!.url).toEqual({ url: 'http://x.com', tooltip: 'http://x.com', label: 'http://x.com' });
  });

  it('targeting a nonexistent classifier is a silent no-op, not a throw', () => {
    expect(() => parse('url of Nonexistent is [[http://x.com]]')).not.toThrow();
    const ast = parse('url of Nonexistent is [[http://x.com]]');
    expect(ast.classifiers).toEqual([]);
  });

  it('a later statement overwrites an earlier inline url (last-writer-wins, ' +
     'mirrors upstream `Entity#addUrl`)', () => {
    const ast = parse('class Foo [[http://first.com]]\nurl of Foo is [[http://second.com]]');
    expect(ast.classifiers[0]!.url!.url).toBe('http://second.com');
  });
});

describe('applyUrlStatement — malformed bracket', () => {
  it('a malformed (empty) bracket is a silent no-op, url stays unset', () => {
    const ast = parse('class Foo\nurl of Foo is [[]]');
    expect(ast.classifiers[0]!.url).toBeUndefined();
  });
});

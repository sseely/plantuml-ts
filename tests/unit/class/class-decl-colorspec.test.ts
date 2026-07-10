/**
 * Classifier declaration color-spec parsing (mission A2, Fix A): a trailing
 * `##[bold]red` (LINECOLOR) or `#line:red;line.bold;text:red` (compound
 * COLOR) spec was swallowed into the classifier id/display instead of being
 * stripped, and a bare `abstract Name` line (no `class` keyword) was dropped
 * entirely — both traced to murotu-83-cebo380 / sosono-24-vuro518.
 *
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateClass.java:81-116
 * @see ~/git/plantuml/.../klimt/color/ColorParser.java:43-46 (COLOR_REGEXP, PART2)
 */
import { describe, it, expect } from 'vitest';
import { parseClassifierDecl } from '../../../src/diagrams/class/class-declaration-parser.js';
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

describe('classifier declaration: `##[style]color` LINECOLOR spec (murotu-83-cebo380)', () => {
  it('strips a `##[bold]red` spec off the id/display, keeping the raw spec in color', () => {
    const decl = parseClassifierDecl('annotation annotation ##[bold]red');
    expect(decl).not.toBeNull();
    expect(decl!.id).toBe('annotation');
    expect(decl!.display).toBe('annotation');
    expect(decl!.kind).toBe('annotation');
    expect(decl!.color).toBe('##[bold]red');
  });

  it('strips `##[dashed]green` / `##[dotted]blue` the same way', () => {
    expect(parseClassifierDecl('class class ##[dashed]green')).toMatchObject({
      id: 'class',
      display: 'class',
      color: '##[dashed]green',
    });
    expect(parseClassifierDecl('interface interface ##[dotted]blue')).toMatchObject({
      id: 'interface',
      display: 'interface',
      color: '##[dotted]blue',
    });
  });

  it('strips a bare `##red` (no style bracket)', () => {
    const decl = parseClassifierDecl('class Foo ##red');
    expect(decl).toMatchObject({ id: 'Foo', display: 'Foo', color: '##red' });
  });
});

describe('classifier declaration: compound `#part:color;...` COLOR spec (sosono-24-vuro518)', () => {
  it('strips `#line:red;line.bold;text:red` off the id/display', () => {
    const decl = parseClassifierDecl('annotation annotation #line:red;line.bold;text:red');
    expect(decl).not.toBeNull();
    expect(decl!.id).toBe('annotation');
    expect(decl!.display).toBe('annotation');
    expect(decl!.color).toBe('#line:red;line.bold;text:red');
  });

  it('strips the dashed/dotted variants the same way', () => {
    expect(parseClassifierDecl('class class #line:green;line.dashed;text:green')).toMatchObject({
      id: 'class',
      display: 'class',
      color: '#line:green;line.dashed;text:green',
    });
    expect(parseClassifierDecl('interface interface #line:blue;line.dotted;text:blue')).toMatchObject({
      id: 'interface',
      display: 'interface',
      color: '#line:blue;line.dotted;text:blue',
    });
  });

  it('still parses a plain `#pink` background spec (no regression)', () => {
    const decl = parseClassifierDecl('class Foo #pink');
    expect(decl).toMatchObject({ id: 'Foo', display: 'Foo', color: '#pink' });
  });
});

describe('bare `abstract Name` declaration (CommandCreateClass.java:87 TYPE alt)', () => {
  it('declares an abstract-kind classifier named "abstract" (not dropped)', () => {
    const decl = parseClassifierDecl('abstract   abstract');
    expect(decl).toMatchObject({ id: 'abstract', display: 'abstract', kind: 'abstract' });
  });

  it('still parses the two-word `abstract class Foo` form unchanged', () => {
    const decl = parseClassifierDecl('abstract class Foo');
    expect(decl).toMatchObject({ id: 'Foo', display: 'Foo', kind: 'abstract' });
  });

  it('reaches the parser end-to-end via the command dispatch table', () => {
    const ast = parse('abstract abstract');
    expect(ast.classifiers).toHaveLength(1);
    expect(ast.classifiers[0]).toMatchObject({ id: 'abstract', display: 'abstract', kind: 'abstract' });
  });
});

describe('murotu-83-cebo380 end to end', () => {
  it('parses all four classifiers (one per kind) with their notes attached', () => {
    const ast = parse(`
      abstract   abstract
      annotation annotation ##[bold]red
      note bottom: Why not bold?
      class      class      ##[dashed]green
      note bottom: Why not dashed?
      interface  interface  ##[dotted]blue
      note bottom: Why not dotted?
    `);
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['abstract', 'annotation', 'class', 'interface']);
    expect(ast.notes).toHaveLength(3);
    expect(ast.notes.map((n) => n.target)).toEqual(['annotation', 'class', 'interface']);
  });
});

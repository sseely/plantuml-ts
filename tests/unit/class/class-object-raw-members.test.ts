/**
 * Raw-display object member rows (object-dot-sync mission, Phase L iter 7).
 *
 * Upstream's `BodierLikeClassOrObject#addFieldOrMethod` NEVER rejects a body
 * line: every raw line becomes a `Member` display row (after visibility-char
 * stripping), not just the `name = value` / bare `name` shapes this parser
 * eagerly structures. See class-object-commands.ts#parseObjectField's doc.
 *
 * @see ~/git/plantuml/.../cucadiagram/BodierLikeClassOrObject.java
 * @see ~/git/plantuml/.../cucadiagram/Member.java
 * @see oracle/goldens/object/nukera-08-dige359 (exact-dimension fixture)
 */

import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import { parseObjectField } from '../../../src/diagrams/class/class-object-commands.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { ClassDiagramAST, Classifier } from '../../../src/diagrams/class/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parse(source: string): ClassDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

function findClassifier(source: string, id: string): Classifier {
  const ast = parse(source);
  const c = ast.classifiers.find((cl) => cl.id === id);
  if (c === undefined) throw new Error(`Expected classifier "${id}"`);
  return c;
}

// ---------------------------------------------------------------------------
// parseObjectField — unit-level (visibility detection + raw fallback)
// ---------------------------------------------------------------------------

describe('parseObjectField — raw-display fallback', () => {
  it('nukera-08-dige359: strips a leading visibility char and keeps the rest verbatim', () => {
    expect(parseObjectField('-String toto = "hello"')).toEqual({
      visibility: '-',
      visibilityExplicit: true,
      name: 'String toto = "hello"',
      rawDisplay: 'String toto = "hello"',
      isStatic: false,
      isAbstract: false,
    });
    expect(parseObjectField('#String toto = "hello"')).toMatchObject({
      visibility: '#',
      visibilityExplicit: true,
      rawDisplay: 'String toto = "hello"',
    });
    expect(parseObjectField('~String toto = "hello"')).toMatchObject({
      visibility: '~',
      visibilityExplicit: true,
      rawDisplay: 'String toto = "hello"',
    });
    expect(parseObjectField('+String toto = "hello"')).toMatchObject({
      visibility: '+',
      visibilityExplicit: true,
      rawDisplay: 'String toto = "hello"',
    });
  });

  it('donoki-79-riku189: strips a leading "*" (IE_MANDATORY) creole-bullet line', () => {
    expect(parseObjectField('* ABullet list')).toEqual({
      visibility: '*',
      visibilityExplicit: true,
      name: 'ABullet list',
      rawDisplay: 'ABullet list',
      isStatic: false,
      isAbstract: false,
    });
  });

  it('does NOT treat "**" (identical second char) as a visibility marker', () => {
    // VisibilityModifier.isVisibilityCharacter requires charAt(1) != charAt(0).
    expect(parseObjectField('** ASub item')).toEqual({
      visibility: '+',
      name: '** ASub item',
      rawDisplay: '** ASub item',
      isStatic: false,
      isAbstract: false,
    });
  });

  it('drops a "--" block-separator line rather than showing it as text', () => {
    expect(parseObjectField('--')).toBeNull();
    expect(parseObjectField('----')).toBeNull();
  });

  it('drops a blank/whitespace-only line', () => {
    expect(parseObjectField('')).toBeNull();
    expect(parseObjectField('   ')).toBeNull();
  });

  it('regression: "name = value" still parses structured, no rawDisplay/icon', () => {
    expect(parseObjectField('name = "x"')).toEqual({
      visibility: '+',
      name: 'name',
      type: '"x"',
      isStatic: false,
      isAbstract: false,
    });
  });

  it('regression: a bare field name still parses structured, no rawDisplay/icon', () => {
    expect(parseObjectField('flag')).toEqual({
      visibility: '+',
      name: 'flag',
      isStatic: false,
      isAbstract: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Parser-level — multiline body + "X : field" post-hoc form
// ---------------------------------------------------------------------------

describe('object member parsing — raw lines kept through the full parser', () => {
  it('nukera-08-dige359 shape: 4 "X : field" lines, one per visibility char', () => {
    const c = findClassifier(
      [
        'object "~#1: Person" as p1',
        'p1 : -String toto = "hello"',
        'p1 : #String toto = "hello"',
        'p1 : ~String toto = "hello"',
        'p1 : +String toto = "hello"',
      ].join('\n'),
      'p1',
    );
    expect(c.kind).toBe('object');
    expect(c.members).toHaveLength(4);
    expect(c.members.map((m) => m.visibility)).toEqual(['-', '#', '~', '+']);
    expect(c.members.every((m) => m.visibilityExplicit === true)).toBe(true);
    expect(c.members.every((m) => m.rawDisplay === 'String toto = "hello"')).toBe(true);
  });

  it('donoki-79-riku189 shape: multiline body keeps a raw bullet-list line', () => {
    const c = findClassifier('object d {\n* Bullet item\n}', 'd');
    expect(c.kind).toBe('object');
    expect(c.members).toEqual([
      {
        visibility: '*',
        visibilityExplicit: true,
        name: 'Bullet item',
        rawDisplay: 'Bullet item',
        isStatic: false,
        isAbstract: false,
      },
    ]);
  });

  it('regression: multiline "name = value" body still parses structured', () => {
    const c = findClassifier('object user1 {\nname = "x"\n}', 'user1');
    expect(c.members).toEqual([
      { visibility: '+', name: 'name', type: '"x"', isStatic: false, isAbstract: false },
    ]);
  });

  it('regression: a blank line inside a multiline body is still dropped', () => {
    const c = findClassifier('object user1 {\nname = "x"\n\nage = 30\n}', 'user1');
    expect(c.members).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Sizing — nukera-08-dige359's p1 exact dimensions through layoutClass
// ---------------------------------------------------------------------------

describe('measureObjectClassifier — raw member rows size the box (nukera-08-dige359)', () => {
  const measurer = new WidthTableMeasurer();
  const theme = defaultTheme; // fontFamily 'sans-serif', fontSize 14

  it('sizes p1 to the oracle dims exactly (1.857118in x 1.138889in @ 72dpi = 133.7125 x 82.0 px)', () => {
    const ast: ClassDiagramAST = {
      classifiers: [
        findClassifier(
          [
            'object "~#1: Person" as p1',
            'p1 : -String toto = "hello"',
            'p1 : #String toto = "hello"',
            'p1 : ~String toto = "hello"',
            'p1 : +String toto = "hello"',
          ].join('\n'),
          'p1',
        ),
      ],
      relationships: [],
      namespaces: [],
      directives: [],
      notes: [],
    };
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.width).toBeCloseTo(133.7125, 4);
    expect(c.height).toBeCloseTo(82, 4);
    // header row + 4 raw member rows, each with a visibility icon.
    expect(c.rows).toHaveLength(5);
    for (const row of c.rows.slice(1)) {
      expect(row.text).toBe('String toto = "hello"');
      expect(row.visibilityIcon).toBeDefined();
    }
  });
});

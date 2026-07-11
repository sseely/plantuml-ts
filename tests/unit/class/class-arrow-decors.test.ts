/**
 * Arrow-decoration gap coverage (mission A2 iteration 12, Group 1): six
 * fixtures were silently dropping their relationship line because the
 * composed HEAD1/HEAD2 grammar in class-relationship-parser.ts didn't cover
 * every LinkDecor.java glyph — see that file's LinkDecor citations in
 * HEAD1_SAFE/HEAD2/HEAD1_KIND/HEAD2_KIND for the exact enum members. One
 * case per construct, plus regressions on arrows that already worked.
 *
 * @see ~/git/plantuml/.../decoration/LinkDecor.java:69-100 (enum values)
 * @see ~/git/plantuml/.../decoration/LinkDecor.java:238-263 (getRegexDecors1/2)
 * @see ~/git/plantuml/.../classdiagram/command/CommandLinkClass.java:131-139
 *      (ARROW_HEAD1/ARROW_BODY1/.../INSIDE/.../ARROW_HEAD2 regex assembly)
 */
import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import { parseRelationshipLine } from '../../../src/diagrams/class/class-relationship-parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function parse(source: string): ReturnType<typeof parseClass> {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

describe('LinkDecor.SQUARE ("#") — zerofa-77-caro506, zuramo-86-liku129', () => {
  it('parses a bare `#` head decor instead of dropping the line', () => {
    const rel = parseRelationshipLine('foo2 #-- foo1');
    expect(rel).not.toBeNull();
    expect(rel?.length).toBe(2);
  });

  it('composes with a COMPOSITION `*` on the other end (`#--*`)', () => {
    const rel = parseRelationshipLine('foo #--* bar');
    expect(rel).not.toBeNull();
    expect(rel?.type).toBe('composition');
  });

  it('auto-creates both endpoints via full parseClass', () => {
    const ast = parse('foo2 #-- foo1');
    expect(ast.classifiers.map((c) => c.id).sort()).toEqual(['foo1', 'foo2']);
    expect(ast.relationships).toHaveLength(1);
  });
});

describe('LinkDecor.EXTENDS second decor "^" — zuramo-86-liku129', () => {
  it('resolves `^` as an extends-like decor, not a parse failure', () => {
    const rel = parseRelationshipLine('foo <||--^ bar');
    expect(rel).not.toBeNull();
    expect(rel?.type).toBe('extension');
    expect(rel?.length).toBe(2);
  });
});

describe('LinkDecor.REDEFINES ("<||"/"||>") — zuramo-86-liku129, nixema-71-tuke505', () => {
  it('parses "<||" as ARROW_HEAD1 (folds into the extends-like kind)', () => {
    const rel = parseRelationshipLine('foo <||--^ bar');
    expect(rel).not.toBeNull();
  });

  it('parses "||>" as ARROW_HEAD2', () => {
    const rel = parseRelationshipLine('A --||>C');
    expect(rel).not.toBeNull();
    expect(rel?.type).toBe('extension');
  });
});

describe('LinkDecor.DEFINEDBY ("<|:"/":|>") — nixema-71-tuke505', () => {
  it('parses "<|:" as ARROW_HEAD1', () => {
    const rel = parseRelationshipLine('A <|:-- B');
    expect(rel).not.toBeNull();
    expect(rel?.type).toBe('extension');
    expect(rel?.length).toBe(2);
  });

  it('auto-creates both endpoints (previously the whole line was dropped)', () => {
    const ast = parse('class A\nclass B\nA <|:-- B');
    expect(ast.relationships).toHaveLength(1);
  });
});

describe('LinkDecor.CIRCLE_CROWFOOT ("}o"/"o{") mixed with a real decor — zuramo-86-liku129', () => {
  it('parses "o{" as ARROW_HEAD2 alongside an EXTENDS ARROW_HEAD1 ("<|--o{")', () => {
    const rel = parseRelationshipLine('foo <|--o{ bar');
    expect(rel).not.toBeNull();
    expect(rel?.length).toBe(2);
  });

  it('parses "}o" as ARROW_HEAD1 (symmetric form)', () => {
    const rel = parseRelationshipLine('foo }o--> bar');
    expect(rel).not.toBeNull();
  });
});

describe('CommandLinkClass INSIDE middle-circle marker ("0)"/"(0"/"0"/"(0)") — cenubi-27-xova754', () => {
  it('parses "-0)-" as a plain association, not a dropped line', () => {
    const rel = parseRelationshipLine('foo1 -0)- foo2');
    expect(rel).not.toBeNull();
    expect(rel?.type).toBe('association');
    expect(rel?.length).toBe(2);
  });

  it('auto-creates both endpoints via full parseClass', () => {
    const ast = parse('foo1 -0)- foo2');
    expect(ast.classifiers.map((c) => c.id).sort()).toEqual(['foo1', 'foo2']);
    expect(ast.relationships).toHaveLength(1);
  });
});

describe('inline `#color;attr` block after the arrow (ColorParser PART2) — nuvake-96-gofe203, xoxuni-96-fere626', () => {
  it('keeps the relationship label when a color block sits before the colon', () => {
    const rel = parseRelationshipLine('Dummy --> Foo2 #blue;text:red : Another link');
    expect(rel).not.toBeNull();
    expect(rel?.label).toBe('Another link');
    expect(rel?.from).toBe('Dummy');
    expect(rel?.to).toBe('Foo2');
  });

  it('does not swallow the label separator for a simple `#color;attr:value` block', () => {
    const rel = parseRelationshipLine('cl1 --> cl2 #red;text:blue : foo3');
    expect(rel).not.toBeNull();
    expect(rel?.label).toBe('foo3');
  });

  it('still parses when no color block is present (regression)', () => {
    const rel = parseRelationshipLine('Dummy --> Foo : A link');
    expect(rel).not.toBeNull();
    expect(rel?.label).toBe('A link');
  });
});

describe('regressions on already-working arrow forms', () => {
  it.each([
    ['foo --> bar', 'association'],
    ['foo <|.. bar', 'implementation'],
    ['foo *-- bar', 'composition'],
    ['foo o-- bar', 'aggregation'],
    ['foo <-- bar', 'association'],
    ['foo +--o bar', 'aggregation'],
  ] as const)('%s -> %s', (line, type) => {
    const rel = parseRelationshipLine(line);
    expect(rel).not.toBeNull();
    expect(rel?.type).toBe(type);
  });

  it('still parses symmetric crow-foot links as association (unaffected by new HEAD glyphs)', () => {
    const ast = parse('A |o--o| B\nC ||--|| D\nE }o--o{ F\nG }|--|{ H\nfoo1 }-- foo2');
    expect(ast.relationships).toHaveLength(5);
    expect(ast.relationships.every((r) => r.type === 'association')).toBe(true);
  });
});

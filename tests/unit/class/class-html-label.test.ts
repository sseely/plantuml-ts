/**
 * Unit tests for the class HTML compartment-label builder.
 *
 * buildClassHtmlLabel is synchronous and pure — no async setup required.
 */

import { describe, it, expect } from 'vitest';
import { buildClassHtmlLabel } from '../../../src/diagrams/class/class-html-label.js';
import type { Classifier, Member } from '../../../src/diagrams/class/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FixedMeasurer, WidthTableMeasurer } from '../../../src/core/measurer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMember(overrides: Partial<Member> & Pick<Member, 'name'>): Member {
  return {
    visibility: '+',
    isStatic: false,
    isAbstract: false,
    ...overrides,
  };
}

function makeClassifier(overrides: Partial<Classifier> & Pick<Classifier, 'id' | 'display'>): Classifier {
  return {
    kind: 'class',
    typeParams: [],
    members: [],
    ...overrides,
  };
}

/** 10px/char width, ignored line height (height comes from theme.fontSize, not the measurer). */
const fixedMeasurer = new FixedMeasurer(10, 14);
const widthTableMeasurer = new WidthTableMeasurer();

const countTr = (label: string): number => (label.match(/<TR>/g) ?? []).length;

// ---------------------------------------------------------------------------
// Bare classifier → null
// ---------------------------------------------------------------------------

describe('buildClassHtmlLabel — bare classifier', () => {
  it('returns null for a class with no members and no stereotype', () => {
    const classifier = makeClassifier({ id: 'X', display: 'X' });
    const result = buildClassHtmlLabel(classifier, defaultTheme, widthTableMeasurer);
    expect(result).toBeNull();
  });

  it('returns null when all members are hidden and no stereotype is set', () => {
    const classifier = makeClassifier({
      id: 'X',
      display: 'X',
      members: [makeMember({ name: 'field', type: 'int', hidden: true })],
    });
    const result = buildClassHtmlLabel(classifier, defaultTheme, widthTableMeasurer);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2 attributes + 1 method → 3 compartment groups, deterministic width/height
// ---------------------------------------------------------------------------

describe('buildClassHtmlLabel — attributes + operations', () => {
  const classifier = makeClassifier({
    id: 'Foo',
    display: 'Foo',
    members: [
      makeMember({ name: 'x', type: 'int' }),
      makeMember({ name: 'y', type: 'string' }),
      makeMember({ name: 'doIt', type: 'void', params: [] }),
    ],
  });

  it('produces 3 compartment <TR> groups (name, attributes, operations)', () => {
    const result = buildClassHtmlLabel(classifier, defaultTheme, widthTableMeasurer);
    expect(result).not.toBeNull();
    expect(countTr(result!.label)).toBe(3);
  });

  it('reports width/height > 0', () => {
    const result = buildClassHtmlLabel(classifier, defaultTheme, widthTableMeasurer);
    expect(result!.width).toBeGreaterThan(0);
    expect(result!.height).toBeGreaterThan(0);
  });

  it('computes an exact deterministic width from a fixed-width measurer', () => {
    // Widest candidate: "doIt(): void" (12 chars) -> 12*10 + ICON_WIDTH(18) = 138.
    // width = max(MIN_WIDTH=100, 138 + WIDTH_PADDING=20) = 158.
    const result = buildClassHtmlLabel(classifier, defaultTheme, fixedMeasurer);
    expect(result!.width).toBe(158);
  });

  it('computes an exact deterministic height from theme.fontSize', () => {
    // lineHeight = 14 * 1.4 = 19.6; CELL_PADDING = 4 (top+bottom = 8).
    // name compartment (1 line): 19.6 + 8 = 27.6
    // attribute compartment (2 lines): 2*19.6 + 8 = 47.2
    // operation compartment (1 line): 19.6 + 8 = 27.6
    // total = 102.4
    const result = buildClassHtmlLabel(classifier, defaultTheme, fixedMeasurer);
    expect(result!.height).toBeCloseTo(102.4, 5);
  });

  it('formats attribute and method rows via formatMemberText (reused from layout.ts)', () => {
    const result = buildClassHtmlLabel(classifier, defaultTheme, widthTableMeasurer);
    expect(result!.label).toContain('+ x: int');
    expect(result!.label).toContain('+ y: string');
    expect(result!.label).toContain('+ doIt(): void');
  });

  it('excludes hidden members from both compartment content and sizing', () => {
    const withHidden = makeClassifier({
      id: 'Foo',
      display: 'Foo',
      members: [
        ...classifier.members,
        makeMember({ name: 'secret', type: 'string', hidden: true }),
      ],
    });
    const result = buildClassHtmlLabel(withHidden, defaultTheme, fixedMeasurer);
    expect(result!.label).not.toContain('secret');
    expect(result!.height).toBeCloseTo(102.4, 5);
  });
});

// ---------------------------------------------------------------------------
// Attributes only (no operations) → 2 compartment groups
// ---------------------------------------------------------------------------

describe('buildClassHtmlLabel — attributes only', () => {
  it('produces 2 compartment <TR> groups (name, attributes)', () => {
    const classifier = makeClassifier({
      id: 'Point',
      display: 'Point',
      members: [
        makeMember({ name: 'x', type: 'int' }),
        makeMember({ name: 'y', type: 'int' }),
      ],
    });
    const result = buildClassHtmlLabel(classifier, defaultTheme, widthTableMeasurer);
    expect(countTr(result!.label)).toBe(2);
    expect(result!.label).not.toContain('(');
  });
});

// ---------------------------------------------------------------------------
// Stereotype → «…» row in the name compartment (not a separate compartment)
// ---------------------------------------------------------------------------

describe('buildClassHtmlLabel — stereotype', () => {
  it('adds a «stereotype» line inside the single name compartment', () => {
    const classifier = makeClassifier({
      id: 'Foo',
      display: 'Foo',
      stereotype: 'Entity',
    });
    const result = buildClassHtmlLabel(classifier, defaultTheme, widthTableMeasurer);
    expect(result).not.toBeNull();
    // No members: bareness is avoided only by the stereotype, so exactly one
    // compartment (name+stereotype) is emitted.
    expect(countTr(result!.label)).toBe(1);
    expect(result!.label).toContain('Foo<BR/>«Entity»');
  });

  it('escapes stereotype text that contains HTML-special characters', () => {
    const classifier = makeClassifier({
      id: 'Foo',
      display: 'Foo',
      stereotype: 'A<B>',
    });
    const result = buildClassHtmlLabel(classifier, defaultTheme, widthTableMeasurer);
    expect(result!.label).toContain('«A&lt;B&gt;»');
  });
});

// ---------------------------------------------------------------------------
// Classifier kind styling
// ---------------------------------------------------------------------------

describe('buildClassHtmlLabel — kind-specific header styling', () => {
  it('italicizes the name for an interface', () => {
    const classifier = makeClassifier({ id: 'Shape', display: 'Shape', kind: 'interface', stereotype: 'x' });
    const result = buildClassHtmlLabel(classifier, defaultTheme, widthTableMeasurer);
    expect(result!.label).toContain('<I>Shape</I>');
  });

  it('italicizes the name for an abstract class', () => {
    const classifier = makeClassifier({ id: 'Shape', display: 'Shape', kind: 'abstract', stereotype: 'x' });
    const result = buildClassHtmlLabel(classifier, defaultTheme, widthTableMeasurer);
    expect(result!.label).toContain('<I>Shape</I>');
  });

  it('prefixes the name with "@" for an annotation', () => {
    const classifier = makeClassifier({ id: 'Ann', display: 'Ann', kind: 'annotation', stereotype: 'x' });
    const result = buildClassHtmlLabel(classifier, defaultTheme, widthTableMeasurer);
    expect(result!.label).toContain('@Ann');
  });
});

// ---------------------------------------------------------------------------
// Static / abstract member styling
// ---------------------------------------------------------------------------

describe('buildClassHtmlLabel — member modifiers', () => {
  it('underlines static members and italicizes abstract members', () => {
    const classifier = makeClassifier({
      id: 'Foo',
      display: 'Foo',
      members: [
        makeMember({ name: 'count', type: 'int', isStatic: true }),
        makeMember({ name: 'run', type: 'void', params: [], isAbstract: true }),
      ],
    });
    const result = buildClassHtmlLabel(classifier, defaultTheme, widthTableMeasurer);
    expect(result!.label).toContain('<U>+ count: int</U>');
    expect(result!.label).toContain('<I>+ run(): void</I>');
  });
});

// ---------------------------------------------------------------------------
// Object-diagram instances — no visibility prefix, "name = value" formatting
// ---------------------------------------------------------------------------

describe('buildClassHtmlLabel — object kind', () => {
  it('formats members as "name = value" without a visibility symbol', () => {
    const classifier = makeClassifier({
      id: 'anObject',
      display: 'anObject',
      kind: 'object',
      members: [makeMember({ name: 'status', type: 'active' })],
    });
    const result = buildClassHtmlLabel(classifier, defaultTheme, widthTableMeasurer);
    expect(result!.label).toContain('status = active');
    expect(result!.label).not.toContain('+ status');
  });
});

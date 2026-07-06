import { describe, it, expect } from 'vitest';
import {
  ALL_TYPES,
  KEYWORD_TO_SYMBOL,
  DESCRIPTIVE_ONLY_KEYWORDS,
  hasDescriptiveSignal,
  hasDescriptiveElement,
} from '../../../src/core/descriptive-keywords.js';
import { classPlugin } from '../../../src/diagrams/class/index.js';
import { descriptionPlugin } from '../../../src/diagrams/description/index.js';

describe('descriptive-keywords — ALL_TYPES / KEYWORD_TO_SYMBOL', () => {
  it('covers the full upstream ALL_TYPES keyword set', () => {
    // Upstream CommandCreateElementFull.ALL_TYPES, in declaration order.
    expect(ALL_TYPES).toEqual([
      'person',
      'artifact',
      'actor/',
      'actor',
      'folder',
      'card',
      'file',
      'package',
      'rectangle',
      'hexagon',
      'label',
      'node',
      'frame',
      'cloud',
      'action',
      'process',
      'database',
      'queue',
      'stack',
      'storage',
      'agent',
      'usecase/',
      'usecase',
      'component',
      'boundary',
      'control',
      'entity',
      'interface',
      'circle',
      'collections',
      'port',
      'portin',
      'portout',
    ]);
  });

  it('maps every keyword to a USymbol', () => {
    for (const keyword of ALL_TYPES) {
      expect(KEYWORD_TO_SYMBOL.has(keyword)).toBe(true);
    }
    expect(KEYWORD_TO_SYMBOL.size).toBe(ALL_TYPES.length);
  });

  it('maps business variants to the -business symbols', () => {
    expect(KEYWORD_TO_SYMBOL.get('actor/')).toBe('actor-business');
    expect(KEYWORD_TO_SYMBOL.get('actor')).toBe('actor');
    expect(KEYWORD_TO_SYMBOL.get('usecase/')).toBe('usecase-business');
    expect(KEYWORD_TO_SYMBOL.get('usecase')).toBe('usecase');
  });

  it('folds portin/portout onto the port symbol', () => {
    expect(KEYWORD_TO_SYMBOL.get('port')).toBe('port');
    expect(KEYWORD_TO_SYMBOL.get('portin')).toBe('port');
    expect(KEYWORD_TO_SYMBOL.get('portout')).toBe('port');
  });
});

describe('descriptive-keywords — DESCRIPTIVE_ONLY_KEYWORDS (D3)', () => {
  it.each(['node', 'cloud', 'usecase', 'rectangle'])(
    '%s is a known symbol and descriptive-only',
    (keyword) => {
      expect(KEYWORD_TO_SYMBOL.has(keyword)).toBe(true);
      expect(DESCRIPTIVE_ONLY_KEYWORDS.has(keyword)).toBe(true);
    },
  );

  it.each(['interface', 'package', 'actor'])(
    '%s is a known symbol but NOT descriptive-only',
    (keyword) => {
      expect(KEYWORD_TO_SYMBOL.has(keyword)).toBe(true);
      expect(DESCRIPTIVE_ONLY_KEYWORDS.has(keyword)).toBe(false);
    },
  );

  it('excludes exactly interface, package, and actor from ALL_TYPES', () => {
    expect(DESCRIPTIVE_ONLY_KEYWORDS.size).toBe(ALL_TYPES.length - 3);
    // The business actor `actor/` stays descriptive-only.
    expect(DESCRIPTIVE_ONLY_KEYWORDS.has('actor/')).toBe(true);
  });
});

describe('descriptive-keywords — hasDescriptiveSignal', () => {
  it('fires on a paren shorthand even when paired with bare actor', () => {
    expect(hasDescriptiveSignal(['actor Bob', '(Login)'])).toBe(true);
  });

  it('fires on a component bracket shorthand', () => {
    expect(hasDescriptiveSignal(['[Comp]'])).toBe(true);
  });

  it('fires on the empty () interface shorthand', () => {
    expect(hasDescriptiveSignal(['() Foo'])).toBe(true);
  });

  it.each(['node Server', 'cloud "AWS"', 'usecase UC1', 'rectangle r', 'actor/ Biz'])(
    'fires on descriptive-only keyword line: %s',
    (line) => {
      expect(hasDescriptiveSignal([line])).toBe(true);
    },
  );

  it('does not fire on a pure class block', () => {
    expect(hasDescriptiveSignal(['class Foo', 'Foo : x'])).toBe(false);
  });

  it('does not fire on bare actor + messages (sequence)', () => {
    expect(hasDescriptiveSignal(['actor Bob', 'Bob -> Alice : hi'])).toBe(false);
  });

  it('does not fire on a pure interface/package block', () => {
    expect(hasDescriptiveSignal(['interface Drawable', 'package p {}'])).toBe(
      false,
    );
  });

  it('does not treat a keyword prefix as a match (node vs nodes)', () => {
    expect(hasDescriptiveSignal(['nodes are here'])).toBe(false);
  });

  it('only scans the first 20 lines', () => {
    const padding = Array.from({ length: 20 }, (_, i) => `note line ${i}`);
    expect(hasDescriptiveSignal([...padding, 'node Late'])).toBe(false);
  });
});

describe('descriptive-keywords — association-class couple exclusion (T5b)', () => {
  // Upstream CommandLinkClass's COUPLE grammar: `(A,B) <arrow>` is a
  // classdiagram association-class endpoint reference, not the descdiagram
  // `(Use Case)` shorthand — a comma-separated pair immediately followed by
  // an arrow must NOT be a descriptive signal.
  it.each(['(A,B) .. R1', '(A,B) - X', '(ClassA,ClassB)--R'])(
    'does not fire on the association-class couple: %s',
    (line) => {
      expect(hasDescriptiveSignal([line])).toBe(false);
      expect(hasDescriptiveElement([line])).toBe(false);
    },
  );

  it('still fires on a genuine single-phrase use-case shorthand', () => {
    expect(hasDescriptiveSignal(['(Use Case)'])).toBe(true);
    expect(hasDescriptiveElement(['(Use Case)'])).toBe(true);
  });

  it('still fires on a comma-bearing phrase with no trailing arrow', () => {
    // A single descriptive phrase that happens to contain a comma, but is
    // not followed by an arrow, is not the association-class couple.
    expect(hasDescriptiveSignal(['(Login, Logout)'])).toBe(true);
  });

  it('routes the association-class fixture to the class engine', () => {
    const lines = ['class R1', 'class R2', 'A-B', '(A,B) .. R1', 'R2 .. (A,B)'];
    expect(classPlugin.accepts(lines)).toBe(true);
    expect(descriptionPlugin.accepts(lines)).toBe(false);
  });

  it('still routes a bare use-case shorthand to the description engine', () => {
    const lines = ['(Use Case)'];
    expect(classPlugin.accepts(lines)).toBe(false);
    expect(descriptionPlugin.accepts(lines)).toBe(true);
  });
});

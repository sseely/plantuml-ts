import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { Classifier } from '../../../src/diagrams/class/ast.js';

// ---------------------------------------------------------------------------
// Fix A: parseIdDisplay's `as` alias forms
//
// Upstream (command/NameAndCodeParser.java:52-67,
// nameAndCodeForClassWithGeneric) recognizes exactly two `as`-alias forms —
// the display side is ALWAYS quoted:
//   1. `"DISPLAY" as CODE`
//   2. `CODE as "DISPLAY"`
// Bareword-both-sides (`class Foo as Bar`) is a SYNTAX ERROR upstream
// (live-oracle-verified: renders "Syntax Error?"); see parser.test.ts's
// "unquoted alias (bareword-both-sides leniency)" describe block for our
// deliberate backward-compat divergence on that invalid form.
// ---------------------------------------------------------------------------

function parse(source: string): ReturnType<typeof parseClass> {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

function firstClassifier(source: string): Classifier {
  const ast = parse(source);
  const c = ast.classifiers[0];
  if (c === undefined) throw new Error('Expected at least one classifier');
  return c;
}

describe('classifier — `"DISPLAY" as CODE` (quoted-display-first)', () => {
  it('class "Display One" as Code1 → id=Code1, display=Display One', () => {
    const c = firstClassifier('class "Display One" as Code1');
    expect(c.id).toBe('Code1');
    expect(c.display).toBe('Display One');
  });

  it('interface "I Base" as IB → id=IB, display=I Base', () => {
    const c = firstClassifier('interface "I Base" as IB');
    expect(c.id).toBe('IB');
    expect(c.display).toBe('I Base');
  });
});

describe('classifier — `CODE as "DISPLAY"` (quoted-display-second)', () => {
  it('class Code1 as "Display One" → id=Code1, display=Display One', () => {
    const c = firstClassifier('class Code1 as "Display One"');
    expect(c.id).toBe('Code1');
    expect(c.display).toBe('Display One');
  });

  it('interface IB as "I Base" → id=IB, display=I Base', () => {
    const c = firstClassifier('interface IB as "I Base"');
    expect(c.id).toBe('IB');
    expect(c.display).toBe('I Base');
  });

  it('single-word quoted display: class Code1 as "Display" → id=Code1, display=Display', () => {
    // Regression guard: a single-word quoted display (no internal space)
    // also matches \S+, so it must not be misassigned by the bareword
    // fallback — this was the exact form that motivated Fix A
    // (besepi-37-rori892, begico-70-guva302).
    const c = firstClassifier('class Code1 as "Display"');
    expect(c.id).toBe('Code1');
    expect(c.display).toBe('Display');
  });
});

// ---------------------------------------------------------------------------
// Fix D: `scale` directive must be ignored, not parsed as a relationship.
//
// Upstream's CommandScale + siblings (CommandScaleWidthAndHeight, ...) are
// registered globally via CommonCommands.java — structurally inert for class
// diagrams. Without the ignore rule, `scale .5` tokenizes as a phantom
// classifier chain (`scale`, `.->`, `5`) plus a minlen-0 edge
// (corine-48-pemu761).
// ---------------------------------------------------------------------------

describe('classifier — `scale` directive is ignored', () => {
  it('scale .5 produces no classifiers and no relationships', () => {
    const ast = parse('class A\nscale .5\nclass B');
    expect(ast.classifiers.map((c) => c.id)).toEqual(['A', 'B']);
    expect(ast.relationships).toEqual([]);
  });

  it('scale 200*100 (width*height form) is ignored', () => {
    const ast = parse('class A\nscale 200*100\nclass B');
    expect(ast.classifiers.map((c) => c.id)).toEqual(['A', 'B']);
    expect(ast.relationships).toEqual([]);
  });

  it('scale 200 width (single-dimension form) is ignored', () => {
    const ast = parse('class A\nscale 200 width\nclass B');
    expect(ast.classifiers.map((c) => c.id)).toEqual(['A', 'B']);
    expect(ast.relationships).toEqual([]);
  });

  it('scale max 300*200 (max-clamped form) is ignored', () => {
    const ast = parse('class A\nscale max 300*200\nclass B');
    expect(ast.classifiers.map((c) => c.id)).toEqual(['A', 'B']);
    expect(ast.relationships).toEqual([]);
  });
});

/**
 * Feature family: transition arrow grammar beyond the plain `A --> B` case —
 * reverse arrows (`<--`), direction abbreviations, cross-start/circle-end
 * decorations, `[style]` brackets, and link stereotypes. T2 gaps against
 * CommandLinkState / CommandLinkStateReverse / CommandLinkStateCommon.
 */
import { describe, it, expect } from 'vitest';
import { parseState } from '../../../src/diagrams/state/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { StateDiagramAST, Transition } from '../../../src/diagrams/state/ast.js';

function parse(source: string): StateDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'state' };
  return parseState(block);
}

function findTransition(ast: StateDiagramAST, from: string, to: string): Transition | undefined {
  return ast.transitions.find((t) => t.from === from && t.to === to);
}

// ---------------------------------------------------------------------------
// Reverse arrow `<--` — previously unparseable (no rule matched it at all)
// ---------------------------------------------------------------------------

describe('reverse arrow transitions (A <-- B)', () => {
  it('A <-- B is semantically equivalent to B --> A', () => {
    const ast = parse('A <-- B');
    expect(findTransition(ast, 'B', 'A')).toBeDefined();
    expect(findTransition(ast, 'A', 'B')).toBeUndefined();
  });

  it('reverse arrow with a label', () => {
    const ast = parse('Active <-- [*] : start');
    const t = findTransition(ast, '[*]', 'Active');
    expect(t?.label).toBe('start');
  });

  it('reverse arrow auto-creates both endpoint states', () => {
    const ast = parse('X <-- Y');
    expect(ast.states.map((s) => s.id).sort()).toEqual(['X', 'Y']);
  });

  it('reverse arrow with no explicit direction defaults to direction=left', () => {
    const ast = parse('A <-- B');
    const t = findTransition(ast, 'B', 'A');
    expect(t?.direction).toBe('left');
  });
});

// ---------------------------------------------------------------------------
// Direction abbreviations
// ---------------------------------------------------------------------------

describe('transition direction abbreviations', () => {
  const cases: Array<[string, string]> = [
    ['-right->', 'right'],
    ['-r->', 'right'],
    ['-left->', 'left'],
    ['-l->', 'left'],
    ['-up->', 'up'],
    ['-u->', 'up'],
    ['-down->', 'down'],
    ['-d->', 'down'],
  ];

  for (const [arrow, expectedDirection] of cases) {
    it(`A ${arrow} B resolves direction=${expectedDirection}`, () => {
      const ast = parse(`A ${arrow} B`);
      const t = findTransition(ast, 'A', 'B');
      expect(t?.direction).toBe(expectedDirection);
    });
  }

  it('a plain --> has no direction field', () => {
    const ast = parse('A --> B');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.direction).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Cross-start / circle-end decorations
// ---------------------------------------------------------------------------

describe('transition decorations — cross-start and circle-end', () => {
  it('A x--> B sets crossStart=true', () => {
    const ast = parse('A x--> B');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.crossStart).toBe(true);
  });

  it('A -->o B sets circleEnd=true', () => {
    const ast = parse('A -->o B');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.circleEnd).toBe(true);
  });

  it('a plain --> has neither decoration', () => {
    const ast = parse('A --> B');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.crossStart).toBeUndefined();
    expect(t?.circleEnd).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// [style] brackets
// ---------------------------------------------------------------------------

describe('transition [style] bracket', () => {
  it('A -[dotted]-> B captures arrowStyle="dotted"', () => {
    const ast = parse('A -[dotted]-> B');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.arrowStyle).toBe('dotted');
  });

  it('A -[#red]-> B captures a color arrowStyle', () => {
    const ast = parse('A -[#red]-> B');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.arrowStyle).toBe('#red');
  });
});

// ---------------------------------------------------------------------------
// Link stereotype
// ---------------------------------------------------------------------------

describe('transition stereotype', () => {
  it('A --> B <<sync>> captures stereotype="sync"', () => {
    const ast = parse('A --> B <<sync>>');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.stereotype).toBe('sync');
  });

  it('stereotype and label can combine', () => {
    const ast = parse('A --> B <<sync>> : go');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.stereotype).toBe('sync');
    expect(t?.label).toBe('go');
  });
});

// ---------------------------------------------------------------------------
// Arrow length (dash count) — feeds T3/T4's minlen calculation
// ---------------------------------------------------------------------------

describe('transition arrow length', () => {
  it('plain --> has length=2', () => {
    const ast = parse('A --> B');
    expect(findTransition(ast, 'A', 'B')?.length).toBe(2);
  });

  it('a longer arrow ---> has length=3', () => {
    const ast = parse('A ---> B');
    expect(findTransition(ast, 'A', 'B')?.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Dispatch gate false positive — a line containing '<'/'>' that is not a
// valid transition (and matched no earlier rule) is silently ignored rather
// than crashing or emitting a bogus transition.
// ---------------------------------------------------------------------------

describe('transition dispatch gate false positive', () => {
  it('a bare stray <<tag>> line (no dashes at all) is silently ignored', () => {
    const ast = parse(`
      A --> B
      <<orphan>>
    `);
    expect(ast.transitions).toHaveLength(1);
    expect(ast.states.map((s) => s.id).sort()).toEqual(['A', 'B']);
  });
});

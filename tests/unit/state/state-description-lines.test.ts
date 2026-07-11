/**
 * Feature family: state body/description lines (`State : text`) — both the
 * inline form on `state X : text` (CommandCreateState's ADDFIELD group) and
 * the standalone `CODE : text` form (CommandAddField). T2 gap: the
 * pre-existing parser had no way to attach body text to a state at all.
 */
import { describe, it, expect } from 'vitest';
import { parseState } from '../../../src/diagrams/state/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { StateDiagramAST, State } from '../../../src/diagrams/state/ast.js';

function parse(source: string): StateDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'state' };
  return parseState(block);
}

function findState(ast: StateDiagramAST, id: string): State | undefined {
  return ast.states.find((s) => s.id === id);
}

// ---------------------------------------------------------------------------
// Inline form: state X : text
// ---------------------------------------------------------------------------

describe('inline description on state declaration', () => {
  it('state Active : some text sets description=["some text"]', () => {
    const ast = parse('state Active : some text');
    expect(findState(ast, 'Active')?.description).toEqual(['some text']);
  });

  it('a plain state declaration with no colon has no description field', () => {
    const ast = parse('state Idle');
    expect(findState(ast, 'Idle')?.description).toBeUndefined();
  });

  it('inline description combines with a color', () => {
    const ast = parse('state Active #pink : text after color');
    const s = findState(ast, 'Active');
    expect(s?.color).toBe('#pink');
    expect(s?.description).toEqual(['text after color']);
  });
});

// ---------------------------------------------------------------------------
// Standalone form: CODE : text
// ---------------------------------------------------------------------------

describe('standalone description line (CommandAddField)', () => {
  it('CODE : text auto-creates the state if it does not exist yet', () => {
    const ast = parse('Active : auto-created description');
    const s = findState(ast, 'Active');
    expect(s).toBeDefined();
    expect(s?.description).toEqual(['auto-created description']);
  });

  it('multiple description lines accumulate in source order', () => {
    const ast = parse(`
      state Active
      Active : first line
      Active : second line
    `);
    expect(findState(ast, 'Active')?.description).toEqual(['first line', 'second line']);
  });

  it('a standalone description line does not duplicate an existing state', () => {
    const ast = parse(`
      A --> B
      B : description for B
    `);
    const copies = ast.states.filter((s) => s.id === 'B');
    expect(copies).toHaveLength(1);
    expect(copies[0]?.description).toEqual(['description for B']);
  });

  it('a composite state can self-reference its own name for a description line', () => {
    const ast = parse(`
      state Outer {
        Outer : composite-level description
        A --> B
      }
    `);
    const outer = findState(ast, 'Outer');
    expect(outer?.description).toEqual(['composite-level description']);
    // Self-reference must not create a duplicate nested "Outer" child.
    expect(outer?.children.map((c) => c.id)).toEqual(['A', 'B']);
  });

  it('quoted CODE resolves to the same id as a quoted-only declaration', () => {
    const ast = parse(`
      state "Long Name"
      "Long Name" : described
    `);
    const s = findState(ast, 'Long Name');
    expect(s?.description).toEqual(['described']);
  });
});

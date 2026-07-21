/**
 * Feature family: notes-on-state — attached (single-line and multi-line,
 * with/without the `{`/`}` bracket form), freestanding, and `note on link`.
 * T2 gap: the pre-existing parser swallowed every `note` line via the
 * generic ignore rule; this is a from-scratch port of
 * CommandFactoryNoteOnEntity / CommandFactoryNote / CommandFactoryNoteOnLink
 * for the state engine.
 */
import { describe, it, expect } from 'vitest';
import { parseState } from '../../../src/diagrams/state/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { StateDiagramAST } from '../../../src/diagrams/state/ast.js';

function parse(source: string): StateDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'state' };
  return parseState(block);
}

// ---------------------------------------------------------------------------
// Single-line attached notes
// ---------------------------------------------------------------------------

describe('single-line attached note', () => {
  it('note left of A : text attaches to A with position=left', () => {
    const ast = parse('A --> B\nnote left of A : a note');
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes?.[0]).toMatchObject({ target: 'A', position: 'left', text: 'a note' });
  });

  it('note with no "of <State>" falls back to lastEntity', () => {
    const ast = parse('A --> B\nnote right : trailing note');
    expect(ast.notes?.[0]).toMatchObject({ target: 'B', position: 'right', implicitTarget: true });
  });

  it('a bare note with no lastEntity is silently dropped', () => {
    const ast = parse('note top : orphan note');
    expect(ast.notes).toHaveLength(0);
  });

  it('explicit "of <State>" does not set implicitTarget', () => {
    const ast = parse('A --> B\nnote left of A : text');
    expect(ast.notes?.[0]?.implicitTarget).toBeUndefined();
  });

  it('quoted note target', () => {
    const ast = parse('state \'My State\' as MS\nnote bottom of MS : quoted target note');
    expect(ast.notes?.[0]?.target).toBe('MS');
  });
});

// ---------------------------------------------------------------------------
// Multi-line attached notes (end note / bracket forms)
// ---------------------------------------------------------------------------

describe('multi-line attached note', () => {
  it('note <pos> of <State> ... end note accumulates lines with newlines', () => {
    const ast = parse(`
      A --> B
      note right of B
        line one
        line two
      end note
    `);
    expect(ast.notes?.[0]).toMatchObject({ target: 'B', position: 'right', text: 'line one\nline two' });
  });

  it('note <pos> of <State> { ... } bracket form closes with a bare }', () => {
    const ast = parse(`
      A --> B
      note left of A {
        bracketed note
      }
    `);
    expect(ast.notes?.[0]).toMatchObject({ target: 'A', text: 'bracketed note' });
  });

  it('a } inside a bracket-note block does not close an enclosing composite', () => {
    const ast = parse(`
      state Outer {
        A --> B
        note left of A {
          inner note
        }
      }
    `);
    const outer = ast.states.find((s) => s.id === 'Outer');
    expect(outer?.children.map((c) => c.id)).toEqual(['A', 'B']);
    expect(ast.notes?.[0]?.text).toBe('inner note');
  });
});

// ---------------------------------------------------------------------------
// Freestanding notes
// ---------------------------------------------------------------------------

describe('freestanding notes', () => {
  it('note "text" as N1 creates an unattached note immediately', () => {
    const ast = parse('note "hi there" as N1');
    expect(ast.notes?.[0]).toEqual({ id: 'N1', text: 'hi there', scopeId: '', creationIndex: 1 });
  });

  it('note as N1 ... end note accumulates multi-line text', () => {
    const ast = parse(`
      note as N2
        multi
        line
      end note
    `);
    expect(ast.notes?.[0]).toMatchObject({ id: 'N2', text: 'multi\nline' });
  });

  it('a freestanding note has no target/position fields', () => {
    const ast = parse('note "hi" as N1');
    expect(ast.notes?.[0]?.target).toBeUndefined();
    expect(ast.notes?.[0]?.position).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// note on link
// ---------------------------------------------------------------------------

describe('note on link', () => {
  it('note on link : text attaches to the last-parsed transition', () => {
    const ast = parse('A --> B\nnote on link : the link note');
    expect(ast.transitions.find((t) => t.from === 'A' && t.to === 'B')?.linkNote).toBe('the link note');
  });

  it('note on link scoped inside a composite attaches to the inner transition', () => {
    const ast = parse(`
      state S {
        A --> B
        note on link : inner link note
      }
    `);
    const s = ast.states.find((st) => st.id === 'S');
    expect(s?.transitions[0]?.linkNote).toBe('inner link note');
  });

  it('note on link with no prior transition is a silent no-op', () => {
    const ast = parse('note on link : orphan');
    expect(ast.transitions).toHaveLength(0);
    expect(ast.notes).toHaveLength(0);
  });

  it('note on link : text with no explicit position defaults to bottom', () => {
    const ast = parse('A --> B\nnote on link : bottom by default');
    expect(ast.transitions[0]?.linkNotePosition).toBe('bottom');
  });

  it('note right on link : text captures the explicit position', () => {
    const ast = parse('A --> B\nnote right on link : right side');
    expect(ast.transitions[0]?.linkNote).toBe('right side');
    expect(ast.transitions[0]?.linkNotePosition).toBe('right');
  });

  it('multi-line note on link ... end note accumulates text (fotigo-style)', () => {
    const ast = parse(`
      a --> b
      note on link
      Should be red
      end note
    `);
    expect(ast.transitions[0]?.linkNote).toBe('Should be red');
    expect(ast.transitions[0]?.linkNotePosition).toBe('bottom');
  });

  it('multi-line note right on link ... end note captures position (tumaba-style)', () => {
    const ast = parse(`
      State1 --> State2
      note right on link
      hi1
      end note
    `);
    expect(ast.transitions[0]?.linkNote).toBe('hi1');
    expect(ast.transitions[0]?.linkNotePosition).toBe('right');
  });

  it('multiple note-on-link blocks attach to their own last-parsed transition', () => {
    const ast = parse(`
      a --> b
      note on link
      Should be red
      end note
      a --> c
      note on link
      Should be blue
      end note
    `);
    expect(ast.transitions).toHaveLength(2);
    expect(ast.transitions[0]?.linkNote).toBe('Should be red');
    expect(ast.transitions[1]?.linkNote).toBe('Should be blue');
  });
});

// ---------------------------------------------------------------------------
// Multi-line opener implicit-target fallback
// ---------------------------------------------------------------------------

describe('multi-line note opener with no "of <State>" clause', () => {
  it('falls back to lastEntity, same as the single-line form', () => {
    const ast = parse(`
      A --> B
      note left
        multi-line, no explicit target
      end note
    `);
    expect(ast.notes?.[0]).toMatchObject({ target: 'B', implicitTarget: true });
  });
});

// ---------------------------------------------------------------------------
// Quoted target text, and a target-less multi-line note with no fallback
// ---------------------------------------------------------------------------

describe('quoted note target text and unresolvable multi-line notes', () => {
  it('a quoted "of" target strips its surrounding quotes', () => {
    const ast = parse('A --> B\nnote left of "Quoted State" : text');
    expect(ast.notes?.[0]?.target).toBe('Quoted State');
  });

  it('a multi-line note with no "of" clause and no lastEntity is dropped', () => {
    const ast = parse(`
      note left
        orphan multi-line note
      end note
    `);
    expect(ast.notes).toHaveLength(0);
  });
});

/**
 * Unit tests for `state-note-layout.ts`'s pure grouping/rotation logic
 * (mission A4 Phase L iter 9) — the two branches
 * `state-note-attached-dot.test.ts`'s fixture-driven tests don't exercise
 * (no fixture in this corpus's note set uses `left to right direction` or
 * genuine same-side/same-host merging):
 *   - `Position.withRankdir` LR rotation (utils/Position.java:49-66).
 *   - same-scope/same-host/same-side EXPLICIT-target notes merge into ONE
 *     DOT node (mirrors class engine's `NoteGroup` — see note-layout.ts's
 *     doc for the class precedent, zepeki-75-pifo352).
 */
import { describe, it, expect } from 'vitest';
import type { StateNote } from '../../../src/diagrams/state/ast.js';
import { buildNoteGraphPartsByScope, sweepOrphanNoteEdges } from '../../../src/diagrams/state/state-note-layout.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';

const measurer = new WidthTableMeasurer();

function note(overrides: Partial<StateNote> & Pick<StateNote, 'id' | 'text' | 'scopeId'>): StateNote {
  return overrides;
}

describe('buildNoteGraphPartsByScope — LR rotation', () => {
  it('rotates right->bottom under left to right direction (minlen stays 1, not 0)', () => {
    const notes: StateNote[] = [
      note({ id: '__note_0', target: 'X', position: 'right', text: 'hi', scopeId: '' }),
    ];
    const parts = buildNoteGraphPartsByScope(notes, defaultTheme, measurer, 'LR').get('')!;
    expect(parts.candidates).toHaveLength(1);
    // right -> bottom under LR: fromNote=false, minLen=1 (bottom's row, not right's).
    expect(parts.candidates[0]).toMatchObject({ fromNote: false, minLen: 1 });
  });

  it('rotates left->top under left to right direction (fromNote stays true, minlen becomes 1)', () => {
    const notes: StateNote[] = [
      note({ id: '__note_0', target: 'X', position: 'left', text: 'hi', scopeId: '' }),
    ];
    const parts = buildNoteGraphPartsByScope(notes, defaultTheme, measurer, 'LR').get('')!;
    expect(parts.candidates[0]).toMatchObject({ fromNote: true, minLen: 1 });
  });

  it('TB (default) leaves right/left minlen at 0 — no rotation', () => {
    const notes: StateNote[] = [
      note({ id: '__note_0', target: 'X', position: 'right', text: 'hi', scopeId: '' }),
    ];
    const parts = buildNoteGraphPartsByScope(notes, defaultTheme, measurer, 'TB').get('')!;
    expect(parts.candidates[0]).toMatchObject({ fromNote: false, minLen: 0 });
  });
});

describe('buildNoteGraphPartsByScope — same-scope/same-host/same-side merging', () => {
  it('two explicit-target notes on the same side of the same host merge into ONE node', () => {
    const notes: StateNote[] = [
      note({ id: '__note_0', target: 'X', position: 'right', text: 'first', scopeId: '' }),
      note({ id: '__note_1', target: 'X', position: 'right', text: 'second', scopeId: '' }),
    ];
    const parts = buildNoteGraphPartsByScope(notes, defaultTheme, measurer, 'TB').get('')!;
    expect(parts.nodes).toHaveLength(1);
    expect(parts.candidates).toHaveLength(1);
    expect(parts.nodes[0]!.id).toBe('__note_0');
  });

  it('an implicit-target note never merges, even onto the same (host, side)', () => {
    const notes: StateNote[] = [
      note({ id: '__note_0', target: 'X', position: 'right', text: 'explicit', scopeId: '' }),
      note({
        id: '__note_1',
        target: 'X',
        position: 'right',
        implicitTarget: true,
        text: 'implicit',
        scopeId: '',
      }),
    ];
    const parts = buildNoteGraphPartsByScope(notes, defaultTheme, measurer, 'TB').get('')!;
    expect(parts.nodes).toHaveLength(2);
    expect(parts.candidates).toHaveLength(2);
  });

  it('notes on the same host but different sides never merge', () => {
    const notes: StateNote[] = [
      note({ id: '__note_0', target: 'X', position: 'right', text: 'r', scopeId: '' }),
      note({ id: '__note_1', target: 'X', position: 'left', text: 'l', scopeId: '' }),
    ];
    const parts = buildNoteGraphPartsByScope(notes, defaultTheme, measurer, 'TB').get('')!;
    expect(parts.nodes).toHaveLength(2);
  });

  it('notes in different declaring scopes never merge, even matching host+side', () => {
    const notes: StateNote[] = [
      note({ id: '__note_0', target: 'X', position: 'right', text: 'outer', scopeId: '' }),
      note({ id: '__note_1', target: 'X', position: 'right', text: 'inner', scopeId: 'Composite' }),
    ];
    const byScope = buildNoteGraphPartsByScope(notes, defaultTheme, measurer, 'TB');
    expect(byScope.get('')!.nodes).toHaveLength(1);
    expect(byScope.get('Composite')!.nodes).toHaveLength(1);
  });
});

describe('sweepOrphanNoteEdges — opportunistic per-pass attach', () => {
  it('drops a candidate whose host resolves to a node absent from EVERY pass', () => {
    const notes: StateNote[] = [
      note({ id: '__note_0', target: 'GhostHost', position: 'right', text: 'x', scopeId: '' }),
    ];
    const parts = buildNoteGraphPartsByScope(notes, defaultTheme, measurer, 'TB').get('')!;
    const acc = { nodes: [{ id: '__note_0' }], edges: [] as { id: string; from: string; to: string }[] };
    const consumed = new Set<(typeof parts.candidates)[number]>();
    sweepOrphanNoteEdges(acc, parts.candidates, consumed, (id) => id);
    expect(acc.edges).toHaveLength(0);
    expect(consumed.size).toBe(0);
  });

  it('a candidate already consumed at an earlier pass is skipped on a later sweep', () => {
    const notes: StateNote[] = [
      note({ id: '__note_0', target: 'X', position: 'right', text: 'x', scopeId: '' }),
    ];
    const parts = buildNoteGraphPartsByScope(notes, defaultTheme, measurer, 'TB').get('')!;
    const acc = { nodes: [{ id: '__note_0' }, { id: 'X' }], edges: [] as { id: string; from: string; to: string }[] };
    const consumed = new Set<(typeof parts.candidates)[number]>();
    sweepOrphanNoteEdges(acc, parts.candidates, consumed, (id) => id);
    expect(acc.edges).toHaveLength(1);
    // Second sweep (mirrors a later pass sharing the same ctx.consumedNotes)
    // must not add a duplicate edge — the candidate is already consumed.
    sweepOrphanNoteEdges(acc, parts.candidates, consumed, (id) => id);
    expect(acc.edges).toHaveLength(1);
  });
});


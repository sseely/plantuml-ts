import { describe, it, expect } from 'vitest';
import { buildNoteGraphParts } from '../../../src/diagrams/class/note-layout.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import type { ClassNote, NotePosition } from '../../../src/diagrams/class/ast.js';

const measurer = new FormulaMeasurer();
const note = (position: NotePosition): ClassNote => ({
  id: '__note_0',
  target: 'A',
  position,
  text: 'hello',
});

const noAnchors = new Map<string, string>();

describe('buildNoteGraphParts — seam node + connector edge', () => {
  it('emits one sized note node and one connector edge', () => {
    const { nodes, edges, measurements } = buildNoteGraphParts(
      [note('left')],
      defaultTheme,
      measurer,
      noAnchors,
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.id).toBe('__note_0');
    expect(nodes[0]!.width).toBeGreaterThan(0);
    expect(nodes[0]!.height).toBeGreaterThan(0);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.id).toBe('__noteedge___note_0');
    expect(measurements.get('__note_0')?.lines).toEqual(['hello']);
  });

  it('directs the edge and sets minLen per position (Svek note-on-entity)', () => {
    const dir = (p: NotePosition) => {
      const e = buildNoteGraphParts([note(p)], defaultTheme, measurer, noAnchors).edges[0]!;
      return { from: e.from, to: e.to, minLen: e.attributes?.minLen };
    };
    expect(dir('left')).toEqual({ from: '__note_0', to: 'A', minLen: 0 });
    expect(dir('right')).toEqual({ from: 'A', to: '__note_0', minLen: 0 });
    expect(dir('top')).toEqual({ from: '__note_0', to: 'A', minLen: 1 });
    expect(dir('bottom')).toEqual({ from: 'A', to: '__note_0', minLen: 1 });
  });

  it('splits multi-line note text into render lines', () => {
    const n: ClassNote = { id: '__note_0', target: 'A', position: 'top', text: 'l1\nl2\nl3' };
    const { measurements } = buildNoteGraphParts([n], defaultTheme, measurer, noAnchors);
    expect(measurements.get('__note_0')?.lines).toEqual(['l1', 'l2', 'l3']);
  });
});

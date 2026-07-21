/**
 * Unit tests for `renderer-note.ts` (mission G4 S10 — "notes never render").
 * Fixture-level coverage lives in the golden ratchet
 * (`state.golden.ratchet.test.ts`, `labono-83-nega255`/`gedude-95-subi666`/
 * `pexuve-81-suxi717`/`xodazu-26-cube992`) — these tests isolate the two
 * PURE pieces that ratchet only exercises indirectly: geo materialization
 * (`buildFlatNoteGeos`) and the two render shapes
 * (`renderStateNoteFreestanding`/`renderStateNoteOpale`), including branches
 * no single fixture reaches on its own (a note absent from `posMap`, an
 * attached note whose connector edge never resolves).
 */
import { describe, it, expect } from 'vitest';
import type { StateDiagramAST, StateNote } from '../../../src/diagrams/state/ast.js';
import {
  buildFlatNoteGeos,
  renderStateNote,
  renderStateNoteFreestanding,
  renderStateNoteOpale,
  type FlatNoteGeoCtx,
} from '../../../src/diagrams/state/renderer-note.js';
import type { StateNodeGeo } from '../../../src/diagrams/state/state-geo-types.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';

const measurer = new WidthTableMeasurer();

function note(overrides: Partial<StateNote> & Pick<StateNote, 'id' | 'text' | 'scopeId'>): StateNote {
  return overrides;
}

function ctx(overrides: Partial<FlatNoteGeoCtx> = {}): FlatNoteGeoCtx {
  return {
    posMap: new Map(),
    edgePosMap: new Map(),
    theme: defaultTheme,
    measurer,
    ...overrides,
  };
}

describe('buildFlatNoteGeos', () => {
  it('materializes a freestanding note as a kind:"note" StateNodeGeo with no noteOpale', () => {
    const ast: StateDiagramAST = {
      states: [],
      transitions: [],
      notes: [note({ id: 'N1', text: 'hi there', scopeId: '', creationIndex: 3 })],
    };
    const posMap = new Map([['N1', { id: 'N1', x: 10, y: 20, width: 100, height: 30 }]]);
    const geos = buildFlatNoteGeos(ast, ctx({ posMap }));
    expect(geos).toHaveLength(1);
    expect(geos[0]).toMatchObject({
      id: 'N1',
      kind: 'note',
      x: 10,
      y: 20,
      width: 100,
      height: 30,
      creationIndex: 3,
    });
    expect(geos[0]!.noteOpale).toBeUndefined();
    expect(geos[0]!.noteLines).toEqual([{ text: 'hi there', width: expect.any(Number) as number }]);
  });

  it('skips a composite-scoped note entirely (scopeId !== "") — flat pipeline only this iteration', () => {
    const ast: StateDiagramAST = {
      states: [],
      transitions: [],
      notes: [note({ id: 'N1', text: 'inner', scopeId: 'Composite' })],
    };
    const posMap = new Map([['N1', { id: 'N1', x: 0, y: 0, width: 10, height: 10 }]]);
    expect(buildFlatNoteGeos(ast, ctx({ posMap }))).toHaveLength(0);
  });

  it('skips a note absent from posMap (no own DOT-layout position)', () => {
    const ast: StateDiagramAST = { states: [], transitions: [], notes: [note({ id: 'N1', text: 'x', scopeId: '' })] };
    expect(buildFlatNoteGeos(ast, ctx())).toHaveLength(0);
  });

  it('an attached note with a resolved connector edge gets noteOpale', () => {
    const ast: StateDiagramAST = {
      states: [],
      transitions: [],
      notes: [note({ id: '__note_0', target: 'X', position: 'left', text: 'hi', scopeId: '' })],
    };
    const posMap = new Map([['__note_0', { id: '__note_0', x: 0, y: 0, width: 60, height: 30 }]]);
    const edgePosMap = new Map([
      ['__noteedge___note_0', { id: '__noteedge___note_0', points: [{ x: 0, y: 15 }, { x: 100, y: 15 }] }],
    ]);
    const geos = buildFlatNoteGeos(ast, ctx({ posMap, edgePosMap }));
    expect(geos).toHaveLength(1);
    expect(geos[0]!.noteOpale).toBeDefined();
    expect(geos[0]!.noteOpale!.direction).toBe('left');
  });

  it('an attached note whose connector edge never resolves falls back to no noteOpale', () => {
    const ast: StateDiagramAST = {
      states: [],
      transitions: [],
      notes: [note({ id: '__note_0', target: 'X', position: 'left', text: 'hi', scopeId: '' })],
    };
    const posMap = new Map([['__note_0', { id: '__note_0', x: 0, y: 0, width: 60, height: 30 }]]);
    // no matching `__noteedge_...` entry in edgePosMap at all.
    const geos = buildFlatNoteGeos(ast, ctx({ posMap }));
    expect(geos[0]!.noteOpale).toBeUndefined();
  });

  it('an ast with no notes array at all produces zero geos', () => {
    const ast: StateDiagramAST = { states: [], transitions: [] };
    expect(buildFlatNoteGeos(ast, ctx())).toHaveLength(0);
  });
});

function baseNoteGeo(overrides: Partial<StateNodeGeo> = {}): StateNodeGeo {
  return {
    id: 'N1',
    kind: 'note',
    display: '',
    x: 10,
    y: 20,
    width: 100,
    height: 30,
    children: [],
    transitions: [],
    noteLines: [{ text: 'hi there', width: 50 }],
    ...overrides,
  };
}

describe('renderStateNoteFreestanding', () => {
  it('draws the main outline path + an ASYMMETRIC-stroke-width corner path (0.5 main, 1 corner)', () => {
    const markup = renderStateNoteFreestanding(baseNoteGeo(), defaultTheme);
    // main outline: M10,20 L10,50 L110,50 L110,30 L100,20 L10,20 (cornersize=10)
    expect(markup).toContain('M10,20 L10,50 L110,50 L110,30 L100,20 L10,20');
    expect(markup).toContain('stroke-width="0.5"');
    expect(markup).toContain('stroke-width="1"');
    expect(markup).toContain('fill="#FEFFDD"');
    expect(markup).toContain('hi there');
  });

  it('draws one <text> per noteLines entry, stacked by NOTE_FONT_SIZE (13)', () => {
    const geo = baseNoteGeo({
      height: 46,
      noteLines: [{ text: 'line one', width: 40 }, { text: 'line two', width: 42 }],
    });
    const markup = renderStateNoteFreestanding(geo, defaultTheme);
    expect(markup).toContain('line one');
    expect(markup).toContain('line two');
    // two distinct y baselines, 13px apart (NOTE_FONT_SIZE).
    const ys = [...markup.matchAll(/y="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(ys[1]! - ys[0]!).toBeCloseTo(13, 5);
  });
});

describe('renderStateNoteOpale', () => {
  it('draws the SAME stroke-width (0.5) on both the outline and corner paths', () => {
    const geo = baseNoteGeo({
      noteOpale: { direction: 'right', pp1: { x: 0, y: 15 }, pp2: { x: 120, y: 15 } },
    });
    const markup = renderStateNoteOpale(geo, defaultTheme);
    const widths = [...markup.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => m[1]);
    expect(widths).toEqual(['0.5', '0.5']);
    expect(markup).toContain('fill="#FEFFDD"');
  });

  it.each(['left', 'right', 'up', 'down'] as const)('dispatches direction %s to its own opale outline fn', (direction) => {
    const geo = baseNoteGeo({ noteOpale: { direction, pp1: { x: 5, y: 5 }, pp2: { x: 50, y: 15 } } });
    expect(() => renderStateNoteOpale(geo, defaultTheme)).not.toThrow();
  });
});

describe('renderStateNote — dispatch', () => {
  it('routes to the opale shape when noteOpale is present', () => {
    const geo = baseNoteGeo({ noteOpale: { direction: 'right', pp1: { x: 0, y: 15 }, pp2: { x: 120, y: 15 } } });
    expect(renderStateNote(geo, defaultTheme)).toBe(renderStateNoteOpale(geo, defaultTheme));
  });

  it('routes to the freestanding shape when noteOpale is absent', () => {
    const geo = baseNoteGeo();
    expect(renderStateNote(geo, defaultTheme)).toBe(renderStateNoteFreestanding(geo, defaultTheme));
  });
});

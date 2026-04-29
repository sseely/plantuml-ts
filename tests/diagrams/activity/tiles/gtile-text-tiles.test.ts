import { describe, it, expect } from 'vitest';
import { GtileAction } from '../../../../src/diagrams/activity/tiles/gtile-action.js';
import { GtileNote } from '../../../../src/diagrams/activity/tiles/gtile-note.js';
import {
  NORTH_HOOK,
  SOUTH_HOOK,
} from '../../../../src/diagrams/activity/tiles/points.js';
import type { StringBounder } from '../../../../src/diagrams/activity/tiles/tile.js';
import type { ActivityAction, ActivityNote } from '../../../../src/diagrams/activity/ast.js';
import type { Theme } from '../../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

const stubBounder: StringBounder = {
  getDimension: (text: string, _size: number) => ({
    width: text.length * 7,
    height: 14,
  }),
};

const stubTheme: Theme = {
  fontSize: 13,
  fontFamily: 'Arial',
  colors: {
    background: '#fff',
    border: '#000',
    text: '#000',
    arrow: '#000',
    note: '#eef',
    noteBackground: '#eef',
    lifeline: '#ccc',
    activation: '#eee',
    frame: '#eee',
    divider: '#eee',
    error: 'red',
    nodeBackground: '#fff',
    graph: {
      classBackground: '#fff',
      interfaceBackground: '#fff',
      enumBackground: '#fff',
      actorStroke: '#000',
      packageBackground: 'none',
      packageBorder: '#000',
      edgeLabel: '#000',
      actorFill: 'none',
      usecaseFill: '#fff',
      businessActorFill: 'none',
      businessUsecaseFill: '#fff',
    },
  },
  sequence: {
    participantPadding: 10,
    participantMinWidth: 80,
    participantGap: 20,
    messageSpacing: 20,
    activationWidth: 10,
    noteMargin: 5,
    frameHeaderHeight: 20,
    lifelineExtension: 20,
  },
};

// ---------------------------------------------------------------------------
// GtileAction tests
// ---------------------------------------------------------------------------

describe('GtileAction', () => {
  it('enforces minimum width of 120 for a short label', () => {
    const node: ActivityAction = { kind: 'action', label: 'Hi' };
    const tile = new GtileAction(node, stubBounder, stubTheme);
    // "Hi" is 2 chars → measured width = 14px; 14 + 2*16 = 46 < 120
    expect(tile.width).toBeGreaterThanOrEqual(120);
  });

  it('uses measured width when label is wide enough', () => {
    const label = 'x'.repeat(30);
    const node: ActivityAction = { kind: 'action', label };
    const tile = new GtileAction(node, stubBounder, stubTheme);
    // 30 chars * 7 = 210px + 2*16 = 242 > 120
    expect(tile.width).toBeGreaterThan(120);
  });

  it('getCoord(NORTH_HOOK) returns top-center', () => {
    const node: ActivityAction = { kind: 'action', label: 'Test action' };
    const tile = new GtileAction(node, stubBounder, stubTheme);
    const coord = tile.getCoord(NORTH_HOOK);
    expect(coord).toEqual({ x: tile.width / 2, y: 0 });
  });

  it('getCoord(SOUTH_HOOK) returns bottom-center', () => {
    const node: ActivityAction = { kind: 'action', label: 'Test action' };
    const tile = new GtileAction(node, stubBounder, stubTheme);
    const coord = tile.getCoord(SOUTH_HOOK);
    expect(coord).toEqual({ x: tile.width / 2, y: tile.height });
  });

  it('stores the label from the AST node', () => {
    const node: ActivityAction = { kind: 'action', label: 'Hi' };
    const tile = new GtileAction(node, stubBounder, stubTheme);
    expect(tile.label).toBe('Hi');
  });

  it('stores the color from the AST node when provided', () => {
    const node: ActivityAction = { kind: 'action', label: 'Hi', color: '#ff0000' };
    const tile = new GtileAction(node, stubBounder, stubTheme);
    expect(tile.color).toBe('#ff0000');
  });

  it('color is undefined when not provided', () => {
    const node: ActivityAction = { kind: 'action', label: 'Hi' };
    const tile = new GtileAction(node, stubBounder, stubTheme);
    expect(tile.color).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GtileNote tests
// ---------------------------------------------------------------------------

describe('GtileNote', () => {
  it('stores the text from the AST node', () => {
    const node: ActivityNote = { kind: 'note', text: 'A note', position: 'left' };
    const tile = new GtileNote(node, stubBounder, stubTheme);
    expect(tile.text).toBe('A note');
  });

  it('stores the side (left)', () => {
    const node: ActivityNote = { kind: 'note', text: 'A note', position: 'left' };
    const tile = new GtileNote(node, stubBounder, stubTheme);
    expect(tile.side).toBe('left');
  });

  it('stores the side (right)', () => {
    const node: ActivityNote = { kind: 'note', text: 'A note', position: 'right' };
    const tile = new GtileNote(node, stubBounder, stubTheme);
    expect(tile.side).toBe('right');
  });

  it('width includes NOTE_FOLD beyond measured width + 2*ACTION_H_PAD', () => {
    // NOTE_FOLD = 8, ACTION_H_PAD = 16
    // text = "A note" (6 chars) → measured width = 42
    // expected minimum width = 42 + 2*16 + 8 = 82
    const node: ActivityNote = { kind: 'note', text: 'A note', position: 'right' };
    const tile = new GtileNote(node, stubBounder, stubTheme);
    const measuredWidth = 'A note'.length * 7; // 42
    expect(tile.width).toBe(measuredWidth + 2 * 16 + 8);
  });
});

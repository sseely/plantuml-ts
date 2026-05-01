import { describe, it, expect } from 'vitest';
import { layoutBoard } from '../../../src/diagrams/board/layout.js';
import type { BoardDiagramAST, BoardNode } from '../../../src/diagrams/board/ast.js';

function node(name: string, stage: number, children: BoardNode[] = []): BoardNode {
  return { name, stage, children };
}

function ast(...activities: Array<{ name: string; root: BoardNode }>): BoardDiagramAST {
  return { activities };
}

describe('layoutBoard', () => {
  it('AC1: root with no children — dx=0, dy=0', () => {
    const root = node('Root', 0);
    const geo = layoutBoard(ast({ name: 'Root', root }));
    const card = geo.activities[0]!.cards[0]!;
    expect(card.dx).toBe(0);
    expect(card.dy).toBe(0);
  });

  it('AC2: root with 1 child — root and child share dx=0', () => {
    const child = node('Child', 1);
    const root = node('Root', 0, [child]);
    const geo = layoutBoard(ast({ name: 'Root', root }));
    const cards = geo.activities[0]!.cards;
    expect(cards.find((c) => c.label === 'Root')!.dx).toBe(0);
    expect(cards.find((c) => c.label === 'Child')!.dx).toBe(0);
  });

  it('AC3: root with 2 children — A.dx=0, B.dx=170', () => {
    const a = node('A', 1);
    const b = node('B', 1);
    const root = node('Root', 0, [a, b]);
    const geo = layoutBoard(ast({ name: 'Root', root }));
    const cards = geo.activities[0]!.cards;
    expect(cards.find((c) => c.label === 'A')!.dx).toBe(0);
    expect(cards.find((c) => c.label === 'B')!.dx).toBe(170);
  });

  it('AC4: linear chain Root→A→B all share dx=0', () => {
    const b = node('B', 2);
    const a = node('A', 1, [b]);
    const root = node('Root', 0, [a]);
    const geo = layoutBoard(ast({ name: 'Root', root }));
    for (const card of geo.activities[0]!.cards) {
      expect(card.dx).toBe(0);
    }
  });

  it('AC5: root→[A→[P,Q],B] — P.dx=0, Q.dx=170, B.dx=340', () => {
    const p = node('P', 2);
    const q = node('Q', 2);
    const a = node('A', 1, [p, q]);
    const b = node('B', 1);
    const root = node('Root', 0, [a, b]);
    const geo = layoutBoard(ast({ name: 'Root', root }));
    const cards = geo.activities[0]!.cards;
    expect(cards.find((c) => c.label === 'P')!.dx).toBe(0);
    expect(cards.find((c) => c.label === 'Q')!.dx).toBe(170);
    expect(cards.find((c) => c.label === 'B')!.dx).toBe(340);
  });

  it('AC6: activity with maxX=5 has fullWidth=1020', () => {
    const children = ['A', 'B', 'C', 'D', 'E', 'F'].map((n) => node(n, 1));
    const root = node('Root', 0, children);
    const geo = layoutBoard(ast({ name: 'Root', root }));
    expect(geo.activities[0]!.fullWidth).toBe(1020);
  });

  it('AC7: two activities have correct xOffsets', () => {
    const root1 = node('A', 0);
    const root2 = node('B', 0, [node('C', 1), node('D', 1)]);
    const geo = layoutBoard(ast({ name: 'A', root: root1 }, { name: 'B', root: root2 }));
    expect(geo.activities[0]!.xOffset).toBe(0);
    expect(geo.activities[1]!.xOffset).toBe(170);
  });

  it('AC8: maxStage = deepest stage across all activities', () => {
    const d = node('D', 3);
    const c = node('C', 2, [d]);
    const b = node('B', 1, [c]);
    const root = node('A', 0, [b]);
    const geo = layoutBoard(ast({ name: 'A', root }));
    expect(geo.maxStage).toBe(3);
  });

  it('AC9: empty AST returns zero geometry without throwing', () => {
    const geo = layoutBoard({ activities: [] });
    expect(geo.activities).toEqual([]);
    expect(geo.totalWidth).toBe(0);
    expect(geo.maxStage).toBe(0);
  });

  it('totalWidth = sum of all activity fullWidths', () => {
    const root1 = node('A', 0);
    const root2 = node('B', 0);
    const geo = layoutBoard(ast({ name: 'A', root: root1 }, { name: 'B', root: root2 }));
    expect(geo.totalWidth).toBe(340);
  });

  it('card dy = stage * 90', () => {
    const child = node('Card', 2);
    const root = node('Root', 0, [child]);
    const geo = layoutBoard(ast({ name: 'Root', root }));
    const card = geo.activities[0]!.cards.find((c) => c.label === 'Card')!;
    expect(card.dy).toBe(180);
  });

  it('maxStage from multiple activities takes global max', () => {
    const root1 = node('A', 0, [node('B', 1)]);
    const root2 = node('C', 0, [node('D', 1, [node('E', 2)])]);
    const geo = layoutBoard(ast({ name: 'A', root: root1 }, { name: 'C', root: root2 }));
    expect(geo.maxStage).toBe(2);
  });

  it('verified trace: fixture gasaxu-65-cipo396', () => {
    const paris = node('Paris', 3);
    const brest = node('Brest', 3);
    const france = node('France', 2, [paris, brest]);
    const madrid = node('Madrid', 3);
    const barcelone = node('Barcelone', 3);
    const pamplune = node('Pamplune', 3);
    const espagne = node('Espagne', 2, [madrid, barcelone, pamplune]);
    const europe = node('Europe', 1, [france, espagne]);
    const montreal = node('Montreal', 3);
    const america = node('America', 1, [montreal]);
    const root = node('World', 0, [europe, america]);

    const geo = layoutBoard(ast({ name: 'World', root }));
    const cards = geo.activities[0]!.cards;
    const get = (label: string) => cards.find((c) => c.label === label)!;

    expect(get('World').dx).toBe(0);
    expect(get('Europe').dx).toBe(0);
    expect(get('France').dx).toBe(0);
    expect(get('Paris').dx).toBe(0);
    expect(get('Brest').dx).toBe(170);
    expect(get('Espagne').dx).toBe(340);
    expect(get('Madrid').dx).toBe(340);
    expect(get('Barcelone').dx).toBe(510);
    expect(get('Pamplune').dx).toBe(680);
    expect(get('America').dx).toBe(850);
    expect(get('Montreal').dx).toBe(850);

    expect(geo.activities[0]!.fullWidth).toBe(1020);
    expect(geo.maxStage).toBe(3);
    expect(geo.totalWidth).toBe(1020);
  });
});

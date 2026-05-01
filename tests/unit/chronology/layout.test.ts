import { describe, it, expect } from 'vitest';
import { layoutChronology } from '../../../src/diagrams/chronology/layout.js';
import type { ChronologyDiagramAST } from '../../../src/diagrams/chronology/ast.js';

// 2023-11-24 10:11:50.750 UTC
const EVENT1_MS = 1700820710750;
// 2023-11-28 14:11:50.750 UTC
const EVENT2_MS = 1701180710750;

const corpusAST: ChronologyDiagramAST = {
  events: [
    { name: 'Event1', timestampMs: EVENT1_MS },
    { name: 'Event2', timestampMs: EVENT2_MS },
  ],
};

describe('layoutChronology', () => {
  describe('AC6: empty AST', () => {
    it('returns zero-geometry without throwing', () => {
      const result = layoutChronology({ events: [] });
      expect(result.events).toHaveLength(0);
      expect(result.dayTicks).toHaveLength(0);
      expect(result.totalWidth).toBe(1000);
      expect(result.totalHeight).toBe(80);
      expect(result.baselineY).toBe(40);
      expect(result.headerHeight).toBe(30);
    });
  });

  describe('AC3: canvas dimensions', () => {
    it('always returns fixed canvas constants', () => {
      const result = layoutChronology(corpusAST);
      expect(result.totalWidth).toBe(1000);
      expect(result.headerHeight).toBe(30);
      expect(result.baselineY).toBe(40);
      expect(result.totalHeight).toBe(80);
    });
  });

  describe('AC1: corpus fixture event x positions', () => {
    it('places Event1 at x ≈ 84.98', () => {
      const result = layoutChronology(corpusAST);
      expect(result.events[0]!.x).toBeCloseTo(84.98, 1);
    });

    it('places Event2 at x ≈ 918.31', () => {
      const result = layoutChronology(corpusAST);
      expect(result.events[1]!.x).toBeCloseTo(918.31, 1);
    });

    it('preserves event names', () => {
      const result = layoutChronology(corpusAST);
      expect(result.events[0]!.name).toBe('Event1');
      expect(result.events[1]!.name).toBe('Event2');
    });
  });

  describe('AC2: day ticks', () => {
    it('generates exactly 5 day ticks for a 5-day span', () => {
      const result = layoutChronology(corpusAST);
      expect(result.dayTicks).toHaveLength(5);
    });

    it('first tick is at x=0', () => {
      const result = layoutChronology(corpusAST);
      expect(result.dayTicks[0]!.x).toBeCloseTo(0, 5);
    });

    it('tick x values are evenly spaced at 200 each', () => {
      const result = layoutChronology(corpusAST);
      const xs = result.dayTicks.map((t) => t.x);
      expect(xs[0]).toBeCloseTo(0, 5);
      expect(xs[1]).toBeCloseTo(200, 5);
      expect(xs[2]).toBeCloseTo(400, 5);
      expect(xs[3]).toBeCloseTo(600, 5);
      expect(xs[4]).toBeCloseTo(800, 5);
    });

    it('tick labels are 2023-11-24 through 2023-11-28', () => {
      const result = layoutChronology(corpusAST);
      expect(result.dayTicks[0]!.label).toBe('2023-11-24');
      expect(result.dayTicks[1]!.label).toBe('2023-11-25');
      expect(result.dayTicks[2]!.label).toBe('2023-11-26');
      expect(result.dayTicks[3]!.label).toBe('2023-11-27');
      expect(result.dayTicks[4]!.label).toBe('2023-11-28');
    });
  });

  describe('AC4: label alternation (2 events)', () => {
    it('event[0] has labelAbove=true', () => {
      const result = layoutChronology(corpusAST);
      expect(result.events[0]!.labelAbove).toBe(true);
    });

    it('event[1] has labelAbove=false', () => {
      const result = layoutChronology(corpusAST);
      expect(result.events[1]!.labelAbove).toBe(false);
    });
  });

  describe('AC7: three events — alternating labels', () => {
    it('labels alternate true/false/true for three events', () => {
      // 2023-11-24 at 00:00, 12:00, 23:00 UTC
      const ast: ChronologyDiagramAST = {
        events: [
          { name: 'A', timestampMs: Date.UTC(2023, 10, 24, 0, 0, 0) },
          { name: 'B', timestampMs: Date.UTC(2023, 10, 24, 12, 0, 0) },
          { name: 'C', timestampMs: Date.UTC(2023, 10, 24, 23, 0, 0) },
        ],
      };
      const result = layoutChronology(ast);
      expect(result.events[0]!.labelAbove).toBe(true);
      expect(result.events[1]!.labelAbove).toBe(false);
      expect(result.events[2]!.labelAbove).toBe(true);
    });
  });

  describe('AC5: single-event AST', () => {
    it('does not throw', () => {
      const ast: ChronologyDiagramAST = {
        events: [{ name: 'Solo', timestampMs: EVENT1_MS }],
      };
      expect(() => layoutChronology(ast)).not.toThrow();
    });

    it('produces 1 day tick at x=0', () => {
      const ast: ChronologyDiagramAST = {
        events: [{ name: 'Solo', timestampMs: EVENT1_MS }],
      };
      const result = layoutChronology(ast);
      expect(result.dayTicks).toHaveLength(1);
      expect(result.dayTicks[0]!.x).toBeCloseTo(0, 5);
    });

    it('places non-midnight event at x > 0', () => {
      // EVENT1_MS is 10:11:50.750 UTC — not midnight
      const ast: ChronologyDiagramAST = {
        events: [{ name: 'Solo', timestampMs: EVENT1_MS }],
      };
      const result = layoutChronology(ast);
      expect(result.events[0]!.x).toBeGreaterThan(0);
    });
  });

  describe('AC8: label format', () => {
    it('zero-pads single-digit month', () => {
      // 2023-01-05
      const ast: ChronologyDiagramAST = {
        events: [{ name: 'E', timestampMs: Date.UTC(2023, 0, 5, 6, 0, 0) }],
      };
      const result = layoutChronology(ast);
      expect(result.dayTicks[0]!.label).toBe('2023-01-05');
    });

    it('zero-pads single-digit day', () => {
      // 2023-03-09
      const ast: ChronologyDiagramAST = {
        events: [{ name: 'E', timestampMs: Date.UTC(2023, 2, 9, 8, 0, 0) }],
      };
      const result = layoutChronology(ast);
      expect(result.dayTicks[0]!.label).toBe('2023-03-09');
    });
  });
});

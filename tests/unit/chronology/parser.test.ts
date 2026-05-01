import { describe, it, expect } from 'vitest';
import { parseChronology } from '../../../src/diagrams/chronology/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'unknown' };
}

describe('parseChronology', () => {
  it('AC1: [Event1] happens at 2023-11-24 10:11:50.750 → timestampMs 1700820710750', () => {
    const ast = parseChronology(
      makeSource(['[Event1] happens at 2023-11-24 10:11:50.750']),
    );
    expect(ast.events.length).toBe(1);
    expect(ast.events[0]).toEqual({ name: 'Event1', timestampMs: 1700820710750 });
  });

  it('AC2: [Event2] happens at 2023-11-28 14:11:50.750 → timestampMs 1701180710750', () => {
    const ast = parseChronology(
      makeSource(['[Event2] happens at 2023-11-28 14:11:50.750']),
    );
    expect(ast.events.length).toBe(1);
    expect(ast.events[0]).toEqual({ name: 'Event2', timestampMs: 1701180710750 });
  });

  it('AC3a: "happens on" parses identically to "happens at"', () => {
    const atAst = parseChronology(
      makeSource(['[A] happens at 2023-01-01 00:00:00']),
    );
    const onAst = parseChronology(
      makeSource(['[A] happens on 2023-01-01 00:00:00']),
    );
    expect(onAst.events[0]).toEqual(atAst.events[0]);
  });

  it('AC3b: "happens the" parses identically to "happens at"', () => {
    const atAst = parseChronology(
      makeSource(['[A] happens at 2023-01-01 00:00:00']),
    );
    const theAst = parseChronology(
      makeSource(['[A] happens the 2023-01-01 00:00:00']),
    );
    expect(theAst.events[0]).toEqual(atAst.events[0]);
  });

  it('AC4: no milliseconds → ms=0, valid UTC epoch value', () => {
    const ast = parseChronology(
      makeSource(['[A] happens at 2023-01-01 12:00:00']),
    );
    expect(ast.events.length).toBe(1);
    const expected = Date.UTC(2023, 0, 1, 12, 0, 0, 0);
    expect(ast.events[0]!.timestampMs).toBe(expected);
    expect(typeof ast.events[0]!.timestampMs).toBe('number');
    expect(Number.isFinite(ast.events[0]!.timestampMs)).toBe(true);
  });

  it('AC5: @startchronology / @endchronology wrapper lines produce no events', () => {
    const ast = parseChronology(
      makeSource(['@startchronology', '@endchronology']),
    );
    expect(ast.events).toEqual([]);
  });

  it('AC6a: blank lines are silently ignored, no throw', () => {
    const ast = parseChronology(
      makeSource(['', '[A] happens at 2023-01-01 00:00:00', '']),
    );
    expect(ast.events.length).toBe(1);
  });

  it('AC6b: unrecognized lines are silently ignored, no throw', () => {
    expect(() =>
      parseChronology(makeSource(['this is garbage', 'not a command'])),
    ).not.toThrow();
    const ast = parseChronology(
      makeSource(['this is garbage', '[A] happens at 2023-01-01 00:00:00']),
    );
    expect(ast.events.length).toBe(1);
  });

  it('AC7: full corpus fixture parses to 2 events with exact timestamps', () => {
    const markup =
      '@startchronology\n[Event1] happens at 2023-11-24 10:11:50.750\n[Event2] happens at 2023-11-28 14:11:50.750\n@endchronology';
    const ast = parseChronology(makeSource(markup.split('\n')));
    expect(ast.events.length).toBe(2);
    expect(ast.events[0]).toEqual({ name: 'Event1', timestampMs: 1700820710750 });
    expect(ast.events[1]).toEqual({ name: 'Event2', timestampMs: 1701180710750 });
  });

  it('AC8: empty source → { events: [] } without throwing', () => {
    const ast = parseChronology(makeSource([]));
    expect(ast).toEqual({ events: [] });
  });

  it('event name with spaces and special chars is preserved verbatim', () => {
    const ast = parseChronology(
      makeSource(['[My Event Name] happens at 2023-06-15 08:30:00']),
    );
    expect(ast.events[0]!.name).toBe('My Event Name');
  });

  it('multiple events accumulate in order', () => {
    const ast = parseChronology(
      makeSource([
        '[First] happens at 2023-01-01 00:00:00',
        '[Second] happens at 2023-06-01 12:00:00',
        '[Third] happens at 2023-12-31 23:59:59',
      ]),
    );
    expect(ast.events.length).toBe(3);
    expect(ast.events[0]!.name).toBe('First');
    expect(ast.events[1]!.name).toBe('Second');
    expect(ast.events[2]!.name).toBe('Third');
  });

  it('milliseconds with trailing digits uses full numeric value', () => {
    // .750 → ms=750
    const ast = parseChronology(
      makeSource(['[E] happens at 2023-01-01 00:00:00.750']),
    );
    const expected = Date.UTC(2023, 0, 1, 0, 0, 0, 750);
    expect(ast.events[0]!.timestampMs).toBe(expected);
  });

  it('@STARTCHRONOLOGY uppercase wrapper is also stripped', () => {
    const ast = parseChronology(
      makeSource([
        '@STARTCHRONOLOGY',
        '[A] happens at 2023-01-01 00:00:00',
        '@ENDCHRONOLOGY',
      ]),
    );
    expect(ast.events.length).toBe(1);
    expect(ast.events[0]!.name).toBe('A');
  });

  it('mixed wrapper, blanks, garbage, and valid events all handled together', () => {
    const ast = parseChronology(
      makeSource([
        '@startchronology',
        '',
        'not a command at all',
        '[Alpha] happens at 2023-03-15 09:00:00',
        '',
        'also garbage',
        '[Beta] happens on 2023-09-01 17:30:00',
        '@endchronology',
      ]),
    );
    expect(ast.events.length).toBe(2);
    expect(ast.events[0]!.name).toBe('Alpha');
    expect(ast.events[1]!.name).toBe('Beta');
  });
});

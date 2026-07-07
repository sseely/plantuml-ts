import { describe, it, expect } from 'vitest';
import { classAccepts } from '../../../src/diagrams/class/class-dispatch.js';

/** Split markup into trimmed, non-empty content lines (as accepts() receives). */
const L = (s: string): string[] =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => x !== '');

describe('classAccepts — class/description routing (Batch 1: Δ2 note-body)', () => {
  it('accepts an ordinary class diagram', () => {
    expect(classAccepts(L('class A\nclass B\nA <|-- B'))).toBe(true);
    expect(classAccepts(L('interface I\nenum E\nabstract class C'))).toBe(true);
  });

  it('is not tripped by shorthand inside a block-note body (Δ2, taxemo-34)', () => {
    // `(palegreen)` inside a note body must not read as a `(usecase)` shorthand
    expect(
      classAccepts(L('class C\nnote left of C\n(palegreen)\nend note')),
    ).toBe(true);
    // a `::member` qualifier on the note target must not defeat body-stripping
    expect(classAccepts(L('class C\nnote right of C::m\n(x)\nend note'))).toBe(
      true,
    );
  });

  it('keeps an inline single-line note from being treated as a block note', () => {
    // `note left of C : text` is inline (has ` : `), no body to strip; a later
    // descriptive shorthand line is still seen as descriptive.
    expect(
      classAccepts(L('class C\nnote left of C : a note\ncomponent X')),
    ).toBe(false);
  });

  it('is not tripped by a class NAMED like a descriptive keyword in a relationship', () => {
    // `Queue`/`QueueEntry` are class names used as relationship endpoints
    expect(classAccepts(L('class Queue\nclass QueueEntry\nQueue -- QueueEntry'))).toBe(
      true,
    );
  });

  it('declines pure descriptive blocks — bare leaves stay in description', () => {
    expect(classAccepts(L('node A\ncomponent B\nA --> B'))).toBe(false);
    expect(classAccepts(L('component X\ndatabase Y\nX -- Y'))).toBe(false);
  });

  it('still declines descriptive-only blocks whose only class-ish keyword is descriptive', () => {
    // entity/circle/allow_mixing routing lands in later batches with their
    // rendering support; for Batch 1 they remain with the description engine.
    expect(classAccepts(L('entity Entity {\n* id\n}'))).toBe(false);
    expect(classAccepts(L('allow_mixing\nclass foo\ncomponent c'))).toBe(false);
  });
});

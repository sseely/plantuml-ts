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

  it('is not tripped by a class named after a descriptive keyword with members (Δ3)', () => {
    // `Person : guid OID` starts with the `person` keyword but is a class member
    // (the namespace fixtures dudimi/duvuti/pareli/xodopa)
    expect(
      classAccepts(L('class Person\nPerson : guid OID\nPerson : string FirstName')),
    ).toBe(true);
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

describe('classAccepts — Δ4 scoped entity/circle routing (Batch 2)', () => {
  it('routes a class+entity/circle block to class (has a class keyword)', () => {
    // tepazu/xidura shape: class keyword alongside entity
    expect(
      classAccepts(L('class CLASS\nenum ENUM\ninterface I\nentity ENTITY')),
    ).toBe(true);
    // niduni shape: class + interface + circle
    expect(classAccepts(L('class P\ninterface A1\ncircle A2\nP --( A2'))).toBe(
      true,
    );
  });

  it('does NOT steal a pure entity-as-sequence-participant block', () => {
    // `entity` here declares sequence participants; no class keyword → not class
    expect(classAccepts(L('entity Alice\nentity Bob\nAlice -> Bob'))).toBe(
      false,
    );
  });

  it('leaves a pure entity/circle block (no class keyword) with description', () => {
    expect(classAccepts(L('entity Entity {\n* id\n}'))).toBe(false);
    expect(classAccepts(L('circle C1\ncircle C2\ncircle C3'))).toBe(false);
  });
});

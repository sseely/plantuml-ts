import { describe, it, expect } from 'vitest';
import { parseSequence } from '../../../src/diagrams/sequence/parser.js';
import type {
  MessageEvent,
  NoteEvent,
  FrameEvent,
  ActivationEvent,
  DividerEvent,
  DelayEvent,
  SpaceEvent,
  SequenceEvent,
} from '../../../src/diagrams/sequence/ast.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parse(lines: string[]) {
  return parseSequence(lines);
}

function isMessage(e: SequenceEvent): e is MessageEvent {
  return e.kind === 'message';
}

function firstMessage(lines: string[]): MessageEvent {
  const ast = parse(lines);
  const ev = ast.events[0];
  if (!ev || ev.kind !== 'message') throw new Error('Expected message event');
  return ev;
}

// ---------------------------------------------------------------------------
// Participant declarations
// ---------------------------------------------------------------------------

describe('participant declarations', () => {
  it('parses a plain participant', () => {
    const ast = parse(['participant Alice']);
    expect(ast.participants).toHaveLength(1);
    expect(ast.participants[0]).toMatchObject({
      id: 'Alice',
      display: 'Alice',
      type: 'participant',
      order: 0,
    });
  });

  it('parses an actor', () => {
    const ast = parse(['actor Bob']);
    expect(ast.participants[0]).toMatchObject({ id: 'Bob', type: 'actor' });
  });

  it('parses boundary, control, entity, database, collections, queue types', () => {
    const types = [
      'boundary',
      'control',
      'entity',
      'database',
      'collections',
      'queue',
    ] as const;
    for (const t of types) {
      const ast = parse([`${t} X`]);
      expect(ast.participants[0]?.type).toBe(t);
    }
  });

  it('parses quoted display name with alias', () => {
    const ast = parse(['participant "Alice Smith" as A', 'A -> Bob: hi']);
    const p = ast.participants[0];
    expect(p?.id).toBe('A');
    expect(p?.display).toBe('Alice Smith');
  });

  it('parses participant with color', () => {
    const ast = parse(['participant Alice #pink']);
    expect(ast.participants[0]?.color).toBe('#pink');
  });

  it('assigns order based on first-appearance index', () => {
    const ast = parse(['participant A', 'participant B', 'participant C']);
    expect(ast.participants[0]?.order).toBe(0);
    expect(ast.participants[1]?.order).toBe(1);
    expect(ast.participants[2]?.order).toBe(2);
  });

  it('auto-creates participants from message senders/receivers', () => {
    const ast = parse(['Alice -> Bob: hello']);
    expect(ast.participants).toHaveLength(2);
    expect(ast.participants[0]?.id).toBe('Alice');
    expect(ast.participants[1]?.id).toBe('Bob');
  });

  it('auto-created participants have type participant and matching display', () => {
    const ast = parse(['Alice -> Bob: hello']);
    expect(ast.participants[0]).toMatchObject({
      type: 'participant',
      display: 'Alice',
    });
  });

  it('does not duplicate participants already declared', () => {
    const ast = parse(['participant Alice', 'Alice -> Bob: hi']);
    const aliceEntries = ast.participants.filter((p) => p.id === 'Alice');
    expect(aliceEntries).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Message events — arrow styles
// ---------------------------------------------------------------------------

describe('message arrow styles', () => {
  it('-> produces sync style', () => {
    const ev = firstMessage(['Alice -> Bob: hello']);
    expect(ev.style).toBe('sync');
    expect(ev.from).toBe('Alice');
    expect(ev.to).toBe('Bob');
    expect(ev.label).toBe('hello');
  });

  it('->> produces async style', () => {
    const ev = firstMessage(['Alice ->> Bob: go']);
    expect(ev.style).toBe('async');
  });

  it('--> produces reply style', () => {
    const ev = firstMessage(['Alice --> Bob: ok']);
    expect(ev.style).toBe('reply');
  });

  it('-->> produces replyAsync style', () => {
    const ev = firstMessage(['Alice -->> Bob: ok']);
    expect(ev.style).toBe('replyAsync');
  });

  it('->? produces lost style', () => {
    const ev = firstMessage(['Alice ->? Bob: lost']);
    expect(ev.style).toBe('lost');
  });

  it('?-> produces found style', () => {
    const ev = firstMessage(['Alice ?-> Bob: found']);
    expect(ev.style).toBe('found');
  });

  it('self-message: from === to', () => {
    const ev = firstMessage(['Alice -> Alice: think']);
    expect(ev.from).toBe('Alice');
    expect(ev.to).toBe('Alice');
  });

  it('message without label gets empty label', () => {
    const ev = firstMessage(['Alice -> Bob']);
    expect(ev.label).toBe('');
  });

  it('++ shorthand sets activates field', () => {
    const ev = firstMessage(['Alice -> Bob ++: call']);
    expect(ev.activates).toBe('Bob');
  });

  it('-- shorthand sets deactivates field', () => {
    const ev = firstMessage(['Alice -> Bob --: done']);
    expect(ev.deactivates).toBe('Bob');
  });

  it('produces kind: message', () => {
    const ev = firstMessage(['Alice -> Bob: hi']);
    expect(ev.kind).toBe('message');
  });
});

// ---------------------------------------------------------------------------
// Autonumber
// ---------------------------------------------------------------------------

describe('autonumber', () => {
  it('off by default', () => {
    const ast = parse(['Alice -> Bob: hi']);
    expect(ast.autonumber.enabled).toBe(false);
  });

  it('autonumber enables sequenceNumber on messages', () => {
    const ast = parse(['autonumber', 'Alice -> Bob: hi', 'Bob --> Alice: ok']);
    const msgs = ast.events.filter(isMessage);
    expect(msgs[0]?.sequenceNumber).toBe(1);
    expect(msgs[1]?.sequenceNumber).toBe(2);
  });

  it('autonumber with start value begins at that number', () => {
    const ast = parse(['autonumber 5', 'Alice -> Bob: hi']);
    const msg = ast.events.find(isMessage);
    expect(msg?.sequenceNumber).toBe(5);
  });

  it('stores autonumber state in ast.autonumber', () => {
    const ast = parse(['autonumber 10', 'Alice -> Bob: hi']);
    expect(ast.autonumber.enabled).toBe(true);
    expect(ast.autonumber.start).toBe(10);
  });

  it('messages without autonumber have no sequenceNumber', () => {
    const ast = parse(['Alice -> Bob: hi']);
    const msg = ast.events.find(isMessage);
    expect(msg?.sequenceNumber).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Activation events
// ---------------------------------------------------------------------------

describe('activation events', () => {
  it('activate produces activate event', () => {
    const ast = parse(['activate Alice']);
    const ev = ast.events[0] as ActivationEvent | undefined;
    expect(ev?.kind).toBe('activate');
    expect(ev?.participantId).toBe('Alice');
  });

  it('deactivate produces deactivate event', () => {
    const ast = parse(['deactivate Alice']);
    const ev = ast.events[0] as ActivationEvent | undefined;
    expect(ev?.kind).toBe('deactivate');
    expect(ev?.participantId).toBe('Alice');
  });

  it('destroy also produces deactivate event', () => {
    const ast = parse(['destroy Alice']);
    const ev = ast.events[0] as ActivationEvent | undefined;
    expect(ev?.kind).toBe('deactivate');
  });

  it('activate with color stores color', () => {
    const ast = parse(['activate Alice #red']);
    const ev = ast.events[0] as ActivationEvent | undefined;
    expect(ev?.color).toBe('#red');
  });

  it('activate then deactivate produces two events in order', () => {
    const ast = parse(['activate Alice', 'deactivate Alice']);
    expect(ast.events[0]?.kind).toBe('activate');
    expect(ast.events[1]?.kind).toBe('deactivate');
  });
});

// ---------------------------------------------------------------------------
// Note events
// ---------------------------------------------------------------------------

describe('note events', () => {
  it('note left of produces NoteEvent with position left', () => {
    const ast = parse(['note left of Alice', 'some text', 'end note']);
    const ev = ast.events[0] as NoteEvent | undefined;
    expect(ev?.kind).toBe('note');
    expect(ev?.position).toBe('left');
    expect(ev?.participants).toEqual(['Alice']);
    expect(ev?.text).toBe('some text');
  });

  it('note right of produces NoteEvent with position right', () => {
    const ast = parse(['note right of Bob', 'text', 'end note']);
    const ev = ast.events[0] as NoteEvent | undefined;
    expect(ev?.position).toBe('right');
    expect(ev?.participants).toEqual(['Bob']);
  });

  it('note over produces NoteEvent with position over', () => {
    const ast = parse(['note over Alice', 'text', 'end note']);
    const ev = ast.events[0] as NoteEvent | undefined;
    expect(ev?.position).toBe('over');
  });

  it('note over with multiple participants', () => {
    const ast = parse(['note over Alice, Bob', 'shared note', 'end note']);
    const ev = ast.events[0] as NoteEvent | undefined;
    expect(ev?.participants).toEqual(['Alice', 'Bob']);
  });

  it('multi-line note accumulates all lines', () => {
    const ast = parse([
      'note left of Alice',
      'line one',
      'line two',
      'end note',
    ]);
    const ev = ast.events[0] as NoteEvent | undefined;
    expect(ev?.text).toBe('line one\nline two');
  });

  it('note with color stores color', () => {
    const ast = parse(['note left of Alice #yellow', 'text', 'end note']);
    const ev = ast.events[0] as NoteEvent | undefined;
    expect(ev?.color).toBe('#yellow');
  });

  // --- single-line (inline) note forms ---

  it('note right of Bob: processing — single-line, position right', () => {
    const ast = parse(['note right of Bob: processing']);
    expect(ast.events).toHaveLength(1);
    const ev = ast.events[0] as NoteEvent | undefined;
    expect(ev?.kind).toBe('note');
    expect(ev?.position).toBe('right');
    expect(ev?.participants).toEqual(['Bob']);
    expect(ev?.text).toBe('processing');
  });

  it('note over Alice, Bob: done — single-line, multiple participants', () => {
    const ast = parse(['note over Alice, Bob: done']);
    expect(ast.events).toHaveLength(1);
    const ev = ast.events[0] as NoteEvent | undefined;
    expect(ev?.kind).toBe('note');
    expect(ev?.position).toBe('over');
    expect(ev?.participants).toEqual(['Alice', 'Bob']);
    expect(ev?.text).toBe('done');
  });

  it('inline note with literal \\n escape becomes actual newline', () => {
    const ast = parse([
      'note over Auth, DB: credentials never leave\\nthe auth service',
    ]);
    expect(ast.events).toHaveLength(1);
    const ev = ast.events[0] as NoteEvent | undefined;
    expect(ev?.kind).toBe('note');
    expect(ev?.participants).toEqual(['Auth', 'DB']);
    expect(ev?.text).toBe('credentials never leave\nthe auth service');
  });

  it('multi-line note (no colon on header) still works — no regression', () => {
    const ast = parse(['note over Alice', 'multi line', 'end note']);
    expect(ast.events).toHaveLength(1);
    const ev = ast.events[0] as NoteEvent | undefined;
    expect(ev?.kind).toBe('note');
    expect(ev?.position).toBe('over');
    expect(ev?.participants).toEqual(['Alice']);
    expect(ev?.text).toBe('multi line');
  });

  it('note over Bob #yellow: hello — color + inline text', () => {
    const ast = parse(['note over Bob #yellow: hello']);
    expect(ast.events).toHaveLength(1);
    const ev = ast.events[0] as NoteEvent | undefined;
    expect(ev?.kind).toBe('note');
    expect(ev?.color).toBe('#yellow');
    expect(ev?.text).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// Frame events (loop, alt, opt, par, break, critical, group)
// ---------------------------------------------------------------------------

describe('frame events', () => {
  it('loop creates FrameEvent with frameType loop', () => {
    const ast = parse(['loop 3 times', 'Alice -> Bob: ping', 'end']);
    const ev = ast.events[0] as FrameEvent | undefined;
    expect(ev?.kind).toBe('frame');
    expect(ev?.frameType).toBe('loop');
    expect(ev?.label).toBe('3 times');
    expect(ev?.branches[0]).toHaveLength(1);
  });

  it('opt creates FrameEvent with frameType opt', () => {
    const ast = parse(['opt condition', 'Alice -> Bob: msg', 'end']);
    const ev = ast.events[0] as FrameEvent | undefined;
    expect(ev?.frameType).toBe('opt');
  });

  it('alt with else creates two branches', () => {
    const ast = parse([
      'alt success',
      'Alice -> Bob: ok',
      'else failure',
      'Alice -> Bob: fail',
      'end',
    ]);
    const ev = ast.events[0] as FrameEvent | undefined;
    expect(ev?.frameType).toBe('alt');
    expect(ev?.branches).toHaveLength(2);
    expect(ev?.branches[0]).toHaveLength(1);
    expect(ev?.branches[1]).toHaveLength(1);
  });

  it('else label is used as frame label for that branch', () => {
    const ast = parse([
      'alt success',
      'Alice -> Bob: ok',
      'else failure',
      'Alice -> Bob: fail',
      'end',
    ]);
    const ev = ast.events[0] as FrameEvent | undefined;
    expect(ev?.label).toBe('success');
  });

  it('par creates FrameEvent with frameType par', () => {
    const ast = parse(['par thread', 'Alice -> Bob: msg', 'end']);
    const ev = ast.events[0] as FrameEvent | undefined;
    expect(ev?.frameType).toBe('par');
  });

  it('group creates FrameEvent with frameType group', () => {
    const ast = parse(['group My Group', 'Alice -> Bob: msg', 'end']);
    const ev = ast.events[0] as FrameEvent | undefined;
    expect(ev?.frameType).toBe('group');
    expect(ev?.label).toBe('My Group');
  });

  it('nested frames: inner frame appears inside outer branch', () => {
    const ast = parse([
      'loop outer',
      'opt inner',
      'Alice -> Bob: msg',
      'end',
      'end',
    ]);
    const outerFrame = ast.events[0] as FrameEvent | undefined;
    expect(outerFrame?.frameType).toBe('loop');
    const innerEvent = outerFrame?.branches[0]?.[0] as FrameEvent | undefined;
    expect(innerEvent?.frameType).toBe('opt');
  });

  it('frame with no label gets empty string label', () => {
    const ast = parse(['loop', 'Alice -> Bob: ping', 'end']);
    const ev = ast.events[0] as FrameEvent | undefined;
    expect(ev?.label).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Divider events
// ---------------------------------------------------------------------------

describe('divider events', () => {
  it('== Section == produces DividerEvent', () => {
    const ast = parse(['== Section ==']);
    const ev = ast.events[0] as DividerEvent | undefined;
    expect(ev?.kind).toBe('divider');
    expect(ev?.text).toBe('Section');
  });

  it('divider text is trimmed', () => {
    const ast = parse(['==  My Section  ==']);
    const ev = ast.events[0] as DividerEvent | undefined;
    expect(ev?.text).toBe('My Section');
  });
});

// ---------------------------------------------------------------------------
// Delay events
// ---------------------------------------------------------------------------

describe('delay events', () => {
  it('... alone produces DelayEvent with no text', () => {
    const ast = parse(['...']);
    const ev = ast.events[0] as DelayEvent | undefined;
    expect(ev?.kind).toBe('delay');
    expect(ev?.text).toBeUndefined();
  });

  it('...text... produces DelayEvent with text', () => {
    const ast = parse(['...5 minutes later...']);
    const ev = ast.events[0] as DelayEvent | undefined;
    expect(ev?.kind).toBe('delay');
    expect(ev?.text).toBe('5 minutes later');
  });
});

// ---------------------------------------------------------------------------
// Space events
// ---------------------------------------------------------------------------

describe('space events', () => {
  it('|||  produces SpaceEvent with default 5 pixels', () => {
    const ast = parse(['|||']);
    const ev = ast.events[0] as SpaceEvent | undefined;
    expect(ev?.kind).toBe('space');
    expect(ev?.pixels).toBe(5);
  });

  it('||25| produces SpaceEvent with 25 pixels', () => {
    const ast = parse(['||25|']);
    const ev = ast.events[0] as SpaceEvent | undefined;
    expect(ev?.kind).toBe('space');
    expect(ev?.pixels).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

describe('options', () => {
  it('hide footbox sets hideFootbox to true', () => {
    const ast = parse(['hide footbox']);
    expect(ast.options.hideFootbox).toBe(true);
  });

  it('hideFootbox is false by default', () => {
    const ast = parse([]);
    expect(ast.options.hideFootbox).toBe(false);
  });

  it('skinparam sequenceMessageAlign sets messageAlign', () => {
    const ast = parse(['skinparam sequenceMessageAlign center']);
    expect(ast.options.messageAlign).toBe('center');
  });

  it('messageAlign defaults to left', () => {
    const ast = parse([]);
    expect(ast.options.messageAlign).toBe('left');
  });
});

// ---------------------------------------------------------------------------
// Return command
// ---------------------------------------------------------------------------

describe('return command', () => {
  it('return creates a reply message to the most recent sender', () => {
    const ast = parse(['Alice -> Bob: call', 'return result']);
    const returnMsg = ast.events[1] as MessageEvent | undefined;
    expect(returnMsg?.kind).toBe('message');
    expect(returnMsg?.from).toBe('Bob');
    expect(returnMsg?.to).toBe('Alice');
    expect(returnMsg?.style).toBe('reply');
    expect(returnMsg?.label).toBe('result');
  });

  it('return with no label produces empty label', () => {
    const ast = parse(['Alice -> Bob: call', 'return']);
    const returnMsg = ast.events[1] as MessageEvent | undefined;
    expect(returnMsg?.label).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Default AST shape
// ---------------------------------------------------------------------------

describe('default AST shape', () => {
  it('returns empty participants and events for empty input', () => {
    const ast = parse([]);
    expect(ast.participants).toEqual([]);
    expect(ast.events).toEqual([]);
  });

  it('autonumber defaults to disabled with start 1', () => {
    const ast = parse([]);
    expect(ast.autonumber).toEqual({ enabled: false, start: 1, current: 1 });
  });
});

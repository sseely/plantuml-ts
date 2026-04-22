# T7 — Sequence AST Types + Parser

## Context

Project: plantuml-js — TypeScript PlantUML renderer producing SVG in browser.
Stack: TypeScript 5 strict, Vitest for tests. Command-dispatch parsing (regex
patterns, no formal grammar). Batch 2 is complete: `UmlSource`, `DiagramPlugin`
and `PreprocessorResult` interfaces exist in `src/core/`.

## Task

Define all sequence diagram AST and Geometry types in `src/diagrams/sequence/ast.ts`,
then implement the parser in `src/diagrams/sequence/parser.ts` and its tests
using TDD. This is the most complex single task in Phase 1 — work through
the test list in `planning/tdd-plan.md` sequentially, one test at a time.

## Write-set

| File | Action |
|------|--------|
| `src/diagrams/sequence/ast.ts` | Create |
| `src/diagrams/sequence/parser.ts` | Create |
| `tests/unit/sequence/parser.test.ts` | Create |

## Read-set

- `planning/tdd-plan.md` — section `tests/unit/sequence/parser.test.ts` (all ~30 tests)
- `planning/diagram-types.md` — section "Sequence Diagrams" (AST node sketches)
- `src/core/block-extractor.ts` — `UmlSource`, `DiagramType` types
- `src/core/preprocessor.ts` — `PreprocessorResult` type

## AST type definitions

Define these in `src/diagrams/sequence/ast.ts`:

```typescript
export type ParticipantType =
  | 'participant' | 'actor' | 'boundary' | 'control'
  | 'entity' | 'database' | 'collections' | 'queue';

export interface Participant {
  id: string;
  display: string;
  type: ParticipantType;
  color?: string;
  order: number;        // first-appearance order (0-based)
}

export type MessageStyle =
  | 'sync' | 'async' | 'reply' | 'replyAsync' | 'lost' | 'found';

export interface MessageEvent {
  kind: 'message';
  from: string;         // participant id
  to: string;           // participant id
  label: string;
  style: MessageStyle;
  activates?: string;   // participant id to auto-activate (++ shorthand)
  deactivates?: string; // participant id to auto-deactivate (-- shorthand)
  sequenceNumber?: number;
}

export interface NoteEvent {
  kind: 'note';
  position: 'left' | 'right' | 'over';
  participants: string[];
  text: string;
  color?: string;
}

export interface FrameEvent {
  kind: 'frame';
  frameType: 'loop' | 'alt' | 'opt' | 'par' | 'break' | 'critical' | 'group';
  label: string;
  branches: SequenceEvent[][];  // alt has multiple; others have one
}

export interface ActivationEvent {
  kind: 'activate' | 'deactivate';
  participantId: string;
  color?: string;
}

export interface DividerEvent {
  kind: 'divider';
  text: string;
}

export interface DelayEvent {
  kind: 'delay';
  text?: string;
}

export interface SpaceEvent {
  kind: 'space';
  pixels: number;
}

export type SequenceEvent =
  | MessageEvent | NoteEvent | FrameEvent | ActivationEvent
  | DividerEvent | DelayEvent | SpaceEvent;

export interface SequenceDiagramAST {
  participants: Participant[];
  events: SequenceEvent[];
  autonumber: { enabled: boolean; start: number; current: number };
  options: {
    hideFootbox: boolean;
    messageAlign: 'left' | 'center' | 'right';
  };
}
```

Also define Geometry types (used by T8 layout and T9 renderer):

```typescript
export interface ParticipantGeo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
}

export interface MessageGeo {
  kind: 'message';
  fromX: number;
  toX: number;
  y: number;
  label: string;
  style: MessageStyle;
  sequenceNumber?: number;
  arrowDirection: 'right' | 'left' | 'self';
}

export interface NoteGeo {
  kind: 'note';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color?: string;
}

export interface ActivationGeo {
  kind: 'activation';
  participantId: string;
  lifelineX: number;
  y: number;
  height: number;
  color?: string;
}

export interface FrameGeo {
  kind: 'frame';
  frameType: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DividerGeo {
  kind: 'divider';
  text: string;
  y: number;
  totalWidth: number;
}

export interface SpaceGeo {
  kind: 'space';
  y: number;
  height: number;
}

export type EventGeo =
  | MessageGeo | NoteGeo | ActivationGeo | FrameGeo | DividerGeo | SpaceGeo;

export interface SequenceGeometry {
  totalWidth: number;
  totalHeight: number;
  participants: ParticipantGeo[];
  events: EventGeo[];
  lifelineEndY: number;
}
```

## Parser implementation notes

Use command dispatch: an array of `{ pattern: RegExp; execute(state, match) }` 
objects tested against each line in order. First match wins per line.

Key commands to implement (in match-priority order):

1. `skinparam sequenceMessageAlign (left|center|right)` → sets options.messageAlign
2. `hide footbox` → sets options.hideFootbox
3. `autonumber( \d+)?` → sets autonumber.enabled, optionally sets start
4. `(participant|actor|boundary|control|entity|database|collections|queue)\s+...` → adds participant
5. `activate (\w+)( #\w+)?` → adds ActivationEvent
6. `deactivate (\w+)` → adds ActivationEvent
7. `destroy (\w+)` → adds ActivationEvent with kind 'deactivate' (mark lifeline as ended)
8. `note (left of|right of|over) ...` → starts NoteEvent (may be multi-line)
9. `end note` → closes multi-line note
10. `(loop|alt|opt|par|break|critical|group)( .+)?` → pushes FrameEvent onto stack
11. `else( .+)?` → adds a new branch to the current alt frame
12. `end` → pops the current frame from the stack
13. `== (.+) ==` → DividerEvent
14. `\.\.\.(.+)?\.\.\.` or `\.\.\.` → DelayEvent
15. `\|\|(\d+)?\|` → SpaceEvent
16. `return( .+)?` → MessageEvent (reply to most recent message's sender)
17. Arrow patterns: `(\S+)\s*(->|-->>|->>|-->|->?\?|\?->)\s*(\S+)(\s*\+\+)?(\s*--)?:\s*(.*)` → MessageEvent
18. Arrow patterns without label (same regex, label group is empty)

**Auto-create participants:** when a message command is parsed and either `from`
or `to` is not yet in `ast.participants`, add it as a `participant` type with
`display = id`.

**Frame stack:** maintain a stack of open frames. When a command executes inside
a frame, it appends to the current branch of the topmost frame, not to
`ast.events` directly.

## Acceptance criteria

- Given `["participant Alice"]`, when parsed, then
  `ast.participants[0]` equals `{ id: "Alice", display: "Alice", type: "participant", order: 0 }`
- Given `["Alice -> Bob: hello"]` with no prior declarations, when parsed,
  then `ast.participants` has length 2 (Alice and Bob auto-created) and
  `ast.events[0]` is `{ kind: "message", from: "Alice", to: "Bob", label: "hello", style: "sync" }`
- Given `["Alice ->> Bob: go"]`, when parsed, then event.style === `"async"`
- Given `["loop 3 times", "Alice -> Bob: ping", "end"]`, when parsed, then
  `ast.events[0]` is a FrameEvent with frameType `"loop"`, label `"3 times"`,
  and one branch containing one message
- Given `["activate Alice", "Alice -> Bob: hi", "deactivate Alice"]`, when
  parsed, then events[0].kind === "activate", events[2].kind === "deactivate"
- Given `["autonumber", "Alice -> Bob: hi", "Bob --> Alice: ok"]`, when parsed,
  then both messages have non-undefined sequenceNumber values (1 and 2)
- Given `["== Section =="]`, when parsed, then events[0] is
  `{ kind: "divider", text: "Section" }`

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test` all pass. Coverage ≥ 90% on
`src/diagrams/sequence/parser.ts`. Commit:
`feat(sequence): implement AST types and parser`

/**
 * Parser for PlantUML sequence diagrams.
 *
 * Uses a command-dispatch table: an array of { pattern, execute } objects
 * tested against each trimmed line in priority order. First match wins.
 */

import type {
  ActivationEvent,
  DelayEvent,
  DividerEvent,
  FrameEvent,
  MessageEvent,
  MessageStyle,
  NoteEvent,
  Participant,
  ParticipantType,
  SequenceDiagramAST,
  SequenceEvent,
  SpaceEvent,
} from './ast.js';

// ---------------------------------------------------------------------------
// Mutable parse state (local to each parseSequence call)
// ---------------------------------------------------------------------------

interface ParseState {
  ast: SequenceDiagramAST;
  /** Stack of open FrameEvents. Empty = top-level. */
  frameStack: FrameEvent[];
  /** Participant id → index in ast.participants */
  participantIndex: Map<string, number>;
  /** When inside a multi-line note, accumulate here. */
  pendingNote: NoteEvent | null;
  /** Track the most recent message sender for `return` command. */
  lastMessageFrom: string | null;
  lastMessageTo: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultAST(): SequenceDiagramAST {
  return {
    participants: [],
    events: [],
    autonumber: { enabled: false, start: 1, current: 1 },
    options: {
      hideFootbox: false,
      messageAlign: 'left',
    },
  };
}

/** Return the event array for the current scope (inner frame or top-level). */
function currentEvents(state: ParseState): SequenceEvent[] {
  const top = state.frameStack[state.frameStack.length - 1];
  if (top === undefined) return state.ast.events;
  const branches = top.branches;
  const last = branches[branches.length - 1];
  return last ?? state.ast.events;
}

/** Ensure a participant exists; create it if it does not. */
function ensureParticipant(
  state: ParseState,
  id: string,
  type: ParticipantType = 'participant',
  display?: string,
  color?: string,
): void {
  if (state.participantIndex.has(id)) return;
  const order = state.ast.participants.length;
  const p: Participant = {
    id,
    display: display ?? id,
    type,
    order,
    ...(color !== undefined ? { color } : {}),
  };
  state.ast.participants.push(p);
  state.participantIndex.set(id, order);
}

/** Emit a SequenceEvent into the current scope. */
function emit(state: ParseState, event: SequenceEvent): void {
  currentEvents(state).push(event);
}

/** Apply autonumber to a message if enabled. */
function applyAutonumber(
  state: ParseState,
  msg: MessageEvent,
): MessageEvent {
  if (!state.ast.autonumber.enabled) return msg;
  const num = state.ast.autonumber.current;
  state.ast.autonumber.current += 1;
  return { ...msg, sequenceNumber: num };
}

// ---------------------------------------------------------------------------
// Arrow pattern → MessageStyle
// ---------------------------------------------------------------------------

/** Map raw arrow tokens to MessageStyle values. */
const ARROW_STYLE_MAP: Readonly<Record<string, MessageStyle>> = {
  '->': 'sync',
  '->>': 'async',
  '-->': 'reply',
  '-->>': 'replyAsync',
  '->?': 'lost',
  '?->': 'found',
};

// ---------------------------------------------------------------------------
// Command dispatch table
// ---------------------------------------------------------------------------

interface Command {
  pattern: RegExp;
  execute(state: ParseState, match: RegExpExecArray): void;
}

/**
 * Order matters: patterns are tested top-to-bottom; first match wins.
 * More specific patterns must precede general ones.
 */
const COMMANDS: readonly Command[] = [
  // 1. skinparam sequenceMessageAlign
  {
    pattern: /^skinparam\s+sequenceMessageAlign\s+(left|center|right)\s*$/i,
    execute(state, match) {
      const align = match[1]?.toLowerCase() as 'left' | 'center' | 'right';
      state.ast.options.messageAlign = align;
    },
  },

  // 2. hide footbox
  {
    pattern: /^hide\s+footbox\s*$/i,
    execute(state) {
      state.ast.options.hideFootbox = true;
    },
  },

  // 3. autonumber
  {
    pattern: /^autonumber(?:\s+(\d+))?\s*$/i,
    execute(state, match) {
      const start = match[1] !== undefined ? parseInt(match[1], 10) : 1;
      state.ast.autonumber.enabled = true;
      state.ast.autonumber.start = start;
      state.ast.autonumber.current = start;
    },
  },

  // 4. Participant declarations with optional quoted name, alias, and color.
  //    Handles forms like:
  //      participant Alice
  //      participant "Alice Smith" as A
  //      participant Alice #pink
  //      participant "Alice Smith" as A #pink
  {
    pattern:
      /^(participant|actor|boundary|control|entity|database|collections|queue)\s+(.+)$/i,
    execute(state, match) {
      const type = match[1]!.toLowerCase() as ParticipantType;
      const rest = match[2]!.trim();

      let id: string;
      let display: string;
      let color: string | undefined;

      // Try: "Display Name" as Alias [#color]
      const quotedAlias =
        /^"([^"]+)"\s+as\s+(\S+)(?:\s+(#\w+))?$/.exec(rest);
      if (quotedAlias !== null) {
        display = quotedAlias[1]!;
        id = quotedAlias[2]!;
        color = quotedAlias[3];
      } else {
        // Try: unquoted Name as Alias [#color]
        const unquotedAlias = /^(\S+)\s+as\s+(\S+)(?:\s+(#\w+))?$/.exec(rest);
        if (unquotedAlias !== null) {
          display = unquotedAlias[1]!;
          id = unquotedAlias[2]!;
          color = unquotedAlias[3];
        } else {
          // Try: Name [#color]
          const withColor = /^(\S+)\s+(#\w+)$/.exec(rest);
          if (withColor !== null) {
            id = withColor[1]!;
            display = id;
            color = withColor[2];
          } else {
            id = rest.trim();
            display = id;
          }
        }
      }

      ensureParticipant(state, id, type, display, color);
    },
  },

  // 5. activate
  {
    pattern: /^activate\s+(\S+)(?:\s+(#\w+))?\s*$/i,
    execute(state, match) {
      const participantId = match[1]!;
      const color = match[2];
      const ev: ActivationEvent = {
        kind: 'activate',
        participantId,
        ...(color !== undefined ? { color } : {}),
      };
      emit(state, ev);
    },
  },

  // 6. deactivate
  {
    pattern: /^deactivate\s+(\S+)\s*$/i,
    execute(state, match) {
      const ev: ActivationEvent = {
        kind: 'deactivate',
        participantId: match[1]!,
      };
      emit(state, ev);
    },
  },

  // 7. destroy → treated as deactivate
  {
    pattern: /^destroy\s+(\S+)\s*$/i,
    execute(state, match) {
      const ev: ActivationEvent = {
        kind: 'deactivate',
        participantId: match[1]!,
      };
      emit(state, ev);
    },
  },

  // 8. note left of / right of / over
  //
  //    Single-line form (inline text after colon):
  //      note left of Alice: some text
  //      note over Alice, Bob: some text
  //      note over Bob #yellow: colored note
  //
  //    Multi-line form (no colon on the header line):
  //      note left of Alice [#color]
  //      ...lines...
  //      end note
  //
  //    Groups:
  //      1 — position keyword (left of | right of | over)
  //      2 — participant list (stops before : or #)
  //      3 — optional color (#word)
  //      4 — optional inline text (everything after ": ")
  {
    pattern:
      /^note\s+(left of|right of|over)\s+([^:#\n]+?)(?:\s+(#\w+))?(?:\s*:\s*(.+))?\s*$/i,
    execute(state, match) {
      const rawPos = match[1]!.toLowerCase();
      const position: NoteEvent['position'] =
        rawPos === 'left of'
          ? 'left'
          : rawPos === 'right of'
            ? 'right'
            : 'over';
      const rawParticipants = match[2]!;
      const color = match[3];
      const inlineText = match[4];

      const participants = rawParticipants
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (inlineText !== undefined) {
        // Single-line form: replace literal \n escape sequences with real newlines,
        // then emit the note immediately.
        const text = inlineText.replace(/\\n/g, '\n');
        const ev: NoteEvent = {
          kind: 'note',
          position,
          participants,
          text,
          ...(color !== undefined ? { color } : {}),
        };
        emit(state, ev);
      } else {
        // Multi-line form: open a pending note; subsequent lines accumulate until
        // "end note".
        state.pendingNote = {
          kind: 'note',
          position,
          participants,
          text: '',
          ...(color !== undefined ? { color } : {}),
        };
      }
    },
  },

  // 9. end note — closes a multi-line note
  {
    pattern: /^end\s+note\s*$/i,
    execute(state) {
      if (state.pendingNote !== null) {
        emit(state, state.pendingNote);
        state.pendingNote = null;
      }
    },
  },

  // 10. Frame types (loop, alt, opt, par, break, critical, group)
  {
    pattern:
      /^(loop|alt|opt|par|break|critical|group)(?:\s+(.+))?\s*$/i,
    execute(state, match) {
      const frameType = match[1]!.toLowerCase() as FrameEvent['frameType'];
      const label = match[2]?.trim() ?? '';
      const frame: FrameEvent = {
        kind: 'frame',
        frameType,
        label,
        branches: [[]],
      };
      state.frameStack.push(frame);
    },
  },

  // 11. else — adds a new branch to the current alt/par frame
  {
    pattern: /^else(?:\s+(.+))?\s*$/i,
    execute(state) {
      const top = state.frameStack[state.frameStack.length - 1];
      if (top !== undefined) {
        top.branches.push([]);
      }
    },
  },

  // 12. end — closes the current frame
  {
    pattern: /^end\s*$/i,
    execute(state) {
      const frame = state.frameStack.pop();
      if (frame !== undefined) {
        emit(state, frame);
      }
    },
  },

  // 13. Divider: == text ==
  {
    pattern: /^==\s*(.+?)\s*==\s*$/,
    execute(state, match) {
      const ev: DividerEvent = {
        kind: 'divider',
        text: match[1]!,
      };
      emit(state, ev);
    },
  },

  // 14a. Delay with text: ...text...
  {
    pattern: /^\.\.\.\s*(.+?)\s*\.\.\.\s*$/,
    execute(state, match) {
      const ev: DelayEvent = {
        kind: 'delay',
        text: match[1]!,
      };
      emit(state, ev);
    },
  },

  // 14b. Bare delay: ...
  {
    pattern: /^\.\.\.\s*$/,
    execute(state) {
      const ev: DelayEvent = { kind: 'delay' };
      emit(state, ev);
    },
  },

  // 15. Space: |||  or  ||N|
  {
    pattern: /^\|\|(\d+)?\|\s*$/,
    execute(state, match) {
      const pixels = match[1] !== undefined ? parseInt(match[1], 10) : 5;
      const ev: SpaceEvent = { kind: 'space', pixels };
      emit(state, ev);
    },
  },

  // 16. return — sends a reply back to the most recent message sender
  {
    pattern: /^return(?:\s+(.+))?\s*$/i,
    execute(state, match) {
      const label = match[1]?.trim() ?? '';
      const from = state.lastMessageTo ?? '';
      const to = state.lastMessageFrom ?? '';
      ensureParticipant(state, from);
      ensureParticipant(state, to);
      let msg: MessageEvent = {
        kind: 'message',
        from,
        to,
        label,
        style: 'reply',
      };
      msg = applyAutonumber(state, msg);
      emit(state, msg);
    },
  },

  // 17. Arrow messages — must come after frame keywords to avoid conflicts.
  //     Supports: ->, -->, ->>, -->>, ->?, ?->
  //     Optionally: ++ (activates) or -- (deactivates) after target
  //     Optionally: : label
  {
    pattern:
      /^(\S+)\s*(->|-->>|->>|-->|->\?|\?->)\s*(\S+?)(\s*\+\+)?(\s*--)?\s*(?::\s*(.*))?$/,
    execute(state, match) {
      const from = match[1]!;
      const arrowToken = match[2]!;
      const to = match[3]!;
      const activatesFlag = match[4] !== undefined && match[4].trim() === '++';
      const deactivatesFlag =
        match[5] !== undefined && match[5].trim() === '--';
      const label = match[6]?.trim() ?? '';

      const style = ARROW_STYLE_MAP[arrowToken] ?? 'sync';

      ensureParticipant(state, from);
      ensureParticipant(state, to);

      let msg: MessageEvent = {
        kind: 'message',
        from,
        to,
        label,
        style,
        ...(activatesFlag ? { activates: to } : {}),
        ...(deactivatesFlag ? { deactivates: to } : {}),
      };
      msg = applyAutonumber(state, msg);

      state.lastMessageFrom = from;
      state.lastMessageTo = to;

      emit(state, msg);
    },
  },
];

// ---------------------------------------------------------------------------
// Main parser entry point
// ---------------------------------------------------------------------------

/**
 * Parse an array of preprocessed PlantUML sequence diagram lines into an AST.
 */
export function parseSequence(lines: readonly string[]): SequenceDiagramAST {
  const state: ParseState = {
    ast: makeDefaultAST(),
    frameStack: [],
    participantIndex: new Map(),
    pendingNote: null,
    lastMessageFrom: null,
    lastMessageTo: null,
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') continue;

    // If we are accumulating a multi-line note, any line that is not
    // "end note" gets appended to the note text.
    if (state.pendingNote !== null) {
      // Check for end note first via the dispatch table (handled above),
      // but we need to run commands even during note accumulation so
      // "end note" is caught.
      const endNoteCmd = COMMANDS.find((c) => c.pattern.test(line));
      if (endNoteCmd !== undefined) {
        const m = endNoteCmd.pattern.exec(line)!;
        // Only close the note if this is the "end note" command.
        // We identify it by checking if the pattern matches "end note".
        if (/^end\s+note\s*$/i.test(line)) {
          endNoteCmd.execute(state, m);
          continue;
        }
      }
      // Accumulate the line into the note text.
      if (state.pendingNote.text === '') {
        state.pendingNote.text = line;
      } else {
        state.pendingNote.text += '\n' + line;
      }
      continue;
    }

    // Normal dispatch
    for (const cmd of COMMANDS) {
      const match = cmd.pattern.exec(line);
      if (match !== null) {
        cmd.execute(state, match);
        break;
      }
    }
  }

  return state.ast;
}

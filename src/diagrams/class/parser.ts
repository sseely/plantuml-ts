/**
 * Parser for PlantUML class diagrams.
 *
 * Uses a command-dispatch table: an array of { pattern, execute } objects
 * tested against each trimmed line in priority order. First match wins.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type {
  ClassDiagramAST,
  Classifier,
  ClassifierKind,
  NotePosition,
} from './ast.js';
import { parseClassifierDecl } from './class-declaration-parser.js';
import { applyDirectives, parseHideShowDirective } from './class-directives.js';
import { parseMemberLine } from './class-member-parser.js';
import {
  parseRelationshipLine,
  REL_DISPATCH_RE,
  stripQuotes,
} from './class-relationship-parser.js';

// ---------------------------------------------------------------------------
// Mutable parse state (local to each parseClass call)
// ---------------------------------------------------------------------------

/**
 * A note block being accumulated until `end note`. Two shapes:
 *  - `attached`: `note <pos> of <Entity>` — has a host + position.
 *  - `freestanding`: `note as <alias>` — no host; the alias becomes the
 *    note's id so later relationship lines (e.g. `alias .> Something`) can
 *    reference it.
 */
type PendingNote =
  | { kind: 'attached'; target: string; position: NotePosition; textLines: string[] }
  | { kind: 'freestanding'; alias: string; textLines: string[] };

interface ParseState {
  ast: ClassDiagramAST;
  /** Map from classifier id to its index in ast.classifiers. */
  classifierIndex: Map<string, number>;
  /**
   * When non-null we are inside an open brace body for this classifier id.
   * Lines are parsed as member definitions until `}` closes it.
   */
  pendingBodyId: string | null;
  /**
   * When non-null we are inside a namespace block.
   * New classifiers get this namespace assigned.
   */
  activeNamespace: string | null;
  /**
   * When non-null we are inside a multi-line note block (attached or
   * freestanding). Lines accumulate as note text until `end note`.
   */
  pendingNote: PendingNote | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultAST(): ClassDiagramAST {
  return {
    classifiers: [],
    relationships: [],
    namespaces: [],
    directives: [],
    notes: [],
  };
}

/** Append an attached (`note <pos> of <Entity>`) note with a generated layout id. */
function addNote(
  state: ParseState,
  position: NotePosition,
  target: string,
  text: string,
): void {
  state.ast.notes.push({
    id: `__note_${state.ast.notes.length}`,
    target: stripQuotes(target),
    position,
    text,
  });
}

/**
 * Append a freestanding (`note as <alias>`) note. Its id is the
 * user-declared alias — not the `__note_N` scheme used for attached notes —
 * so a later relationship line can resolve `alias` back to this note
 * instead of accidentally creating a phantom classifier for it.
 */
function addFreestandingNote(state: ParseState, alias: string, text: string): void {
  state.ast.notes.push({
    id: stripQuotes(alias),
    text,
  });
}

/** Close out the current pendingNote block (attached or freestanding). */
function finalizePendingNote(state: ParseState, note: PendingNote): void {
  const text = note.textLines.join('\n');
  if (note.kind === 'attached') {
    addNote(state, note.position, note.target, text);
  } else {
    addFreestandingNote(state, note.alias, text);
  }
}

/** True if `id` refers to an already-parsed note (attached or freestanding). */
function isNoteId(state: ParseState, id: string): boolean {
  return state.ast.notes.some((n) => n.id === id);
}

/** Build a fresh Classifier, assigning the active namespace if one is open. */
function makeClassifier(
  state: ParseState,
  id: string,
  kind: ClassifierKind,
  display: string | undefined,
): Classifier {
  return {
    id,
    display: display ?? id,
    kind,
    typeParams: [],
    members: [],
    ...(state.activeNamespace !== null
      ? { namespace: state.activeNamespace }
      : {}),
  };
}

/** Register a classifier id with the active namespace, if one is open. */
function registerInNamespace(state: ParseState, id: string): void {
  if (state.activeNamespace === null) return;
  const ns = state.ast.namespaces.find((n) => n.id === state.activeNamespace);
  if (ns !== undefined) {
    ns.classifiers.push(id);
  }
}

/**
 * Open a `package`/`namespace` block: mark it the active container and create
 * the Namespace entry if it does not already exist. Both keywords map to the
 * same GroupType.PACKAGE container upstream (CommandPackage/CommandNamespace
 * both call `gotoGroup(..., GroupType.PACKAGE, ...)`); they differ only in the
 * USymbol used for rendering, which does not affect DOT cluster structure.
 */
function openNamespaceBlock(state: ParseState, id: string, display: string): void {
  state.activeNamespace = id;
  const existing = state.ast.namespaces.find((n) => n.id === id);
  if (existing === undefined) {
    state.ast.namespaces.push({ id, display, classifiers: [] });
  }
}

/** Ensure a classifier exists with the given id; create if absent. */
function ensureClassifier(
  state: ParseState,
  id: string,
  kind: ClassifierKind = 'class',
  display?: string,
): Classifier {
  const existing = state.classifierIndex.get(id);
  if (existing !== undefined) {
    return state.ast.classifiers[existing]!;
  }
  const classifier = makeClassifier(state, id, kind, display);
  const idx = state.ast.classifiers.length;
  state.ast.classifiers.push(classifier);
  state.classifierIndex.set(id, idx);
  registerInNamespace(state, id);
  return classifier;
}

// ---------------------------------------------------------------------------
// Command dispatch table
// ---------------------------------------------------------------------------

interface Command {
  pattern: RegExp;
  execute(state: ParseState, match: RegExpExecArray): void;
}

/**
 * Order matters: patterns are tested top-to-bottom; first match wins.
 */
const COMMANDS: readonly Command[] = [
  // 1. Ignore: comments starting with '
  {
    pattern: /^'/,
    execute() { /* no-op */ },
  },

  // 2. Ignore: skinparam and title lines
  {
    pattern: /^(skinparam|title\s)/i,
    execute() { /* no-op */ },
  },

  // 3. hide/show directives — parse and store; unrecognised targets are ignored
  {
    pattern: /^(hide|show)\s/i,
    execute(state, match) {
      const directive = parseHideShowDirective(match.input);
      if (directive !== null) {
        state.ast.directives.push(directive);
      }
    },
  },

  // 4. Closing brace — ends a pending body or namespace block
  {
    pattern: /^\}\s*$/,
    execute(state) {
      if (state.pendingBodyId !== null) {
        state.pendingBodyId = null;
      } else if (state.activeNamespace !== null) {
        state.activeNamespace = null;
      }
    },
  },

  // 5. Namespace block: namespace com.example {, namespace A #color {,
  //    namespace A <<Stereo>> {. The name stops at the first space, '#'
  //    (color), or '<' (stereotype); any trailing decoration up to '{' is
  //    ignored — it does not affect DOT cluster structure.
  {
    pattern: /^namespace\s+("[^"]*"|[^\s#<{]+)\s*(?:[#<][^{]*)?\{?\s*$/i,
    execute(state, match) {
      const nsId = stripQuotes(match[1]!);
      openNamespaceBlock(state, nsId, nsId);
    },
  },

  // 5b. Package block: package Name {, package "Some Group" {,
  //     package Foo <<Stereo>> {, package Bar #DDDDDD {, or anonymous
  //     package {. Upstream routes this through the same PACKAGE group as
  //     namespace (CommandPackage.executeArg → gotoGroup(GroupType.PACKAGE)),
  //     so it produces a cluster just like a namespace does. Trailing
  //     decoration (color/stereotype) up to '{' is ignored for DOT structure.
  {
    pattern: /^package\b\s*("[^"]*"|[^\s#<{]+)?\s*(?:[#<][^{]*)?\{\s*$/i,
    execute(state, match) {
      const raw = match[1];
      if (raw !== undefined) {
        const name = stripQuotes(raw);
        openNamespaceBlock(state, name, name);
      } else {
        const id = '__pkg' + String(state.ast.namespaces.length);
        openNamespaceBlock(state, id, '');
      }
    },
  },

  // 6. Classifier declarations.
  //    Must come before relationship detection because "class Foo {" could
  //    otherwise partially match arrow patterns.
  {
    pattern: /^(?:abstract\s+class|class|interface|enum|annotation)\s+/i,
    execute(state, match) {
      // match.input is always a string on a successful RegExp match
      const decl = parseClassifierDecl(match.input);
      if (decl === null) return;

      const classifier = ensureClassifier(
        state,
        decl.id,
        decl.kind,
        decl.display,
      );
      classifier.kind = decl.kind;
      if (decl.typeParams.length > 0) {
        classifier.typeParams = decl.typeParams;
      }
      if (decl.stereotype !== undefined) {
        classifier.stereotype = decl.stereotype;
      }
      if (decl.color !== undefined) {
        classifier.color = decl.color;
      }

      // Handle inline members from single-line body: class Foo { +bar() }
      for (const memberStr of decl.inlineMembers) {
        const member = parseMemberLine(memberStr);
        if (member !== null) {
          classifier.members.push(member);
        }
      }

      if (decl.opensBody) {
        state.pendingBodyId = decl.id;
      }
    },
  },

  // 6b. Single-line note on entity: note <pos> of <Entity> : text
  {
    pattern: /^note\s+(left|right|top|bottom)\s+of\s+(\w+|"[^"]+")\s*:\s*(.+)$/i,
    execute(state, match) {
      addNote(
        state,
        match[1]!.toLowerCase() as NotePosition,
        match[2]!,
        match[3]!.trim(),
      );
    },
  },

  // 6c. Multi-line note on entity opener: note <pos> of <Entity>  (… end note)
  {
    pattern: /^note\s+(left|right|top|bottom)\s+of\s+(\w+|"[^"]+")\s*$/i,
    execute(state, match) {
      state.pendingNote = {
        kind: 'attached',
        position: match[1]!.toLowerCase() as NotePosition,
        target: match[2]!,
        textLines: [],
      };
    },
  },

  // 6d. Multi-line freestanding note opener: note as <alias>  (… end note)
  //     Unattached: no host entity, no position. Referenced later by a
  //     plain relationship line, e.g. `N4 .> DrawableAdapter`.
  {
    pattern: /^note\s+as\s+(\w+|"[^"]+")\s*$/i,
    execute(state, match) {
      state.pendingNote = {
        kind: 'freestanding',
        alias: match[1]!,
        textLines: [],
      };
    },
  },

  // 7. Standalone member: ClassName : +member
  //    Must come before relationship detection to avoid colon ambiguity.
  //    Negative lookahead `(?!:)` on the colon keeps this from swallowing
  //    `Class::member` port syntax (`ClassB::b <-- pack.ClassA::a`) — that
  //    double-colon belongs to rule 8's relationship parsing, not here.
  {
    pattern: /^(\w+)\s*:(?!:)\s*(.+)$/,
    execute(state, match) {
      const classId = match[1]!;
      const memberStr = match[2]!.trim();
      const classifier = ensureClassifier(state, classId);
      const member = parseMemberLine(memberStr);
      if (member !== null) {
        classifier.members.push(member);
      }
    },
  },

  // 8. Relationship lines.
  //    The dispatch pattern mirrors REL_RE's endpoint/qualifier/arrow
  //    alternatives (built from the same CLASS_ID/REL_ARROW fragments) so
  //    that only genuine relationship lines reach parseRelationshipLine.
  {
    pattern: REL_DISPATCH_RE,
    execute(state, match) {
      // match.input is always a string on a successful RegExp match
      const rel = parseRelationshipLine(match.input);
      if (rel === null) return;
      // A note-referencing endpoint (e.g. `N4 .> DrawableAdapter`) must not
      // spawn a phantom classifier for the note's alias.
      if (!isNoteId(state, rel.from)) ensureClassifier(state, rel.from);
      if (!isNoteId(state, rel.to)) ensureClassifier(state, rel.to);
      state.ast.relationships.push(rel);
    },
  },
];

// ---------------------------------------------------------------------------
// Main parser entry point
// ---------------------------------------------------------------------------

/**
 * Parse a preprocessed PlantUML class diagram block into an AST.
 */
/**
 * Consume a line while inside a multi-line note block, accumulating text until
 * `end note`. Returns true when the line was consumed (i.e. a note was open).
 */
function handlePendingNoteLine(state: ParseState, line: string): boolean {
  if (state.pendingNote === null) return false;
  if (/^end\s*note\s*$/i.test(line)) {
    finalizePendingNote(state, state.pendingNote);
    state.pendingNote = null;
  } else {
    state.pendingNote.textLines.push(line);
  }
  return true;
}

/**
 * Consume a line while inside an open brace body, treating it as a member
 * definition until `}` closes it. Returns true when the line was consumed
 * (i.e. a body was open).
 */
function handlePendingBodyLine(state: ParseState, line: string): boolean {
  if (state.pendingBodyId === null) return false;
  if (/^\}\s*$/.test(line)) {
    state.pendingBodyId = null;
    return true;
  }
  const idx = state.classifierIndex.get(state.pendingBodyId);
  if (idx !== undefined) {
    const classifier = state.ast.classifiers[idx];
    if (classifier !== undefined) {
      const member = parseMemberLine(line);
      if (member !== null) {
        classifier.members.push(member);
      }
    }
  }
  return true;
}

/** Dispatch a line to the first matching command. */
function dispatchCommand(state: ParseState, line: string): void {
  for (const cmd of COMMANDS) {
    const match = cmd.pattern.exec(line);
    if (match !== null) {
      cmd.execute(state, match);
      break;
    }
  }
}

export function parseClass(block: UmlSource): ClassDiagramAST {
  const state: ParseState = {
    ast: makeDefaultAST(),
    classifierIndex: new Map(),
    pendingBodyId: null,
    activeNamespace: null,
    pendingNote: null,
  };

  for (const rawLine of block.lines) {
    const line = rawLine.trim();
    if (line === '') continue;
    if (handlePendingNoteLine(state, line)) continue;
    if (handlePendingBodyLine(state, line)) continue;
    dispatchCommand(state, line);
  }

  // Post-processing: apply all hide/show directives to the AST
  applyDirectives(state.ast);

  return state.ast;
}

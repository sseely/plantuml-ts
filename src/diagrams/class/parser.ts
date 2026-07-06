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
  HideShowDirective,
  HideTarget,
  NotePosition,
} from './ast.js';
import { parseClassifierDecl } from './class-declaration-parser.js';
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
  const classifier: Classifier = {
    id,
    display: display ?? id,
    kind,
    typeParams: [],
    members: [],
    ...(state.activeNamespace !== null
      ? { namespace: state.activeNamespace }
      : {}),
  };
  const idx = state.ast.classifiers.length;
  state.ast.classifiers.push(classifier);
  state.classifierIndex.set(id, idx);

  // Register with active namespace if present
  if (state.activeNamespace !== null) {
    const ns = state.ast.namespaces.find(
      (n) => n.id === state.activeNamespace,
    );
    if (ns !== undefined) {
      ns.classifiers.push(id);
    }
  }

  return classifier;
}

// ---------------------------------------------------------------------------
// Hide/show directive parsing
// ---------------------------------------------------------------------------

/**
 * Map from the lowercase target string to the canonical HideTarget value.
 * Only the supported global targets are listed here.
 */
const HIDE_TARGET_MAP: Record<string, HideTarget> = {
  'empty members': 'empty members',
  'members':       'members',
  'circle':        'circle',
  'empty fields':  'empty fields',
  'empty methods': 'empty methods',
};

/**
 * Parse a hide/show directive line.
 * Returns null if the line is not a recognised directive.
 *
 * Matches lines of the form:
 *   hide empty members
 *   hide members
 *   hide circle
 *   hide empty fields
 *   hide empty methods
 *   show <same targets>
 */
function parseHideShowDirective(line: string): HideShowDirective | null {
  const m = /^(hide|show)\s+(.+)$/i.exec(line);
  if (m === null) return null;

  const action = m[1]!.toLowerCase() as 'hide' | 'show';
  const targetStr = m[2]!.trim().toLowerCase();
  const target = HIDE_TARGET_MAP[targetStr];
  if (target === undefined) return null;

  return { kind: 'hideshow', action, target };
}

// ---------------------------------------------------------------------------
// Post-processing: apply directives to the AST
// ---------------------------------------------------------------------------

/**
 * Apply the accumulated hide/show directives to classifiers and their members.
 * Later directives (higher index in the array) override earlier ones because
 * show/hide are additive and last-writer-wins per target.
 *
 * Effective state is determined by scanning directives in order; for each
 * target the last action seen wins.
 *
 * Note on hide empty fields / hide empty methods:
 *   These directives affect the divider/section visibility, which is computed in
 *   layout (layoutClass reads ast.directives directly). No per-member flag is
 *   needed here — the directives are already stored in ast.directives for layout.
 */
function applyDirectives(ast: ClassDiagramAST): void {
  if (ast.directives.length === 0) return;

  // Resolve the final effective action for each target (last wins).
  const effectiveAction = new Map<HideTarget, 'hide' | 'show'>();
  for (const directive of ast.directives) {
    effectiveAction.set(directive.target, directive.action);
  }

  const hideMembers = effectiveAction.get('members') === 'hide';
  const hideCircle  = effectiveAction.get('circle')  === 'hide';

  for (const classifier of ast.classifiers) {
    // hide circle — suppress the C/I/A/E badge in the renderer
    if (hideCircle) {
      classifier.hideCircle = true;
    }

    // hide members — mark every member as hidden regardless of type
    if (hideMembers) {
      for (const member of classifier.members) {
        member.hidden = true;
      }
    }
  }
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

  // 5. Namespace block: namespace com.example {
  {
    pattern: /^namespace\s+(\S+)\s*\{?\s*$/i,
    execute(state, match) {
      const nsId = match[1]!;
      state.activeNamespace = nsId;
      const existing = state.ast.namespaces.find((n) => n.id === nsId);
      if (existing === undefined) {
        state.ast.namespaces.push({
          id: nsId,
          display: nsId,
          classifiers: [],
        });
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

    // If we are inside a multi-line note block, accumulate text until `end note`.
    if (state.pendingNote !== null) {
      if (/^end\s*note\s*$/i.test(line)) {
        finalizePendingNote(state, state.pendingNote);
        state.pendingNote = null;
      } else {
        state.pendingNote.textLines.push(line);
      }
      continue;
    }

    // If we are inside a multi-line body, treat lines as member defs
    if (state.pendingBodyId !== null) {
      if (/^\}\s*$/.test(line)) {
        state.pendingBodyId = null;
        continue;
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
      continue;
    }

    // Normal command dispatch
    for (const cmd of COMMANDS) {
      const match = cmd.pattern.exec(line);
      if (match !== null) {
        cmd.execute(state, match);
        break;
      }
    }
  }

  // Post-processing: apply all hide/show directives to the AST
  applyDirectives(state.ast);

  return state.ast;
}

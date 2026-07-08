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
import {
  applyAssocCouple,
  applyDoubleCouple,
  ASSOC_COUPLE_RE,
  ASSOC_DOUBLE_COUPLE_RE,
} from './class-assoc-couple.js';
import { parseClassifierDecl } from './class-declaration-parser.js';
import { applyDirectives, parseHideShowDirective } from './class-directives.js';
import { addNote, finalizePendingNote, isNoteId, type PendingNote } from './class-notes.js';
import {
  ensureNamespaceChain,
  makeClassifier,
  resolveReference,
  splitOnSeparator,
} from './class-namespace.js';
import { parseMemberLine } from './class-member-parser.js';
import {
  parseRelationshipLine,
  REL_DISPATCH_RE,
  stripQuotes,
} from './class-relationship-parser.js';

// ---------------------------------------------------------------------------
// Mutable parse state (local to each parseClass call)
// ---------------------------------------------------------------------------

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
  /**
   * The namespace separator for splitting dotted ids into nested namespaces.
   * Defaults to `.` (AbstractEntityDiagram.java:88); `set namespaceSeparator`
   * or `set separator` overrides it, and `none` (→ null) disables splitting.
   */
  namespaceSeparator: string | null;
  /** `!pragma useIntermediatePackages false` collapses a dotted id to one
   *  namespace instead of a nested chain (default true). */
  intermediatePackages: boolean;
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

/** Register a classifier id with the given namespace, if one is set. */
function registerInNamespace(state: ParseState, nsId: string | null, id: string): void {
  if (nsId === null) return;
  const ns = state.ast.namespaces.find((n) => n.id === nsId);
  if (ns !== undefined) {
    ns.classifiers.push(id);
  }
}

/**
 * Open a `package`/`namespace` block: mark it the active container, splitting a
 * dotted name into a nested chain. Both keywords map to the same
 * GroupType.PACKAGE container upstream (gotoGroup(GroupType.PACKAGE)); the
 * USymbol difference does not affect DOT cluster structure.
 */
function openNamespaceBlock(state: ParseState, id: string, display: string): void {
  const segments = splitOnSeparator(id, state.namespaceSeparator);
  if (segments !== null) {
    state.activeNamespace = ensureNamespaceChain(
      state.ast.namespaces,
      state.namespaceSeparator ?? '.',
      segments,
    );
    return;
  }
  state.activeNamespace = id;
  if (state.ast.namespaces.find((n) => n.id === id) === undefined) {
    state.ast.namespaces.push({ id, display, classifiers: [] });
  }
}

/**
 * Ensure a classifier exists for the raw reference; create if absent. The
 * reference is resolved to a fully-qualified (namespace-aware) id, so the
 * returned `id` may differ from `rawName` — callers storing the reference
 * elsewhere (relationships, body opener) must use the returned `id`.
 */
function ensureClassifier(
  state: ParseState,
  rawName: string,
  kind: ClassifierKind = 'class',
  display?: string,
): Classifier {
  const { id, nsId, display: disp } = resolveReference({
    namespaces: state.ast.namespaces,
    sep: state.namespaceSeparator,
    activeNamespace: state.activeNamespace,
    name: rawName,
    display,
    intermediatePackages: state.intermediatePackages,
  });
  const existing = state.classifierIndex.get(id);
  if (existing !== undefined) {
    return state.ast.classifiers[existing]!;
  }
  const classifier = makeClassifier(id, kind, disp, nsId);
  const idx = state.ast.classifiers.length;
  state.ast.classifiers.push(classifier);
  state.classifierIndex.set(id, idx);
  registerInNamespace(state, nsId, id);
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

  // 1b. `left to right direction` → rankdir LR (upstream CommandRankDir).
  //     `top to bottom direction` is a no-op (TB is the default). Both must
  //     precede the skinparam/title ignore so they are consumed here.
  {
    pattern: /^left\s+to\s+right\s+direction\b/i,
    execute(state) {
      state.ast.rankdir = 'LR';
    },
  },
  {
    pattern: /^top\s+to\s+bottom\s+direction\b/i,
    execute() { /* no-op — TB is the default */ },
  },

  // 2. Ignore: skinparam and title lines
  {
    pattern: /^(skinparam|title\s)/i,
    execute() { /* no-op */ },
  },

  // 2b. Namespace separator directive: `set namespaceSeparator ::`,
  //     `set separator .`, or `set separator none` (disables splitting).
  {
    pattern: /^set\s+(?:namespace)?separator\s+(\S+)\s*$/i,
    execute(state, match) {
      const value = match[1]!;
      state.namespaceSeparator = /^none$/i.test(value) ? null : value;
    },
  },

  // 2c. `!pragma useIntermediatePackages false` — collapse a dotted id to a
  //     single namespace instead of a nested chain.
  {
    pattern: /^!pragma\s+useintermediatepackages\s+(true|false)\s*$/i,
    execute(state, match) {
      state.intermediatePackages = !/^false$/i.test(match[1]!);
    },
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

  // 5. Namespace block. The name stops at the first space/'#'/'<'; any trailing
  //    decoration (color/stereotype) up to '{' is ignored (no DOT effect).
  {
    pattern: /^namespace\s+("[^"]*"|[^\s#<{]+)\s*(?:[#<][^{]*)?\{?\s*$/i,
    execute(state, match) {
      const nsId = stripQuotes(match[1]!);
      openNamespaceBlock(state, nsId, nsId);
    },
  },

  // 5b. Package block (named/quoted/stereotyped/colored/anonymous). Upstream
  //     routes package through the same PACKAGE group as namespace
  //     (CommandPackage → gotoGroup(GroupType.PACKAGE)), so it clusters alike.
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

  // 5c. Association diamond: `<> name` (CommandDiamondAssociation) — a
  //     diamond-shaped n-ary/association-class connector node.
  {
    pattern: /^<>\s+(\S+)\s*$/,
    execute(state, match) {
      // Force kind even if a relationship endpoint auto-created it as a class.
      ensureClassifier(state, match[1]!, 'association').kind = 'association';
    },
  },

  // 5d. Association-class couple. Double `(A,B).(C,D)` before single `(A,B)..C`.
  {
    pattern: ASSOC_DOUBLE_COUPLE_RE,
    execute(state, match) {
      applyDoubleCouple(state.ast, (id) => ensureClassifier(state, id), match.input);
    },
  },
  {
    pattern: ASSOC_COUPLE_RE,
    execute(state, match) {
      applyAssocCouple(state.ast, (id) => ensureClassifier(state, id), match.input);
    },
  },

  // 6. Relationship lines — BEFORE classifier declarations so a class NAMED
  //    like a keyword used as a relationship endpoint (`CLASS *-- f1`, where
  //    `CLASS` is a class named "CLASS") is parsed as a relationship, not a
  //    declaration named `*-- f1`. Declarations never match REL_DISPATCH_RE
  //    (they carry no arrow), so this ordering does not steal them. The dispatch
  //    pattern mirrors REL_RE's endpoint/qualifier/arrow alternatives (built from
  //    the same CLASS_ID/REL_ARROW fragments) so only genuine relationship lines
  //    reach parseRelationshipLine.
  {
    pattern: REL_DISPATCH_RE,
    execute(state, match) {
      // match.input is always a string on a successful RegExp match
      const rel = parseRelationshipLine(match.input);
      if (rel === null) return;
      // A note-referencing endpoint (e.g. `N4 .> DrawableAdapter`) must not
      // spawn a phantom classifier for the note's alias. For class endpoints,
      // rewrite from/to to the resolved fully-qualified id so the edge connects
      // the same node the (namespace-qualified) classifier was created under.
      if (!isNoteId(state.ast, rel.from)) rel.from = ensureClassifier(state, rel.from).id;
      if (!isNoteId(state.ast, rel.to)) rel.to = ensureClassifier(state, rel.to).id;
      state.ast.relationships.push(rel);
    },
  },

  // 7. Classifier declarations.
  {
    pattern: /^(?:abstract\s+class|class|interface|enum|annotation|entity|circle)\s+/i,
    execute(state, match) {
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
        state.pendingBodyId = classifier.id;
      }
    },
  },

  // 6b. Single-line note on entity: note <pos> of <Entity> : text
  {
    pattern: /^note\s+(left|right|top|bottom)\s+of\s+(\w+|"[^"]+")\s*:\s*(.+)$/i,
    execute(state, match) {
      addNote(state.ast, match[1]!.toLowerCase() as NotePosition, match[2]!, match[3]!.trim());
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

  // 6d. Multi-line freestanding note opener: note as <alias> (… end note).
  //     Unattached; referenced later by a relationship (`N4 .> Drawable`).
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

  // 7. Standalone member: `ClassName : +member`. Before relationship detection;
  //    the `(?!:)` lookahead leaves `Class::member` port syntax to rule 8.
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
    finalizePendingNote(state.ast, state.pendingNote);
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
    namespaceSeparator: '.',
    intermediatePackages: true,
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

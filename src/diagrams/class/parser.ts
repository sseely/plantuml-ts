/**
 * Parser for PlantUML class diagrams.
 *
 * Uses a command-dispatch table: an array of { pattern, execute } objects
 * tested against each trimmed line in priority order. First match wins.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type { ClassDiagramAST, Classifier, ClassifierKind } from './ast.js';
import { applyDirectives } from './class-directives.js';
import { finalizePendingNote, type PendingNote } from './class-notes.js';
import { makeClassifier, resolveReference } from './class-namespace.js';
import { parseMemberLine } from './class-member-parser.js';
import { stripQuotes } from './class-relationship-parser.js';
import { COMMANDS } from './class-commands.js';

// ---------------------------------------------------------------------------
// Mutable parse state (local to each parseClass call)
// ---------------------------------------------------------------------------

export interface ParseState {
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
  /**
   * Namespace id → usymbol for *descriptive* containers (`rectangle`/`component`/
   * `stack`/… opened with a `{` body — not a plain `package`). Used on `}` close
   * to convert an EMPTY descriptive container into a rect leaf (upstream renders
   * an empty descriptive-element box as a rect, whereas an empty package vanishes).
   */
  descriptiveContainers: Map<string, string>;
  /**
   * Enclosing-container ids saved when a brace container opens, so a `}`
   * restores the parent container. The flat `activeNamespace` alone cannot nest
   * brace-delimited containers (`package { rectangle { … } }`).
   */
  namespaceStack: (string | null)[];
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
 * Ensure a classifier exists for the raw reference; create if absent. The
 * reference is resolved to a fully-qualified (namespace-aware) id, so the
 * returned `id` may differ from `rawName` — callers storing the reference
 * elsewhere (relationships, body opener) must use the returned `id`.
 */
export function ensureClassifier(
  state: ParseState,
  rawName: string,
  kind: ClassifierKind = 'class',
  display?: string,
): Classifier {
  const { id, nsId, display: disp } = resolveReference({
    namespaces: state.ast.namespaces,
    sep: state.namespaceSeparator,
    activeNamespace: state.activeNamespace,
    // Strip surrounding quotes so a quoted name (`"side1"`) resolves to the same
    // id whether it comes from a declaration, a relationship, or an assoc-couple.
    name: stripQuotes(rawName),
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
    descriptiveContainers: new Map(),
    namespaceStack: [],
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

/**
 * Parser for PlantUML class diagrams.
 *
 * Uses a command-dispatch table: an array of { pattern, execute } objects
 * tested against each trimmed line in priority order. First match wins.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type { ClassDiagramAST, Classifier, ClassifierKind } from './ast.js';
import { applyDirectives } from './class-directives.js';
import { finalizePendingNote, isNoteCloser, type PendingNote } from './class-notes.js';
import {
  makeClassifier,
  normalizeSameConnectionLengths,
  registerInNamespace,
  resolveReference,
} from './class-namespace.js';
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
   * `$tag` names captured by a multi-line freestanding note opener
   * (`note as N1 $z` … `end note`), attached to the note when the block
   * finalizes. Carried here rather than on `PendingNote` so the tag feature
   * stays within the command/parse seam. Reset together with `pendingNote`.
   * @see ~/git/plantuml/.../command/note/CommandFactoryNote.java:85 (TAGS)
   */
  pendingNoteTags: string[];
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
  /**
   * Namespace ids active when each open `together {` block started
   * (CommandTogether → CucaDiagram#gotoTogether pushes a Together entry on
   * the same stacks list as groups). Lets the `}` handler pop the innermost
   * together instead of the enclosing namespace — see closeBraceScope
   * (class-container.ts).
   */
  togetherStack: (string | null)[];
  /**
   * The most recently created entity's id — classifier OR note (upstream
   * `CucaDiagram#lastEntity`, set unconditionally by every `reallyCreateLeaf`
   * call). Used to resolve a `note <pos>` line whose `of <Entity>` clause is
   * omitted. `null` before any entity has been created, or right after a
   * `newpage` resets the diagram.
   * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:140,218-228,675-676
   */
  lastEntity: string | null;
  /**
   * Completed pages, in source order, accumulated by `newpage`
   * (upstream `NewpagedDiagram`). Does NOT include the in-progress
   * `state.ast` — that is appended once parsing finishes.
   */
  pages: ClassDiagramAST[];
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

/**
 * Ensure a classifier exists for the raw reference; create if absent. The
 * reference is resolved to a fully-qualified (namespace-aware) id, so the
 * returned `id` may differ from `rawName` — callers storing the reference
 * elsewhere (relationships, body opener) must use the returned `id`.
 *
 * `reuseExistingChild` mirrors upstream `quarkInContext`'s flag of the same
 * name: true at relation-endpoint sites (a bare name may resolve to an
 * existing classifier declared elsewhere), false at declaration sites
 * (always scope-local, upstream `CommandCreateClass`). Defaults to false so
 * every pre-existing declaration call site is unaffected; endpoint call
 * sites pass `true` explicitly.
 */
export function ensureClassifier(
  state: ParseState,
  rawName: string,
  kind: ClassifierKind = 'class',
  display?: string,
  reuseExistingChild = false,
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
    classifiers: state.ast.classifiers,
    reuseExistingChild,
  });
  const existing = state.classifierIndex.get(id);
  if (existing !== undefined) {
    return state.ast.classifiers[existing]!;
  }
  const classifier = makeClassifier(id, kind, disp, nsId);
  const idx = state.ast.classifiers.length;
  state.ast.classifiers.push(classifier);
  state.classifierIndex.set(id, idx);
  registerInNamespace(state.ast.namespaces, nsId, id);
  // Mirrors upstream `reallyCreateLeaf` (CucaDiagram.java:218-228), which
  // unconditionally sets `lastEntity` on every leaf creation. ensureClassifier
  // is the single creation chokepoint for both declarations and
  // relationship-endpoint auto-create, so this covers both call sites —
  // matching upstream, where both paths also funnel through reallyCreateLeaf.
  state.lastEntity = id;
  return classifier;
}

/**
 * `newpage` (CommandNewpage): finalize the current page and start an
 * entirely fresh one. Upstream creates a brand-new empty diagram
 * (`factory.createEmptyDiagram`) and wraps the pair in `NewpagedDiagram`,
 * which routes every subsequent command to `getLastDiagram()` — only `dpi`
 * carries over, which this parser does not model, so a page reset here
 * means every mutable field returns to its `parseClass` initial value.
 * @see ~/git/plantuml/.../descdiagram/command/CommandNewpage.java:77-88
 * @see ~/git/plantuml/.../NewpagedDiagram.java:61-162
 */
export function startNewPage(state: ParseState): void {
  // checkFinalError's same-pair length normalization runs per finished
  // diagram (ClassDiagram.java:74-82) — a page is a finished diagram.
  normalizeSameConnectionLengths(state.ast.relationships);
  applyDirectives(state.ast);
  state.pages.push(state.ast);
  state.ast = makeDefaultAST();
  state.classifierIndex = new Map();
  state.pendingBodyId = null;
  state.activeNamespace = null;
  state.pendingNote = null;
  state.pendingNoteTags = [];
  state.namespaceSeparator = '.';
  state.intermediatePackages = true;
  state.descriptiveContainers = new Map();
  state.namespaceStack = [];
  state.togetherStack = [];
  state.lastEntity = null;
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
  if (isNoteCloser(state.pendingNote, line)) {
    const id = finalizePendingNote(state.ast, state.pendingNote);
    if (id !== undefined) {
      state.lastEntity = id;
      // Attach `$tag`s captured on the opener (multi-line freestanding note).
      if (state.pendingNoteTags.length > 0) {
        const note = state.ast.notes.find((n) => n.id === id);
        if (note !== undefined) note.tags = state.pendingNoteTags;
      }
    }
    state.pendingNote = null;
    state.pendingNoteTags = [];
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

/**
 * Merge a standalone `{` line into the immediately preceding non-blank line
 * (dropping blank lines, which the main parse loop below skips anyway).
 *
 * Upstream's `class`/`package`/`namespace`/`interface`/… body-openers
 * (`CommandCreateClassMultilines`, `CommandPackage`, …) all declare
 * `syntaxWithFinalBracket() == true` (SingleLineCommand2.java:65-67):
 * when such a command's own line doesn't end in `{`, the framework peeks at
 * the NEXT line, and if it is EXACTLY `{`, merges the two into one logical
 * line before regex matching (`SingleLineCommand2.java:83-100`). So
 * `package foo <<Node>>` / `{` on its own next line is equivalent to
 * `package foo <<Node>> {` on one line — not a variant syntax our regexes
 * need to special-case individually, but a line-merge that applies before
 * ANY command dispatch (verified against dativu-93-pona469: without the
 * merge, `package foo <<Node>>` fails every command pattern and is
 * silently dropped, so `class A`/`class B` parse with no active namespace
 * and land outside any cluster).
 */
function mergeStandaloneBraces(lines: readonly string[]): string[] {
  const merged: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    if (trimmed === '{' && merged.length > 0 && !merged[merged.length - 1]!.endsWith('{')) {
      merged[merged.length - 1] += ' {';
      continue;
    }
    merged.push(trimmed);
  }
  return merged;
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
    pendingNoteTags: [],
    descriptiveContainers: new Map(),
    namespaceStack: [],
    togetherStack: [],
    lastEntity: null,
    pages: [],
  };

  for (const line of mergeStandaloneBraces(block.lines)) {
    if (handlePendingNoteLine(state, line)) continue;
    if (handlePendingBodyLine(state, line)) continue;
    dispatchCommand(state, line);
  }

  return finalizeParse(state);
}

/** Post-processing: same-pair length normalization (checkFinalError,
 *  ClassDiagram.java:74-82), hide/show directives, then page assembly. */
function finalizeParse(state: ParseState): ClassDiagramAST {
  normalizeSameConnectionLengths(state.ast.relationships);
  applyDirectives(state.ast);

  // Single page (the common case): no `pages` field, AST unchanged.
  if (state.pages.length === 0) {
    return state.ast;
  }

  // Multi-page: the first page carries `pages` (itself included), per the
  // T6 interface contract consumed by layoutClass (T7).
  state.pages.push(state.ast);
  state.pages[0]!.pages = state.pages;
  return state.pages[0]!;
}

/**
 * Parser for PlantUML class diagrams.
 *
 * Uses a command-dispatch table: an array of { pattern, execute } objects
 * tested against each trimmed line in priority order. First match wins.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type { ClassDiagramAST, Classifier, ClassifierKind } from './ast.js';
import { applyDirectives, applyVisibilityHideShow } from './class-directives.js';
import { finalizePendingNote, isNoteCloser, type PendingNote } from './class-notes.js';
import { createAnnotations, matchAnnotationCommand } from '../../core/annotations/index.js';
import { createSpriteRegistry, matchSpriteCommand } from '../../core/sprite-commands.js';
import {
  makeClassifier,
  normalizeSameConnectionLengths,
  registerInNamespace,
  resolveReference,
} from './class-namespace.js';
import { parseMemberLine } from './class-member-parser.js';
import { parseObjectField } from './class-object-commands.js';
import { applyMapBodyLine } from './class-map-commands.js';
import { finalizeJsonBody } from './class-json-commands.js';
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
   * Raw body lines accumulated for a pending `json Name { ... }` classifier
   * (kind `'json'` only — a map/object/class body is parsed line-by-line
   * instead, see handlePendingBodyLine). Parsed as ONE JSON blob by
   * `finalizeJsonBody` (class-json-commands.ts) when the closing `}` line is
   * reached — a single body line (e.g. `"name": "component c1",`) is not
   * independently valid JSON, unlike a map/object body line. Reset on every
   * body close and on `newpage`.
   */
  pendingJsonLines: string[];
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
  /**
   * G2 N2 (mechanism 3, entity/cluster/link `<g>` wrapping + uid
   * assignment): shared parse-time creation counter, mirroring upstream
   * `CucaDiagram#cpt1` (`AtomicInteger`, `getUniqueSequenceValue()`).
   * Stamped onto `Classifier.creationIndex`/`Namespace.creationIndex`/
   * `Relationship.creationIndex` at their respective creation chokepoints
   * (`ensureClassifier` below, `ensureNamespaceChain`, and the primary
   * relationship-dispatch site in `class-commands.ts`) — see those
   * fields' own doc comments for the exact/fallback gate this feeds.
   * Reset on `newpage` (a fresh page is a fresh upstream `CucaDiagram`).
   */
  creationCounter: { value: number };
  /**
   * G2 N9: 0-indexed source line of the CURRENT line being dispatched
   * (`UmlSource.linePositions[i]`, minimal "command-dispatch level"
   * tracking -- see `preprocessor.ts#PreprocessorResult.linePositions`'s
   * doc comment). `undefined` when the block carries no position data
   * (a hand-built literal `UmlSource` fixture) or the line was merged by
   * `mergeStandaloneBraces` from a position-less source. Read by the
   * relationship-dispatch command (`class-commands.ts`) to stamp
   * `Relationship.sourceLine`; not consulted by any other command this
   * iteration (narrowly scoped to the edge `<path codeLine="...">`
   * mechanism -- see `ast.ts#Relationship.sourceLine`'s doc comment).
   */
  currentLine?: number | undefined;
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
    annotations: createAnnotations(),
    sprites: createSpriteRegistry(),
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
    counter: state.creationCounter,
  });
  const existing = state.classifierIndex.get(id);
  if (existing !== undefined) {
    return state.ast.classifiers[existing]!;
  }
  const classifier = makeClassifier(id, kind, disp, nsId);
  // G2 N2 (mechanism 3): this is the single classifier-creation chokepoint
  // (declarations AND relationship-endpoint auto-create both funnel
  // through here — see this function's own doc comment) — see
  // ast.ts#Classifier.creationIndex's doc comment.
  state.creationCounter.value += 1;
  classifier.creationIndex = state.creationCounter.value;
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
  applyVisibilityHideShow(state.ast);
  state.pages.push(state.ast);
  state.ast = makeDefaultAST();
  state.classifierIndex = new Map();
  state.pendingBodyId = null;
  state.pendingJsonLines = [];
  state.activeNamespace = null;
  state.pendingNote = null;
  state.pendingNoteTags = [];
  state.namespaceSeparator = '.';
  state.intermediatePackages = true;
  state.descriptiveContainers = new Map();
  state.namespaceStack = [];
  state.togetherStack = [];
  state.lastEntity = null;
  state.creationCounter = { value: 0 };
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
    const id = finalizePendingNote(state.ast, state.pendingNote, state.creationCounter);
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
 * Close a pending `json { ... }` body, finalizing the accumulated raw lines
 * into `classifier.jsonValue` (class-json-commands.ts#finalizeJsonBody) —
 * called just before `handlePendingBodyLine` clears `pendingBodyId` on a
 * closing `}`. A no-op for every other pending kind (map/object/class), and
 * for the `''` duplicate-name sentinel (class-json-commands.ts#applyJsonOpen)
 * since `classifierIndex.get('')` always misses.
 */
function closeJsonBodyIfPending(state: ParseState): void {
  const idx = state.pendingBodyId !== null ? state.classifierIndex.get(state.pendingBodyId) : undefined;
  const classifier = idx !== undefined ? state.ast.classifiers[idx] : undefined;
  if (classifier !== undefined && classifier.kind === 'json') {
    finalizeJsonBody(classifier, state.pendingJsonLines);
  }
  state.pendingJsonLines = [];
}

/**
 * Consume a line while inside an open brace body, treating it as a member
 * definition until `}` closes it. Returns true when the line was consumed
 * (i.e. a body was open).
 */
function handlePendingBodyLine(state: ParseState, line: string): boolean {
  if (state.pendingBodyId === null) return false;
  if (/^\}\s*$/.test(line)) {
    closeJsonBodyIfPending(state);
    state.pendingBodyId = null;
    return true;
  }
  const idx = state.classifierIndex.get(state.pendingBodyId);
  if (idx !== undefined) {
    const classifier = state.ast.classifiers[idx];
    if (classifier !== undefined) {
      if (classifier.kind === 'map') {
        // Map bodies (`map Name { key => value / key *-> dest }`) collect
        // MapRow entries (and, for a linked entry, a Relationship) under
        // wholly different semantics than a member line — see
        // class-map-commands.ts#applyMapBodyLine's doc.
        applyMapBodyLine(state, classifier, line);
      } else if (classifier.kind === 'json') {
        // json bodies are not line-parseable individually (a bare
        // `"name": "component c1",` is not valid JSON on its own) — see
        // ParseState.pendingJsonLines' doc.
        state.pendingJsonLines.push(line);
      } else {
        // Object bodies (`object Foo { ... }`) collect raw field lines under
        // different semantics than class member lines — route by kind. See
        // class-object-commands.ts#parseObjectField's doc for why.
        const member =
          classifier.kind === 'object' ? parseObjectField(line) : parseMemberLine(line);
        if (member !== null) {
          classifier.members.push(member);
        }
      }
    }
  }
  return true;
}

/** Dispatch a line to the first matching command. Returns whether a
 *  command's pattern matched -- callers use this to decide whether to fall
 *  back to the annotation matcher (see `parseClass`'s doc: the generic
 *  `CODE : text` member-addition rule ("6-pre" above, upstream's
 *  `CommandAddMethod`) must win over a same-shaped `header: text`/
 *  `title: text` line, matching upstream's real registration order --
 *  `CommandAddMethod` before `CommonCommands.addTitleCommands`,
 *  ClassDiagramFactory.java:109,168). */
function dispatchCommand(state: ParseState, line: string): boolean {
  for (const cmd of COMMANDS) {
    const match = cmd.pattern.exec(line);
    if (match !== null) {
      cmd.execute(state, match);
      return true;
    }
  }
  return false;
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
interface MergedLines {
  readonly lines: string[];
  /** G2 N9: parallel to `lines` -- the ORIGINAL (pre-merge) position of
   *  each surviving entry, so `state.currentLine` stays accurate after
   *  blank-line dropping/brace-merging shrinks the array. A merged `{`
   *  line keeps the position of the line it merged INTO (the opener),
   *  matching upstream's own "peek at the next line" merge (the logical
   *  line's source position is the opener's, per `SingleLineCommand2
   *  .java:83-100`). */
  readonly positions: (number | undefined)[];
}

function mergeStandaloneBraces(
  lines: readonly string[],
  positions: readonly (number | undefined)[] = [],
): MergedLines {
  const merged: string[] = [];
  const mergedPositions: (number | undefined)[] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx]!;
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    if (trimmed === '{' && merged.length > 0 && !merged[merged.length - 1]!.endsWith('{')) {
      merged[merged.length - 1] += ' {';
      continue;
    }
    merged.push(trimmed);
    mergedPositions.push(positions[idx]);
  }
  return { lines: merged, positions: mergedPositions };
}

export function parseClass(block: UmlSource): ClassDiagramAST {
  const state: ParseState = {
    ast: makeDefaultAST(),
    classifierIndex: new Map(),
    namespaceSeparator: '.',
    intermediatePackages: true,
    pendingBodyId: null,
    pendingJsonLines: [],
    activeNamespace: null,
    pendingNote: null,
    pendingNoteTags: [],
    descriptiveContainers: new Map(),
    namespaceStack: [],
    togetherStack: [],
    lastEntity: null,
    pages: [],
    creationCounter: { value: 0 },
  };

  // Annotation commands (title/caption/legend/header/footer/mainframe) are
  // consulted AFTER the existing multiline constructs (note body, brace
  // body) have had a chance to claim the line -- decisions.md D3: a
  // `title`/`legend`-shaped line inside `note ... end note` or a class body
  // must stay note/member text, never annotation content. Also consulted
  // AFTER `dispatchCommand`/`COMMANDS` -- NOT "matcher first": upstream
  // registers `CommonCommands.addTitleCommands` near the END of
  // `ClassDiagramFactory#initCommandsList` (line 168 of ~170), AFTER the
  // generic `CODE : text` member-addition rule ("6-pre" above, upstream's
  // `CommandAddMethod`, line 109). A top-level `header: text`/`title: text`
  // line is therefore claimed by that member rule FIRST in real upstream
  // output (creating/appending to a classifier literally named `header`/
  // `title`), matching the identical ambiguity verified against the
  // desebo-47-maro096 state-diagram oracle (see state/parser.ts's doc) --
  // `dispatchCommand` returning `false` (no COMMANDS pattern matched) is
  // what makes a line eligible for the annotation fallback. This also
  // replaces the old `pendingLegend` strip (legend content now lands in
  // `state.ast.annotations.legend` instead of being discarded).
  const merged = mergeStandaloneBraces(block.lines, block.linePositions ?? []);
  const lines = merged.lines;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // G2 N9: current line's 0-indexed source position, for the
    // relationship-dispatch command's `Relationship.sourceLine` stamp --
    // see `ParseState.currentLine`'s doc comment.
    state.currentLine = merged.positions[i];
    if (handlePendingNoteLine(state, line)) continue;
    if (handlePendingBodyLine(state, line)) continue;
    if (dispatchCommand(state, line)) continue;
    // makeDefaultAST() always sets annotations; the field is optional on
    // ClassDiagramAST only so hand-authored literal fixtures elsewhere need
    // not include it (see ast.ts's doc on the field).
    const annotationMatch = matchAnnotationCommand(lines, i, state.ast.annotations!);
    if (annotationMatch !== null) {
      i += annotationMatch.consumed - 1;
      continue;
    }

    // `sprite $name [WxH/N[z]] { ... }` definitions (mission SI5b/T4): tried
    // immediately after the chrome matcher, same fallback dispatch position
    // (mirrors upstream registering `CommandFactorySprite` right after
    // `addTitleCommands`, ClassDiagramFactory.java:168-169).
    const spriteMatch = matchSpriteCommand(lines, i, state.ast.sprites!);
    if (spriteMatch !== null) {
      i += spriteMatch.consumed - 1;
      continue;
    }
  }

  return finalizeParse(state);
}

/** Post-processing: same-pair length normalization (checkFinalError,
 *  ClassDiagram.java:74-82), hide/show directives, then page assembly. */
function finalizeParse(state: ParseState): ClassDiagramAST {
  normalizeSameConnectionLengths(state.ast.relationships);
  applyDirectives(state.ast);
  applyVisibilityHideShow(state.ast);

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

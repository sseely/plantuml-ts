/**
 * Scope-stack machinery and shared mutation helpers for the state parser.
 *
 * Split out of `parser.ts` so `state-commands.ts` (the COMMANDS dispatch
 * table) can import these without a parser.ts <-> state-commands.ts import
 * cycle — mirrors the class engine's split between `parser.ts` (owns the
 * main loop) and `class-namespace.ts`/`class-notes.ts` (own the mutation
 * helpers command implementations call). Name-resolution mechanics (dotted
 * id splitting, global by-name reuse, `ensureState`/`declareState`) live in
 * `state-parse-resolve.ts` — split out under the 500-line file cap (mission
 * A4 Phase L iter 10).
 */

import type { State, StateKind, StateDiagramAST, Transition } from './ast.js';
import type { PendingNote } from './state-notes.js';
import { isSyncBarId } from './state-transitions.js';

// ---------------------------------------------------------------------------
// Parser passes
// ---------------------------------------------------------------------------

/**
 * Mirrors upstream `net.sourceforge.plantuml.command.ParserPass` (`ONE`,
 * `TWO`, `THREE`) — collapsed to two values here. Upstream runs the ENTIRE
 * source three times against ONE persistent entity/group tree: pass ONE
 * structurally creates every declaration
 * (`CommandCreateState`/`CommandCreatePackageState`/`CommandConcurrentState`/
 * `CommandEndState` are all eligible for every pass); pass TWO runs
 * transitions (`CommandLinkStateCommon`, TWO-only) and `note on link`
 * (`CommandFactoryNoteOnLink`, TWO-only). This port merges upstream's TWO
 * and THREE into a single `'two'` pass: nothing in this parser's note
 * handling depends on ALL transitions (across the WHOLE document) having
 * already run before ANY attached note resolves — that stronger ordering
 * guarantee only matters for a note that both (a) omits `of <State>` (falls
 * back to `lastEntity`) AND (b) textually precedes the transition that
 * would auto-create its intended target, which no fixture in the corpus
 * exercises. What DOES matter (and is why ONE is still split out from TWO)
 * is that every DECLARATION exists, in its true nested scope, before any
 * transition resolves an endpoint — that is what makes the global by-name
 * reuse (`state-parse-resolve.ts#resolveExistingState`) safe for forward
 * references.
 *
 * `parser.ts` walks the source text TWICE (once per pass) against the SAME
 * persistent scope tree (`ParseState.scopeByOwner`) rather than rebuilding
 * a fresh tree per pass (mirrors upstream's single-tree-visited-thrice
 * model) and is what lets a state created ONLY during pass ONE (e.g. an
 * implicit create from a standalone `CODE : text` line, `CommandAddField`
 * being ParserPass.ONE-only) survive into the final result even though
 * nothing references it again on pass TWO.
 * @see ~/git/plantuml/.../statediagram/StateDiagram.java#getRequiredPass
 * @see ~/git/plantuml/.../statediagram/command/CommandLinkStateCommon.java#isEligibleFor
 * @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java (CommandFactoryNoteOnEntity/OnLink pass args)
 */
export type Pass = 'one' | 'two';

// ---------------------------------------------------------------------------
// Pseudostate markers
// ---------------------------------------------------------------------------

/** The reserved pseudostate id used for initial and final transitions. */
export const PSEUDOSTATE = '[*]';

/** The shallow history pseudostate id. */
const HISTORY_SHALLOW = '[H]';

/** The deep history pseudostate id. */
const HISTORY_DEEP = '[H*]';

/**
 * Default namespace separator for state diagrams (`StateDiagram.java:62`,
 * `setNamespaceSeparator(".")` — same default as class diagrams, NOT
 * `null`). `set separator none`/`null` disables splitting entirely
 * (`ParseState.separator = null`) — every id, dotted or not, then resolves
 * via the flat global-uniqueness rule (`state-parse-resolve.ts`), same as
 * before mission A4 Phase L iter 10.
 * @see ~/git/plantuml/.../statediagram/StateDiagram.java:62
 */
export const DEFAULT_SEPARATOR = '.';

// ---------------------------------------------------------------------------
// Stereotype → StateKind mapping
// ---------------------------------------------------------------------------

/**
 * Upstream resolves a pseudostate's leaf type from the FIRST `<<label>>` in
 * a state's stereotype group (`Stereogroup#getLeafType`) — only these
 * labels are recognized; anything else keeps `LeafType.STATE` (our
 * `'normal'`). `junction` below is NOT an upstream keyword (no
 * `<<junction>>` stereotype exists in `Stereogroup.java`) — kept for
 * backward compatibility with pre-existing (invented) test coverage;
 * harmless since it never collides with a real upstream label.
 * `entrypoint`/`exitpoint` stay OUT of this table on purpose (see the
 * table's own comment) — a separate classification axis, not a StateKind.
 * @see ~/git/plantuml/.../stereo/Stereogroup.java#getLeafType
 */
const STEREOTYPE_KIND_MAP: Readonly<Record<string, StateKind>> = {
  choice: 'choice',
  fork: 'fork',
  join: 'join',
  junction: 'junction',
  history: 'history',
  // Real upstream key is `history*` (Stereogroup.java:127-128), not
  // `deephistory` — both map here so pre-existing `<<deepHistory>>`
  // fixtures/tests keep working while the faithful `<<history*>>` spelling
  // now also resolves correctly.
  'history*': 'deepHistory',
  deephistory: 'deepHistory',
  // Named (non-anonymous) initial/final pseudostates: `state X <<start>>` /
  // `state X <<end>>` reuse the `'initial'`/`'final'` StateKind values that
  // were previously reserved-but-unused (only the anonymous `[*]` sentinel
  // used them, and `[*]` is never turned into a State node at all).
  start: 'initial',
  end: 'final',
  // `<<entrypoint>>`/`<<exitpoint>>` are deliberately ABSENT here (mission
  // A4/T4 fact-4): Stereogroup.java has no such case, so upstream keeps
  // these `LeafType.STATE` (kind:'normal') — classification into a
  // border-point box happens via the INDEPENDENT `EntityPosition` axis
  // (./state-entity-position.ts), not `StateKind`. A prior (invented)
  // mapping to `'choice'` here rendered them as diamonds — wrong shape,
  // wrong size (24x24 vs the correct 12x12 border-point box) — removed.
};

export function stereotypeToKind(raw: string): StateKind {
  const key = raw.toLowerCase();
  return STEREOTYPE_KIND_MAP[key] ?? 'normal';
}

/**
 * Resolve the kind for a pseudostate transition endpoint id: exact
 * shallow/deep history (`[H]`/`[H*]`), or a `=name=` synchronization bar
 * reference. Compound `StateId[H]`/`StateId[H*]` forms are NOT resolved
 * here (pre-existing behavior — see `state-transitions.ts`'s ENT doc
 * comment): they auto-create a `'normal'`-kind state under the literal
 * compound id, not a nested history pseudostate inside `StateId`.
 */
export function pseudoKindForId(id: string): StateKind | undefined {
  if (id === HISTORY_SHALLOW) return 'history';
  if (id === HISTORY_DEEP) return 'deepHistory';
  if (isSyncBarId(id)) return 'syncBar';
  return undefined;
}

// ---------------------------------------------------------------------------
// Parse scope (represents one level of nesting)
// ---------------------------------------------------------------------------

export interface Scope {
  /** The composite State owning this scope. null at top level. */
  owner: State | null;
  states: State[];
  transitions: Transition[];
  /**
   * When the owner uses concurrent regions (`--`/`||`), regions accumulate
   * here. Each entry is a region's State[]. Index 0 (region 0, before the
   * FIRST separator) is `popScope`'s `owner.children` -- it is NOT its own
   * synthetic sub-group upstream. Indices 1+ become `owner.concurrentRegions`
   * (the synthetic `CONC1`, `CONC2`, ... groups).
   */
  regions: State[][];
  /**
   * Index into `regions` that new states/content currently append to.
   * Reset to `0` every time this scope is (re)entered via `pushScope`
   * (pass ONE's first visit, or pass TWO's replay) — advances by one each
   * time a concurrent separator (`--`/`||`) is encountered DURING THAT
   * VISIT. On pass ONE a separator also allocates a brand-new region; on
   * pass TWO (revisiting a scope pass ONE already built) it just moves the
   * cursor to the region pass ONE already allocated at that same textual
   * position, so pass TWO's transitions land in the SAME region their
   * source-text position implies, instead of appending duplicate empty
   * regions.
   */
  regionCursor: number;
  /** Whether we have seen at least one region separator. */
  hasConcurrency: boolean;
  /** Maps state id → State for this scope level. Scoped per-level so that
   *  popping a composite scope restores the outer index automatically. */
  stateIndex: Map<string, State>;
}

export function makeScope(owner: State | null): Scope {
  return {
    owner,
    states: [],
    transitions: [],
    regions: [[]],
    regionCursor: 0,
    hasConcurrency: false,
    stateIndex: new Map(),
  };
}

export function makeState(
  id: string,
  display: string,
  kind: StateKind,
  opts?: {
    color?: string;
    lineColor?: string;
    stereotype?: string;
    container?: 'frame';
    autoPhantom?: true;
  },
): State {
  return {
    id,
    display,
    kind,
    children: [],
    concurrentRegions: [],
    transitions: [],
    ...(opts?.color !== undefined ? { color: opts.color } : {}),
    ...(opts?.lineColor !== undefined ? { lineColor: opts.lineColor } : {}),
    ...(opts?.stereotype !== undefined ? { stereotype: opts.stereotype } : {}),
    ...(opts?.container !== undefined ? { container: opts.container } : {}),
    ...(opts?.autoPhantom !== undefined ? { autoPhantom: opts.autoPhantom } : {}),
  };
}

// ---------------------------------------------------------------------------
// Mutable parse state
// ---------------------------------------------------------------------------

export interface ParseState {
  /** Stack of open scopes. Bottom element is always the top-level scope.
   *  `parser.ts` resets this to `[topScope]` at the start of each pass. */
  scopeStack: [Scope, ...Scope[]];
  /** Diagram-level AST — `notes`/`hideEmptyDescription`/`rankdir` are
   *  written directly here. `states`/`transitions` are read from the
   *  (persistent, shared-across-passes) top scope once both passes
   *  complete (see `parser.ts`). */
  ast: StateDiagramAST;
  /** Non-null while inside a multi-line note block (attached or
   *  freestanding). Lines accumulate as note text until the closer. Reset
   *  to `null` at the START of each pass by `parser.ts` — unlike
   *  `lastEntity`/the scope tree, this is a walk-position construct (which
   *  line are we AT, in THIS top-to-bottom scan), not a diagram-level
   *  value, so it must not leak from one pass's walk into the next's. */
  pendingNote: PendingNote | null;
  /**
   * The most recently created entity's id — state OR note (upstream
   * `CucaDiagram#lastEntity`). Used to resolve a `note <pos>` line whose
   * `of <State>` clause is omitted. NOT reset between passes — upstream's
   * `lastEntity` is a single running field on the (one, persistent)
   * diagram object, so it genuinely does carry over from pass ONE's last
   * write into pass TWO's first read, same as here.
   * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:140,218-228
   */
  lastEntity: string | null;
  /**
   * Diagram-wide registry of every State ever created, keyed by id, in
   * creation order — mirrors upstream `Plasma#stats`/`PEntry` (the by-name
   * index `quarkInContext`/`firstWithName`/`countByName` consult). Persistent
   * across both parser passes.
   * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#quarkInContextSafe
   */
  globalByName: Map<string, State[]>;
  /**
   * Persistent map from a composite State to its (also persistent) Scope
   * object. `pushScope` REOPENS the same Scope when re-visiting an
   * already-declared composite (pass TWO replaying a pass-ONE declaration,
   * or the same pass re-declaring the same id) instead of creating a fresh
   * one — the scope tree is built ONCE and enriched across both passes,
   * mirroring upstream's single persistent entity/group tree (visited
   * twice here, three times upstream — not rebuilt each visit). Also the
   * anchor a dotted id's hierarchical walk descends into per segment
   * (`state-parse-resolve.ts#resolveOrCreateDottedPath`) — a composite
   * auto-created purely as a byproduct of that walk never goes through
   * `pushScope`/`popScope` (no literal `{ }` was ever opened for it), so
   * its content lives ONLY here until `syncAutoScopes` copies it onto
   * `State.children` at end-of-parse.
   */
  scopeByOwner: Map<State, Scope>;
  /**
   * Active namespace separator (`quarkInContextSafe`'s `sep`) — `'.'` by
   * default (`StateDiagram.java:62`), `null` after `set separator
   * none`/`null` (`CommandNamespaceSeparator.java`). Persistent across both
   * passes; `set separator` is pass-ONE-eligible (mirrors the other simple
   * pragma commands) and every corpus fixture writes it before any
   * declaration, so pass ONE's own declarations already see the final
   * value.
   * @see ~/git/plantuml/.../statediagram/StateDiagram.java:62
   * @see ~/git/plantuml/.../classdiagram/command/CommandNamespaceSeparator.java
   */
  separator: string | null;
}

/** Return the current (innermost) scope. */
export function currentScope(ps: ParseState): Scope {
  return ps.scopeStack[ps.scopeStack.length - 1]!;
}

/** Return the diagram's top-level (root) scope — `quarkInContextSafe`'s
 *  `this.root`, the anchor a dotted id's FIRST segment is checked against
 *  (`state-parse-resolve.ts#resolveOrCreateDottedPath`'s doc). */
export function rootScope(ps: ParseState): Scope {
  return ps.scopeStack[0];
}

/** Return the current region's state array within the innermost scope. */
export function currentRegionStates(scope: Scope): State[] {
  return scope.regions[scope.regionCursor]!;
}

/** Get-or-create the persistent `Scope` for `owner` (`ParseState.scopeByOwner`),
 *  WITHOUT resetting `regionCursor` — shared by `pushScope` (which does its
 *  own reset on a re-visit, see its doc) and
 *  `state-parse-resolve.ts#resolveOrCreateDottedPath` (which descends into
 *  a segment's scope exactly once per resolution, so no cursor reset is
 *  ever needed there). */
export function scopeOf(ps: ParseState, owner: State): Scope {
  let scope = ps.scopeByOwner.get(owner);
  if (scope === undefined) {
    scope = makeScope(owner);
    ps.scopeByOwner.set(owner, scope);
  }
  return scope;
}

/** Emit a transition into the current scope. */
export function emitTransition(ps: ParseState, t: Transition): void {
  currentScope(ps).transitions.push(t);
}

/**
 * Append a description/body line to a state — mirrors
 * `Bodier#addFieldOrMethod`, called once per `State : text` line (inline on
 * the declaration, or standalone via CommandAddField).
 */
export function addDescriptionLine(state: State, text: string): void {
  (state.description ??= []).push(text);
}

// ---------------------------------------------------------------------------
// Open/close composite state scope
// ---------------------------------------------------------------------------

/**
 * Push a composite's scope onto the stack — REOPENING the same persistent
 * Scope object (`ParseState.scopeByOwner`) when `owner` has been visited
 * before (pass TWO replaying a pass-ONE declaration), rather than creating
 * a fresh one. `regionCursor` resets to `0` on every (re)entry so
 * concurrent-region content lands in the region matching its textual
 * position on THIS visit (see `Scope.regionCursor`'s doc).
 */
export function pushScope(ps: ParseState, owner: State): void {
  const existed = ps.scopeByOwner.has(owner);
  const scope = scopeOf(ps, owner);
  if (existed) scope.regionCursor = 0;
  (ps.scopeStack as Scope[]).push(scope);
}

/** Copy a scope's accumulated content onto its owner State — shared by
 *  `popScope` (real `{ }` block closure) and `syncAutoScopes` (end-of-parse
 *  sweep for composites that exist ONLY as byproducts of dotted-hierarchy
 *  auto-creation, which never go through `pushScope`/`popScope` since there
 *  is no literal `{ }`/`begin`...`end state` to close). Idempotent: safe to
 *  call more than once with the same scope — it only READS the scope's
 *  accumulated arrays, never mutates them, so re-applying to an
 *  already-closed scope reproduces the identical `owner.children`. */
function applyScopeToOwner(owner: State, scope: Scope): void {
  if (scope.hasConcurrency) {
    // Region 0 (everything BEFORE the first `--`/`||`) is NOT wrapped in a
    // synthetic sub-group upstream -- it is `owner`'s own direct content,
    // exactly like a non-concurrent composite's children
    // (`GroupMakerState.getImage()`'s `containsSomeConcurrentStates()`
    // branch builds it via `filter(group.leafs())`, i.e. `owner`'s OWN
    // leafs minus the STATE_CONCURRENT ones -- GroupMakerState.java:124-126).
    // Only region 1, 2, ... (each separator allocates one) become synthetic
    // `CONC{n}` `GroupType.CONCURRENT_STATE` sub-groups. Verified via
    // `data-qualified-name` in the oracle SVG: darime-88-moda428's region-0
    // member is `S.d` (no synthetic prefix) while its region-1 member is
    // `S.CONC1.a`.
    owner.children = [...scope.regions[0]!];
    owner.concurrentRegions = scope.regions.slice(1).map((r) => [...r]);
  } else {
    owner.children = [...scope.states];
  }

  // Store inner transitions on the composite state — do NOT hoist to parent.
  owner.transitions = [...scope.transitions];
}

export function popScope(ps: ParseState): void {
  if (ps.scopeStack.length === 1) return; // never pop the root scope
  const closed = (ps.scopeStack as Scope[]).pop()!;
  const owner = closed.owner;
  if (owner === null) return; // should not happen
  applyScopeToOwner(owner, closed);
}

/**
 * End-of-parse sweep: apply every scope in `ps.scopeByOwner` onto its
 * owner. Composites that went through an explicit `{ }` block already have
 * correct `children` from `popScope` — re-applying is a no-op for them
 * (`applyScopeToOwner`'s doc). Composites that exist ONLY as auto-created
 * ancestors of a dotted id (`state-parse-resolve.ts#resolveOrCreateDottedPath`)
 * never reach `popScope` at all, since no literal block was ever opened for
 * them — this sweep is what materializes their `children` array, mirroring
 * upstream's implicit model where the persistent Quark/Entity tree simply
 * IS the source of truth (there is no separate "materialize" step
 * upstream; DOT emission walks the tree directly).
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#eventuallyBuildPhantomGroups
 */
export function syncAutoScopes(ps: ParseState): void {
  for (const [owner, scope] of ps.scopeByOwner) applyScopeToOwner(owner, scope);
}

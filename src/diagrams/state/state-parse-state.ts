/**
 * Scope-stack machinery and shared mutation helpers for the state parser.
 *
 * Split out of `parser.ts` so `state-commands.ts` (the COMMANDS dispatch
 * table) can import these without a parser.ts <-> state-commands.ts import
 * cycle — mirrors the class engine's split between `parser.ts` (owns the
 * main loop) and `class-namespace.ts`/`class-notes.ts` (own the mutation
 * helpers command implementations call).
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
 * (`CommandCreateState`/`CommandCreatePackageState`/`CommandCreatePackage2`/
 * `CommandConcurrentState`/`CommandEndState` are all eligible for every
 * pass); pass TWO runs transitions (`CommandLinkStateCommon`, TWO-only) and
 * `note on link` (`CommandFactoryNoteOnLink`, TWO-only); pass THREE runs
 * attached `note <pos> of <State>` (`CommandFactoryNoteOnEntity`,
 * THREE-only). This port merges upstream's TWO and THREE into a single
 * `'two'` pass: nothing in this parser's note handling depends on ALL
 * transitions (across the WHOLE document) having already run before ANY
 * attached note resolves — that stronger ordering guarantee only matters
 * for a note that both (a) omits `of <State>` (falls back to `lastEntity`)
 * AND (b) textually precedes the transition that would auto-create its
 * intended target, which no fixture in the corpus exercises. What DOES
 * matter (and is why ONE is still split out from TWO) is that every
 * DECLARATION exists, in its true nested scope, before any transition
 * resolves an endpoint — that is what makes the global by-name reuse below
 * (`resolveExistingState`) safe for forward references.
 *
 * `parser.ts` walks the source text TWICE (once per pass) against the SAME
 * persistent scope tree (`ParseState.scopeByOwner`) rather than rebuilding
 * a fresh tree per walk — this mirrors upstream's single-tree-visited-
 * thrice model and is what lets a state created ONLY during pass ONE (e.g.
 * an implicit create from a standalone `CODE : text` line, `CommandAddField`
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
  opts?: { color?: string; stereotype?: string; container?: 'frame' },
): State {
  return {
    id,
    display,
    kind,
    children: [],
    concurrentRegions: [],
    transitions: [],
    ...(opts?.color !== undefined ? { color: opts.color } : {}),
    ...(opts?.stereotype !== undefined ? { stereotype: opts.stereotype } : {}),
    ...(opts?.container !== undefined ? { container: opts.container } : {}),
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
   * index `quarkInContext`/`firstWithName`/`countByName` consult). State
   * diagrams default `namespaceSeparator` to `"."` (same as class diagrams
   * — `StateDiagram.java:62`, `setNamespaceSeparator(".")`; NOT `null`),
   * so `quarkInContextSafe`'s non-null-separator, no-separator-in-id branch
   * governs every id our grammar produces: an id matching EXACTLY one
   * entry here resolves to that entity from ANY scope; an id matching zero
   * or 2+ entries falls back to the current scope's own `stateIndex`.
   * Persistent across both parser passes.
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
   * twice here, three times upstream — not rebuilt each visit).
   */
  scopeByOwner: Map<State, Scope>;
}

/** Return the current (innermost) scope. */
export function currentScope(ps: ParseState): Scope {
  return ps.scopeStack[ps.scopeStack.length - 1]!;
}

/** Return the current region's state array within the innermost scope. */
export function currentRegionStates(scope: Scope): State[] {
  return scope.regions[scope.regionCursor]!;
}

/**
 * Resolve an id to an ALREADY-EXISTING State it should reuse, per upstream
 * `quarkInContextSafe`'s non-null-separator, no-separator-in-id branch:
 * reuse the SOLE diagram-wide entity with this id when exactly one exists
 * (regardless of which scope/pass created it), otherwise fall back to the
 * CURRENT scope's own local index. Returns `undefined` when no state with
 * this id exists anywhere yet — the caller must create one.
 *
 * Callers are responsible for the id === currentScope.owner.id self-loop
 * check (`CommandLinkStateCommon#getEntity`'s
 * `getCurrentGroup().getName().equals(code)` short-circuit) and for
 * excluding bare `[H]`/`[H*]` shorthand from the global search (see
 * `ensureState`'s doc) — both apply only to specific callers, not to this
 * shared resolver.
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#quarkInContextSafe
 */
function resolveExistingState(ps: ParseState, id: string): State | undefined {
  // Upstream's default "." namespaceSeparator (StateDiagram.java:62) means
  // an id CONTAINING a literal "." hits `quarkInContextSafe`'s hierarchical
  // dotted-id branch (`full.indexOf(sep) !== -1` -- splits into a chain of
  // nested quarks), not the flat global-uniqueness branch below. That
  // branch is NOT implemented here (deliberately out of scope -- D5
  // escalation; tuvugi-94-gapi519 is the corpus fixture: `state S.I { S.I
  // --> S.I }` needs real hierarchical id-splitting, not a bigger version
  // of this flat lookup). Falling back to pure scope-local resolution for
  // dotted ids restores this function's pre-global-reuse behavior for
  // exactly that case, rather than mis-applying flat global reuse to an id
  // shape it was never derived for.
  // @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#quarkInContextSafe
  if (!id.includes('.')) {
    const globalMatches = ps.globalByName.get(id);
    if (globalMatches !== undefined && globalMatches.length === 1) return globalMatches[0];
  }
  return currentScope(ps).stateIndex.get(id);
}

/**
 * Register a BRAND NEW state: local scope bookkeeping (index/children/
 * region arrays of the CURRENT scope) plus the diagram-wide `globalByName`
 * registry — mirrors upstream `Plasma#register`, which grows the by-name
 * `PEntry` list every quark constructs, regardless of which group it was
 * created under. Only call this for an id that has never been seen in ANY
 * prior pass — `declareState`/`ensureState` gate this via
 * `resolveExistingState`. Because the scope tree is PERSISTENT
 * (`ParseState.scopeByOwner`), an id that already exists must NOT be
 * re-registered here on a later pass/visit — it is already present in its
 * owning scope's arrays from the visit that first created it.
 */
function registerNewState(ps: ParseState, state: State): void {
  const scope = currentScope(ps);
  scope.stateIndex.set(state.id, state);
  scope.states.push(state);
  currentRegionStates(scope).push(state);

  const entries = ps.globalByName.get(state.id);
  if (entries !== undefined) entries.push(state);
  else ps.globalByName.set(state.id, [state]);
}

/**
 * Ensure a named state exists, resolving it diagram-wide when its id is
 * globally unique. '[*]' is never auto-created as a State node. '[H]',
 * '[H*]', and '=name=' are auto-created as history/deepHistory/syncBar
 * pseudostates respectively.
 *
 * Resolution order (mirrors `CommandLinkStateCommon#getEntity` +
 * `CucaDiagram#quarkInContextSafe`):
 *   1. An id equal to the CURRENTLY OPEN composite's own name self-loops to
 *      that composite (`getCurrentGroup().getName().equals(code)`) — this
 *      check happens at the CALLER (`getEntity`), before `quarkInContext`
 *      is even reached, so it takes priority over every other rule. Upstream
 *      compares against `getCurrentGroup().getName()` -- the quark's LOCAL
 *      (unqualified) segment name, not its full qualified id -- so for a
 *      DOTTED id (`state S.I { S.I --> S.I }`, hierarchically split
 *      upstream into a "S" quark containing an "I" quark) this comparison
 *      is "I".equals("S.I"), which is false: the self-loop never fires for
 *      a dotted reference. Our port keeps dotted ids as one flat, unsplit
 *      string (the hierarchical-split branch is out of scope -- see
 *      `resolveExistingState`'s doc), so `owner.id` IS the full dotted
 *      string and would wrongly match `id` here; the check below excludes
 *      dotted ids to avoid over-firing relative to upstream.
 *   2. Bare `[H]`/`[H*]` shorthand stays scope-local ONLY. Upstream avoids
 *      cross-composite merging for these by building a
 *      composite-namespaced synthetic id internally
 *      (`StateDiagram#getHistorical`/`getDeepHistory`,
 *      `"*historical*" + groupName`) before ever calling
 *      `quarkInContext` — our port keeps the literal `[H]`/`[H*]` id
 *      instead (pre-existing, unrelated to this mechanism), so it must be
 *      excluded from the diagram-wide search below or two different
 *      composites' bare history shorthand would incorrectly merge into one
 *      pseudostate. `=name=` sync bars are NOT excluded — upstream calls
 *      `quarkInContext` directly for them with no synthetic-id namespacing,
 *      so a same-named sync bar genuinely IS meant to be diagram-wide.
 *   3. Otherwise, the shared `resolveExistingState` diagram-wide/scope-local
 *      resolution applies; if nothing exists yet, create a new state in the
 *      CURRENT scope and register it (both locally and diagram-wide). This
 *      is only reachable from pass-TWO transitions or pass-ONE standalone
 *      description lines (each a single-pass-eligible caller — see
 *      `Pass`'s doc), so there is no cross-pass double-creation risk.
 * @see ~/git/plantuml/.../statediagram/command/CommandLinkStateCommon.java#getEntity
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#quarkInContextSafe
 */
export function ensureState(ps: ParseState, id: string, kind: StateKind = 'normal'): State | undefined {
  if (id === PSEUDOSTATE) return undefined;

  const owner = currentScope(ps).owner;
  if (owner !== null && !id.includes('.') && owner.id === id) return owner;

  const pseudoKind = pseudoKindForId(id);
  const isHistoryShorthand = pseudoKind === 'history' || pseudoKind === 'deepHistory';
  const existing = isHistoryShorthand ? currentScope(ps).stateIndex.get(id) : resolveExistingState(ps, id);
  if (existing !== undefined) return existing;

  const resolvedKind = pseudoKind ?? kind;
  const s = makeState(id, id, resolvedKind);
  registerNewState(ps, s);
  ps.lastEntity = id;
  return s;
}

/**
 * Add an explicitly declared state (overrides auto-created entry). Returns
 * the CANONICAL State object backing this id — the pre-existing object
 * when one already exists (auto-created by an earlier transition
 * reference, e.g. `Run --> Stop` before `state Run{`, a diagram-wide-unique
 * entity declared/referenced in a DIFFERENT scope, OR — on pass TWO — this
 * SAME declaration having already run during pass ONE), or `state` itself
 * when this id has never been seen before. Callers that go on to
 * `pushScope` (composite/frame openers) MUST push the returned object, not
 * their own throwaway `state` — pushing the throwaway orphans the block's
 * children (popScope writes `owner.children`, and only the CANONICAL object
 * is reachable from the tree afterwards). This was a real bug caught during
 * mission A4/T4: every fixture referencing a composite as a transition
 * endpoint before its own `{ }`/`begin` block silently dropped that
 * composite's entire body.
 *
 * `pass` gates the CONTENT mutation (display/kind/color/stereotype/
 * container) to pass `'one'` only, mirroring upstream's
 * `if (currentPass == ParserPass.ONE) { ent.setDisplay(...); ... }` guard
 * inside `CommandCreateState`/`CommandCreatePackageState` (both of which
 * are structurally eligible for EVERY pass, but only apply their content
 * side effects once). An EXISTING state is deliberately NOT re-registered
 * into the current scope here — the scope tree is persistent
 * (`ParseState.scopeByOwner`), so it is already present in its owning
 * scope's arrays from whichever earlier visit first created it;
 * re-registering would duplicate it.
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#quarkInContextSafe
 * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java (ParserPass.ONE gate)
 */
export function declareState(ps: ParseState, state: State, pass: Pass): State {
  const existing = resolveExistingState(ps, state.id);
  if (existing !== undefined) {
    if (pass === 'one') {
      existing.display = state.display;
      existing.kind = state.kind;
      if (state.color !== undefined) existing.color = state.color;
      if (state.stereotype !== undefined) existing.stereotype = state.stereotype;
      if (state.container !== undefined) existing.container = state.container;
    }
    ps.lastEntity = existing.id;
    return existing;
  }
  registerNewState(ps, state);
  ps.lastEntity = state.id;
  return state;
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

/**
 * Resolve the target State for a standalone `CODE : text` description line
 * (CommandAddField): the CURRENT scope's own composite (self-reference,
 * `state Foo { Foo : text }`) if the id matches its owner, otherwise an
 * existing-or-auto-created state in the current scope.
 * @see ~/git/plantuml/.../statediagram/command/CommandAddField.java:92-100
 */
export function resolveDescriptionTarget(ps: ParseState, code: string): State | undefined {
  const owner = currentScope(ps).owner;
  if (owner !== null && owner.id === code) return owner;
  return ensureState(ps, code);
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
  let scope = ps.scopeByOwner.get(owner);
  if (scope === undefined) {
    scope = makeScope(owner);
    ps.scopeByOwner.set(owner, scope);
  } else {
    scope.regionCursor = 0;
  }
  (ps.scopeStack as Scope[]).push(scope);
}

export function popScope(ps: ParseState): void {
  if (ps.scopeStack.length === 1) return; // never pop the root scope
  const closed = (ps.scopeStack as Scope[]).pop()!;
  const owner = closed.owner;
  if (owner === null) return; // should not happen

  if (closed.hasConcurrency) {
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
    owner.children = [...closed.regions[0]!];
    owner.concurrentRegions = closed.regions.slice(1).map((r) => [...r]);
  } else {
    owner.children = [...closed.states];
  }

  // Store inner transitions on the composite state — do NOT hoist to parent.
  owner.transitions = [...closed.transitions];
}

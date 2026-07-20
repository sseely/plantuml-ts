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
import type { PendingJson } from './state-json-commands.js';

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
// Pseudostate markers + stereotype/compound-id classification (mission G4
// S7: moved to ./state-pseudokind.ts, 500-line file-cap compliance) --
// re-exported here so every pre-existing importer of this module keeps
// working unchanged (a pure move, not a public-API change).
// ---------------------------------------------------------------------------

export { PSEUDOSTATE, stereotypeToKind, pseudoKindForId, compoundHistoryKind } from './state-pseudokind.js';

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
    tags?: string[];
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
    ...(opts?.tags !== undefined ? { tags: opts.tags } : {}),
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
  /** Non-null while inside a `json Name { ... }` multi-line body — same
   *  walk-position reset discipline as `pendingNote` above (reset to
   *  `null` at the START of each pass by `parser.ts`).
   *  @see state-json-commands.ts's {@link PendingJson} doc */
  pendingJson: PendingJson | null;
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
  /**
   * mission G4 S7 (mechanism 10, id-numbering creation-index gap): the
   * SHARED, monotonically-incrementing tick counter behind every state's,
   * transition's, and pseudostate's `creationIndex` -- mirrors upstream
   * `net.atmp.CucaDiagram#cpt1` (`AtomicInteger`, starts at 0,
   * `addAndGet(1)` per tick, so the first real tick is `1`). Also
   * incremented (its result discarded) for a concurrent-region separator
   * (`--`/`||`) on pass ONE ONLY (`state-commands.ts`'s rule 4) -- mirrors
   * upstream `StateDiagram#concurrentState`'s `gotoGroup(..., GroupType
   * .CONCURRENT_STATE)`, which constructs a real (if never individually
   * rendered) `Entity` via `CucaDiagram#createGroup` -> `new Entity(...)`,
   * burning a real `cpt1` tick with NO corresponding visible node -- this is
   * what makes a CONC-region-owning composite's OWN children's ids skip a
   * slot (jar-verified `nivanu-50-zajo916`/`semala-31-joji042`/
   * `pevene-26-kebo361`, plans/g4-state-svg/ledger.md S7). Persistent across
   * both parser passes (never reset).
   * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#cpt1
   */
  creationCounter: number;
  /**
   * mission G4 S7: lazily-assigned `creationIndex` per scope's synthetic
   * `[*]`-derived pseudostate, keyed by {@link pseudoTickKey}. See
   * `StateDiagramAST.pseudoCreationIndex`'s doc (ast.ts) for the full
   * mechanism and why this lives outside the `State`/`Transition` shape.
   */
  pseudoCreationIndex: Map<string, number>;
}

/**
 * Consume and return the next shared creation-order tick (mission G4 S7) --
 * mirrors upstream `CucaDiagram#getUniqueSequenceValue`
 * (`cpt1.addAndGet(1)`). Callers that only need to BURN a tick (concurrent-
 * region phantom groups) discard the return value.
 */
export function nextCreationIndex(ps: ParseState): number {
  ps.creationCounter += 1;
  return ps.creationCounter;
}

/**
 * Composite key for {@link ParseState.pseudoCreationIndex} /
 * `StateDiagramAST.pseudoCreationIndex` -- see that field's own doc comment
 * (ast.ts) for why `scopeId` must be the SAME string
 * `noteScopeId`/`concurrentRegionScopeId` already produce.
 */
export function pseudoTickKey(scopeId: string, which: 'start' | 'end'): string {
  return `${scopeId}::${which}`;
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

/**
 * Synthetic scope id for a `--`-delimited concurrent region's OWN content.
 * Region 0 (before the first separator) is NOT wrapped in a synthetic
 * sub-group upstream (`applyScopeToOwner`'s doc above) -- its content keeps
 * the owner's own id. Region 1+ (upstream's `CONC1`, `CONC2`, ... --
 * verified via darime-88-moda428's `data-qualified-name`, `S.CONC1.a`) get
 * this synthetic suffix so a note declared inside a SPECIFIC region routes
 * to THAT region's own always-autarkic svek pass
 * (`GroupType.CONCURRENT_STATE` short-circuits `isAutarkic()` true,
 * mechanisms.md §3), not the whole composite's -- mission A4 Phase L iter
 * 16 (joleju-94-maru748: three composites each with a note-only trailing
 * region). `regionNumber` is 1-based, matching `Scope.regionCursor`'s
 * value while parsing that region and `State.concurrentRegions[regionNumber
 * - 1]` once parsing completes -- shared by note-scope assignment
 * (`noteScopeId` below, and the composite-pass's matching per-region
 * lookup in `state-composite-pass.ts`/`state-composite-concurrent.ts`) so
 * every side agrees on the same key without re-deriving it independently.
 */
export function concurrentRegionScopeId(ownerId: string, regionNumber: number): string {
  return `${ownerId}::CONC${regionNumber}`;
}

/** A note's declaring scope id, region-aware -- see `concurrentRegionScopeId`'s
 *  doc. Replaces the earlier `currentScope(ps).owner?.id ?? ''` convention
 *  (still correct for region 0 / non-concurrent scopes, since
 *  `regionCursor` is `0` there) at all three note-finalization call sites
 *  (`state-commands-notes.ts` x2, `parser.ts`'s block-note finalizer). */
export function noteScopeId(ps: ParseState): string {
  const scope = currentScope(ps);
  const ownerId = scope.owner?.id ?? '';
  return scope.regionCursor === 0 ? ownerId : concurrentRegionScopeId(ownerId, scope.regionCursor);
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

/** Emit a transition into the current scope -- stamps `t.creationIndex`
 *  (mission G4 S7) at the SINGLE true creation chokepoint, mirroring
 *  upstream `Link`'s own ctor tick (`Link.java:135`), which always fires
 *  AFTER both endpoints are already resolved/auto-created (callers
 *  `ensureState` both endpoints before calling this — see `Transition
 *  .creationIndex`'s own doc comment, ast.ts). */
export function emitTransition(ps: ParseState, t: Transition): void {
  t.creationIndex = nextCreationIndex(ps);
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
 * upstream; DOT emission walks the tree directly). Also picks up a compound
 * `StateId[H]`/`StateId[H*]` reference's synthetic child grafted DIRECTLY
 * into an ALREADY-CLOSED composite's scope (`state-parse-resolve.ts
 * #ensureCompoundHistory`) — same "re-apply after further mutation"
 * reasoning as the dotted-ancestor case.
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#eventuallyBuildPhantomGroups
 */
export function syncAutoScopes(ps: ParseState): void {
  for (const [owner, scope] of ps.scopeByOwner) applyScopeToOwner(owner, scope);
}

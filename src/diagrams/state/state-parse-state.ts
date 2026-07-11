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
 * a state's stereotype group (`Stereogroup#getLeafType`) — only these six
 * labels are recognized; anything else keeps `LeafType.STATE` (our
 * `'normal'`). `junction`/`entrypoint`/`exitpoint` below are NOT upstream
 * keywords (no `<<junction>>`/`<<entryPoint>>`/`<<exitPoint>>` stereotype
 * exists in `Stereogroup.java`) — kept for backward compatibility with
 * pre-existing (invented) test coverage; harmless since they never collide
 * with a real upstream label.
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
  entrypoint: 'choice',
  exitpoint: 'choice',
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
   * here. Each entry is a region's State[].
   */
  regions: State[][];
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
  /** Stack of open scopes. Bottom element is always the top-level scope. */
  scopeStack: [Scope, ...Scope[]];
  /** Diagram-level AST — `notes`/`hideEmptyDescription`/`rankdir` are
   *  written directly here; `states`/`transitions` alias `topScope`'s
   *  live arrays (see parser.ts's `parseState`). */
  ast: StateDiagramAST;
  /** Non-null while inside a multi-line note block (attached or
   *  freestanding). Lines accumulate as note text until the closer. */
  pendingNote: PendingNote | null;
  /**
   * The most recently created entity's id — state OR note (upstream
   * `CucaDiagram#lastEntity`). Used to resolve a `note <pos>` line whose
   * `of <State>` clause is omitted.
   * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:140,218-228
   */
  lastEntity: string | null;
}

/** Return the current (innermost) scope. */
export function currentScope(ps: ParseState): Scope {
  return ps.scopeStack[ps.scopeStack.length - 1]!;
}

/** Return the current region's state array within the innermost scope. */
export function currentRegionStates(scope: Scope): State[] {
  return scope.regions[scope.regions.length - 1]!;
}

/**
 * Extract display name and alias id from a regex match that uses the
 * alternation `(?:'([^']+)'\s+as\s+(\S+)|(\S+))`.
 *
 * When the quoted alternative matches, groups at `quotedDisplayGroup` and
 * `aliasGroup` are defined; when the bare-name alternative matches, the
 * group at `bareNameGroup` is defined. The regex guarantees exactly one
 * alternative matches, so the non-null assertions are safe.
 */
export function extractDisplayAndId(
  match: RegExpExecArray,
  quotedDisplayGroup: number,
  aliasGroup: number,
  bareNameGroup: number,
): { display: string; id: string } {
  const quotedDisplay = match[quotedDisplayGroup];
  if (quotedDisplay !== undefined) {
    return {
      display: quotedDisplay,
      id: match[aliasGroup]!,
    };
  }
  const bare = match[bareNameGroup]!;
  return { display: bare, id: bare };
}

/**
 * Ensure a named state exists in the current scope. '[*]' is never
 * auto-created as a State node. '[H]', '[H*]', and '=name=' are
 * auto-created as history/deepHistory/syncBar pseudostates respectively.
 */
export function ensureState(ps: ParseState, id: string, kind: StateKind = 'normal'): State | undefined {
  if (id === PSEUDOSTATE) return undefined;
  const scope = currentScope(ps);
  const existing = scope.stateIndex.get(id);
  if (existing !== undefined) return existing;

  // Determine kind: pseudostate id patterns override the default.
  const resolvedKind = pseudoKindForId(id) ?? kind;
  const s = makeState(id, id, resolvedKind);
  scope.stateIndex.set(id, s);
  scope.states.push(s);
  currentRegionStates(scope).push(s);
  ps.lastEntity = id;
  return s;
}

/** Add an explicitly declared state (overrides auto-created entry). */
export function declareState(ps: ParseState, state: State): void {
  const scope = currentScope(ps);
  const existing = scope.stateIndex.get(state.id);
  if (existing !== undefined) {
    // Update in-place so any existing references remain valid.
    existing.display = state.display;
    existing.kind = state.kind;
    if (state.color !== undefined) existing.color = state.color;
    if (state.stereotype !== undefined) existing.stereotype = state.stereotype;
    if (state.container !== undefined) existing.container = state.container;
    ps.lastEntity = existing.id;
    return;
  }
  scope.stateIndex.set(state.id, state);
  scope.states.push(state);
  currentRegionStates(scope).push(state);
  ps.lastEntity = state.id;
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

/**
 * Parse a transition label into guard / action / label fields.
 *
 * Formats:
 *   [guard] / action   → guard + action (label = raw text)
 *   [guard]            → guard only
 *   / action           → action only
 *   anything else      → label only
 */
export function parseLabel(raw: string): Pick<Transition, 'guard' | 'action' | 'label'> {
  const trimmed = raw.trim();
  if (trimmed === '') return {};

  // Try to extract [guard] at the start.
  const guardMatch = /^\[([^\]]*)\](.*)$/.exec(trimmed);
  if (guardMatch !== null) {
    const guard = guardMatch[1]!.trim();
    const rest = guardMatch[2]!.trim();
    // After guard, optional "/ action"
    const actionMatch = /^\/\s*(.*)$/.exec(rest);
    if (actionMatch !== null) {
      const action = actionMatch[1]!.trim();
      return {
        guard: guard !== '' ? guard : undefined,
        action: action !== '' ? action : undefined,
        label: trimmed,
      } as Pick<Transition, 'guard' | 'action' | 'label'>;
    }
    // Guard only — carry rest as label when non-empty.
    return {
      ...(guard !== '' ? { guard } : {}),
      ...(rest !== '' ? { label: trimmed } : {}),
    };
  }

  // Try "/ action" with no guard.
  const bareAction = /^\/\s*(.+)$/.exec(trimmed);
  if (bareAction !== null) {
    const action = bareAction[1]!.trim();
    return { action, label: trimmed };
  }

  // Plain label.
  return { label: trimmed };
}

// ---------------------------------------------------------------------------
// Open/close composite state scope
// ---------------------------------------------------------------------------

export function pushScope(ps: ParseState, owner: State): void {
  (ps.scopeStack as Scope[]).push(makeScope(owner));
}

export function popScope(ps: ParseState): void {
  if (ps.scopeStack.length === 1) return; // never pop the root scope
  const closed = (ps.scopeStack as Scope[]).pop()!;
  const owner = closed.owner;
  if (owner === null) return; // should not happen

  if (closed.hasConcurrency) {
    owner.concurrentRegions = closed.regions.map((r) => [...r]);
    owner.children = [];
  } else {
    owner.children = [...closed.states];
  }

  // Store inner transitions on the composite state — do NOT hoist to parent.
  owner.transitions = [...closed.transitions];
}

/**
 * Parser for PlantUML state diagrams.
 *
 * Uses a command-dispatch table: an array of { pattern, execute } objects
 * tested against each trimmed line in priority order. First match wins.
 *
 * Composite states (state Foo { ... }) and concurrent regions (separated
 * by `--` inside a composite block) are handled via a scope stack.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type {
  State,
  StateKind,
  StateDiagramAST,
  Transition,
} from './ast.js';

// ---------------------------------------------------------------------------
// Pseudostate marker
// ---------------------------------------------------------------------------

/** The reserved pseudostate id used for initial and final transitions. */
const PSEUDOSTATE = '[*]';

// ---------------------------------------------------------------------------
// Stereotype → StateKind mapping
// ---------------------------------------------------------------------------

const STEREOTYPE_KIND_MAP: Readonly<Record<string, StateKind>> = {
  choice: 'choice',
  fork: 'fork',
  join: 'join',
  junction: 'junction',
  history: 'history',
  deephistory: 'deepHistory',
  entrypoint: 'choice',
  exitpoint: 'choice',
};

function stereotypeToKind(raw: string): StateKind {
  const key = raw.toLowerCase();
  return STEREOTYPE_KIND_MAP[key] ?? 'normal';
}

// ---------------------------------------------------------------------------
// Parse scope (represents one level of nesting)
// ---------------------------------------------------------------------------

interface Scope {
  /** The composite State owning this scope. null at top level. */
  owner: State | null;
  states: State[];
  transitions: Transition[];
  /**
   * When the owner uses concurrent regions (`--`), regions accumulate here.
   * Each entry is a region's State[].
   */
  regions: State[][];
  /** Whether we have seen at least one `--` separator. */
  hasConcurrency: boolean;
  /** Maps state id → State for this scope level. Scoped per-level so that
   *  popping a composite scope restores the outer index automatically. */
  stateIndex: Map<string, State>;
}

// ---------------------------------------------------------------------------
// Mutable parse state
// ---------------------------------------------------------------------------

interface ParseState {
  /** Stack of open scopes. Bottom element is always the top-level scope. */
  scopeStack: [Scope, ...Scope[]];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScope(owner: State | null): Scope {
  return {
    owner,
    states: [],
    transitions: [],
    regions: [[]],
    hasConcurrency: false,
    stateIndex: new Map(),
  };
}

function makeState(
  id: string,
  display: string,
  kind: StateKind,
  opts?: { color?: string; stereotype?: string },
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
  };
}

/** Return the current (innermost) scope. */
function currentScope(ps: ParseState): Scope {
  return ps.scopeStack[ps.scopeStack.length - 1]!;
}

/** Return the current region's state array within the innermost scope. */
function currentRegionStates(scope: Scope): State[] {
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
function extractDisplayAndId(
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
 * auto-created as a State node.
 */
function ensureState(
  ps: ParseState,
  id: string,
  kind: StateKind = 'normal',
): State | undefined {
  if (id === PSEUDOSTATE) return undefined;
  const scope = currentScope(ps);
  const existing = scope.stateIndex.get(id);
  if (existing !== undefined) return existing;
  const s = makeState(id, id, kind);
  scope.stateIndex.set(id, s);
  scope.states.push(s);
  currentRegionStates(scope).push(s);
  return s;
}

/** Add an explicitly declared state (overrides auto-created entry). */
function declareState(ps: ParseState, state: State): void {
  const scope = currentScope(ps);
  const existing = scope.stateIndex.get(state.id);
  if (existing !== undefined) {
    // Update in-place so any existing references remain valid.
    existing.display = state.display;
    existing.kind = state.kind;
    if (state.color !== undefined) existing.color = state.color;
    if (state.stereotype !== undefined) existing.stereotype = state.stereotype;
    return;
  }
  scope.stateIndex.set(state.id, state);
  scope.states.push(state);
  currentRegionStates(scope).push(state);
}

/** Emit a transition into the current scope. */
function emitTransition(ps: ParseState, t: Transition): void {
  currentScope(ps).transitions.push(t);
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
function parseLabel(raw: string): Pick<Transition, 'guard' | 'action' | 'label'> {
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

function pushScope(ps: ParseState, owner: State): void {
  (ps.scopeStack as Scope[]).push(makeScope(owner));
}

function popScope(ps: ParseState): void {
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

// ---------------------------------------------------------------------------
// Command dispatch table
// ---------------------------------------------------------------------------

interface Command {
  pattern: RegExp;
  execute(ps: ParseState, match: RegExpExecArray): void;
}

/**
 * Patterns are tested top-to-bottom; first match wins.
 * More specific patterns must precede general ones.
 */
const COMMANDS: readonly Command[] = [
  // -------------------------------------------------------------------------
  // 1. Ignore lines: skinparam, title, scale, hide, show, note, comment (')
  // -------------------------------------------------------------------------
  {
    pattern: /^(?:skinparam|title|scale|hide|show|note)\b/i,
    execute() { /* ignored */ },
  },
  {
    pattern: /^'/,
    execute() { /* comment */ },
  },

  // -------------------------------------------------------------------------
  // 2. Concurrent region separator `--`
  //    Must come before transition patterns (which also use --)
  // -------------------------------------------------------------------------
  {
    pattern: /^--\s*$/,
    execute(ps) {
      const scope = currentScope(ps);
      scope.hasConcurrency = true;
      scope.regions.push([]);
    },
  },

  // -------------------------------------------------------------------------
  // 3. Close composite state block `}`
  // -------------------------------------------------------------------------
  {
    pattern: /^\}\s*$/,
    execute(ps) {
      popScope(ps);
    },
  },

  // -------------------------------------------------------------------------
  // 4. State declaration with open brace — composite state
  //    state Foo {
  //    state 'Display' as Foo {
  //    state Foo #color {
  //    state Foo <<stereotype>> {
  // -------------------------------------------------------------------------
  {
    pattern:
      /^state\s+(?:(?:'|")([^'"]+)(?:'|")\s+as\s+(\S+)|(\S+))\s*(?:<<(\w+)>>)?\s*(?:(#\w+))?\s*\{\s*$/i,
    execute(ps, match) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3);
      const stereotypeRaw = match[4];
      const colorRaw = match[5];
      const kind: StateKind =
        stereotypeRaw !== undefined ? stereotypeToKind(stereotypeRaw) : 'normal';

      const s = makeState(id, display, kind, {
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
        ...(stereotypeRaw !== undefined ? { stereotype: stereotypeRaw } : {}),
      });
      declareState(ps, s);
      pushScope(ps, s);
    },
  },

  // -------------------------------------------------------------------------
  // 5. State declaration with stereotype (pseudostates)
  //    state choice <<choice>>
  //    state 'My State' as MS <<choice>>
  // -------------------------------------------------------------------------
  {
    pattern:
      /^state\s+(?:(?:'|")([^'"]+)(?:'|")\s+as\s+(\S+)|(\S+))\s*<<(\w+)>>\s*(?:(#\w+))?\s*$/i,
    execute(ps, match) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3);
      const stereotypeRaw = match[4]!;
      const colorRaw = match[5];
      const kind = stereotypeToKind(stereotypeRaw);

      const s = makeState(id, display, kind, {
        stereotype: stereotypeRaw,
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
      });
      declareState(ps, s);
    },
  },

  // -------------------------------------------------------------------------
  // 6. Plain state declaration
  //    state Active
  //    state 'My State' as MS
  //    state Active #pink
  //    state 'My State' as MS #pink
  // -------------------------------------------------------------------------
  {
    pattern:
      /^state\s+(?:(?:'|")([^'"]+)(?:'|")\s+as\s+(\S+)|(\S+))\s*(?:(#\w+))?\s*$/i,
    execute(ps, match) {
      const { display, id } = extractDisplayAndId(match, 1, 2, 3);
      const colorRaw = match[4];

      const s = makeState(id, display, 'normal', {
        ...(colorRaw !== undefined ? { color: colorRaw } : {}),
      });
      declareState(ps, s);
    },
  },

  // -------------------------------------------------------------------------
  // 7. Transition
  //    A --> B
  //    A --> B : label
  //    [*] --> Active
  //    Active --> [*] : done
  // -------------------------------------------------------------------------
  {
    pattern:
      /^(\[?\*?\]?[\w.]+|\[\*\])\s*-->\s*(\[?\*?\]?[\w.]+|\[\*\])\s*(?::\s*(.*))?$/,
    execute(ps, match) {
      const from = match[1]!;
      const to = match[2]!;
      const rawLabel = match[3] ?? '';

      ensureState(ps, from);
      ensureState(ps, to);

      const labelParts = parseLabel(rawLabel);
      const t: Transition = { from, to, ...labelParts };
      emitTransition(ps, t);
    },
  },
];

// ---------------------------------------------------------------------------
// Main parser entry point
// ---------------------------------------------------------------------------

/**
 * Parse a PlantUML state diagram block into a StateDiagramAST.
 */
export function parseState(block: UmlSource): StateDiagramAST {
  const topScope = makeScope(null);
  const ps: ParseState = {
    scopeStack: [topScope],
  };

  for (const rawLine of block.lines) {
    const line = rawLine.trim();
    if (line === '') continue;

    for (const cmd of COMMANDS) {
      const match = cmd.pattern.exec(line);
      if (match !== null) {
        cmd.execute(ps, match);
        break;
      }
    }
  }

  // Close any unclosed composite scopes.
  while (ps.scopeStack.length > 1) {
    popScope(ps);
  }

  return {
    states: topScope.states,
    transitions: topScope.transitions,
  };
}

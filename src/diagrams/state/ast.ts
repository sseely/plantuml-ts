/**
 * AST type definitions for PlantUML state diagrams.
 */

// ---------------------------------------------------------------------------
// State kinds
// ---------------------------------------------------------------------------

export type StateKind =
  | 'normal'
  | 'initial'
  | 'final'
  | 'history'
  | 'deepHistory'
  | 'fork'
  | 'join'
  | 'choice'
  | 'junction';

// ---------------------------------------------------------------------------
// History pseudostate
// ---------------------------------------------------------------------------

/**
 * Represents a UML history pseudostate — either shallow `[H]` or deep `[H*]`.
 * These are represented in the parsed AST as State nodes with kind='history'
 * or kind='deepHistory'. This interface documents the discriminated shape.
 */
export interface HistoryPseudostate {
  kind: 'history';
  id: string;
  depth: 'shallow' | 'deep';
}

// ---------------------------------------------------------------------------
// State node
// ---------------------------------------------------------------------------

export interface State {
  id: string;
  display: string;
  kind: StateKind;
  /** Nested states for composite states. */
  children: State[];
  /**
   * Concurrent regions for states with `--` separators.
   * Each sub-array is one region. Empty unless `--` was present.
   */
  concurrentRegions: State[][];
  /**
   * Transitions that belong to this composite state's inner scope.
   * Empty for leaf states. Inner transitions are NOT hoisted to the
   * parent scope — they are rendered within the composite's bounding box.
   */
  transitions: Transition[];
  color?: string;
  stereotype?: string;
}

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

export interface Transition {
  /** State id; '[*]' for initial/final pseudostates. */
  from: string;
  /** State id; '[*]' for initial/final pseudostates. */
  to: string;
  guard?: string;
  action?: string;
  /**
   * Free-form label — set when there is a label that does not parse into
   * distinct guard/action parts (or when guard + action are both present,
   * this holds the raw label text).
   */
  label?: string;
}

// ---------------------------------------------------------------------------
// Root AST
// ---------------------------------------------------------------------------

export interface StateDiagramAST {
  states: State[];
  transitions: Transition[];
}

/**
 * AST type definitions for PlantUML activity diagrams (new syntax).
 */

// ---------------------------------------------------------------------------
// Leaf node types
// ---------------------------------------------------------------------------

export interface ActivityAction {
  kind: 'action';
  label: string;
  color?: string;
  stereotype?: string;
  swimlane?: string;
}

export interface ActivityStart {
  kind: 'start';
  swimlane?: string;
}

export interface ActivityStop {
  kind: 'stop';
  swimlane?: string;
}

export interface ActivityEnd {
  kind: 'end';
  swimlane?: string;
}

export interface ActivityKill {
  kind: 'kill';
  swimlane?: string;
}

export interface ActivityDetach {
  kind: 'detach';
  swimlane?: string;
}

export interface ActivityBreak {
  kind: 'break';
  swimlane?: string;
}

export interface ActivityArrowLabel {
  kind: 'arrow-label';
  label: string;
  color?: string;
  swimlane?: string;
}

// ---------------------------------------------------------------------------
// Composite node types
// ---------------------------------------------------------------------------

export interface ActivityElseIf {
  condition: string;
  label?: string;
  body: ActivityNode[];
}

export interface ActivityIf {
  kind: 'if';
  condition: string;
  thenLabel?: string;
  elseLabel?: string;
  thenBranch: ActivityNode[];
  elseBranch: ActivityNode[];
  /** Intermediate elseif clauses in order; may be empty. */
  elseIfBranches: ActivityElseIf[];
  swimlane?: string;
}

export interface ActivityWhile {
  kind: 'while';
  condition: string;
  /** Label on the entry edge (the "is" / "yes" path into the body). */
  yesLabel?: string;
  /** Label on the exit edge (the "is not" path). */
  exitLabel?: string;
  body: ActivityNode[];
  swimlane?: string;
}

export interface ActivityRepeat {
  kind: 'repeat';
  body: ActivityNode[];
  condition: string;
  swimlane?: string;
}

export interface ActivityFork {
  kind: 'fork';
  branches: ActivityNode[][];
  swimlane?: string;
}

export interface ActivitySplit {
  kind: 'split';
  branches: ActivityNode[][];
  swimlane?: string;
}

export interface ActivityNote {
  kind: 'note';
  text: string;
  position: 'left' | 'right';
  swimlane?: string;
}

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

export type ActivityNode =
  | ActivityAction
  | ActivityStart
  | ActivityStop
  | ActivityEnd
  | ActivityKill
  | ActivityDetach
  | ActivityBreak
  | ActivityArrowLabel
  | ActivityIf
  | ActivityWhile
  | ActivityRepeat
  | ActivityFork
  | ActivitySplit
  | ActivityNote;

// ---------------------------------------------------------------------------
// Root AST
// ---------------------------------------------------------------------------

export interface ActivityDiagramAST {
  /** Top-level sequence of activity nodes (may contain nested structures). */
  nodes: ActivityNode[];
  /** Ordered list of swimlane names as they appear in the source. */
  swimlanes: string[];
}

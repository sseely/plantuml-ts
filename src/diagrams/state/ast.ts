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
  | 'junction'
  /**
   * A synchronization bar auto-created from a bare `=name=` transition
   * endpoint (no prior `<<fork>>`/`<<join>>` declaration needed).
   * @see ~/git/plantuml/.../statediagram/command/CommandLinkStateCommon.java#getEntity
   *      (LeafType.SYNCHRO_BAR)
   */
  | 'syncBar';

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
  /**
   * Body/description lines added via `State : text` (either inline on the
   * `state X : text` declaration, or as a standalone line referencing an
   * already-declared or auto-created state). Multiple lines accumulate in
   * source order — mirrors `Bodier#addFieldOrMethod`, called once per line.
   * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java
   *      (inline ADDFIELD group)
   * @see ~/git/plantuml/.../statediagram/command/CommandAddField.java
   *      (standalone `CODE : text` form)
   */
  description?: string[];
  /**
   * Set to `'frame'` for a composite opened with the `frame X { ... }` /
   * `frame X begin` keyword instead of `state X { ... }`. Upstream models
   * this as a `GroupType.PACKAGE` entity decorated with `USymbols.FRAME`
   * (a visually distinct container), rather than `GroupType.STATE` — the
   * DOT/SVG layer (T3/T4) uses this to pick the frame envelope instead of
   * the composite-state cluster envelope. `undefined` means a regular
   * `state { }` composite.
   * @see ~/git/plantuml/.../statediagram/command/CommandCreatePackage2.java
   */
  container?: 'frame';
}

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

/** Compass-style forced routing direction on a transition arrow. */
export type TransitionDirection = 'left' | 'right' | 'up' | 'down';

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
  /**
   * Forced routing direction from an abbreviated arrow body
   * (`-right->`, `-r->`, …). Absent when the transition uses a plain `-->`.
   * Reverse-arrow transitions (`A <-- B`) default to `'left'` when no
   * explicit direction is written — mirrors `getDefaultDirection()`.
   * @see ~/git/plantuml/.../statediagram/command/CommandLinkStateCommon.java#getDirection
   */
  direction?: TransitionDirection;
  /** True for an `x-->`-style arrow (circled cross at the start). */
  crossStart?: boolean;
  /** True for a `-->o`-style arrow (circle decoration at the end). */
  circleEnd?: boolean;
  /**
   * Raw contents of the `-[style]->` bracket, e.g. `'dotted'`, `'bold'`,
   * `'#red'`, or `'node'` (the `node` keyword asks for the label to be
   * drawn as an intermediate transition node — a layout decision, not a
   * parser one; T3/T4 interprets this string).
   * @see ~/git/plantuml/.../descdiagram/command/CommandLinkElement.java#LINE_STYLE
   */
  arrowStyle?: string;
  /** `<<stereotype>>` written on the transition itself. */
  stereotype?: string;
  /**
   * Total dash-count of the arrow body (`-->` = 2, `--->` = 3, …) — upstream
   * uses this as the graphviz `minlen` driver for the transition edge.
   * @see ~/git/plantuml/.../statediagram/command/CommandLinkStateCommon.java#executeArg
   *      (`LinkArg.build(label, length, ...)`)
   */
  length?: number;
  /**
   * Text from a `note [pos] on|of link : text` command attached to this
   * (the most-recently-parsed) transition.
   * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnLink.java
   */
  linkNote?: string;
  /**
   * Position of `linkNote` relative to the transition's own label — LEFT/TOP
   * put the note ahead of the label in the merged edge label, RIGHT/BOTTOM
   * put it after (`CucaNote#getPosition`, default BOTTOM when unwritten).
   * Only meaningful when `linkNote` is set.
   * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnLink.java#executeInternal
   * @see ~/git/plantuml/.../svek/SvekEdge.java (SvekEdge.java:308-326, mergeLR/mergeTB)
   */
  linkNotePosition?: NotePosition;
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export type NotePosition = 'left' | 'right' | 'top' | 'bottom';

/**
 * A note attached to a state (`note <pos> of <State> : text`, or the
 * bracketed/`end note` multi-line forms) or freestanding (`note as N1 ...
 * end note`). State diagrams have no relationship syntax, so a freestanding
 * note's alias has no later reference site — it exists purely so the note
 * text is captured under a stable id.
 * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java
 * @see ~/git/plantuml/.../command/note/CommandFactoryNote.java
 */
export interface StateNote {
  /** Generated layout id (e.g. `__note_0`) for attached notes; the
   *  user-declared alias for freestanding notes. */
  id: string;
  /** Host state id the note is attached to (attached notes only). */
  target?: string;
  /**
   * True when `target` came from falling back to the last-created state
   * rather than an explicit `of <State>` clause — mirrors the
   * `CommandFactoryNote`(bare)/`CommandFactoryNoteOnEntity`(`of`) split in
   * the class engine's note handling (see class ast.ts's `ClassNote`).
   */
  implicitTarget?: true;
  position?: NotePosition;
  /** Note body (may contain newlines for multi-line notes). */
  text: string;
}

// ---------------------------------------------------------------------------
// Root AST
// ---------------------------------------------------------------------------

export interface StateDiagramAST {
  states: State[];
  transitions: Transition[];
  /**
   * Optional so pre-existing literal `StateDiagramAST` construction (e.g. in
   * layout/renderer tests predating notes support) does not need updating —
   * `parseState` always sets this to `[]` at minimum; treat as `notes ?? []`
   * when reading.
   */
  notes?: StateNote[];
  /**
   * `hide empty description` / `show empty description` — states with no
   * description/body lines render as a simple one-compartment box when
   * true, instead of the default two-compartment shape.
   * @see ~/git/plantuml/.../statediagram/command/CommandHideEmptyDescription.java
   */
  hideEmptyDescription?: boolean;
  /**
   * `left to right direction` / `top to bottom direction` (default is
   * top-to-bottom when absent) — global graphviz rankdir override.
   * @see ~/git/plantuml/.../command/CommandRankDir.java
   */
  rankdir?: 'top-to-bottom' | 'left-to-right';
}

/**
 * AST type definitions for PlantUML state diagrams.
 */

// ---------------------------------------------------------------------------
// JSON leaf value type (split out of this file — see state-json-ast.ts)
// ---------------------------------------------------------------------------

import type { JsonNode } from './state-json-ast.js';
export type { JsonNode };

import type { DiagramAnnotations } from '../../core/annotations/index.js';

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
  /**
   * A synchronization bar auto-created from a bare `=name=` transition
   * endpoint (no prior `<<fork>>`/`<<join>>` declaration needed).
   * @see ~/git/plantuml/.../statediagram/command/CommandLinkStateCommon.java#getEntity
   *      (LeafType.SYNCHRO_BAR)
   */
  | 'syncBar'
  /**
   * An embedded `json Name { ... }` / `json Name value` leaf (upstream
   * `LeafType.JSON`) — `CommandCreateJson`/`CommandCreateJsonSingleLine`,
   * registered verbatim by `StateDiagramFactory` from the shared
   * `objectdiagram.command` package (mission A4 Phase L iter 20). See
   * {@link State.jsonValue} for the parsed payload.
   * @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java:115-116
   */
  | 'json';

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
  /**
   * Raw `##[dotted|dashed|bold]colorname` line-color spec, stored
   * unparsed (matches `color`'s own precedent — neither field is
   * consumed downstream yet; the DOT-parity comparator never reads
   * colors, so the only parity-relevant effect of capturing this is
   * stopping the declaration line from being dropped entirely).
   * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java:108
   */
  lineColor?: string;
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
  /**
   * `true` when this composite exists ONLY as an auto-created, never
   * explicitly declared, ANCESTOR segment of a dotted id opened as a
   * composite/frame BLOCK (`state S.I { ... }` auto-creates phantom
   * ancestor `S`) -- mission A4 Phase L iter 10. Mirrors upstream
   * `GroupType.PACKAGE`, materialized once at end-of-parse by
   * `eventuallyBuildPhantomGroups` for any quark still lacking Entity data:
   * `Entity.isAutarkic`'s very first line unconditionally disqualifies a
   * PACKAGE-type group from autonom, regardless of link topology
   * (`abel/Entity.java:691-692`). A LEAF-style dotted declare (`state A.X`,
   * no `{ }`) instead promotes its ancestors EAGERLY via upstream
   * `ensureParentState` (`StateDiagram.java:268-280`) to ordinary
   * `GroupType.STATE` (autonom-eligible, no flag) -- so this is set ONLY by
   * the composite/frame block-opener path, and is CLEARED the moment a
   * later leaf-style declare passes through the same ancestor (mirrors
   * `ensureParentState`'s own eager-promotion check, which stops walking up
   * as soon as it finds a quark that already has Entity data -- so any
   * still-phantom ancestor a LATER leaf declare reaches gets promoted for
   * good).
   * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#eventuallyBuildPhantomGroups
   * @see ~/git/plantuml/.../abel/Entity.java#isAutarkic (:691-692)
   */
  autoPhantom?: true;
  /**
   * `$tag` names attached via a state declaration (`state Foo $a $b`, or
   * `state "A" as a $tagA { }` on a composite opener) — upstream
   * `Entity#stereotags()` (`Set<Stereotag>`). Consulted by `remove`/
   * `restore $tag` directives (state-directives.ts#computeRemovedIds) —
   * mirrors the class engine's `Classifier.tags` precedent exactly (the
   * SAME shared `CommandCreateClassMultilines#addTags`/`Stereotag`/
   * `HideOrShow` machinery upstream, reused verbatim by the state factory).
   * @see ~/git/plantuml/.../stereo/Stereotag.java
   * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java (TAGS1/TAGS2)
   * @see ~/git/plantuml/.../statediagram/command/CommandCreatePackageState.java (TAGS1/TAGS2)
   */
  tags?: string[];
  /**
   * For `kind: 'json'` only — the parsed JSON value (`CommandCreateJson`'s
   * `BodierJSon#setJson`). Absent when the json body failed to parse (a
   * `json Name {}` with no/malformed data — mirrors upstream leaving the
   * leaf entity created but never calling `setJson`; see
   * state-json-sizing.ts's empty-object fallback for how sizing represents
   * that state) or for a `kind: 'json'` state created only as an
   * auto-referenced endpoint that a real `json` declaration never reached
   * (should not occur in practice — `json` leaves have no forward-reference
   * grammar, unlike `state`).
   * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateJson.java
   * @see {@link JsonNode}
   */
  jsonValue?: JsonNode;
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
  /**
   * The composite scope active when the `note` command was parsed (`''` at
   * the diagram's top level, else the owning composite's `State.id`) --
   * mission A4 Phase L iter 9. Mirrors upstream's leaf placement: a note is
   * `diagram.reallyCreateLeaf`d under `quarkInContext(...)`, which resolves
   * relative to `getCurrentGroup()` -- the SAME "current parsing scope"
   * convention `FlatLink.scopeId` (state-composite-detect.ts) already uses
   * for `'[*]'` pseudostates. Drives which svek pass
   * (state-composite-pass.ts) the note's own DOT node is emitted into.
   * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java:329-330
   * @see ~/git/plantuml/.../command/note/CommandFactoryNote.java:192
   */
  scopeId: string;
}

// ---------------------------------------------------------------------------
// Remove/restore directives
// ---------------------------------------------------------------------------

/**
 * A `remove`/`restore` directive (upstream `CommandRemoveRestore`, registered
 * verbatim by `StateDiagramFactory` from the classdiagram package — the SAME
 * command class, not a state-specific reimplementation). Excludes the
 * matched entities from the exported graph entirely: nodes disappear and any
 * transition touching a removed entity is dropped too. Mirrors the class
 * engine's `RemoveRestoreDirective` (class ast.ts) exactly.
 * @see ~/git/plantuml/.../classdiagram/command/CommandRemoveRestore.java
 * @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java:87
 */
export interface RemoveRestoreDirective {
  kind: 'removerestore';
  action: 'remove' | 'restore';
  /**
   * Raw target expression, interpreted by
   * state-directives.ts#computeRemovedIds (mirrors `HideOrShow#isApplyable`):
   * `*` (or any `*`-wildcard pattern) matches every entity by name; `$tag`
   * matches {@link State.tags}; `<<stereotype>>` matches
   * {@link State.stereotype}; `@unlinked` matches entities with no incident
   * transition; anything else is a bare/wildcard id match.
   */
  what: string;
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
   * Additive (optional, unlike `states`/`transitions` above) so existing AST
   * literal constructors elsewhere (layout/renderer tests predating this
   * feature) are unaffected — absent is equivalent to `[]` everywhere this
   * is read (state-directives.ts#computeRemovedIds, layout.ts).
   */
  removeDirectives?: RemoveRestoreDirective[];
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
  /**
   * title/caption/legend/header/footer/mainframe chrome, populated by
   * {@link matchAnnotationCommand} at the parser's command-dispatch position
   * (mission G0b, decisions.md D3). Optional (unlike `states`/`transitions`)
   * so pre-existing hand-authored AST literal fixtures compile unchanged; a
   * real `parseState()` call always sets it via `createAnnotations()` —
   * `isEmpty()` distinguishes "no chrome present" from "not yet populated".
   */
  annotations?: DiagramAnnotations;
}

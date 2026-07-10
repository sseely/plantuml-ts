/**
 * AST type definitions for PlantUML class diagrams.
 */

// ---------------------------------------------------------------------------
// Member types
// ---------------------------------------------------------------------------

export type Visibility = '+' | '-' | '#' | '~';

export interface Member {
  visibility: Visibility;
  name: string;
  /** Return type (methods) or field type (attributes). */
  type?: string;
  /**
   * Defined means this is a method; undefined means this is an attribute.
   * An empty array means a method with no parameters.
   */
  params?: string[];
  isStatic: boolean;
  isAbstract: boolean;
  /** Set to true by hide/show post-processing when this member should not be rendered. */
  hidden?: boolean;
}

// ---------------------------------------------------------------------------
// Classifier types
// ---------------------------------------------------------------------------

export type ClassifierKind =
  | 'class'
  | 'abstract'
  | 'interface'
  | 'enum'
  | 'annotation'
  | 'object'
  /**
   * `entity Foo` — a native class-factory keyword (upstream
   * `CommandCreateEntityObjectMultilines` / `CommandCreateClass`'s TYPE
   * alternation). Renders as a plain rect, like a class.
   */
  | 'entity'
  /**
   * `circle Foo` — a native class-factory keyword (upstream `CommandCreateClass`
   * TYPE alternation). Rendered as the small circle table (svek `shape=plaintext`),
   * the same node shape as a `()` interface lollipop.
   */
  | 'circle'
  /**
   * A descriptive element used as a *leaf* under `allowmixing` (upstream
   * `CommandCreateElementFull2` — `database`, `node`, `component`, `cloud`, …).
   * All render as a plain rect at the DOT level; the specific USymbol icon is a
   * rendering detail. The keyword is preserved in {@link Classifier.usymbol}.
   */
  | 'descriptive'
  /**
   * `usecase Foo` (LeafType.USECASE) — the only descriptive leaf whose svek node
   * shape is not rect: it renders as `shape=ellipse`.
   */
  | 'usecase'
  /**
   * An association node declared with `<> name` (upstream
   * CommandDiamondAssociation → LeafType.ASSOCIATION): a small diamond-shaped
   * n-ary/association-class connector, rendered as `shape=diamond`.
   */
  | 'association'
  /**
   * The tiny `shape=circle` connector node synthesised for an association-class
   * couple `(A,B) .. C`: it sits on the A–B association and the association
   * class C attaches to it. Not user-declared — created by the parser.
   */
  | 'assoc-circle'
  /**
   * The interface-lollipop leaf synthesised by the `Name ()-- Existing` /
   * `Existing --() Name` shorthand (upstream `CommandLinkLollipop`) — a
   * DIFFERENT command from both the general relationship arrow's single `(`/`)`
   * decor glyph (class-relationship-parser.ts, `CommandLinkClass`, which only
   * decorates an edge between two already-declared classifiers) and the
   * standalone `() "name"` declaration (class-commands.ts, shape=plaintext,
   * `CommandCreateElementParenthesis`). Renders as `shape=circle` (fixed 10x10
   * size, not text-measured) — see {@link Classifier.lollipopKind} for the
   * required/provided distinction. Not user-declared directly — created by
   * class-lollipop.ts.
   */
  | 'lollipop';

export interface Classifier {
  /** Unique identifier — alias if declared, otherwise display name. */
  id: string;
  display: string;
  kind: ClassifierKind;
  /** Generic type parameters, e.g. ['T', 'U']. */
  typeParams: string[];
  members: Member[];
  stereotype?: string;
  color?: string;
  namespace?: string;
  /** Set to true by hide/show post-processing when the circle badge should be suppressed. */
  hideCircle?: boolean;
  /**
   * For `kind: 'descriptive'`, the source keyword (`database`, `node`, …) — the
   * upstream USymbol. Preserved for rendering; does not affect DOT structure.
   */
  usymbol?: string;
  /**
   * For `kind: 'lollipop'` only — `'half'` (required interface / socket, a
   * half-circle notch) vs `'full'` (provided interface, a full circle), from
   * whether the two paren glyphs matched (`((`/`))`) or differed (`()`)
   * (`CommandLinkLollipop#getType`). SVG-rendering-only: the DOT node shape is
   * `circle` either way, so this does not affect layout/DOT parity.
   */
  lollipopKind?: 'full' | 'half';
}

// ---------------------------------------------------------------------------
// Relationship types
// ---------------------------------------------------------------------------

export type RelationshipType =
  | 'extension'      // <|--
  | 'implementation' // <|..
  | 'composition'    // *--
  | 'aggregation'    // o--
  | 'dependency'     // ..>
  | 'association'    // -->
  | 'usage';         // ..

/**
 * The decoration drawn at one end of a link, mirroring upstream's LinkDecor:
 * each arrow end is decorated independently of the semantic {@link
 * RelationshipType}. `none` is a plain (undecorated) end — a plain `--`
 * association has `none` at both ends, unlike a directed `-->` (`open` at the
 * target). Parsed per-end from the arrow token (source/target assigned by the
 * arrow's direction).
 */
export type LinkDecor =
  | 'triangle'
  | 'open'
  | 'diamond'
  | 'filledDiamond'
  | 'none';

export interface Relationship {
  from: string;
  to: string;
  type: RelationshipType;
  /**
   * Decoration at the source/target end, parsed independently from the arrow
   * token's two heads (D6). Drives the rendered edge markers; does NOT affect
   * the DOT graph (which uses {@link RelationshipType} + `length`). Absent for
   * relationships not built from an arrow token — layout then falls back to a
   * type-derived default.
   */
  sourceDecor?: LinkDecor;
  targetDecor?: LinkDecor;
  fromMultiplicity?: string;
  toMultiplicity?: string;
  label?: string;
  /**
   * Port/member name from `Class::member` endpoint syntax (PlantUML reuses
   * the legacy UML `::` namespace separator to target a specific member of
   * a classifier). The edge itself still connects the two classifiers;
   * the port name is metadata for a later shield/port-node rendering pass.
   */
  fromPort?: string;
  toPort?: string;
  /**
   * Qualifier text from qualified-association syntax (`class1 [Qualifier] <--
   * class2`), sided like the multiplicities: the qualifier attaches to whichever
   * endpoint bears the `[...]`. The qualifier-bearing classifier renders as a
   * shielded `shape=plaintext` node in svek.
   */
  fromQualifier?: string;
  toQualifier?: string;
  /**
   * Arrow length: the count of body chars (`-`/`.`/`=`) in the arrow, mirroring
   * upstream `CommandLinkClass.getQueueLength`. Drives the dot `minlen`
   * (`length - 1`): `->` (1) → 0, `-->` (2) → 1, `--->` (3) → 2. Absent ⇒ the
   * default association length of 2 (minlen 1).
   */
  length?: number;
  /**
   * Emit as `style=invis` — an invisible layout constraint edge, not a drawn
   * relationship. Used to tie together the two association-class circles that
   * share an (A,B) pair (`R1..(A,B)` + `(A,B)..R2`).
   */
  invis?: boolean;
  /**
   * Graphviz edge `weight` (rank-assignment tie-breaker; higher pulls the
   * edge straighter/shorter) — from the optional `@N.N` header prefix upstream
   * commands accept (`CommandLinkClass`/`CommandLinkLollipop`'s HEADER group,
   * `Link#setWeight`). Passed straight through to the dot layout engine
   * (graph-layout.ts); not shown in the emitted comparator DOT (matches
   * upstream, where it also only affects internal rank assignment).
   */
  weight?: number;
}

// ---------------------------------------------------------------------------
// Note types
// ---------------------------------------------------------------------------

export type NotePosition = 'left' | 'right' | 'top' | 'bottom';

/**
 * A note. Two forms:
 *  - `note <pos> of <Entity>` — attached to a classifier; PlantUML lays this
 *    out as its own graphviz node connected to the host by a plain
 *    connector edge. `target` and `position` are set.
 *  - `note as <alias> ... end note` — freestanding/unattached; still becomes
 *    its own graph node (inside its enclosing package, if any), but has no
 *    host classifier and no position until/unless a later relationship
 *    line connects it to something. `target` and `position` are undefined;
 *    `id` is the user-declared alias so relationship endpoints can resolve
 *    to it.
 */
export interface ClassNote {
  /** Generated layout id (e.g. `__note_0`) for attached notes; the
   *  user-declared alias (e.g. `N3`) for freestanding notes. */
  id: string;
  /** Host classifier id the note is attached to (attached notes only). */
  target?: string;
  /**
   * Member/port name from `note <pos> of Class::member` syntax — mirrors
   * `Relationship.fromPort`/`toPort` (same `::` grammar, split the same way
   * via `splitEndpointPort`). The note still anchors to the host classifier
   * (`target`); this is metadata only. Notes anchored to a specific member
   * lay out with an invisible connector (svek routes member-anchored notes
   * as a layout-only constraint, unlike a plain classifier note's visible
   * connector) — see note-layout.ts's `buildNoteGraphParts`.
   * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java
   */
  targetPort?: string;
  /**
   * True when `target` came from falling back to the last-created entity —
   * a bare `note <pos>` with no `of <Entity>` clause at all — rather than an
   * explicit `of` reference. `CommandFactoryNote` (bare) and
   * `CommandFactoryNoteOnEntity` (`of`) are separate upstream commands with
   * different merge behavior: only explicit-`of` notes on the same
   * (host, side) merge into one svek node (verified: zepeki-75-pifo352 — a
   * bare `note left` and an explicit `note left of test::member`, same host
   * and side, stay TWO separate oracle nodes). See note-layout.ts's
   * `groupNotes`.
   */
  implicitTarget?: true;
  position?: NotePosition;
  /** Note body (may contain newlines for multi-line notes). */
  text: string;
  /**
   * Enclosing namespace id, if the note was declared inside a `package`/
   * namespace block — mirrors `Classifier.namespace`. A note's DOT node id
   * (`id` above) is registered bare into `Namespace.classifiers` (same as any
   * other member), which is the sole source `buildDotClusters` uses for
   * cluster membership; upstream has no separate field since notes and
   * classifiers are both leaves in the same Quark tree.
   * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:175-184 getCurrentGroup
   */
  namespace?: string;
}

// ---------------------------------------------------------------------------
// Namespace types
// ---------------------------------------------------------------------------

export interface Namespace {
  id: string;
  display: string;
  /** Classifier ids contained within this namespace. */
  classifiers: string[];
  /**
   * Enclosing namespace id for nested packages/namespaces (dotted names split
   * on the namespace separator, e.g. `a.b.c` → nested `a` > `a.b` > `a.b.c`);
   * absent ⇒ top-level. Mirrors upstream's Quark hierarchy.
   */
  parentId?: string;
}

// ---------------------------------------------------------------------------
// Hide/show directives
// ---------------------------------------------------------------------------

export type HideTarget =
  | 'empty members'
  | 'members'
  | 'circle'
  | 'empty fields'
  | 'empty methods';

export interface HideShowDirective {
  kind: 'hideshow';
  action: 'hide' | 'show';
  target: HideTarget;
}

// ---------------------------------------------------------------------------
// Root AST
// ---------------------------------------------------------------------------

export interface ClassDiagramAST {
  classifiers: Classifier[];
  relationships: Relationship[];
  namespaces: Namespace[];
  directives: HideShowDirective[];
  notes: ClassNote[];
  /**
   * Set to `'LR'` by `left to right direction` (upstream CommandRankDir →
   * skinparam Rankdir=LEFT_TO_RIGHT). Absent = top-to-bottom default (svek emits
   * no `rankdir` attribute then).
   */
  rankdir?: 'LR';
  /**
   * All pages, in source order, when the source contains `newpage`
   * (upstream `NewpagedDiagram`) — the first element is this same AST
   * object. Absent for single-page sources so existing callers/tests that
   * only look at the top-level AST fields are unaffected.
   * @see ~/git/plantuml/.../NewpagedDiagram.java:61-162
   */
  pages?: ClassDiagramAST[];
}

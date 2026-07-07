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
  | 'object';

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

export interface Relationship {
  from: string;
  to: string;
  type: RelationshipType;
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
  position?: NotePosition;
  /** Note body (may contain newlines for multi-line notes). */
  text: string;
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
}

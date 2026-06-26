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
}

// ---------------------------------------------------------------------------
// Note types
// ---------------------------------------------------------------------------

export type NotePosition = 'left' | 'right' | 'top' | 'bottom';

/** A `note <pos> of <Entity>` attached to a classifier. PlantUML lays this out
 *  as its own graphviz node connected to the host by a plain connector edge. */
export interface ClassNote {
  /** Generated layout id (e.g. `__note_0`); distinct from any classifier id. */
  id: string;
  /** Host classifier id the note is attached to. */
  target: string;
  position: NotePosition;
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

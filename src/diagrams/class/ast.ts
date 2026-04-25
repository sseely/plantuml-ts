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
// Namespace types
// ---------------------------------------------------------------------------

export interface Namespace {
  id: string;
  display: string;
  /** Classifier ids contained within this namespace. */
  classifiers: string[];
}

// ---------------------------------------------------------------------------
// Root AST
// ---------------------------------------------------------------------------

export interface ClassDiagramAST {
  classifiers: Classifier[];
  relationships: Relationship[];
  namespaces: Namespace[];
}

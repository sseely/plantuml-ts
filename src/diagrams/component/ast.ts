/**
 * AST type definitions for PlantUML component diagrams.
 */

// ---------------------------------------------------------------------------
// Node types
// ---------------------------------------------------------------------------

export type ComponentKind =
  | 'component'
  | 'interface'
  | 'node'
  | 'package'
  | 'folder'
  | 'frame'
  | 'cloud'
  | 'database'
  | 'storage';

export interface ComponentNode {
  id: string;
  display: string;
  kind: ComponentKind;
  /** Nested children — non-empty only for container kinds. */
  children: ComponentNode[];
  stereotype?: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Link types
// ---------------------------------------------------------------------------

export type LinkStyle = 'solid' | 'dashed';

export interface ComponentLink {
  from: string;
  to: string;
  label?: string;
  style: LinkStyle;
  arrowHead?: 'open' | 'filled' | 'none';
}

// ---------------------------------------------------------------------------
// Root AST
// ---------------------------------------------------------------------------

export interface ComponentDiagramAST {
  /** Top-level nodes only; children are nested under their parent. */
  nodes: ComponentNode[];
  links: ComponentLink[];
}

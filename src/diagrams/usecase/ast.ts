/**
 * AST type definitions for PlantUML use case diagrams.
 */

// ---------------------------------------------------------------------------
// Node kinds
// ---------------------------------------------------------------------------

export type UCNodeKind =
  | 'actor'
  | 'business-actor'
  | 'usecase'
  | 'business-usecase'
  | 'package'
  | 'rectangle'
  | 'node'
  | 'folder'
  | 'frame'
  | 'cloud'
  | 'database';

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

export interface UCNode {
  id: string;
  display: string;
  kind: UCNodeKind;
  /** Nested children — non-empty only for container kinds. */
  children: UCNode[];
  stereotype?: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

export type UCLinkStyle = 'solid' | 'dashed';

export interface UCLink {
  from: string;
  to: string;
  label?: string;
  /** Stripped from <<...>> in the link label (e.g. "include", "extend"). */
  stereotype?: string;
  style: UCLinkStyle;
}

// ---------------------------------------------------------------------------
// Root AST
// ---------------------------------------------------------------------------

export interface UseCaseDiagramAST {
  /** Top-level nodes only; children are nested under their parent. */
  nodes: UCNode[];
  links: UCLink[];
}

/**
 * AST type definitions for PlantUML descriptive diagrams (component / use-case /
 * deployment).
 *
 * Upstream renders all three through one engine (`DescriptionDiagramFactory`),
 * modelling every element as a single type that carries a `USymbol` shape rather
 * than a per-diagram `kind` union. This unifies the prior `ComponentNode` /
 * `UCNode` shapes — which differed only in their `kind` union and the use-case
 * link `stereotype` field — into one model (decisions D1, D2).
 */

import type { USymbol } from '../../core/descriptive-keywords.js';

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

export interface DescriptiveNode {
  id: string;
  display: string;
  /** Upstream `USymbol` shape — drives both layout sizing and render dispatch. */
  symbol: USymbol;
  /** Nested children — non-empty only for container symbols. */
  children: DescriptiveNode[];
  stereotype?: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

export type DescriptiveLinkStyle = 'solid' | 'dashed';

export interface DescriptiveLink {
  from: string;
  to: string;
  label?: string;
  /** Stripped from <<...>> in the link label (e.g. "include", "extend"). */
  stereotype?: string;
  style: DescriptiveLinkStyle;
  arrowHead?: 'open' | 'filled' | 'none';
}

// ---------------------------------------------------------------------------
// Root AST
// ---------------------------------------------------------------------------

export interface DescriptionDiagramAST {
  /** Top-level nodes only; children are nested under their parent. */
  nodes: DescriptiveNode[];
  links: DescriptiveLink[];
}

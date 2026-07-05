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
  /** Declared with a `{` body (CommandPackageWithUSymbol) — a GROUP entity
   *  at parse time even when the body is empty. Empty groups are demoted to
   *  leaves only later, at the svek stage (GraphvizImageBuilder.java:416-418),
   *  which is AFTER applySingleStrategy — so they never count as magma
   *  standalones. Braceless declarations are plain leaves. */
  declaredAsGroup?: true;
  stereotype?: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

export type DescriptiveLinkStyle = 'solid' | 'dashed' | 'dotted' | 'bold';

export interface DescriptiveLink {
  from: string;
  to: string;
  label?: string;
  /** Stripped from <<...>> in the link label (e.g. "include", "extend"). */
  stereotype?: string;
  style: DescriptiveLinkStyle;
  arrowHead?: 'open' | 'filled' | 'none';
  /**
   * Upstream `Link.getLength()` — the count of '-'/'.' characters in the
   * arrow token (`->` = 1, `-->` = 2, `->>` = 1, `--` = 2, `..` = 2, `.>` = 1,
   * `..>` = 2). Drives SvekEdge.isHorizontal() (length === 1) and therefore
   * whether a labeled link's dzeta contributes to nodesep or ranksep.
   *
   * CommandLinkElement.executeArg: when the resolved direction is LEFT or
   * RIGHT the upstream "queue" collapses to "-" (length 1, minlen 0);
   * otherwise length is the full BODY1+BODY2 character count.
   */
  length: number;
  /**
   * Upstream CommandLinkElement FIRST_LABEL / SECOND_LABEL — qualifier
   * labels attached to the tail (ENT1-side) / head (ENT2-side) end of the
   * link, e.g. `a "1" --> "0..*" b`. Swapped along with from/to whenever the
   * link is inverted (explicit `left`/`up` direction — see `length` above).
   */
  firstLabel?: string;
  secondLabel?: string;
  /**
   * Raw HEAD1/HEAD2 `LinkDecor` tokens (trimmed, lowercased), swapped on
   * inversion like firstLabel/secondLabel. Recorded for future decor
   * rendering (diamond/crowfoot/circle/etc shapes) — not yet rendered.
   */
  tailDecor?: string;
  headDecor?: string;
  /**
   * Upstream ARROW_STYLE1/2 `hidden` keyword. `SvekEdge` still emits the DOT
   * edge (`style=invis`) — a hidden link still counts structurally.
   */
  hidden?: boolean;
  /**
   * Upstream ARROW_STYLE `norank` keyword. Recorded only — no graphviz
   * constraint=false equivalent exists in the layout pipeline yet.
   */
  norank?: boolean;
  /**
   * Raw `[...]` ARROW_STYLE1/2 content (e.g. "#blue,dashed;#red"). Besides
   * hidden/norank above, these keywords are render-only (upstream
   * `Link.applyStyle`) and not yet applied.
   */
  rawStyle?: string;
}

// ---------------------------------------------------------------------------
// Root AST
// ---------------------------------------------------------------------------

export interface DescriptionDiagramAST {
  /** Top-level nodes only; children are nested under their parent. */
  nodes: DescriptiveNode[];
  links: DescriptiveLink[];
  /**
   * Upstream skinparam Rankdir, set ONLY by `left to right direction`
   * (CommandRankDir.java). Absent = top-to-bottom default (upstream emits
   * no `rankdir` attribute at all in that case).
   */
  rankdir?: 'LR';
  /** `skinparam linetype ortho|polyline` — under ortho, svek emits edge
   *  labels as `xlabel=` instead of `label=` (SvekEdge.java:434-441) plus
   *  `splines=ortho;forcelabels=true;` graph attrs. */
  linetype?: 'ortho' | 'polyline';
}

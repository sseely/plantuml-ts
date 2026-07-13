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
import type { DiagramAnnotations } from '../../core/annotations/index.js';

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
  /** Auto-created from a bare/quoted link endpoint (LeafType.STILL_UNKNOWN);
   *  mutated to actor-or-interface at parse end (makeDiagramReady). Cleared
   *  once resolved. */
  stillUnknown?: true;
  /** `remove <id|$tag|*>` marker (CommandRemoveRestore.java). Upstream is a
   *  LAZY marker evaluated at print time (CucaDiagram.isRemoved): magma
   *  chaining and the degenerate check run on the UNFILTERED entity set;
   *  only DOT emission (nodes, edges touching removed, cluster members) and
   *  rendering filter it. `restore` clears the flag. */
  removed?: true;
  stereotype?: string;
  color?: string;
  /** `Stereotag` names (net.sourceforge.plantuml.stereo.Stereotag), attached
   *  via `$tag` tokens on the declaration line (CommandCreateElementFull's
   *  TAGS1/TAGS2 groups, added to the entity by
   *  CommandCreateClassMultilines.addTags). Matched by tag-form `remove`/
   *  `restore`/`hide` (HideOrShow#isApplyableTag) — see
   *  `parser.ts#removeEntity`. */
  tags?: string[];
  /** `port`/`portin`/`portout` direction (abel/EntityPosition.java PORTIN/
   *  PORTOUT). `port` and `portin` both resolve to `'portin'`; `portout` to
   *  `'portout'` (descdiagram/command/CommandCreateElementFull.java:276-284).
   *  Only ever set on a `symbol: 'port'` leaf — drives rank assignment
   *  (source/sink) and the Svek `ClusterDotString` port-placeholder
   *  mechanism at the layout stage. */
  position?: 'portin' | 'portout';
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
   * Upstream ARROW_STYLE `single` keyword (`WithLinkType.goSingle` /
   * `isSingle`) — NOT a render style despite living in the same style-token
   * grammar as dashed/bold/hidden. It is a link-ADD-time dedup flag consumed
   * by `CucaDiagram.addLink` (`net.atmp.CucaDiagram.java:880-893`): when a
   * new link has `single === true` and the diagram already holds any other
   * link connecting the same two entities (`Link.sameConnections` —
   * endpoint identity match in either direction, ignoring style/type), the
   * new link is silently dropped instead of appended. Consumed at the
   * `state.ast.links.push` call site in parser.ts, not at render time.
   * @see ~/git/plantuml/.../decoration/WithLinkType.java:110-116,151-152
   * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:880-893
   */
  single?: boolean;
  /**
   * Raw `[...]` ARROW_STYLE1/2 content (e.g. "#blue,dashed;#red"). Besides
   * hidden/norank/single above, these keywords are render-only (upstream
   * `Link.applyStyle`) and not yet applied.
   */
  rawStyle?: string;
}

// ---------------------------------------------------------------------------
// Root AST
// ---------------------------------------------------------------------------

export interface DescriptionDiagramAST {
  /** `remove @unlinked` pending (HideOrShow.isAboutUnlinked) — evaluated
   *  lazily in effectiveRemovedIds per Entity.isAloneAndUnlinked:457-476
   *  (every touching link hidden or other-endpoint removed; groups qualify
   *  when all children do). `restore @unlinked` clears it. */
  removeUnlinked?: true;
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
  /**
   * T17 seed thread: `UmlSource.seed()` (see `svg-graphics-core.ts#seedOf`),
   * computed by the plugin's `parse()` step from the raw `@start.../@end...`
   * block text and carried through `layoutDescription` into
   * `DescriptionGeometry.seed` for `renderDescription`'s `UGraphicSvg.build`
   * call — the only seam back to the original source text, since the public
   * plugin contract's `render(geo, theme)` never receives it directly.
   * Type-carrying field only; no layout math reads it.
   */
  seed?: bigint;
  /**
   * All pages, in source order, when the source contains `newpage`
   * (upstream `descdiagram/command/CommandNewpage.java` wraps a
   * `NewpagedDiagram` around a brand-new empty diagram per page) — the
   * first element is this same AST object. Absent for single-page sources
   * so existing callers/tests that only look at the top-level AST fields
   * are unaffected. Mirrors the class engine's identical field
   * (`class/ast.ts`'s `ClassDiagramAST.pages`, T7).
   * @see ~/git/plantuml/.../descdiagram/command/CommandNewpage.java:76-88
   * @see ~/git/plantuml/.../NewpagedDiagram.java:61-162
   */
  pages?: DescriptionDiagramAST[];
  /**
   * title/caption/legend/header/footer/mainframe chrome (mission G0b).
   * Always populated by `parseDescription` (default `createAnnotations()`
   * when no annotation directive is present) -- optional in the type only
   * so the shared structural consumer type `{ annotations?: DiagramAnnotations
   * }` (T7) stays uniform across engines.
   * @see ../../core/annotations/index.js
   */
  annotations?: DiagramAnnotations;
}

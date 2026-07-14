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
import type { SpriteRegistry } from '../../core/sprite-commands.js';

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
  /** Auto-vivified `GroupType.PACKAGE` wrapper synthesized ONLY at layout
   *  time from a dotted (`set separator`-qualified) declaration id that has
   *  no explicit `{ }` block of its own — mirrors upstream
   *  `CucaDiagram#eventuallyBuildPhantomGroups` (`net/atmp/CucaDiagram.java
   *  :323-336`), which materializes an intermediate Quark with no Entity
   *  data into a `GroupType.PACKAGE` group ONLY at `getTextBlock`/DOT-export
   *  time (`CucaDiagram.java:465`) — AFTER `applySingleStrategy`
   *  (`CucaDiagram.java:679`, the magma/standalone-chaining pass) already
   *  ran at parse-end (`DescriptionDiagram#checkFinalError`). Never present
   *  on a parser-produced node; only ever synthesized by
   *  `namespace-groups.ts#buildNamespaceGroups`, and consumed by
   *  `magma.ts#magmaGroups` to exclude its members from standalone-chaining
   *  (they belong to no *materialized* group at magma time upstream).
   *  @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:323-336,465,679-702 */
  phantomGroup?: true;
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
  /**
   * I3b write-set expansion (journaled): parse-time creation-order value,
   * ONE shared sequence across every node AND link in the diagram -- mirrors
   * `net.atmp.CucaDiagram#cpt1` (`AtomicInteger`, starts at 0,
   * `addAndGet(1)` per assignment: `getUniqueSequenceValue()` for an
   * `Entity`'s `ent%04d` uid, `getUniqueSequence("lnk")` for a `Link`'s
   * `lnkN` uid -- `abel/Entity.java:171`, `abel/Link.java:135`). Assigned by
   * `parse-state.ts#emitNode` (every node, leaf or group alike -- the shared
   * `Entity` constructor assigns a uid unconditionally regardless of leaf
   * vs. group) at the exact moment the node is created (explicit
   * declaration OR link-endpoint auto-create, `ensureEndpoint`). Consumed
   * only by `renderer-uid.ts#buildUidPlan` to FORMAT the final `ent%04d`
   * id -- no layout math reads it. A `remove`d node still carries the index
   * it was assigned at declaration time (upstream never re-numbers on
   * removal; the value simply becomes an invisible gap once the removed
   * node is filtered out of `geo.nodes` at layout time).
   * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:127,725-730
   */
  creationIndex?: number;
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
  /**
   * `remove <<stereotype>>` marker whose pattern matched THIS link's own
   * `stereotype` (exact match; single-label only -- this port's `stereotype`
   * field has no `Stereotype#getMultipleLabels()` composite equivalent).
   * Upstream `Link.isRemoved()` (net/sourceforge/plantuml/abel/Link.java
   * :492-498) checks this INDEPENDENTLY of `cl1.isRemoved() || cl2.isRemoved()`
   * -- a stereotyped link is dropped from DOT emission even when both
   * endpoints survive, and an untagged sibling link between the same two
   * endpoints is unaffected. `isStereotypeRemoved` (net/atmp/CucaDiagram.java
   * :739-745) folds the SAME `removed` HideOrShow list used for entities,
   * matched via `HideOrShow.isApplyable(Stereotype)` (HideOrShow.java:71-75).
   * A lazy marker like `DescriptiveNode.removed` -- set/cleared eagerly by
   * `removeMatchingLinks` at command-execution time (see that function's
   * doc for why eager evaluation is equivalent here); filtered out only at
   * DOT-edge build time (`layout.ts#buildDotEdges`).
   * @see plans/description-dot-100/decision-journal.md (I3)
   */
  removed?: true;
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
  /**
   * I3b write-set expansion (journaled) -- see `DescriptiveNode
   * .creationIndex`'s doc comment for the shared-counter mechanism. A
   * LEFT/UP-direction-inverted link burns TWO values (the discarded
   * pre-inversion `Link`, then the surviving inverted one) --
   * `descdiagram/command/CommandLinkElement.java:322-326`: `Link link = new
   * Link(...); if (dir == LEFT || dir == UP) link = link.getInv();` --
   * `Link#getInv()` (`abel/Link.java:145-147`) constructs a WHOLE NEW `Link`
   * (fresh `cucaDiagram.getUniqueSequence("lnk")` call), discarding the
   * first. Assigned at `command-table.ts`'s link-execute call site, AFTER
   * both endpoints are auto-created (`ensureEndpoint`) but BEFORE
   * `addLink`'s `single`-dedup check -- upstream constructs the `Link`
   * object (consuming its uid) unconditionally before `CucaDiagram
   * .addLink`'s dedup ever runs, so a dropped-as-duplicate `single` link
   * still burns its value.
   */
  creationIndex?: number;
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
  /** `set separator <sep>` / `set namespaceseparator <sep>`
   *  (CommandNamespaceSeparator.java) — splits a dotted declaration/
   *  reference id into a nested-package hierarchy. Absent (the parser's
   *  default) matches upstream `TitledDiagram`'s own field default (`private
   *  String namespaceSeparator = null;`, TitledDiagram.java:99) — NOT ".";
   *  `DescriptionDiagram` never overrides that default (unlike
   *  `StateDiagram`, which calls `setNamespaceSeparator(".")` in its own
   *  constructor), so a dot in a component/usecase id is an ordinary id
   *  character until `set separator` is written. Explicit `set separator
   *  none`/`null` records `null` here (same effective behavior as absent).
   *  @see ~/git/plantuml/.../classdiagram/command/CommandNamespaceSeparator.java
   *  @see ~/git/plantuml/.../TitledDiagram.java:99,118-123 */
  namespaceSeparator?: string | null;
  /**
   * `!pragma kermor on` (skin/PragmaKey.java:55) — svek's alternate
   * cluster/note DOT-emission path. Set by command-table.ts's `!pragma
   * kermor on` rule; read at note-attach time (parse-state.ts's
   * `attachNoteToEntity` — a kermor group-target note attaches to the
   * Entity directly, `CommandFactoryNoteOnEntity.java:322`, rather than
   * creating a separate note leaf + edge) and at layout time
   * (link-edge-attrs.ts's `computeGraphSpacing` ranksep variant,
   * `DotStringFactory.java:111-114,247-249`; layout.ts's `DotInputGraph
   * .kermor` passthrough to svek-dot-emit.ts's kermor cluster block).
   * Absent (the default) is upstream's own default (`PragmaKey` values
   * default false; `!pragma kermor on` is the only way to set it — no
   * `off`/toggle form is exercised by any fixture in this port).
   * @see ~/git/plantuml/.../svek/ClusterDotStringKermor.java
   * @see ~/git/plantuml/.../svek/Cluster.java:595-609
   * @see plans/description-dot-100/decision-journal.md (I2)
   */
  kermor?: true;
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
  /**
   * `sprite $name [WxH/N[z]] { ... }` definitions (mission SI5b/T4),
   * populated by {@link matchSpriteCommand} at the SAME dispatch position
   * as {@link matchAnnotationCommand} (tried immediately after it, mirroring
   * upstream's `CommonCommands.addTitleCommands` then `addCommonCommands2`
   * registration order). Optional so hand-authored AST literal fixtures
   * compile unchanged; a real `parseDescription()` call always sets it via
   * `createSpriteRegistry()`.
   */
  sprites?: SpriteRegistry;
}

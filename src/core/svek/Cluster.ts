/**
 * Cluster — the DRAWING half of a description/component/usecase-diagram
 * container (a `package`, `frame`, `node`, or component/interface acting
 * as a group): the `<!--cluster X-->` comment, the `<g class="cluster"
 * data-qualified-name="..." id="..." data-source-line="...">` decoration
 * group, and the body+title+stereotype chrome drawn inside it via
 * `ClusterDecoration`.
 *
 * Upstream: svek/Cluster.java (760 ln). This port covers ONLY the
 * drawing half; every layout/dot-generation member is UNPORTED (see the
 * cut line below). `Cluster.java` itself is a `Moveable` layout node that
 * also owns child-cluster/`SvekNode` bookkeeping, dot-string emission,
 * and rank machinery — none of that belongs to "draw this container's
 * chrome", and constructing it here would drag in `SvekNode`/`SvekEdge`/
 * `ColorSequence`/`FrontierCalculator`/the dot-generation pipeline, none
 * of which exist in this port yet (several are OTHER tasks' write-sets
 * in this mission batch).
 *
 * PORTED (drawing half):
 *  - `drawU(UGraphic)` — the `group.isHidden()` guard, the `<!--cluster
 *    X-->` comment (skipped for `##`-prefixed synthetic names), the
 *    `UGroup` decoration (`CLASS`/`ID`/`DATA_ENTITY`/`DATA_UID`/
 *    `DATA_QUALIFIED_NAME`), the package/USymbol-based body+title+
 *    stereotype draw path (border/back color resolution,
 *    `getStrokeInternal`, `ClusterDecoration`), and the defensive
 *    try/catch/finally (upstream: `catch (Exception e) {
 *    e.printStackTrace(); }` — ported as a logged catch, not a silent
 *    swallow, per this project's error-handling convention; still
 *    matches upstream's actual behavior of never letting one broken
 *    cluster abort the whole render).
 *  - `getStrokeInternal(Entity, Style)` → `getStrokeInternal(specificLine
 *    Stroke, styleStroke)`, adapted to take the two already-resolved
 *    values directly (see below).
 *  - `getBackColor(Style)` (instance) + the static `getBackColor(...)`
 *    overload — collapsed into one pure `resolveBackColor` (see its own
 *    doc comment for why the two Java overloads collapse to one).
 *  - The border-color / round-corner branch logic inside `drawU`
 *    (`resolveBorderColor`, `resolveRoundCorner`).
 *
 * UNPORTED — layout-half (needs `SvekNode`/`SvekEdge`/dot-generation
 * machinery not part of drawing, several of them other tasks' write-sets
 * this mission batch):
 *  - Constructor overloads, `parentCluster`/`group`/`nodes`/`children`/
 *    `color`/`colorTitle`/`colorNoteTop`/`colorNoteBottom`/`skinParam`/
 *    `diagram` fields, `createChild`, `getParentCluster`, `getChildren`,
 *    `getGroups`, `getGroup` — the cluster TREE and its `ColorSequence`-
 *    assigned dot identifiers; this port's `Cluster` is a single
 *    self-contained drawable, constructed per-container by the caller
 *    (matches the interface contract: geometry/title inputs come from
 *    the existing layout, `layout.ts`).
 *  - `addNode`, `getNodes(*)`, `getNodesOrderedTop`, `getNodesOrdered
 *    WithoutTop`, `isNormalPosition`, `entityPositionsExceptNormal`,
 *    `manageEntryExitPoint` (computes `rectangleArea`/`xyTitle` via
 *    `FrontierCalculator` — a layout concern; this port receives
 *    `ClusterGeometry` already computed by `layout.ts`).
 *  - `moveDelta`, `setPosition`, `setTitlePosition`, `setNoteTopPosition`,
 *    `setNoteBottomPosition`, `getRectangleArea` — mutable layout-phase
 *    position setters; this port's geometry is an immutable constructor
 *    input (functional-core style), not a mutated field.
 *  - `printCluster1`/`printCluster2`/`printCluster3_forKermor`,
 *    `printTogether`/`printInternal`/`appendRankSame`/`getRankSame`/
 *    `isInCluster`/`togetherCounter`/`addTogetherWithParents` — dot-text
 *    generation, entirely a layout/`ClusterDotString` concern (already
 *    ported separately in `layout.ts`'s own dot-building code).
 *  - `getClusterId`, `getSpecialPointId`, `getMinPoint`, `getMaxPoint` —
 *    dot node-id generation for the layout pass.
 *  - `getMagneticBorder` — feeds `SvekLine`/edge-routing "force"
 *    avoidance around a cluster's decorated shape (extremity/`SvekEdge`
 *    machinery, a parallel task's write-set this batch), not drawing.
 *  - `getTitleAndAttributeWidth`/`getTitleAndAttributeHeight`/
 *    `getTitleDimension`, `isLabel`, `getColor`, `getTitleColor`,
 *    `getColorNoteTop`, `getColorNoteBottom`, `isClusterOf` — layout-
 *    sizing/dot-identifier accessors with no drawing role.
 *  - `getCucaNote`, and `drawU`'s KERMOR-pragma branch that calls it —
 *    a niche activity-diagram/state-note integration
 *    (`CucaNote`/`EntityImageNoteLink`) gated behind
 *    `PragmaKey.KERMOR`, orthogonal to component/package container
 *    drawing and not exercised by any of this task's acceptance
 *    criteria.
 *  - `drawSwinLinesState` and `drawU`'s `skinParam.useSwimlanes(...)`
 *    branch — diagram-type-gated to state-diagram swimlanes only
 *    (`skinParam.useSwimlanes` is never true for description/component/
 *    usecase diagrams).
 *  - `drawUState` and `drawU`'s `isState` branch — diagram-type-gated to
 *    `DiagramType.STATE` only; needs `RoundedContainer`/
 *    `EntityImageState`/`EntityImageStateCommon`, none of which are
 *    ported in this codebase yet (a state-diagram mission's job, not
 *    this one's).
 *  - `getStyle`, `getDefaultStyleDefinition` — the upstream `Style`/
 *    `StyleBuilder`/`PName`/`SName`-as-real-type system these depend on
 *    does not exist in this codebase (grep confirms no
 *    `StyleSignatureBasic`/real `SName` type anywhere in `src/`) — a
 *    separate, unstarted mission. This port's `Cluster` accepts already-
 *    resolved style values (`ClusterStyleDefaults`) as a constructor
 *    input instead, mirroring this codebase's established Paint-for-
 *    HColor / SName-as-string adaptation (see `SymbolContext.ts`'s D9
 *    note, `USymbol.ts`'s `SName` doc).
 *  - `ClusterHeader` (svek/ClusterHeader.java) is not ported as a class:
 *    its job — building `title`/`stereo` `TextBlock`s from an `Entity`'s
 *    `Display`/`FontConfiguration`/creole markup — belongs to a BodyFactory-
 *    equivalent text-layout subsystem this codebase already has
 *    elsewhere (`leaf-sizing.ts`/`layout-helpers.ts`), not to
 *    `Cluster.java`. This port's `Cluster` accepts `ClusterHeaderInfo`
 *    (title/stereo `TextBlock`s + title alignment — exactly
 *    `ClusterHeader`'s three public outputs) as a plain constructor
 *    input, per the same "caller supplies the TextBlock" convention
 *    already established for the `USymbol*` family (see
 *    `symbols-component.test.ts`'s "Text measurement seam" note).
 */
import type { UGraphic } from '../klimt/UGraphic.js';
import type { UStroke } from '../klimt/UStroke.js';
import type { Paint } from '../paint.js';
import type { TextBlock } from '../klimt/shape/TextBlock.js';
import type { HorizontalAlignment } from '../klimt/geom/HorizontalAlignment.js';
import type { USymbol } from '../decoration/symbol/USymbol.js';
import { UComment } from '../klimt/shape/UComment.js';
import { UGroup, UGroupType } from '../klimt/shape/UGroup.js';
import type { UGraphicWithGroups } from './DecorateEntityImage.js';
import type { PackageStyleName } from './PackageStyle.js';
import { ClusterDecoration, type ClusterGeometry } from './ClusterDecoration.js';

/**
 * Narrows `ug` to `UGraphicWithGroups` (`startGroup`/`closeGroup` —
 * extra surface on the concrete `UGraphicSvg`, deliberately outside the
 * Brief-1-scoped `UGraphic` interface; see `UGraphicWithGroups`'s own
 * doc comment in `DecorateEntityImage.ts`). Duplicated locally (that
 * module's own `requireGroups` is not exported) rather than widening
 * `DecorateEntityImage.ts`'s write-set — matches this codebase's
 * established one-local-helper-per-call-site convention (e.g.
 * `driver-dot-path-svg.ts`'s own local `isTransparentPaint`).
 */
function requireGroups(ug: UGraphic): UGraphicWithGroups {
  const candidate = ug as Partial<UGraphicWithGroups>;
  if (typeof candidate.startGroup !== 'function' || typeof candidate.closeGroup !== 'function') {
    throw new Error('Cluster: ug does not support startGroup/closeGroup (see UGraphicSvg)');
  }
  return ug as UGraphicWithGroups;
}

export type { ClusterGeometry } from './ClusterDecoration.js';

/**
 * The subset of `Cluster.java`'s backing `Entity group` that the
 * DRAWING half reads. `hidden`/`name`/`uid`/`qualifiedName`/`location`
 * feed the `<!--cluster X-->` comment and `UGroup` decoration;
 * `isRoot`/`lineColorOverride`/`backColorOverride`/`specificLineStroke`
 * feed `resolveBorderColor`/`resolveBackColor`/`getStrokeInternal`
 * (Entity#getColors()' `ColorType.LINE`/`ColorType.BACK`/
 * `getSpecificLineStroke()`).
 */
export interface ClusterGroupInfo {
  readonly hidden: boolean;
  readonly name: string;
  readonly uid: string;
  readonly qualifiedName: string;
  readonly location: { readonly position: number } | null;
  readonly isRoot: boolean;
  readonly lineColorOverride: Paint | null;
  readonly backColorOverride: Paint | null;
  readonly specificLineStroke: UStroke | null;
}

/**
 * Already-resolved style facts `Cluster#drawU` would otherwise pull off
 * a `Style` object via `getStyle()` (unported — see module doc comment).
 */
export interface ClusterStyleDefaults {
  readonly shadowing: number;
  readonly roundCorner: number;
  readonly strictUmlStyle: boolean;
  readonly diagonalCorner: number;
  readonly lineColorDefault: Paint;
  readonly backGroundColorDefault: Paint | null;
  readonly strokeDefault: UStroke;
}

/** `ClusterHeader`'s three public outputs (see module doc comment for
 * why `ClusterHeader` itself is not ported as a class). */
export interface ClusterHeaderInfo {
  readonly title: TextBlock;
  readonly stereo: TextBlock;
  readonly titleHorizontalAlignment: HorizontalAlignment;
}

/** The `USymbol`/`PackageStyle` resolution inputs `drawU` reads off
 * `group.getUSymbol()`, `group.getPackageStyle()`, `skinParam
 * .packageStyle()`, and `skinParam.getStereotypeAlignment()`. */
export interface ClusterSymbolInfo {
  readonly symbol: USymbol | null;
  readonly packageStyle: PackageStyleName | null;
  readonly defaultPackageStyle: PackageStyleName;
  readonly stereoAlignment: HorizontalAlignment;
}

/** The "nothing painted" sentinel this codebase's SVG driver already
 * treats as fully transparent (see `AbstractCommonUGraphic.ts`'s
 * `NONE_PAINT` doc comment, `driver-dot-path-svg.ts`'s
 * `isTransparentPaint`) — upstream: `HColors.transparent()`. */
const NONE_PAINT: Paint = 'none';

/** Same equivalence class `driver-dot-path-svg.ts`'s own local
 * `isTransparentPaint` uses (duplicated per that file's own convention
 * of one small local helper per call site rather than a shared one). */
function isTransparentPaint(p: Paint): boolean {
  return p === 'none' || p === '#00000000';
}

/** Upstream: the border-color branch inside `Cluster#drawU` (`if
 * (group.getColors().getColor(LINE) != null) borderColor = ...; else
 * borderColor = style.value(LineColor).asColor(...);`). */
export function resolveBorderColor(lineColorOverride: Paint | null, lineColorDefault: Paint): Paint {
  return lineColorOverride ?? lineColorDefault;
}

/** Upstream: the `rounded`-computation lines inside `Cluster#drawU`
 * (`double rounded = style.value(RoundCorner).asDouble(); if
 * (skinParam.strictUmlStyle()) rounded = 0;`). */
export function resolveRoundCorner(roundCornerStyle: number, strictUmlStyle: boolean): number {
  return strictUmlStyle ? 0 : roundCornerStyle;
}

/** Upstream: `Cluster.getStrokeInternal(Entity, Style)` (static),
 * adapted to take the two already-resolved values (`Colors
 * #getSpecificLineStroke()`, `Style#getStroke()`) directly. */
export function getStrokeInternal(specificLineStroke: UStroke | null, styleStroke: UStroke): UStroke {
  if (specificLineStroke !== null) return specificLineStroke;
  return styleStroke;
}

/**
 * Upstream: `Cluster#getBackColor(Style)` (instance) followed
 * unconditionally by the static `Cluster.getBackColor(HColor, ...)`
 * overload — collapsed into one pure function. Both Java stages
 * ultimately resolve to the same observable outcome given no
 * `Style`/`StyleBuilder` port exists here: a root group never paints a
 * background; otherwise an explicit color override wins, else the
 * caller's resolved style default, else "nothing painted" (upstream:
 * `HColors.transparent()`).
 */
export function resolveBackColor(isRoot: boolean, backColorOverride: Paint | null, backGroundColorDefault: Paint | null): Paint {
  if (isRoot) return NONE_PAINT;
  const backColor = backColorOverride ?? backGroundColorDefault;
  if (backColor === null || isTransparentPaint(backColor)) return NONE_PAINT;
  return backColor;
}

/** Upstream: the five `uGroup.put(...)` calls inside `Cluster#drawU`,
 * plus `new UGroup(group.getLocation())`. Ported verbatim, including the
 * `ID`/`DATA_ENTITY` puts this codebase's own SVG writer already ignores
 * (`xml-writer.ts`'s `applyGroupAttribute`, porting `PortableSvgDocument
 * .java`'s identical ID-ignored/DATA_UID-renamed-to-id behavior) — kept
 * for bug-for-bug parity with upstream's own (harmless) redundant puts. */
function buildClusterGroup(group: ClusterGroupInfo): UGroup {
  const uGroup = new UGroup(group.location);
  uGroup.put(UGroupType.CLASS, 'cluster');
  uGroup.put(UGroupType.ID, `cluster_${group.name}`);
  uGroup.put(UGroupType.DATA_ENTITY, group.name);
  uGroup.put(UGroupType.DATA_UID, group.uid);
  uGroup.put(UGroupType.DATA_QUALIFIED_NAME, group.qualifiedName);
  return uGroup;
}

/**
 * Cluster — see module doc comment for the full ported/unported cut
 * line. Constructed per-container by the caller with already-computed
 * geometry (from `layout.ts`) and already-resolved style/header inputs.
 */
export class Cluster {
  constructor(
    private readonly group: ClusterGroupInfo,
    private readonly header: ClusterHeaderInfo,
    private readonly geometry: ClusterGeometry,
    private readonly style: ClusterStyleDefaults,
    private readonly symbolInfo: ClusterSymbolInfo,
  ) {}

  /** Upstream: `Cluster#drawU(UGraphic)` — the package/`USymbol`
   * decoration path only (see module doc comment for the swimlane/state/
   * KERMOR branches this omits, all diagram-type-gated away from
   * description/component/usecase diagrams). */
  drawU(ug: UGraphic): void {
    if (this.group.hidden) return;

    const fullName = this.group.name;
    if (!fullName.startsWith('##')) ug.draw(new UComment(`cluster ${fullName}`));

    const grouped = requireGroups(ug);
    grouped.startGroup(buildClusterGroup(this.group));
    try {
      this.drawDecoration(grouped);
    } catch (err) {
      // Upstream: `catch (Exception e) { e.printStackTrace(); }` — a
      // defensive catch so one broken cluster never aborts the whole
      // diagram's render. Logged, not silently swallowed (this
      // project's error-handling convention), which also matches
      // upstream's own observable behavior (diagnostic output, render
      // continues).
      console.error('Cluster.drawU: decoration failed', err);
    } finally {
      grouped.closeGroup();
    }
  }

  /** The body of `drawU`'s `try` block — split out to keep `drawU`
   * itself under this project's per-function complexity budget. */
  private drawDecoration(ug: UGraphic): void {
    const borderColor = resolveBorderColor(this.group.lineColorOverride, this.style.lineColorDefault);
    const rounded = resolveRoundCorner(this.style.roundCorner, this.style.strictUmlStyle);
    const packageStyle = this.symbolInfo.packageStyle ?? this.symbolInfo.defaultPackageStyle;
    const stroke = getStrokeInternal(this.group.specificLineStroke, this.style.strokeDefault);
    const backColor = resolveBackColor(this.group.isRoot, this.group.backColorOverride, this.style.backGroundColorDefault);

    const decoration = new ClusterDecoration(packageStyle, this.symbolInfo.symbol, this.header.title, this.header.stereo, this.geometry, stroke);

    decoration.drawU(
      ug,
      backColor,
      borderColor,
      this.style.shadowing,
      rounded,
      this.header.titleHorizontalAlignment,
      this.symbolInfo.stereoAlignment,
      this.style.diagonalCorner,
    );
  }
}

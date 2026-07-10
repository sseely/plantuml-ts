import type { UGraphic } from '../klimt/UGraphic.js';
import type { UDrawable } from '../klimt/shape/UDrawable.js';
import type { Point2D } from '../klimt/UTranslate.js';
import type { Paint } from '../paint.js';
import type { FontConfiguration } from '../klimt/shape/UText.js';
import { UTranslate } from '../klimt/UTranslate.js';
import { UText } from '../klimt/shape/UText.js';
import { UComment } from '../klimt/shape/UComment.js';
import { UGroup, UGroupType } from '../klimt/shape/UGroup.js';
import { Fore } from '../klimt/Fore.js';
import { Back } from '../klimt/Back.js';
import type { DotPath } from '../klimt/shape/DotPath.js';
import { buildDotPathFromSplinePoints, edgeMidpoint } from './svek-edge-geometry.js';
import { placeHeadExtremity, placeTailExtremity } from './svek-edge-extremity.js';
import type { PlacedExtremity } from './svek-edge-extremity.js';
import { strokeForStyle } from './svek-edge-stroke.js';
import type { UStroke } from '../klimt/UStroke.js';
import {
  getLinkTypeName,
  looksLikeRevertedForSvg,
  lookupDecors1,
  lookupDecors2,
} from './extremity/link-decor.js';
import type { LinkDecorName } from './extremity/link-decor.js';

/**
 * SvekEdge.ts — the DRAWING half of `svek/SvekEdge.java` (~1361 ln):
 * spline body, per-end extremity decorations, dashed/bold styling,
 * label/stereotype placement, and the edge's own comment/group
 * wrapper. Ported for T13; the LAYOUT half (dot round-tripping, label
 * position solving, DOT-attribute emission) stays with this port's
 * existing `src/diagrams/description/` layout — see `layout-helpers
 * .ts`'s `DescriptionEdgeGeo`/`link-edge-attrs.ts` (already built,
 * T5/T5b/etc — not touched by this task).
 *
 * `LinkStrategy.SIMPLEST`-only scope (verified against upstream, not
 * an assumption): `Link.getLinkStrategy()` (abel/Link.java:103) always
 * returns `LinkStrategy.SIMPLEST` — the `LEGACY_toberemoved` branch is
 * a commented-out dead `return` in the SAME method. Every upstream
 * `SvekEdge` member gated on `getLinkStrategy() == LEGACY_toberemoved`
 * (`getExtremity`, `getExtremitySpecial`, `isThereTwo`, `count`,
 * `PointListIterator`-based extraction from a rendered graphviz SVG
 * string) is therefore DEAD CODE in the current upstream jar and is
 * NOT ported here — this port's own layout never round-trips through a
 * rendered graphviz SVG string in the first place (`DescriptionEdgeGeo
 * .points` already carries plain control-point numbers), so there
 * would be nothing to feed that machinery even if it were ported.
 *
 * This port has no `abel/Link.java` class (the link model is the
 * description parser's `DescriptiveLink`), so the three `Link` members
 * `SvekEdge.drawU` consumes travel with this class instead:
 * `commentForSvg`/`idCommentForSvg` (Link.java:106-120) are private
 * methods below, and `Link#getUid`/entity names/uids/`getLocation`/
 * `getCodeLine` become plain `SvekEdgeInput` fields.
 *
 * Adapter boundary (interface contract, T13 mission brief): this class
 * does NOT import `DescriptionEdgeGeo` (that would create a
 * `core/svek` -> `diagrams/description` dependency, backwards per this
 * project's layering — no existing `core/svek/*` file imports from
 * `diagrams/*`). `SvekEdgeInput` below is `core/svek`'s own decoupled
 * shape; a later task adapts `DescriptionEdgeGeo` -> `SvekEdgeInput`.
 *
 * Full cut-line (every unported `SvekEdge` member + reason) is in the
 * T13 report, not repeated field-by-field here; the highlights are:
 * DOT/appendLine/rankSame emission (owned by `link-edge-attrs.ts`),
 * `Kal`/quantifier/role text, notes-on-links, `Rainbow`/multi-color
 * links, `MagneticBorder`, `Cluster`-aware trimming, and
 * `LinkConstraint` drawing — none of which this port's simplified
 * description-diagram data model produces today.
 */
export type SvekLinkStyle = 'solid' | 'dashed' | 'dotted' | 'bold';

export interface SvekEdgeLabel {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

export interface SvekEdgeInput {
  /** `Link#getUid()` (e.g. `lnk3`) — rendered as the `<g id="...">`
   *  attribute via `UGroupType.DATA_UID` (see `buildGroup`). */
  readonly uid: string;
  /** Graphviz-spline-format control points: `points[0]` is the curve
   *  start, subsequent (cp1, cp2, endpoint) triples each add one cubic
   *  bezier segment (see `svek-edge-geometry.ts`). */
  readonly points: readonly Point2D[];
  /** `Link#getEntity1().getName()` — display name of the tail entity
   *  (near `points[0]`); used by the `<!--link X to Y-->` comment and
   *  the path's `id` (`idCommentForSvg`). */
  readonly from: string;
  /** `Link#getEntity2().getName()` — display name of the head entity
   *  (near the last point). */
  readonly to: string;
  /** `Link#getEntity1().getUid()` (e.g. `ent0001`) — rendered as the
   *  group's `data-entity-1` attribute via `DATA_ENTITY_1_UID`. */
  readonly fromUid: string;
  /** `Link#getEntity2().getUid()` — rendered as `data-entity-2`. */
  readonly toUid: string;
  /** `Link#getLocation().getPosition()` — the `data-source-line`
   *  group attribute (upstream passes location unconditionally; absent
   *  here simply omits the attribute, like upstream's null location). */
  readonly sourceLine?: number;
  /** `Link#getCodeLine()` — the path's `codeLine` attribute (only
   *  emitted by upstream under `-codeLine`-style tracing; optional). */
  readonly codeLine?: string;
  readonly style: SvekLinkStyle;
  /** Raw decor token near `from` (`DescriptiveLink.tailDecor` — e.g.
   *  `'<|'`, `'o'`, `'<<'`) — upstream's `head1`, resolved via
   *  `LinkDecor.lookupDecors1` (`link-decor.ts`). */
  readonly tailDecor?: string;
  /** Raw decor token near `to` — upstream's `head2`, resolved via
   *  `LinkDecor.lookupDecors2`. */
  readonly headDecor?: string;
  /** Line/arrowhead-fill color — upstream's `Rainbow#getColor()`
   *  (this port has no multi-color `Rainbow`, so one color serves both
   *  the line and every filled extremity). */
  readonly color: Paint;
  /** Diagram background paint — upstream's `skinParam.getBackgroundColor()`,
   *  used by hollow decors (`CIRCLE`, `SQUARE`, `SVEK_CIRCLE_CONNECT`, …)
   *  to punch a background-colored hole. */
  readonly backgroundColor: Paint;
  readonly label?: SvekEdgeLabel;
  readonly stereotype?: string;
  /** Font for both `label` and `stereotype` text — required only when
   *  either is present (see `drawLabels`). */
  readonly labelFont?: FontConfiguration;
}

/** Duck-typed widening of `UGraphic` for the two group methods T2
 *  deferred off the shared interface (see `UGraphic.ts`'s doc comment —
 *  `UGraphicSvg` carries them as extra public members beyond the
 *  interface surface). Calls are feature-detected and silently skipped
 *  when absent (e.g. a minimal test double), matching this port's
 *  "widen locally via optional members" pattern rather than expanding
 *  the shared `UGraphic` interface from this task's write-set. */
interface GroupCapableUGraphic {
  startGroup?(group: UGroup): void;
  closeGroup?(): void;
}

/**
 * SvekEdge — a drawable svek link: spline body + both end extremities
 * + label/stereotype text, through a klimt `UGraphic`.
 *
 * Upstream: `svek/SvekEdge.java`'s `drawU` (comment + group + path id
 * stamping, SvekEdge.java:830-948) + the `solveLine` subset that
 * builds `extremity1`/`extremity2` and trims `dotPath`
 * (`getExtremitySimplier`, ported in `svek-edge-extremity.ts`) +
 * `drawRainbow` (ported inline below, single-color simplification —
 * see the class doc comment's cut-line pointer) + `uniq`/
 * `setSharedIds` (SvekEdge.java:824-827, 1093-1105).
 */
export class SvekEdge implements UDrawable {
  private readonly input: SvekEdgeInput;
  private readonly dotPath: DotPath;
  private readonly tailExtremity: PlacedExtremity | undefined;
  private readonly headExtremity: PlacedExtremity | undefined;
  /** Upstream `LinkType.decor1` — the HEAD-side decor (near entity 2);
   *  `CommandLinkElement.java:140` builds `new LinkType(d2, d1)`,
   *  swapping the token-side numbering (see `link-decor.ts`). */
  private readonly decor1: LinkDecorName | undefined;
  /** Upstream `LinkType.decor2` — the TAIL-side decor (near entity 1). */
  private readonly decor2: LinkDecorName | undefined;
  /** Upstream `setSharedIds(Set<String> ids)` — one set shared across
   *  every edge of a diagram so duplicate links get `-1`/`-2`-suffixed
   *  path ids. Defaults to a per-instance set (a single edge drawn
   *  standalone needs no cross-edge dedup). */
  private ids: Set<string> = new Set();

  constructor(input: SvekEdgeInput) {
    this.input = input;
    this.decor1 = lookupDecors2(input.headDecor);
    this.decor2 = lookupDecors1(input.tailDecor);
    const dotPath = buildDotPathFromSplinePoints(input.points);

    this.tailExtremity = placeTailExtremity(
      input.tailDecor,
      dotPath.getStartPoint(),
      dotPath.getStartAngle() + Math.PI,
      input.backgroundColor,
    );
    if (this.tailExtremity !== undefined) {
      dotPath.moveStartPoint(this.tailExtremity.trim.x, this.tailExtremity.trim.y);
    }

    this.headExtremity = placeHeadExtremity(
      input.headDecor,
      dotPath.getEndPoint(),
      dotPath.getEndAngle(),
      input.backgroundColor,
    );
    if (this.headExtremity !== undefined) {
      dotPath.moveEndPoint(this.headExtremity.trim.x, this.headExtremity.trim.y);
    }

    this.dotPath = dotPath;
  }

  /** Upstream: `SvekEdge#setSharedIds` (SvekEdge.java:826). */
  setSharedIds(ids: Set<string>): void {
    this.ids = ids;
  }

  /** Upstream: `Link#commentForSvg()` (Link.java:116) — see the class
   *  doc comment on why the two Link members live here. */
  private commentForSvg(): UComment {
    if (looksLikeRevertedForSvg(this.decor1, this.decor2))
      return new UComment(`reverse link ${this.input.from} to ${this.input.to}`);
    return new UComment(`link ${this.input.from} to ${this.input.to}`);
  }

  /** Upstream: `Link#idCommentForSvg()` (Link.java:106) — becomes the
   *  `<path id="...">` attribute via `setCommentAndCodeLine`. The
   *  middle branch (`looksLikeNoDecorAtAllSvg` -> plain `X-Y`) is
   *  inlined: both-NONE or both-set. */
  private idCommentForSvg(): string {
    if (looksLikeRevertedForSvg(this.decor1, this.decor2))
      return `${this.input.from}-backto-${this.input.to}`;
    if ((this.decor1 === undefined) === (this.decor2 === undefined))
      return `${this.input.from}-${this.input.to}`;
    return `${this.input.from}-to-${this.input.to}`;
  }

  /**
   * Upstream: the `UGroup` block of `SvekEdge#drawU`
   * (SvekEdge.java:845-855), put-for-put in source order. Two of the
   * keys (`ID`, and the display-name `DATA_ENTITY_1`/`DATA_ENTITY_2`)
   * are dropped by `applyGroupAttribute` (`xml-writer.ts` — verified
   * upstream quirk); they are still put here verbatim. The rendered
   * `id`/`data-entity-1`/`data-entity-2` come from `DATA_UID`/
   * `DATA_ENTITY_1_UID`/`DATA_ENTITY_2_UID`, and `EnumMap` declaration
   * order (see `UGroup.asMap`) yields the jar's attribute order.
   */
  private buildGroup(): UGroup {
    const input = this.input;
    const group = new UGroup(input.sourceLine !== undefined ? { position: input.sourceLine } : null);
    group.put(UGroupType.DATA_UID, input.uid);
    group.put(UGroupType.CLASS, 'link');
    group.put(UGroupType.ID, `link_${input.from}_${input.to}`);
    group.put(UGroupType.DATA_ENTITY_1, input.from);
    group.put(UGroupType.DATA_ENTITY_2, input.to);
    group.put(UGroupType.DATA_ENTITY_1_UID, input.fromUid);
    group.put(UGroupType.DATA_ENTITY_2_UID, input.toUid);
    const linkTypeName = getLinkTypeName(this.decor1, this.decor2);
    if (linkTypeName !== undefined) group.put(UGroupType.DATA_LINK_TYPE, linkTypeName);
    return group;
  }

  /** Upstream: `SvekEdge#uniq` (SvekEdge.java:1093), verbatim. */
  private uniq(ids: Set<string>, comment: string): string {
    if (!ids.has(comment)) {
      ids.add(comment);
      return comment;
    }
    let i = 1;
    for (;;) {
      const candidate = `${comment}-${i}`;
      if (!ids.has(candidate)) {
        ids.add(candidate);
        return candidate;
      }
      i++;
    }
  }

  drawU(ug: UGraphic): void {
    ug.draw(this.commentForSvg());
    const groupable = ug as UGraphic & GroupCapableUGraphic;
    groupable.startGroup?.(this.buildGroup());

    this.dotPath.setCommentAndCodeLine(this.uniq(this.ids, this.idCommentForSvg()), this.input.codeLine ?? null);

    const stroke = strokeForStyle(this.input.style);
    const lined = ug.apply(new Fore(this.input.color)).apply(stroke);
    lined.draw(this.dotPath);

    this.drawExtremity(lined, this.tailExtremity, stroke.onlyThickness());
    this.drawExtremity(lined, this.headExtremity, stroke.onlyThickness());
    this.drawLabels(lined);

    groupable.closeGroup?.();
  }

  private drawExtremity(ug: UGraphic, placed: PlacedExtremity | undefined, thicknessOnlyStroke: UStroke): void {
    if (placed === undefined) return;
    const backed = ug.apply(thicknessOnlyStroke).apply(new Back(placed.isFill ? this.input.color : 'none'));
    placed.drawable.drawU(backed);
  }

  private drawLabels(ug: UGraphic): void {
    const font = this.input.labelFont;
    if (font === undefined) return;
    if (this.input.stereotype !== undefined) {
      const mid = edgeMidpoint(this.input.points);
      ug.apply(new UTranslate(mid.x, mid.y - 6)).draw(UText.build(`«${this.input.stereotype}»`, font));
    }
    if (this.input.label !== undefined) {
      const { text, x, y } = this.input.label;
      ug.apply(new UTranslate(x, y)).draw(UText.build(text, font));
    }
  }
}

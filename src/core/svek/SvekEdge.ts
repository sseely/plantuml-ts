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
  /** Unique edge id — becomes the `<g id="...">` group attribute. */
  readonly id: string;
  /** Graphviz-spline-format control points: `points[0]` is the curve
   *  start, subsequent (cp1, cp2, endpoint) triples each add one cubic
   *  bezier segment (see `svek-edge-geometry.ts`). */
  readonly points: readonly Point2D[];
  /** Display identifier of the tail entity (near `points[0]`) — used
   *  for the `<!--link from to to-->` comment and the group's
   *  `data-entity-1` attribute. */
  readonly from: string;
  /** Display identifier of the head entity (near the last point). */
  readonly to: string;
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
 * buildGroup — `SvekEdge`'s `UGroup` attribute set, adapted to
 * `PortableSvgDocument#applyGroupAttribute`'s actual key handling
 * (`xml-writer.ts`, already ported, T2/T3-era — out of this task's
 * write-set): `UGroupType.ID` is silently DROPPED by that method (a
 * verified-against-upstream quirk, not a bug — see its own doc
 * comment's "ignored" branch); the `id="..."` attribute a real jar
 * `<g class="link">` carries actually comes from `UGroupType.DATA_UID`
 * (upstream's own "will be renamed to ID, but right now we do some
 * hack" comment). Likewise the rendered `data-entity-1`/`data-entity-2`
 * attributes come from `DATA_ENTITY_1_UID`/`DATA_ENTITY_2_UID`, not the
 * plain `DATA_ENTITY_1`/`DATA_ENTITY_2` keys upstream's own `SvekEdge
 * .drawU` ALSO sets (those render to nothing — `applyGroupAttribute`
 * has no case for them either, an upstream quirk not reproduced here
 * since it has zero observable SVG output).
 */
function buildGroup(input: SvekEdgeInput): UGroup {
  const group = new UGroup();
  group.put(UGroupType.CLASS, 'link');
  group.put(UGroupType.DATA_UID, input.id);
  group.put(UGroupType.DATA_ENTITY_1_UID, input.from);
  group.put(UGroupType.DATA_ENTITY_2_UID, input.to);
  return group;
}

/**
 * SvekEdge — a drawable svek link: spline body + both end extremities
 * + label/stereotype text, through a klimt `UGraphic`.
 *
 * Upstream: `svek/SvekEdge.java`'s `drawU` + the `solveLine` subset
 * that builds `extremity1`/`extremity2` and trims `dotPath`
 * (`getExtremitySimplier`, ported in `svek-edge-extremity.ts`) +
 * `drawRainbow` (ported inline below, single-color simplification —
 * see the class doc comment's cut-line pointer).
 */
export class SvekEdge implements UDrawable {
  private readonly input: SvekEdgeInput;
  private readonly dotPath: DotPath;
  private readonly tailExtremity: PlacedExtremity | undefined;
  private readonly headExtremity: PlacedExtremity | undefined;

  constructor(input: SvekEdgeInput) {
    this.input = input;
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

  drawU(ug: UGraphic): void {
    ug.draw(new UComment(`link ${this.input.from} to ${this.input.to}`));
    const groupable = ug as UGraphic & GroupCapableUGraphic;
    groupable.startGroup?.(buildGroup(this.input));

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

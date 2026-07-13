/**
 * renderer-ink-extent.ts — G0/T3 (LimitFinder mission): the SvekResult
 * document-dimension recipe (svek/SvekResult.java:70-140), lifted out of
 * `renderer.ts` to keep that file under the project's complexity cap.
 *
 * Upstream chain, faithfully reproduced (jar-verified against 8 fixtures
 * total under `DeterministicMeasurer` — the three named F4 examples
 * `vapalu-27-muxa300`/`jesibe-85-sozu187`/`cifaki-66-boxa005` PLUS all
 * five `oracle/goldens/svg-description/ratchet.json` pins, two of them
 * usecase/ellipse fixtures — see this task's report for the full
 * measurement and the two-round diagnosis this recipe's final shape
 * reflects):
 *
 *  1. `SvekResult#calculateDimension` (svek/SvekResult.java:126-133):
 *     `minMax = TextBlockUtils.getMinMax(this, sb, false)` — a `LimitFinder`
 *     ink walk over the SAME draw sequence `SvekResult#drawU` uses: every
 *     cluster, then every leaf entity, then every edge (`renderer.ts`'s own
 *     `drawClusters`/`drawEntities`/`drawEdges` — the `draw` callback this
 *     module's `computeDocumentDims` receives runs that exact sequence a
 *     SECOND time, once through the real `UGraphicSvg`). Returns
 *     `minMax.getDimension().delta(15, 15)` — `getDimension()` is
 *     `maxX-minX` / `maxY-minY`, translation-invariant, so this step needs
 *     no re-anchor to be reproduced faithfully (see the case-analysis note
 *     below for why the `moveDelta` re-anchor itself is NOT applied here).
 *  2. `TextBlockExporter#calculateFinalDimension`
 *     (core/TextBlockExporter.java:198-202) adds the diagram's own outer
 *     margin on top of (1)'s result: `width += margin.left + margin.right`,
 *     `height += margin.top + margin.bottom`. For the cuca family
 *     (component/usecase/deployment all route through `AbstractEntityDiagram`
 *     — see this project's CLAUDE.md package table), that margin is
 *     `CucaDiagram#getDefaultMargins` (net/atmp/CucaDiagram.java:719-722):
 *     `topRightBottomLeft(0, 5, 5, 0)` — top=0, right=5, bottom=5, left=0,
 *     the method's own comment reading "Strange numbers here for backwards
 *     compatibility". Faithful upstream quirk, preserved verbatim (not
 *     simplified to a symmetric margin) — this is the piece that was
 *     missing from the pre-T3 `computeTotalDimensions` hand-scan and is the
 *     actual root cause of the F4 "document dimensions short" defect: the
 *     ink-extent recipe alone (step 1) is NOT sufficient, the diagram-level
 *     margin (step 2) is what closes the remaining gap.
 *
 * This recipe applies ONLY to geometries laid out through the normal
 * DOT/svek pipeline. A SEPARATE, upstream-mandated exception exists for
 * "degenerate single leaf" diagrams — see `renderer.ts#isDegenerateGeo`'s
 * own doc comment for why those must keep using `geo.totalWidth`/
 * `totalHeight` instead (a DIFFERENT upstream class, `EntityImageDegenerated`,
 * with its own, unrelated dimension formula).
 *
 * Case analysis (decisions.md D2, the three possible re-anchor findings)
 * — REVISED after the initial F4-only measurement (which could not
 * distinguish (a) from (b), since the re-anchor delta measured `(0,0)`
 * either way): measured case (b), NOT case (a). Evidence: the F4 set
 * (rectangle/`URectangle` entities, whose `LimitFinder#drawRectangle` has
 * a `-1` min-corner inset) happened to measure ink-min exactly `(6,6)`,
 * making `(a)` and `(b)` indistinguishable there. The five
 * `ratchet.json`-pinned fixtures include two USECASE/`UEllipse` entities
 * (`LimitFinder#drawEllipse` has NO min-corner inset — `addPoint(x,y)`
 * directly, upstream/`LimitFinder.java:211-215`, ported faithfully),
 * whose measured ink-min came out `(7,7)`, not `(6,6)`. Literally applying
 * `moveDelta(6-7, 6-7) = (-1,-1)` as a real translate on the draw pass
 * SHIFTED the rendered ellipse off its jar-verified position (`ellipse/
 * @cx` off by exactly 1) — i.e., the naive translate is NOT illusory-safe,
 * it actively CORRUPTS interior geometry for non-inset shapes. Omitting
 * the translate entirely (dims-only, case (b)) reproduces every one of
 * the 5 ratchet fixtures' document dimensions exactly (verified) while
 * leaving interior geometry untouched. `getDimension()`'s translation
 * invariance (see step 1 above) means the DIMENSION math is identical
 * whether or not the translate is applied — only interior positions differ
 * — so dropping the translate costs nothing on the dimension side and
 * fixes the ellipse regression. Conclusion: this port's own layout
 * (`computeGlobalShift`/`shiftGeo`, `layout.ts`) already anchors content
 * correctly; the raw `LimitFinder` ink-min disagreeing with upstream's
 * literal `(6,6)` target for non-inset shapes is exactly the "illusory"
 * case D2 describes, not a real fidelity gap.
 */
import type { UGraphic } from '../../core/klimt/UGraphic.js';
import type { UChange } from '../../core/klimt/UChange.js';
import type { UShape } from '../../core/klimt/UShape.js';
import type { UParam } from '../../core/klimt/UParam.js';
import type { UGroup } from '../../core/klimt/shape/UGroup.js';
import type { UTranslate } from '../../core/klimt/UTranslate.js';
import type { StringBounder as KlimtStringBounder } from '../../core/klimt/font/StringBounder.js';
import type { StringBounder as DriverStringBounder } from '../../core/klimt/drawing/svg/driver-text-svg.js';
import type { StringMeasurer } from '../../core/measurer.js';
import { LimitFinder } from '../../core/klimt/drawing/LimitFinder.js';
import { XDimension2D } from '../../core/klimt/geom/XDimension2D.js';

/** `CucaDiagram#getDefaultMargins` (net/atmp/CucaDiagram.java:719-722) —
 *  "Strange numbers here for backwards compatibility": top=0, right=5,
 *  bottom=5, left=0. Applied by `TextBlockExporter#calculateFinalDimension`
 *  on top of `SvekResult#calculateDimension`'s own return value, before it
 *  reaches `SvgOption#minDim`. */
const DOCUMENT_MARGIN_TOP = 0;
const DOCUMENT_MARGIN_RIGHT = 5;
const DOCUMENT_MARGIN_BOTTOM = 5;
const DOCUMENT_MARGIN_LEFT = 0;

/**
 * `UGraphicWithGroups`-shaped decorator (see `DecorateEntityImage.ts`'s own
 * doc comment for why this port's `UGraphic` interface omits
 * `startGroup`/`closeGroup`) around a `LimitFinder`. Upstream's own
 * `LimitFinder` needs no such wrapper: it `extends UGraphicNo`, whose
 * `startGroup`/`closeGroup` are no-ops declared directly on the Java
 * `UGraphic` interface (klimt/drawing/UGraphicNo.java:76,84) — every
 * `UGraphic` implementer gets them for free. This port's own `UGraphicNo`
 * intentionally does NOT (T2 mission brief scope reduction — see
 * `UGraphic.ts`'s doc comment) since `LimitFinder` had no caller needing
 * group support until now: `EntityImageDescription#drawU`
 * (`EntityImageDescriptionSupport.ts#requireGroups`) throws without it, and
 * this task's collect pass is the first LimitFinder caller that reaches
 * `EntityImageDescription`. Scoped HERE (not added to `UGraphicNo.ts`/
 * `LimitFinder.ts` — out of this task's write-set per D7) since no other
 * caller needs it. `apply()` re-wraps every derived instance so
 * `startGroup`/`closeGroup` stay available after any number of chained
 * `.apply()` calls, exactly as upstream's class-level no-ops do.
 */
class LimitFinderWithGroups implements UGraphic {
  constructor(private readonly inner: UGraphic) {}

  apply(change: UChange): UGraphic {
    return new LimitFinderWithGroups(this.inner.apply(change));
  }

  draw(shape: UShape): void {
    this.inner.draw(shape);
  }

  getParam(): UParam {
    return this.inner.getParam();
  }

  getTranslate(): UTranslate {
    return this.inner.getTranslate();
  }

  getStringBounder(): KlimtStringBounder {
    return this.inner.getStringBounder();
  }

  /** No-op — mirrors upstream `UGraphicNo#startGroup` (klimt/drawing/UGraphicNo.java:76). */
  startGroup(_group: UGroup): void {
    // Intentionally empty — ink measurement only, no real group emitted.
  }

  /** No-op — mirrors upstream `UGraphicNo#closeGroup` (klimt/drawing/UGraphicNo.java:84). */
  closeGroup(): void {
    // Intentionally empty — ink measurement only, no real group emitted.
  }
}

/**
 * Adapts a `driverBounder` (width-only, `driver-text-svg.ts`'s narrower
 * shape) + a `StringMeasurer` into the klimt-shaped `StringBounder`
 * `LimitFinder`/`TextBlock#calculateDimension` expect — the exact
 * computation `UGraphicSvg#getStringBounder` (`u-graphic-svg.ts`) performs
 * for the REAL draw pass, duplicated here as this module's own "local
 * adapter, not a new shared module" (`renderer.ts`'s own established
 * pattern for this exact seam, `driverBounderFor`) so the collect pass and
 * the real draw pass measure text identically without either module
 * reaching into the other's private state.
 */
function klimtStringBounderFor(driverBounder: DriverStringBounder, measurer: StringMeasurer): KlimtStringBounder {
  return {
    calculateDimension(font, text) {
      const width = driverBounder.calculateDimension(font, text).width;
      const height = measurer.measure(text, font).height;
      return new XDimension2D(width, height);
    },
    getDescent(font, text) {
      return measurer.getDescent(font, text);
    },
  };
}

export interface DocumentDimResult {
  /** Final `SvgOption#minDim` width — SvekResult ink extent + document margin. */
  readonly width: number;
  /** Final `SvgOption#minDim` height — SvekResult ink extent + document margin. */
  readonly height: number;
}

/**
 * The SvekResult recipe (see this module's own doc comment — case (b),
 * dims-only, no re-anchor translate): draws `draw` (the SAME
 * `drawClusters`/`drawEntities`/`drawEdges` sequence `renderDescription`
 * uses for the real pass) through a group-capable `LimitFinder`, then
 * computes the final document `minDim` (SvekResult's own ink-extent dims,
 * `.delta(15,15)`'d, plus the CucaDiagram outer margin).
 *
 * NOT for degenerate single-leaf geometries — see `renderer.ts#
 * isDegenerateGeo`'s doc comment.
 */
export function computeDocumentDims(
  draw: (ug: UGraphic) => void,
  driverBounder: DriverStringBounder,
  measurer: StringMeasurer,
): DocumentDimResult {
  const bounder = klimtStringBounderFor(driverBounder, measurer);
  const rawLimitFinder = LimitFinder.create(bounder, false);
  draw(new LimitFinderWithGroups(rawLimitFinder));
  const minMax = rawLimitFinder.getMinMax();
  const dim = minMax.getDimension().delta(15, 15);
  return {
    width: dim.getWidth() + DOCUMENT_MARGIN_LEFT + DOCUMENT_MARGIN_RIGHT,
    height: dim.getHeight() + DOCUMENT_MARGIN_TOP + DOCUMENT_MARGIN_BOTTOM,
  };
}

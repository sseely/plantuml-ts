/**
 * u-graphic-svg.ts — `UGraphicSvg`, the concrete SVG backend that wires
 * every `Driver*Svg` from this task into `AbstractCommonUGraphic`'s
 * driver registry and owns the shared `SvgGraphics` document.
 *
 * Upstream: klimt/drawing/svg/UGraphicSvg.java (~194 ln). Ported:
 * `register()` (the seven live drivers this task ports; see below for
 * the five deferred ones), `copyUGraphic()`'s state-and-document-sharing
 * contract, `startGroup`/`closeGroup`, and `writeToStream` (collapsed to
 * `getSvgString()` — see the doc comment on that method).
 *
 * Constructor / factory signature deviation (reported): upstream splits
 * a private `UGraphicSvg(StringBounder, boolean textAsPath, FileFormat)`
 * constructor from a public `static build(SvgOption option, boolean
 * textAsPath, long seed, StringBounder, FileFormat)` factory. This port
 * collapses both into `UGraphicSvg.build(seed, option, version,
 * stringBounder)` — `textAsPath` is dropped (its only consumer,
 * `DriverTextAsPathSvg`, is a D3′ stub — see `driver-svg-stubs.ts`) and
 * `fileFormat` is dropped (its only consumers, `DriverImagePng`/
 * `DriverCenteredCharacterSvg`, are also D3′ stubs). `version` is an
 * explicit param, matching `SvgGraphicsCore`'s own D4′ preamble-
 * conformance adaptation (`svg-graphics-core.ts`). `stringBounder` is
 * `DriverTextSvg`'s own injected seam (see that module's doc comment).
 * `seed`'s type is widened to `bigint | number` (D8, see
 * `svg-graphics-core.ts`'s doc comment) — a pure widening, not a
 * breaking change: existing `number` call sites keep working unchanged.
 *
 * `copyUGraphic()` shares the SAME `SvgGraphics`/`StringBounder`
 * instances across every copy in the `apply()` chain (mirroring
 * upstream's `AbstractUGraphic#copy(other)`, which copies the
 * `graphicObject` reference, not a fresh one) — all draws on any copy
 * land in one shared document. Only the four `AbstractCommonUGraphic`
 * state fields (translate/stroke/color/backColor) are independently
 * chained per copy, via `basicCopy` (T2).
 *
 * `UComment` dispatch: `UComment implements UShape` (see
 * `shape/UComment.ts`), so it is wired into the SAME driver-registry
 * `draw(shape)` mechanism as every other shape (a small inline `UDriver
 * <UComment>` calling `svg.addComment(...)`) rather than a special-cased
 * override — `AbstractCommonUGraphic#draw` has no such special case
 * (T2), and this keeps upstream's `drawComment` override's *effect*
 * without needing a new dispatch path.
 *
 * `UGroup` dispatch: `UGroup` is NOT a `UShape` (see `shape/UGroup.ts`),
 * so it cannot go through the driver-registry `draw(shape)` mechanism at
 * all. `startGroup(UGroup)`/`closeGroup()` are ported as extra public
 * methods directly on this concrete class — beyond the `UGraphic`
 * interface's surface (T2 explicitly scoped `startGroup`/`closeGroup`
 * out of that interface; see `UGraphic.ts`'s doc comment), matching
 * upstream's own `AbstractUGraphic#startGroup`/`closeGroup` abstract-
 * method overrides.
 *
 * `asShapeCtor` (this task's own finding, reported): `URectangle` and
 * `UText` both have PRIVATE constructors (their `build()` static
 * factories are the only construction path — see `URectangle.ts`/
 * `UText.ts`). `AbstractCommonUGraphic.ts`'s `ShapeConstructor<S>` type
 * (T2) requires a *public* construct signature, so passing either class
 * directly to `registerDriver` fails to typecheck even though
 * `registerDriver` only ever uses the value as a `Map` key (`shape
 * .constructor`), never actually invoking `new` on it — the privacy
 * distinction is compile-time-only and irrelevant at this call site.
 * `asShapeCtor` documents and localizes the one unavoidable cast this
 * forces, rather than casting ad hoc at each call site.
 *
 * NOT ported (out of this task's explicitly stated scope — driver-
 * registry wiring, comment/group dispatch, document finalization only —
 * reported): `dpiFactor()` (trivially `1`, no consumer in this port
 * yet); `matchesProperty(String)`, `startUrl`/`closeUrl` (needs the
 * `Url` type, not ported — though the underlying `SvgGraphics#openLink`/
 * `closeLink` D3′ stubs already exist, see `svg-graphics.ts`),
 * `getDefaultBackground()`/`getColorMapper()` (T2 already dropped both
 * from `UGraphic`, see `UGraphic.ts`); `beforeDraw`/`afterDraw`/
 * `manageHiddenAutomatically()` (need `UParam#isHidden()`, dropped by T2
 * — see `UParam.ts`'s doc comment); the `writeToStream`'s `metadata`
 * param (its sole effect, `addCommentMetadata`, is already a D3′-
 * extended throwing stub per T4's `svg-graphics.ts` — carrying the param
 * here would just be dead surface that always throws when non-null).
 *
 * Deferred D3′ drivers (see `driver-svg-stubs.ts` for the classes and
 * why none of them can be registered here): `DriverImagePng`,
 * `DriverPixelSvg`, `DriverImageSvgSvg`, `DriverTextAsPathSvg`,
 * `DriverCenteredCharacterSvg`. `ignoreShape(UImageTikz.class)` — not
 * ported; upstream's own behavior for it is a no-op, and no `UImageTikz`
 * shape class exists in this port either.
 */

import { AbstractCommonUGraphic } from '../../AbstractCommonUGraphic.js';
import type { UDriver, ShapeConstructor } from '../../AbstractCommonUGraphic.js';
import type { UShape } from '../../UShape.js';
import { URectangle } from '../../shape/URectangle.js';
import { UEllipse } from '../../shape/UEllipse.js';
import { ULine } from '../../shape/ULine.js';
import { UPolygon } from '../../shape/UPolygon.js';
import { UPath } from '../../shape/UPath.js';
import { DotPath } from '../../shape/DotPath.js';
import { UText } from '../../shape/UText.js';
import { UComment } from '../../shape/UComment.js';
import type { UGroup } from '../../shape/UGroup.js';
import { SvgGraphics } from './svg-graphics.js';
import type { SvgOption } from './svg-graphics.js';
import { DriverRectangleSvg } from './driver-rectangle-svg.js';
import { DriverEllipseSvg } from './driver-ellipse-svg.js';
import { DriverLineSvg } from './driver-line-svg.js';
import { DriverPolygonSvg } from './driver-polygon-svg.js';
import { DriverPathSvg } from './driver-path-svg.js';
import { DriverDotPathSvg } from './driver-dot-path-svg.js';
import { DriverTextSvg } from './driver-text-svg.js';
import type { StringBounder as DriverStringBounder } from './driver-text-svg.js';
import { XDimension2D } from '../../geom/XDimension2D.js';
import type { StringBounder } from '../../font/StringBounder.js';

// See the module doc comment above ("asShapeCtor") for why this cast is
// necessary and confined to this one call site.
function asShapeCtor<S extends UShape>(ctor: { readonly name: string }): ShapeConstructor<S> {
  return ctor as unknown as ShapeConstructor<S>;
}

/** Upstream: `UGraphicSvg`. See the module doc comment above for the
 * full scope, deviations, and NOT-ported list. */
export class UGraphicSvg extends AbstractCommonUGraphic {
  private constructor(
    private readonly svg: SvgGraphics,
    private readonly stringBounder: DriverStringBounder,
  ) {
    super();
    this.register();
  }

  /** Upstream: the merged `UGraphicSvg(StringBounder, ...)` ctor +
   * `static build(SvgOption, ...)` factory — see the module doc comment
   * above for the collapsed signature and dropped params. */
  static build(seed: bigint | number, option: SvgOption, version: string, stringBounder: DriverStringBounder): UGraphicSvg {
    return new UGraphicSvg(new SvgGraphics(seed, option, version), stringBounder);
  }

  protected copyUGraphic(): UGraphicSvg {
    const result = new UGraphicSvg(this.svg, this.stringBounder);
    result.basicCopy(this);
    return result;
  }

  private register(): void {
    this.registerDriver(asShapeCtor<URectangle>(URectangle), new DriverRectangleSvg(this.svg));
    this.registerDriver(UEllipse, new DriverEllipseSvg(this.svg));
    this.registerDriver(ULine, new DriverLineSvg(this.svg));
    this.registerDriver(UPolygon, new DriverPolygonSvg(this.svg));
    this.registerDriver(UPath, new DriverPathSvg(this.svg));
    this.registerDriver(DotPath, new DriverDotPathSvg(this.svg));
    this.registerDriver(asShapeCtor<UText>(UText), new DriverTextSvg(this.svg, this.stringBounder));
    this.registerDriver(UComment, this.commentDriver());
  }

  // See the module doc comment above for why UComment goes through the
  // ordinary driver map instead of a special-cased override.
  private commentDriver(): UDriver<UComment> {
    const svg = this.svg;
    return {
      draw(comment: UComment): void {
        svg.addComment(comment.getComment());
      },
    };
  }

  /** Upstream: `startGroup(UGroup)`. See the module doc comment above
   * for why this is extra surface beyond the `UGraphic` interface. */
  startGroup(group: UGroup): void {
    this.svg.startGroup(group.asMap());
  }

  /** Upstream: `closeGroup()`. */
  closeGroup(): void {
    this.svg.closeGroup();
  }

  /** Upstream: `getSvgGraphics()`. */
  getSvgGraphics(): SvgGraphics {
    return this.svg;
  }

  /**
   * Overrides `AbstractCommonUGraphic`'s throwing default (write-set
   * expansion, T6 -- see `UGraphic.ts`'s doc comment for why this
   * method exists). Adapts this class's own constructor-injected
   * `DriverStringBounder` (`driver-text-svg.ts`'s narrower, width-only
   * text-measurement seam -- see that module's doc comment) into the
   * `klimt/font/StringBounder` shape `TextBlock#calculateDimension`
   * expects. Height is always `0`: `DriverStringBounder` carries no
   * ascent/descent data (it exists solely to compute `DriverTextSvg`'s
   * `textLength` attribute), so this adapter cannot report a real text
   * height -- callers needing one must supply their own
   * `TextBlock#calculateDimension` override that does not depend on
   * this adapter's height (as this task's own
   * `USymbolComponent1..Frame` conformance tests do: their label/
   * stereotype test doubles return a fixed, jar-measured height and
   * never consult the `StringBounder` argument they receive).
   */
  getStringBounder(): StringBounder {
    const driverBounder = this.stringBounder;
    return {
      calculateDimension(font, text) {
        return new XDimension2D(driverBounder.calculateDimension(font, text).width, 0);
      },
    };
  }

  /** Upstream: `writeToStream(OutputStream, String metadata, int dpi)`,
   * collapsed to a pure-string return (this port's renderer is
   * pure-string, no DOM/async/canvas — see `svg-graphics-core.ts`'s own
   * `createXml()` doc comment) — see the module doc comment above for
   * the dropped `metadata`/`dpi` params. */
  getSvgString(): string {
    return this.svg.createXml();
  }
}

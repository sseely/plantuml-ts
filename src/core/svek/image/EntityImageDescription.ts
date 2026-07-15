/**
 * EntityImageDescription — draws a descriptive/deployment leaf entity
 * (`component`, `usecase`, `database`, `interface`, `rectangle`, ...): the
 * `<!--entity NAME--><g class="entity" ...>` wrapper, the resolved
 * `USymbol`'s `asSmall` chrome, an optional hexagon overlay, and (for the
 * `INTERFACE` symbol only) an out-of-band title/stereotype pair drawn
 * above/below the small lollipop circle.
 *
 * Upstream: svek/image/EntityImageDescription.java (383 ln, `extends
 * AbstractEntityImage`). Ported: `getUSymbol` (as `resolveUSymbol`, in
 * `EntityImageDescriptionSupport.ts` — see below), the `shapeType`/
 * `hideText` derivation, `desc`/`name`/`stereo` `TextBlock` construction,
 * `drawU` (hexagon branch + `hideText` stencil-clipped overlay),
 * `calculateDimensionSlow`, `getShield` (+ its three private
 * link-scanning helpers), `getNameDimension`, `getOverscanX`,
 * `getShapeType`, `getMagneticBorder`.
 *
 * File split (reported, mechanical only — not an upstream divergence):
 * `EntityImageDescriptionSupport.ts` (same directory) holds `ShapeType`,
 * `Margins`, the text-construction seam, and the symbol-resolution seam;
 * `EntityImageDescriptionDelegates.ts` (same directory, split out of
 * Support.ts at E2r/L1 once that file grew past this project's 500-line
 * complexity-hook ceiling) holds every private-instance-method delegate
 * (`buildDesc`, `buildStereo`, the three link-scanning helpers,
 * `computeShieldMargins`, `hideTextOffsets`, `requireGroups`) — purely to
 * stay under that ceiling, this project's own established "500-line
 * splits" workaround. This file holds the port narrative, the constructor
 * param interfaces, and the `EntityImageDescription` class itself.
 *
 * Adaptation seam (this task's explicit charter): upstream's constructor
 * takes an `Entity` backed by `Style`/`StyleSignatureBasic`/`Colors`/
 * `Stereotype`/`PortionShower`/`BodyFactory`/`Display` — none of which
 * exist anywhere in this codebase (verified by grep). This port's
 * constructor takes the ALREADY-RESOLVED values those upstream types
 * would have produced (colors as {@link Paint}, font as klimt
 * `FontConfiguration`, label text as plain strings) as one params object
 * — the "caller supplies the resolved value" convention `Cluster.ts`
 * (T12, the sibling svek drawing-half port) established for the
 * identical `Entity`/`Style`/`ClusterHeader` gap.
 *
 * Text-construction seam: upstream builds `name`/`desc` via
 * `BodyFactory.create2`/`create3` (full Creole + word-wrap) and `stereo`
 * via `Display.create(...)`; none of `BodyFactory`/`BodyEnhanced*`/
 * `Display` exist here. `buildTextBlock` (support file) is a scoped
 * substitute — `\n`-split multi-line text, now (E2r/L1) running each line
 * through the ported `klimt/creole` stripe/atom pipeline (nested inline
 * style runs, `==` heading cascade) but still no word-wrap. Dimension
 * math uses `jarMeasurer` directly (D12, byte-verified vs the real AWT
 * jar) rather than `ug.getStringBounder()`, because this port's injected
 * klimt `StringBounder` is width-only today (T5: "real height must come
 * from a caller-supplied override") — per this task's brief ("text via
 * klimt UText with the jar measurer available for dimension math").
 *
 * Symbol-resolution seam: upstream's `getUSymbol(entity)` is a one-line
 * null-coalesce (`entity.getUSymbol() ?? componentStyle.toUSymbol()`).
 * `entity.getUSymbol()` is populated by a DIFFERENT file
 * (`descdiagram/command/CommandCreateElementFull.java`, parser layer,
 * out of this task's write-set) that special-cases `usecase`/`usecase/`/
 * `circle` BEFORE calling `USymbols.fromString`, and resolves
 * `actor`/`actor/` (business actor) VIA `fromString`'s own branches
 * (already ported, `USymbols.ts`). `resolveDescriptionUSymbol` (support
 * file) collapses that two-file interaction into one function — the
 * "IMPORTANT verified finding" the mission brief calls out.
 *
 * Dropped (reported, zero observable effect): `getStyleSignature()`
 * (needs the unported `Style` system, same exclusion `Cluster.ts`
 * documents for `getStyle`); `useRankSame` field (grep-verified: assigned
 * once, never read again anywhere in `EntityImageDescription.java` —
 * dead upstream, not a divergence); `stereotype.getSprite(...)` (no
 * sprite registry exists, catalog: "Planned"); `Display#equalsLike` is
 * approximated as plain string equality (both plain strings here, not
 * creole-aware `Display` objects) — documented, not guessed.
 */
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import type { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import type { MagneticBorder } from '../../klimt/geom/MagneticBorder.js';
import { MagneticBorderNone } from '../../klimt/geom/MagneticBorderNone.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import type { UStroke } from '../../klimt/UStroke.js';
import { UGraphicStencil } from '../../klimt/drawing/UGraphicStencil.js';
import type { FontConfiguration } from '../../klimt/shape/UText.js';
import type { AtomImageResolver } from '../../creole-atoms.js';
import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { textBlockMagneticBorder } from '../../klimt/shape/TextBlock.js';
import { TextBlockUtils } from '../../klimt/shape/TextBlockUtils.js';
import type { Paint } from '../../paint.js';
import type { USymbol } from '../../decoration/symbol/USymbol.js';
import { SymbolContext } from '../../decoration/symbol/SymbolContext.js';
import { USymbols } from '../../decoration/symbol/USymbols.js';
import type { ComponentStyle } from '../../decoration/symbol/USymbols.js';
import type { ActorStyle } from '../../skin/ActorStyle.js';
import { decorateEntityDrawing, type EntityDecorationInfo } from '../DecorateEntityImage.js';
import {
  ShapeType,
  Margins,
  type HexagonPolygon,
  buildTextBlock,
  resolveDescriptionUSymbol,
  resolveUSymbol,
  resolveShapeType,
} from './EntityImageDescriptionSupport.js';
import {
  buildDesc,
  buildStereo,
  hasSomeHorizontalLinkVisible,
  isThereADoubleLink,
  hasSomeHorizontalLinkDoubleDecorated,
  computeShieldMargins,
  hideTextOffsets,
  requireGroups,
} from './EntityImageDescriptionDelegates.js';

export { ShapeType, Margins, resolveDescriptionUSymbol, type HexagonPolygon };

// ---------------------------------------------------------------------------
// Constructor param bundles (adaptation seam — see module doc comment)
// ---------------------------------------------------------------------------

/** Upstream fields read off `Entity`: name/uid/qualified-name/location
 *  (feeds `decorateEntityDrawing`'s `UGroup` wrapper) plus `getUrl99()`. */
export interface EntityImageDescriptionEntity {
  readonly name: string;
  readonly uid: string;
  readonly qualifiedName: string;
  readonly location: { readonly position: number } | null;
  /** Non-null triggers a throw in `drawU` (D3′ URL/link scope note). */
  readonly url: string | null;
}

/** Upstream: `entity.getUSymbol()` (parser-resolved keyword) plus
 *  `getSkinParam().componentStyle()`/`actorStyle()` (fallback path). */
export interface EntityImageDescriptionSymbol {
  readonly keyword: string | null;
  readonly actorStyle: ActorStyle;
  readonly componentStyle: ComponentStyle;
}

/** Upstream: `codeDisplay` (→ `name`), `entity.getDisplay()` (→ `desc`),
 *  `portionShower.getVisibleStereotypeLabels(entity)` (→ `stereo`,
 *  plural). */
export interface EntityImageDescriptionLabels {
  readonly codeName: string;
  readonly displayText: string;
  readonly stereotypeLabels: readonly string[];
}

/** Upstream: the resolved `forecolor`/`backcolor`/`roundCorner`/
 *  `diagonalCorner`/`deltaShadow`/`stroke`/`fcTitle`/`fc`/`fcStereo`/
 *  `defaultAlign` locals the constructor computes from `Style`/`Colors`
 *  — pre-resolved here (module doc comment). `fontBody` is upstream's
 *  separate `fc` (non-title style), used only when `displayText` differs
 *  from `codeName`; defaults to `fontTitle` when omitted. */
export interface EntityImageDescriptionPaint {
  readonly forecolor: Paint;
  readonly backcolor: Paint;
  readonly roundCorner: number;
  readonly diagonalCorner: number;
  readonly deltaShadow: number;
  readonly stroke: UStroke;
  readonly fontTitle: FontConfiguration;
  readonly fontStereo: FontConfiguration;
  readonly fontBody?: FontConfiguration;
  readonly titleAlignment: HorizontalAlignment;
  readonly stereotypeAlignment: HorizontalAlignment;
  /** `style.value(PName.MinimumWidth).asDouble()`, read only on the
   *  "empty desc" branch. Defaults to upstream's own default, 0. */
  readonly minimumWidth?: number;
  /** `style.wrapWidth()`, applied ONLY to `desc` (upstream: `BodyFactory
   *  .create3`'s `lineBreakStrategy` param — `name`/`stereo` never receive
   *  it, per `EntityImageDescription.java`'s own ctor). E2r/L3, word-wrap
   *  (`Fission.ts#getSplitted`). Absent/0 = disabled (this port's default,
   *  matching upstream's own unset `PName.MaximumWidth`). */
  readonly wrapWidth?: number;
}

/** One `Link` from upstream's `Collection<Link> links` ctor param,
 *  ALREADY FILTERED to links that `contains(leaf)` (no `Entity`/`Link`
 *  identity model exists here to filter with). `otherEntityId` stands in
 *  for `link.getOther(leaf)` — any caller-chosen identity string works,
 *  used only for `Set` de-duplication. */
export interface EntityImageDescriptionLinkInfo {
  readonly length: number;
  readonly otherEntityId: string;
  readonly isInvis: boolean;
  readonly isDoubleDecorated: boolean;
}

export interface EntityImageDescriptionParams {
  readonly entity: EntityImageDescriptionEntity;
  readonly symbol: EntityImageDescriptionSymbol;
  readonly labels: EntityImageDescriptionLabels;
  readonly paint: EntityImageDescriptionPaint;
  readonly links: readonly EntityImageDescriptionLinkInfo[];
  readonly fixCircleLabelOverlapping: boolean;
  /** `bibliotekon.getNode(getEntity()).getPolygon()`, read only when
   *  `shapeType === HEXAGON`. Two absent-states mirror upstream's two
   *  null checks: `undefined` (omitted) = no `Bibliotekon` at all —
   *  upstream throws; `null` = a `Bibliotekon` exists but has no polygon
   *  for this node — upstream silently skips the draw. */
  readonly hexagonPolygon?: HexagonPolygon | null;
  /**
   * SI5b+E2r T7 write-set expansion (journaled, additive-only): resolves a
   * Creole `<img>`/`<$sprite>` atom to drawable SVG `<image>` geometry, for
   * the GIVEN font (its `color` is the sprite tint's `fontColor` per
   * `AtomSprite`'s upstream ctor — java `fontConfiguration.getColor()`).
   * Threaded to `name`/`desc`/`stereo`'s own `buildTextBlock` calls below,
   * one call per textblock so each gets its own font's color. `undefined`
   * (every pre-T7 caller) preserves byte-identical output — see
   * `EntityImageDescriptionSupport.ts#buildTextBlock`'s doc comment.
   * Builder: `src/diagrams/description/render-atoms.ts`.
   */
  readonly atomImageResolverFor?: (font: FontConfiguration) => AtomImageResolver;
}

// ---------------------------------------------------------------------------
// EntityImageDescription
// ---------------------------------------------------------------------------

/** See module doc comment. Constructed with one params object per this
 *  task's adaptation seam (also dodges this project's lizard param-count
 *  budget, matching `DecorateEntityImageParts`'s established precedent). */
export class EntityImageDescription {
  private readonly entity: EntityImageDescriptionEntity;
  private readonly shapeType: ShapeType;
  private readonly hideText: boolean;
  private readonly links: readonly EntityImageDescriptionLinkInfo[];
  private readonly fixCircleLabelOverlapping: boolean;
  private readonly hexagonPolygon: HexagonPolygon | null | undefined;
  private readonly ctx: SymbolContext;
  private readonly symbol: USymbol;

  private readonly name: TextBlock;
  private readonly desc: TextBlock;
  private readonly stereo: TextBlock;
  private readonly asSmall: TextBlock;

  constructor(params: EntityImageDescriptionParams) {
    this.entity = params.entity;
    this.links = params.links;
    this.fixCircleLabelOverlapping = params.fixCircleLabelOverlapping;
    this.hexagonPolygon = params.hexagonPolygon;

    this.symbol = resolveUSymbol(params.symbol);
    this.shapeType = resolveShapeType(this.symbol, params.fixCircleLabelOverlapping);
    this.hideText = this.symbol === USymbols.INTERFACE;

    this.ctx = new SymbolContext(params.paint.backcolor, params.paint.forecolor)
      .withStroke(params.paint.stroke)
      .withShadow(params.paint.deltaShadow)
      .withCorner(params.paint.roundCorner, params.paint.diagonalCorner);

    this.name = buildTextBlock(
      params.labels.codeName,
      params.paint.fontTitle,
      params.paint.titleAlignment,
      params.atomImageResolverFor?.(params.paint.fontTitle),
    );
    this.desc = buildDesc(this.symbol, params.labels, params.paint, params.atomImageResolverFor);
    this.stereo = buildStereo(
      params.labels.stereotypeLabels,
      params.paint.fontStereo,
      params.atomImageResolverFor?.(params.paint.fontStereo),
    );

    this.asSmall = this.hideText
      ? this.symbol.asSmall(
          TextBlockUtils.empty(0, 0),
          TextBlockUtils.empty(0, 0),
          TextBlockUtils.empty(0, 0),
          this.ctx,
          params.paint.stereotypeAlignment,
        )
      : this.symbol.asSmall(this.name, this.desc, this.stereo, this.ctx, params.paint.stereotypeAlignment);
  }

  getNameDimension(stringBounder: StringBounder): XDimension2D {
    if (this.hideText) return new XDimension2D(0, 0);
    return this.name.calculateDimension(stringBounder);
  }

  calculateDimensionSlow(stringBounder: StringBounder): XDimension2D {
    return this.asSmall.calculateDimension(stringBounder);
  }

  getShapeType(): ShapeType {
    return this.shapeType;
  }

  getShield(stringBounder: StringBounder): Margins {
    if (!this.hideText) return Margins.NONE;
    if (isThereADoubleLink(this.links)) return Margins.NONE;
    if (!this.fixCircleLabelOverlapping && hasSomeHorizontalLinkVisible(this.links)) return Margins.NONE;
    if (hasSomeHorizontalLinkDoubleDecorated(this.links)) return Margins.NONE;
    return computeShieldMargins(this.stereo, this.desc, this.asSmall, stringBounder);
  }

  getOverscanX(stringBounder: StringBounder): number {
    if (!this.hideText) return 0;
    const { posx1, posx2 } = hideTextOffsets(this.asSmall, this.desc, this.stereo, stringBounder);
    return Math.max(-posx1, -posx2, 0);
  }

  getMagneticBorder(): MagneticBorder {
    if (this.shapeType === ShapeType.FOLDER) return textBlockMagneticBorder(this.asSmall);
    return new MagneticBorderNone();
  }

  drawU(ug: UGraphic): void {
    if (this.entity.url !== null) {
      throw new Error(
        'EntityImageDescription.drawU: entity hyperlinks (Url) are not supported — ' +
          'ug.startUrl/closeUrl require the interactive-link driver, deferred per D3-prime ' +
          '(see drawing/svg/svg-graphics.ts openLink/closeLink)',
      );
    }
    const info: EntityDecorationInfo = {
      name: this.entity.name,
      qualifiedName: this.entity.qualifiedName,
      uid: this.entity.uid,
      location: this.entity.location,
    };
    decorateEntityDrawing(requireGroups(ug), info, { drawU: (inner: UGraphic) => this.drawInner(inner) });
  }

  private drawInner(ug: UGraphic): void {
    if (this.shapeType === ShapeType.HEXAGON) this.drawHexagon(this.ctx.apply(ug));
    this.asSmall.drawU(ug);
    if (this.hideText) this.drawHiddenTextOverlay(ug);
  }

  private drawHexagon(ug: UGraphic): void {
    if (this.hexagonPolygon === undefined) {
      throw new Error('EntityImageDescription.drawHexagon: no hexagon geometry supplied (upstream: bibliotekon == null)');
    }
    if (this.hexagonPolygon === null) return;
    this.hexagonPolygon.setDeltaShadow(this.ctx.getDeltaShadow());
    ug.draw(this.hexagonPolygon);
  }

  /** Upstream: the `if (hideText) { ... }` block inside `drawU` — the
   *  desc/stereo pair drawn outside the small lollipop circle,
   *  stencil-clipped to their own dimension. */
  private drawHiddenTextOverlay(ug: UGraphic): void {
    const HIDE_TEXT_SPACE = 8;
    const stringBounder = ug.getStringBounder();
    const { posx1, posx2, dimSmall, dimDesc, dimStereo } = hideTextOffsets(this.asSmall, this.desc, this.stereo, stringBounder);

    const dimSmallHeight = dimSmall.getHeight();
    let ugDesc = ug.apply(new UTranslate(posx1, HIDE_TEXT_SPACE + dimSmallHeight));
    ugDesc = UGraphicStencil.create(ugDesc, dimDesc);
    this.desc.drawU(ugDesc);

    const dimStereoHeight = dimStereo.getHeight();
    this.stereo.drawU(ug.apply(new UTranslate(posx2, -HIDE_TEXT_SPACE - dimStereoHeight)));
  }
}

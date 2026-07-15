/**
 * EntityImageDescriptionSupport — module-level helpers for
 * `EntityImageDescription.ts`, extracted purely to stay under this
 * project's 500-line complexity-hook ceiling (see this project's
 * established "500-line splits" workaround — `EntityImageDescription.ts`
 * itself carries the full port narrative and adaptation-seam citations;
 * this file is pure implementation, not a separate upstream unit).
 *
 * Contains: `ShapeType`/`Margins` (upstream: svek/ShapeType.java,
 * svek/Margins.java), the text-construction seam (`buildTextBlock` and
 * its helpers — this port's scoped substitute for `BodyFactory
 * .create2`/`create3`, see the sibling file's doc comment), the
 * symbol-resolution seam (`resolveDescriptionUSymbol`/`resolveUSymbol`/
 * `resolveShapeType`), and every private instance-method body
 * `EntityImageDescription` delegates to (`buildDesc`, `buildStereo`,
 * the three link-scanning helpers, `computeShieldMargins`,
 * `hideTextOffsets`, `requireGroups`).
 */
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { UShape } from '../../klimt/UShape.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UText } from '../../klimt/shape/UText.js';
import type { FontConfiguration } from '../../klimt/shape/UText.js';
import { UImage } from '../../klimt/shape/UImage.js';
import { UHorizontalLine } from '../../klimt/shape/UHorizontalLine.js';
import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { TextBlockUtils } from '../../klimt/shape/TextBlockUtils.js';
import { scanLineForAtoms, type AtomImageResolver } from '../../creole-atoms.js';
import type { USymbol } from '../../decoration/symbol/USymbol.js';
import { USymbols, componentStyleToUSymbol } from '../../decoration/symbol/USymbols.js';
import type { ComponentStyle } from '../../decoration/symbol/USymbols.js';
import type { ActorStyle } from '../../skin/ActorStyle.js';
import type { UGraphicWithGroups } from '../DecorateEntityImage.js';
import type {
  EntityImageDescriptionSymbol,
  EntityImageDescriptionLabels,
  EntityImageDescriptionPaint,
  EntityImageDescriptionLinkInfo,
} from './EntityImageDescription.js';

/** The geometric family svek/layout branches on. Upstream:
 *  svek/ShapeType.java (12-value `enum`); only the 5 values this file's
 *  sibling can produce are ported (as-const object — no `const enum`). */
export const ShapeType = {
  RECTANGLE: 'RECTANGLE',
  RECTANGLE_WITH_CIRCLE_INSIDE: 'RECTANGLE_WITH_CIRCLE_INSIDE',
  FOLDER: 'FOLDER',
  HEXAGON: 'HEXAGON',
  OVAL: 'OVAL',
} as const;
export type ShapeType = (typeof ShapeType)[keyof typeof ShapeType];

/** The (x1,x2,y1,y2) "shield" padding `getShield` reports so a
 *  magnetic-border-avoiding link steers clear of a lollipop interface's
 *  out-of-band title/stereotype text. Upstream: svek/Margins.java,
 *  ported in full. */
export class Margins {
  static readonly NONE = new Margins(0, 0, 0, 0);

  constructor(
    private readonly x1: number,
    private readonly x2: number,
    private readonly y1: number,
    private readonly y2: number,
  ) {}

  static uniform(value: number): Margins { return new Margins(value, value, value, value); }
  toString(): string { return `MARGIN[${this.x1},${this.x2},${this.y1},${this.y2}]`; }
  merge(o: Margins): Margins {
    return new Margins(Math.max(this.x1, o.x1), Math.max(this.x2, o.x2), Math.max(this.y1, o.y1), Math.max(this.y2, o.y2));
  }
  isZero(): boolean { return this.x1 === 0 && this.x2 === 0 && this.y1 === 0 && this.y2 === 0; }
  getX1(): number { return this.x1; }
  getX2(): number { return this.x2; }
  getY1(): number { return this.y1; }
  getY2(): number { return this.y2; }
  getTotalWidth(): number { return this.x1 + this.x2; }
  getTotalHeight(): number { return this.y1 + this.y2; }
}

/** A `UShape` that also exposes `setDeltaShadow` — the surface
 *  `EntityImageDescription#drawHexagon` needs off `bibliotekon
 *  .getNode(entity).getPolygon()` (upstream: a `Shadowable` polygon). */
export interface HexagonPolygon extends UShape {
  setDeltaShadow(deltaShadow: number): void;
}

// ---------------------------------------------------------------------------
// Text construction seam — see EntityImageDescription.ts's doc comment
// ("Text-construction seam")
// ---------------------------------------------------------------------------

/** One measured text line: width/height/descent, read off the ACTIVE
 *  `StringBounder` (maintainer course-correction, 2026-07-10: no
 *  prop-drilled `measurer` parameter — the render-phase seam is
 *  `UGraphicSvg.build`'s own `measurer` param, which `getStringBounder()`
 *  already turns into real width/height/descent; see that method's doc
 *  comment). `getDescent` is optional on `StringBounder` (not every
 *  implementation carries it — e.g. hand-rolled test doubles); falling
 *  back to the same `size/4.5` approximation every measurer in this
 *  codebase already uses as its own descent formula
 *  (`FormulaMeasurer`/`WidthTableMeasurer`/`CanvasMeasurer`/
 *  `FixedMeasurer`, `measurer.ts`) keeps behavior sane for any caller not
 *  wired through the updated `UGraphicSvg`. */
function measureLine(
  stringBounder: StringBounder,
  line: string,
  font: FontConfiguration,
): { width: number; height: number; descent: number } {
  const dim = stringBounder.calculateDimension(font, line);
  const descent = stringBounder.getDescent?.(font, line) ?? font.size / 4.5;
  return { width: dim.getWidth(), height: dim.getHeight(), descent };
}

/** `HorizontalAlignment`-driven local x offset — same branch
 *  `DecorateEntityImage.ts`'s local `textX` implements (duplicated per
 *  that file's one-local-helper-per-call-site convention). */
function lineX(align: HorizontalAlignment, blockWidth: number, lineWidth: number): number {
  if (align === HorizontalAlignment.LEFT) return 0;
  if (align === HorizontalAlignment.RIGHT) return blockWidth - lineWidth;
  return (blockWidth - lineWidth) / 2;
}

interface LineMetrics {
  width: number;
  height: number;
  descent: number;
}

/**
 * I9b: a raw display line that is EXACTLY a bare Creole horizontal-line
 * separator marker -- upstream `CreoleStripeSimpleParser`'s
 * SECTION_HEADER_PATTERN (`^--([^-]*)--$`), SECTION_TITLE_PATTERN
 * (`^==([^=]*)==$`)/SECTION_SEPARATOR_PATTERN (`^===*==$`), and
 * DOUBLE_DOT_DELIMITED_LINE (`^\.\.([^.]*)\.\.$`) -- classified with an
 * EMPTY captured title only (a bare `----`/`====`/`....` line, no text
 * between the markers). Returns the upstream `StripeStyle` char
 * (`'-'`/`'='`/`'.'`) `CreoleHorizontalLine`/`UHorizontalLine#getStroke`
 * dispatch on, or `null` for any other line (plain text, unchanged).
 *
 * A marker line WITH text between the delimiters (`--Header--`,
 * `==Header==`, `..Header..`) is upstream's `StripeStyleType.HEADING`
 * instead -- a DIFFERENT, unported mechanism (`fontConfigurationForHeading`
 * re-fonts every subsequent line in the section) that this port leaves as
 * plain text rather than half-implementing (G1 I4c ruled-out list, "=="
 * heading markers). Only exact 4-char runs match `----`/`....` (upstream's
 * `[^-]*`/`[^.]*` capture groups exclude the delimiter character itself, so
 * a 5-dash run like `-----` falls through to plain NORMAL text, matching
 * upstream); `=` permits any run length >= 4 (`===*==` has no upper bound).
 */
function classifySeparatorLine(line: string): string | null {
  if (line === '----') return '-';
  if (line === '....') return '.';
  if (line.length >= 4 && /^=+$/.test(line)) return '=';
  return null;
}

/**
 * Empirically-calibrated separator-atom footprint (jar-verified against
 * component/butebe-90-dozo380's queue3 -- `queue "queue1\n----\ntoto"`,
 * cross-checked structurally, not numerically, against component/
 * babafi-51-dixi026's actor `a` -- `"a\n====\ncan use b"`). Upstream's real
 * stacking is `SheetBlock1`/`StripeSimple`'s Atom-altitude system
 * (`CreoleHorizontalLine#getStartingAltitude() === 0`, TeX-box-style
 * ascent/descent placement) -- a substantially larger, unported creole
 * layout subsystem (G1 I4c's deferred "full char-atom subsystem" family).
 * `buildTextBlock` here is a documented SCOPED SUBSTITUTE (naive top-down
 * height-summing, not the real Sheet algorithm), so reproducing the jar's
 * exact box height under this simpler model requires two DIFFERENT
 * numbers, reverse-derived from queue3's own box geometry (content height
 * 36 = line1 14 + SEP + line3 14 -> SEP contributes 8 to total block
 * height) and its separator `<line>`'s own drawn y (exactly at the
 * cursor position BEFORE the separator, no offset -- so only 4, half of
 * the 8 total, is consumed before the NEXT line's cursor starts; the
 * other half is trailing space after the last line, absorbed into the
 * block's overall height by `calculateDimension` alone). Width is not
 * independently verified (no sampled fixture has the bare separator as
 * the WIDEST line); kept equal to the draw-advance value as the
 * least-surprising default. */
const SEPARATOR_SIZE_HEIGHT = 8;
const SEPARATOR_DRAW_ADVANCE = SEPARATOR_SIZE_HEIGHT / 2;
const SEPARATOR_WIDTH_CONTRIBUTION = SEPARATOR_DRAW_ADVANCE;
const SEPARATOR_DEFAULT_THICKNESS = 1;

/**
 * Atom-aware line measurement (SI5b+E2r T7, D9): when `resolveAtomImage`
 * is supplied AND `line` actually embeds a Creole `<img>`/`<$sprite>`
 * atom, width = the markup-stripped text width PLUS each resolved atom's
 * own width (sum — x-advance); height = the greater of the stripped
 * text's height and any resolved atom's height (max, mirroring
 * `StripeSimple`'s `getStartingAltitude()===0` top-alignment for both atom
 * kinds). An unresolved atom (`resolveAtomImage` returns `undefined` —
 * e.g. an unknown sprite name) contributes nothing, matching
 * `StripeSimple.addSprite`'s "never added" behavior. Every atom-free line
 * — including every call site that passes no resolver at all — takes the
 * EXACT prior `measureLine` path, so pre-T7 output is byte-identical.
 */
function measureLineAtomAware(
  stringBounder: StringBounder,
  line: string,
  font: FontConfiguration,
  resolveAtomImage: AtomImageResolver | undefined,
): LineMetrics {
  if (resolveAtomImage === undefined) return measureLine(stringBounder, line, font);
  const scan = scanLineForAtoms(line);
  if (scan.atoms.length === 0) return measureLine(stringBounder, line, font);
  const textM = measureLine(stringBounder, scan.textWithoutAtoms, font);
  let width = textM.width;
  let height = textM.height;
  for (const atom of scan.atoms) {
    const resolved = resolveAtomImage(atom);
    if (resolved === undefined) continue;
    width += resolved.width;
    if (resolved.height > height) height = resolved.height;
  }
  return { width, height, descent: textM.descent };
}

/**
 * Draws one line, atom-aware (SI5b+E2r T7): an atom-free line (or every
 * call with no resolver) draws through the EXACT prior single-`UText`
 * path. An atom-bearing line instead walks `scanLineForAtoms(line)
 * .segments` in source order, drawing each text run as its own `UText`
 * and each resolved atom as a `UImage` (`DriverImageSvg` -> SVG
 * `<image>`), advancing `x` by each segment's own width — the SAME
 * x-advance math `measureLineAtomAware` (above) already summed, so
 * drawing and measuring agree by construction. Atoms sit at the line's
 * TOP (`y`, no baseline offset), matching `AtomImg`/`AtomSprite
 * .getStartingAltitude() === 0`; text keeps its normal baseline
 * (`y + baselineDy`) even when a taller atom on the same line grows
 * `m.height` beyond the text's own height.
 */
function drawLineAtomAware(
  ug: UGraphic,
  stringBounder: StringBounder,
  line: string,
  font: FontConfiguration,
  x0: number,
  y: number,
  m: LineMetrics,
  resolveAtomImage: AtomImageResolver | undefined,
): void {
  const baselineDy = m.height - m.descent;
  const scan = resolveAtomImage === undefined ? undefined : scanLineForAtoms(line);
  if (scan === undefined || scan.atoms.length === 0) {
    ug.apply(new UTranslate(x0, y + baselineDy)).draw(UText.build(line, font));
    return;
  }
  let x = x0;
  for (const seg of scan.segments) {
    if (seg.kind === 'text') {
      const segM = measureLine(stringBounder, seg.text, font);
      ug.apply(new UTranslate(x, y + baselineDy)).draw(UText.build(seg.text, font));
      x += segM.width;
      continue;
    }
    const resolved = resolveAtomImage!(seg.atom);
    if (resolved === undefined) continue;
    ug.apply(new UTranslate(x, y)).draw(UImage.build(resolved.width, resolved.height, resolved.href));
    x += resolved.width;
  }
}

/**
 * buildTextBlock — scoped substitute for `BodyFactory.create2`/`create3`
 * (see EntityImageDescription.ts's doc comment). A literal, `\n`-split,
 * non-creole multi-line `TextBlock`. Each line is measured/drawn through
 * whichever `StringBounder` its CALLER supplies (`calculateDimension`'s own
 * param, `ug.getStringBounder()` inside `drawU`) — no measurer captured in
 * this closure, no eager measurement: both `calculateDimension` and
 * `drawU` are only ever invoked later, by a caller that already holds a
 * real `stringBounder`/`ug` (`EntityImageDescription`'s own
 * `calculateDimensionSlow`/`getShield`/`getOverscanX`/`drawU` — see that
 * class's doc comment), so this is genuinely lazy, not "pre-draw".
 *
 * `resolveAtomImage` (SI5b+E2r T7 write-set expansion, journaled —
 * additive-only optional 4th param; every existing call site that omits it
 * keeps byte-identical behavior, see `measureLineAtomAware`/
 * `drawLineAtomAware` above): resolves a line's Creole `<img>`/`<$sprite>`
 * atoms to drawable image geometry, per `src/diagrams/description/
 * render-atoms.ts`'s builder.
 */
function measureBuildTextLine(
  stringBounder: StringBounder,
  line: string,
  font: FontConfiguration,
  resolveAtomImage: AtomImageResolver | undefined,
): LineMetrics {
  if (classifySeparatorLine(line) !== null) {
    return { width: SEPARATOR_WIDTH_CONTRIBUTION, height: SEPARATOR_SIZE_HEIGHT, descent: 0 };
  }
  return measureLineAtomAware(stringBounder, line, font, resolveAtomImage);
}

/** Draws the separator's `UHorizontalLine` shape AT the running cursor `y`
 *  (see `SEPARATOR_SIZE_HEIGHT`'s doc comment for why this differs from a
 *  literal `CreoleHorizontalLine#drawU` port). */
function drawSeparatorLine(ug: UGraphic, y: number, style: string): void {
  ug.apply(new UTranslate(0, y)).draw(UHorizontalLine.infinite(SEPARATOR_DEFAULT_THICKNESS, 0, 0, style));
}

/** Cursor advance to the NEXT line: `SEPARATOR_DRAW_ADVANCE` for a
 *  separator (half its own `SEPARATOR_SIZE_HEIGHT` -- see that constant's
 *  doc comment), else the line's own measured height. */
function lineCursorAdvance(line: string, m: LineMetrics): number {
  return classifySeparatorLine(line) !== null ? SEPARATOR_DRAW_ADVANCE : m.height;
}

export function buildTextBlock(
  text: string,
  font: FontConfiguration,
  align: HorizontalAlignment,
  resolveAtomImage?: AtomImageResolver,
): TextBlock {
  const lines = text.length === 0 ? [] : text.split('\n');

  function calculateDimension(stringBounder: StringBounder): XDimension2D {
    let width = 0;
    let height = 0;
    for (const line of lines) {
      const m = measureBuildTextLine(stringBounder, line, font, resolveAtomImage);
      if (m.width > width) width = m.width;
      height += m.height;
    }
    return new XDimension2D(width, height);
  }

  return {
    calculateDimension,
    drawU(ug: UGraphic): void {
      const stringBounder = ug.getStringBounder();
      const dim = calculateDimension(stringBounder);
      let y = 0;
      for (const line of lines) {
        const separatorStyle = classifySeparatorLine(line);
        const m = measureBuildTextLine(stringBounder, line, font, resolveAtomImage);
        if (separatorStyle !== null) {
          drawSeparatorLine(ug, y, separatorStyle);
        } else {
          const x = lineX(align, dim.getWidth(), m.width);
          drawLineAtomAware(ug, stringBounder, line, font, x, y, m, resolveAtomImage);
        }
        y += lineCursorAdvance(line, m);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Symbol resolution — see EntityImageDescription.ts's doc comment
// ("Symbol-resolution seam")
// ---------------------------------------------------------------------------

/**
 * Keyword string to `USymbol`, collapsing `CommandCreateElementFull
 * .java`'s keyword dispatch with `Entity#getUSymbol()`'s leafType
 * fallback. `null` return means "no explicit symbol" (upstream:
 * `entity.getUSymbol() == null`) — caller falls back to
 * {@link componentStyleToUSymbol}. `portin`/`portout`/`port` also
 * resolve to `null`: upstream never resolves a `USymbol` for ports
 * (`EntityImagePort` draws them — out of scope).
 */
export function resolveDescriptionUSymbol(
  keyword: string | null,
  actorStyle: ActorStyle,
  componentStyle: ComponentStyle,
): USymbol | null {
  if (keyword === null) return null;
  const lower = keyword.toLowerCase();
  if (lower === 'usecase') return USymbols.USECASE;
  if (lower === 'usecase/') return USymbols.USECASE_BUSINESS;
  if (lower === 'circle') return USymbols.INTERFACE;
  if (lower === 'portin' || lower === 'portout' || lower === 'port') return null;
  return USymbols.fromString(keyword, { actorStyle: () => actorStyle, componentStyle: () => componentStyle });
}

/** Upstream: `EntityImageDescription#getUSymbol(Entity)`. */
export function resolveUSymbol(symbolInfo: EntityImageDescriptionSymbol): USymbol {
  const explicit = resolveDescriptionUSymbol(symbolInfo.keyword, symbolInfo.actorStyle, symbolInfo.componentStyle);
  return explicit ?? componentStyleToUSymbol(symbolInfo.componentStyle);
}

/** Upstream: the `shapeType` if/else-if chain inside the constructor. */
export function resolveShapeType(symbol: USymbol, fixCircleLabelOverlapping: boolean): ShapeType {
  if (symbol === USymbols.FOLDER || symbol === USymbols.PACKAGE) return ShapeType.FOLDER;
  if (symbol === USymbols.HEXAGON) return ShapeType.HEXAGON;
  if (symbol === USymbols.USECASE || symbol === USymbols.USECASE_BUSINESS) return ShapeType.OVAL;
  if (symbol === USymbols.INTERFACE) {
    return fixCircleLabelOverlapping ? ShapeType.RECTANGLE_WITH_CIRCLE_INSIDE : ShapeType.RECTANGLE;
  }
  return ShapeType.RECTANGLE;
}

// ---------------------------------------------------------------------------
// Instance-method delegates
// ---------------------------------------------------------------------------

/** Upstream: the `desc` local-variable if/else-if/else chain. */
export function buildDesc(
  symbol: USymbol,
  labels: EntityImageDescriptionLabels,
  paint: EntityImageDescriptionPaint,
  atomImageResolverFor?: (font: FontConfiguration) => AtomImageResolver,
): TextBlock {
  const isPackageLeaf = symbol.getSNames()[0] === 'package_';
  const displayEqualsCode = labels.displayText === labels.codeName;
  const isWhite = labels.displayText.trim().length === 0;
  if ((displayEqualsCode && isPackageLeaf) || isWhite) {
    return TextBlockUtils.empty(paint.minimumWidth ?? 0, 0);
  }
  const font = displayEqualsCode ? paint.fontTitle : (paint.fontBody ?? paint.fontTitle);
  return buildTextBlock(labels.displayText, font, paint.titleAlignment, atomImageResolverFor?.(font));
}

/** Upstream: the `stereo` local-variable if/else-if/else chain, minus
 *  the sprite branch (EntityImageDescription.ts's doc comment). */
export function buildStereo(
  stereotypeLabels: readonly string[],
  fontStereo: FontConfiguration,
  resolveAtomImage?: AtomImageResolver,
): TextBlock {
  if (stereotypeLabels.length === 0) return TextBlockUtils.empty(0, 0);
  const text = stereotypeLabels.map((label) => `«${label}»`).join('\n');
  const block = buildTextBlock(text, fontStereo, HorizontalAlignment.CENTER, resolveAtomImage);
  return TextBlockUtils.withMargin(block, 1, 1, 0, 0);
}

/** Upstream: `EntityImageDescription#hasSomeHorizontalLinkVisible`. */
export function hasSomeHorizontalLinkVisible(links: readonly EntityImageDescriptionLinkInfo[]): boolean {
  return links.some((link) => link.length === 1 && !link.isInvis);
}

/** Upstream: `EntityImageDescription#isThereADoubleLink`. */
export function isThereADoubleLink(links: readonly EntityImageDescriptionLinkInfo[]): boolean {
  const seen = new Set<string>();
  for (const link of links) {
    if (seen.has(link.otherEntityId)) return true;
    seen.add(link.otherEntityId);
  }
  return false;
}

/** Upstream: `EntityImageDescription#hasSomeHorizontalLinkDoubleDecorated`. */
export function hasSomeHorizontalLinkDoubleDecorated(links: readonly EntityImageDescriptionLinkInfo[]): boolean {
  return links.some((link) => link.length === 1 && link.isDoubleDecorated);
}

/** Upstream: the dimension math inside `getShield` (after the four
 *  early-return guards). */
export function computeShieldMargins(stereo: TextBlock, desc: TextBlock, asSmall: TextBlock, stringBounder: StringBounder): Margins {
  const dimStereo = stereo.calculateDimension(stringBounder);
  const dimDesc = desc.calculateDimension(stringBounder);
  const dimSmall = asSmall.calculateDimension(stringBounder);
  const x = Math.max(dimStereo.getWidth(), dimDesc.getWidth());
  const dimSmallWidth = dimSmall.getWidth();
  let suppX = x - dimSmallWidth;
  if (suppX < 1) suppX = 1;
  const y = Math.max(1, dimDesc.getHeight(), dimStereo.getHeight());
  return new Margins(suppX / 2, suppX / 2, y, y);
}

/** Shared `posx1`/`posx2` (+ the three dimensions they derive from) —
 *  upstream duplicates this exact computation once in `drawU`'s
 *  `hideText` block and once in `getOverscanX`; both still read
 *  upstream's own `(dimSmall.getWidth() - dimX.getWidth()) / 2` formula
 *  unchanged. */
export function hideTextOffsets(
  asSmall: TextBlock,
  desc: TextBlock,
  stereo: TextBlock,
  stringBounder: StringBounder,
): { posx1: number; posx2: number; dimSmall: XDimension2D; dimDesc: XDimension2D; dimStereo: XDimension2D } {
  const dimSmall = asSmall.calculateDimension(stringBounder);
  const dimDesc = desc.calculateDimension(stringBounder);
  const dimStereo = stereo.calculateDimension(stringBounder);
  const dimSmallWidth = dimSmall.getWidth();
  const posx1 = (dimSmallWidth - dimDesc.getWidth()) / 2;
  const posx2 = (dimSmallWidth - dimStereo.getWidth()) / 2;
  return { posx1, posx2, dimSmall, dimDesc, dimStereo };
}

/** Narrows `ug` to `UGraphicWithGroups` — duplicated locally per
 *  `DecorateEntityImage.ts`'s/`Cluster.ts`'s own one-local-helper-
 *  per-call-site convention (that module's own `requireGroups` is not
 *  exported). */
export function requireGroups(ug: UGraphic): UGraphicWithGroups {
  const candidate = ug as Partial<UGraphicWithGroups>;
  if (typeof candidate.startGroup !== 'function' || typeof candidate.closeGroup !== 'function') {
    throw new Error('EntityImageDescription: ug does not support startGroup/closeGroup (see UGraphicSvg)');
  }
  return ug as UGraphicWithGroups;
}

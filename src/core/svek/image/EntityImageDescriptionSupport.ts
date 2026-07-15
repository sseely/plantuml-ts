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
 * .create2`/`create3`, see the sibling file's doc comment), and the
 * symbol-resolution seam (`resolveDescriptionUSymbol`/`resolveUSymbol`/
 * `resolveShapeType`). Every private instance-method body
 * `EntityImageDescription` delegates to (`buildDesc`, `buildStereo`, the
 * three link-scanning helpers, `computeShieldMargins`, `hideTextOffsets`,
 * `requireGroups`) moved to the sibling `EntityImageDescriptionDelegates.ts`
 * (E2r/L1, mechanical split — see that file's doc comment) once this file
 * grew past the 500-line ceiling to accommodate the ported creole
 * stripe/atom pipeline.
 *
 * E2r/L1 (mission `plans/e2r-creole/`): `buildTextBlock`'s per-line
 * measure/draw now goes through `klimt/creole`'s ported stripe/atom
 * pipeline (`classifyStripeLine` + `buildStripeAtoms`) instead of the old
 * single-`UText`-per-line path — one `<text>` element per STYLED RUN,
 * matching the jar's own SVG element structure, plus per-line `==` heading
 * font cascade (I4c mechanism 2/5). `classifySeparatorLine` (G1 I9b) is
 * SUBSUMED by `classifyStripeLine` (see that module's doc comment for the
 * exact behavior-preservation argument, including why a non-empty
 * `--Header--`-shaped line still falls through to plain NORMAL text).
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
import type { AtomImageResolver } from '../../creole-atoms.js';
import type { CreoleAtom } from '../../klimt/creole/atom/Atom.js';
import { classifyStripeLine, type StripeClassification } from '../../klimt/creole/legacy/CreoleStripeSimpleParser.js';
import { buildStripeAtoms, buildLiteralAtoms, fontConfigurationForHeading } from '../../klimt/creole/legacy/StripeSimple.js';
import type { USymbol } from '../../decoration/symbol/USymbol.js';
import { USymbols, componentStyleToUSymbol } from '../../decoration/symbol/USymbols.js';
import type { ComponentStyle } from '../../decoration/symbol/USymbols.js';
import type { ActorStyle } from '../../skin/ActorStyle.js';
import type { EntityImageDescriptionSymbol } from './EntityImageDescription.js';

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

/** A line's baseline descent, independent of its text content (every
 *  measurer in this codebase computes descent from `font.size` alone — see
 *  `measureLine`'s doc comment) — used for the STRIPE-level (not per-atom)
 *  baseline offset every styled run on the same physical line shares. */
function lineDescent(stringBounder: StringBounder, font: FontConfiguration): number {
  return stringBounder.getDescent?.(font, '') ?? font.size / 4.5;
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
 * Empirically-calibrated separator-atom footprint (jar-verified against
 * component/butebe-90-dozo380's queue3 -- `queue "queue1\n----\ntoto"`,
 * cross-checked structurally, not numerically, against component/
 * babafi-51-dixi026's actor `a` -- `"a\n====\ncan use b"`). Upstream's real
 * stacking is `SheetBlock1`/`StripeSimple`'s Atom-altitude system
 * (`CreoleHorizontalLine#getStartingAltitude() === 0`, TeX-box-style
 * ascent/descent placement) -- a substantially larger, unported creole
 * layout subsystem (G1 I4c's deferred "full char-atom subsystem" family,
 * now partially landed as of E2r/L1 — see `klimt/creole/`). `buildTextBlock`
 * here is a documented SCOPED SUBSTITUTE (naive top-down height-summing,
 * not the real Sheet algorithm), so reproducing the jar's exact box height
 * under this simpler model requires two DIFFERENT numbers, reverse-derived
 * from queue3's own box geometry (content height 36 = line1 14 + SEP +
 * line3 14 -> SEP contributes 8 to total block height) and its separator
 * `<line>`'s own drawn y (exactly at the cursor position BEFORE the
 * separator, no offset -- so only 4, half of the 8 total, is consumed
 * before the NEXT line's cursor starts; the other half is trailing space
 * after the last line, absorbed into the block's overall height by
 * `calculateDimension` alone). Width is not independently verified (no
 * sampled fixture has the bare separator as the WIDEST line); kept equal
 * to the draw-advance value as the least-surprising default. */
const SEPARATOR_SIZE_HEIGHT = 8;
const SEPARATOR_DRAW_ADVANCE = SEPARATOR_SIZE_HEIGHT / 2;
const SEPARATOR_WIDTH_CONTRIBUTION = SEPARATOR_DRAW_ADVANCE;
const SEPARATOR_DEFAULT_THICKNESS = 1;

/** One display line's classification plus its built atom sequence (E2r/L1)
 *  — `atoms` is empty for a `HORIZONTAL_LINE` line (nothing to measure/draw
 *  as text; `drawSeparatorLine` handles it directly), `lineFont` is the
 *  BASE font for `NORMAL`, or the heading-cascaded font
 *  (`fontConfigurationForHeading`) for `HEADING` — the font every atom on
 *  this line's OWN style flags/color start from before any nested
 *  `<b>`/`**`/etc. run adds more. */
interface LineBuild {
  readonly classification: StripeClassification;
  readonly atoms: readonly CreoleAtom[];
  readonly lineFont: FontConfiguration;
}

function buildLine(line: string, font: FontConfiguration): LineBuild {
  const classification = classifyStripeLine(line);
  if (classification.type === 'HORIZONTAL_LINE') return { classification, atoms: [], lineFont: font };
  if (classification.type === 'LITERAL') {
    return { classification, atoms: buildLiteralAtoms(classification.content, font), lineFont: font };
  }
  const lineFont = classification.type === 'HEADING' ? fontConfigurationForHeading(font, classification.order) : font;
  return { classification, atoms: buildStripeAtoms(classification.content, lineFont), lineFont };
}

/** Sums each atom's own width (text run measured under ITS own
 *  `FontConfiguration`; a resolved `<img>`/`<$sprite>` atom under its
 *  resolved dims) and takes the MAX height across atoms — the same
 *  width-ADD/height-MAX composition `creole-atoms.ts#measureLineWithAtoms`
 *  already established for the img/sprite-only case (D9), now generalized
 *  to every styled text run too. An unresolved inline atom (`resolveAtomImage`
 *  returns `undefined`, or no resolver supplied at all) contributes
 *  nothing, matching `StripeSimple.addSprite`'s "never added" behavior. */
function measureAtomsWidthHeight(
  stringBounder: StringBounder,
  atoms: readonly CreoleAtom[],
  resolveAtomImage: AtomImageResolver | undefined,
): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const atom of atoms) {
    if (atom.kind === 'text') {
      const m = measureLine(stringBounder, atom.text, atom.font);
      width += m.width;
      if (m.height > height) height = m.height;
      continue;
    }
    const resolved = resolveAtomImage?.(atom.atom);
    if (resolved === undefined) continue;
    width += resolved.width;
    if (resolved.height > height) height = resolved.height;
  }
  return { width, height };
}

function measureBuildTextLine(
  stringBounder: StringBounder,
  line: string,
  font: FontConfiguration,
  resolveAtomImage: AtomImageResolver | undefined,
): LineMetrics {
  const built = buildLine(line, font);
  if (built.classification.type === 'HORIZONTAL_LINE') {
    return { width: SEPARATOR_WIDTH_CONTRIBUTION, height: SEPARATOR_SIZE_HEIGHT, descent: 0 };
  }
  const { width, height } = measureAtomsWidthHeight(stringBounder, built.atoms, resolveAtomImage);
  return { width, height, descent: lineDescent(stringBounder, built.lineFont) };
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
function lineCursorAdvance(isHorizontalLine: boolean, m: LineMetrics): number {
  return isHorizontalLine ? SEPARATOR_DRAW_ADVANCE : m.height;
}

/**
 * Draws one line's already-built atom sequence (E2r/L1): each atom draws as
 * its OWN `UText` (a text run) or `UImage` (a resolved inline atom), left
 * to right, x-advancing by each segment's own measured width — the SAME
 * math `measureAtomsWidthHeight` (above) already summed, so drawing and
 * measuring agree by construction. Atoms sit at the line's TOP (`origin.y`,
 * no baseline offset), matching `AtomImg`/`AtomSprite
 * .getStartingAltitude() === 0`; text keeps its normal baseline
 * (`origin.y + baselineDy`) even when a taller atom on the same line grows
 * `m.height` beyond any one text run's own height. This produces ONE
 * `<text>` SVG element per styled run — the jar's own element structure —
 * rather than the pre-E2r single-`UText`-per-line path.
 *
 * `origin` bundles x/y into a single param to stay under this project's
 * 5-param complexity-hook ceiling; `stringBounder` comes off
 * `ug.getStringBounder()` directly rather than a separate param — every
 * caller already has `ug`.
 */
function drawAtoms(
  ug: UGraphic,
  atoms: readonly CreoleAtom[],
  origin: { readonly x: number; readonly y: number },
  m: LineMetrics,
  resolveAtomImage: AtomImageResolver | undefined,
): void {
  const stringBounder = ug.getStringBounder();
  const baselineDy = m.height - m.descent;
  let x = origin.x;
  for (const atom of atoms) {
    if (atom.kind === 'text') {
      const segM = measureLine(stringBounder, atom.text, atom.font);
      ug.apply(new UTranslate(x, origin.y + baselineDy)).draw(UText.build(atom.text, atom.font));
      x += segM.width;
      continue;
    }
    const resolved = resolveAtomImage?.(atom.atom);
    if (resolved === undefined) continue;
    ug.apply(new UTranslate(x, origin.y)).draw(UImage.build(resolved.width, resolved.height, resolved.href));
    x += resolved.width;
  }
}

/**
 * buildTextBlock — scoped substitute for `BodyFactory.create2`/`create3`
 * (see EntityImageDescription.ts's doc comment). A `\n`-split, multi-line
 * `TextBlock` whose per-line content runs through E2r/L1's ported creole
 * stripe/atom pipeline (`klimt/creole`) — nested `<b>`/`**`/`<i>`/`//`/
 * `<u>`/`__`/`<s>`/`--`/`<w>`/`~~` inline style runs, and per-line `==`
 * heading font cascade — plus SI5b+E2r T6/T7's `<img>`/`<$sprite>` atoms.
 * Each line is measured/drawn through whichever `StringBounder` its CALLER
 * supplies (`calculateDimension`'s own param, `ug.getStringBounder()`
 * inside `drawU`) — no measurer captured in this closure, no eager
 * measurement: both `calculateDimension` and `drawU` are only ever invoked
 * later, by a caller that already holds a real `stringBounder`/`ug`
 * (`EntityImageDescription`'s own `calculateDimensionSlow`/`getShield`/
 * `getOverscanX`/`drawU` — see that class's doc comment), so this is
 * genuinely lazy, not "pre-draw".
 *
 * `resolveAtomImage` (SI5b+E2r T7 write-set expansion, journaled —
 * additive-only optional 4th param; every existing call site that omits it
 * keeps byte-identical behavior for atom-free lines — see
 * `measureAtomsWidthHeight`/`drawAtoms` above): resolves a line's Creole
 * `<img>`/`<$sprite>` atoms to drawable image geometry, per `src/diagrams/
 * description/render-atoms.ts`'s builder.
 *
 * NOT in E2r/L1 scope (mission brief NOT-in-scope list — journaled,
 * `plans/e2r-creole/decision-journal.md`): `<size:>`/`<back:>`/`<color:>`/
 * `<font>`/`<u:color>`/`<U+NNNN>`/`<code>`/`[[url]]` atom-splitting/
 * `<latex>`, word-wrap, multi-line note bodies. The command-chain
 * architecture (`klimt/creole/command/`) is built to accept more `Command`
 * registrations for these without changing `StripeSimple`'s dispatch loop
 * — see `legacy/CommandCreoleBuilder.ts`'s doc comment.
 */
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
        const built = buildLine(line, font);
        const m = measureBuildTextLine(stringBounder, line, font, resolveAtomImage);
        if (built.classification.type === 'HORIZONTAL_LINE') {
          drawSeparatorLine(ug, y, built.classification.style);
        } else {
          const x = lineX(align, dim.getWidth(), m.width);
          drawAtoms(ug, built.atoms, { x, y }, m, resolveAtomImage);
        }
        y += lineCursorAdvance(built.classification.type === 'HORIZONTAL_LINE', m);
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

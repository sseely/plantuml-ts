/**
 * class-namespace-shape.ts — G2 N17: the package/namespace folder-tab
 * outline (`USymbolFolder`'s tab-notch shape, `core/decoration/symbol/
 * USymbolFolder.ts#folderPath`/`getWTitle`/`getHTitle`) wired into class's
 * plain-SVG-string render path.
 *
 * REUSE, not re-port: `USymbolFolder.ts`'s shape geometry (arc formula,
 * `marginTitleX1/X2/X3`/`Y1/Y2` constants) is already ported and
 * jar-verified for description's `Cluster`/`ClusterDecoration` (`asBig`,
 * the SAME group/cluster draw path upstream's own `Cluster#drawU` uses for
 * `package X { ... }`). Class's renderer draws every element as a plain SVG
 * string (`core/svg.ts` primitives), never through a `UGraphic` — mirroring
 * `note-opale.ts`'s established precedent, this module re-expresses the
 * SAME verified geometry as pure functions over plain numbers instead of
 * adopting the klimt `UGraphic`/`TextBlock` machinery wholesale (see
 * `renderer-group.ts`'s own doc comment for the identical rationale).
 *
 * Upstream: `decoration/symbol/USymbolFolder.java#asBig`/`drawFolder`
 * (dispatched via `svek/ClusterDecoration.java#getTextBlock` ->
 * `USymbolFolder#asBig`, the group/cluster draw path — NOT `asSmall`,
 * which is the unrelated `folder X`/`package X` LEAF-entity notation).
 *
 * Scope (G2 N17, jar-verified against `finono-05-cuvu171`, `jinibe-02-
 * tebi269`, `pecabi-95-demu756`, `pixexi-81-sete111`): the DEFAULT
 * rounded-corner tab (`roundCorner=5`, `USymbolFolder#asBig`'s `UPath`
 * branch) only. Two upstream variants are deliberately NOT modeled this
 * iteration (named remainders, `plans/g2-class-svg/ledger.md` N17):
 *   - `skinparam style strictuml` (`roundCorner=0`, the sharp-corner
 *     `UPolygon` branch, jar-verified present via `jinibe-02-tebi269`'s own
 *     `<polygon>` output) — class has no `strictUmlStyle`/`packageStyle`
 *     skinparam threading at all yet (same gap `renderer-cluster.ts`'s own
 *     `isFolderStyled`/`buildStyleDefaults` cover for description, not
 *     ported to class).
 *   - `skinparam packageStyle rect|frame|node|...` (a DIFFERENT `USymbol`
 *     entirely, e.g. a plain unnotched rounded rect — jar-verified via
 *     `mucuxi-36-beku683`) — same unmodeled skinparam gap.
 */
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import type { Theme } from '../../core/theme.js';
import type { NamespaceGeo } from './layout.js';
import { path, line, text } from '../../core/svg.js';
import { javaRound4 } from '../../core/number-format.js';

// marginTitleX1/X2/X3/Y1/Y2 — upstream's own field names
// (USymbolFolder.java), kept verbatim per this project's porting
// discipline (mirrors `USymbolFolder.ts`'s identical constants).
const MARGIN_TITLE_X1 = 3;
const MARGIN_TITLE_X2 = 3;
const MARGIN_TITLE_X3 = 7;
const MARGIN_TITLE_Y1 = 3;
const MARGIN_TITLE_Y2 = 3;

/** `USymbolFolder#asBig`'s unstyled default `roundCorner` — jar-verified
 *  identical to every OTHER container's default (`A2.5,2.5`/`A3.75,3.75`
 *  arcs, `half = roundCorner/2`), matching description's own G1 I10
 *  finding (`renderer-cluster.ts#NON_FOLDER_ROUND_CORNER`). `skinparam
 *  style strictuml` (roundCorner=0) is NOT modeled — see module doc
 *  comment. */
export const PACKAGE_ROUND_CORNER = 5;

/** Jar-observed default class-diagram package/namespace border width
 *  (`stroke-width:1.5`, e.g. `finono-05-cuvu171`, `jinibe-02-tebi269`) —
 *  matches description's own `CLUSTER_STROKE_WIDTH` for folder-styled
 *  containers (`renderer-cluster.ts`). */
export const PACKAGE_STROKE_WIDTH = 1.5;

/** `USymbolFolder.java`'s title-text font is always bold; `skinparam
 *  packageFontSize N` / `skinparam package { FontSize N }` overrides the
 *  diagram-wide `theme.fontSize` for the folder-tab title ONLY (G2 N18,
 *  jar-verified against `pixexi-81-sete111`: title font-size 40, the
 *  classifier's OWN member text stays the diagram default 14). Reads the
 *  SAME generic per-element bucket description's package/folder USymbol
 *  rendering already consumes (`colors.elements.package.fontSize`, G1
 *  I4b) rather than a class-local field -- both diagram types' package
 *  groups share upstream's one `Entity`/`FontParam.PACKAGE` mechanism
 *  (`abel/Entity.java`). */
function titleFont(theme: Theme): FontSpec {
  const size = theme.colors.elements?.package?.fontSize ?? theme.fontSize;
  return { family: theme.fontFamily, size, weight: 'bold' };
}

/** The folder-tab title's own text color -- `skinparam packageFontColor`/
 *  `skinparam package { FontColor ... }`, the SAME generic per-element
 *  bucket `titleFont` reads from (`renderer-symbol.ts#textFontColor`'s
 *  identical `typeof override !== 'string'` Gradient-guard precedent: the
 *  plain-SVG-string `text()` primitive has no gradient-fill path here
 *  either). Falls back to jar's true default `#000000`. */
function titleFontColor(theme: Theme): string {
  const override = theme.colors.elements?.package?.font;
  return typeof override === 'string' ? override : '#000000';
}

/**
 * `USymbolFolder#getHTitle`: the tab's own height — jar-verified via TWO
 * independent font sizes (`finono-05-cuvu171`/`jinibe-02-tebi269` at the
 * diagram default 14pt: htitle=20; `pixexi-81-sete111`'s `skinparam
 * package { FontSize 40 }`: htitle=46) — both reduce EXACTLY to
 * `measuredHeight + marginTitleY1 + marginTitleY2`, confirming the formula
 * (not a flat constant) even though `StringMeasurer.measure().height`
 * always returns the raw font size regardless of text content.
 */
export function getHTitle(measurer: StringMeasurer, theme: Theme, label: string): number {
  const dim = measurer.measure(label, titleFont(theme));
  if (dim.width === 0) return 10;
  return dim.height + MARGIN_TITLE_Y1 + MARGIN_TITLE_Y2;
}

/**
 * `USymbolFolder#getWTitle`: the tab's own width (title text width plus
 * X1/X2 margin), falling back to `max(30, width/4)` for an empty label —
 * jar-verified `titleWidth+6` exactly against `finono-05-cuvu171` ("foo",
 * textLength 19.425 -> wtitle 25.425) and `jinibe-02-tebi269` ("a",
 * textLength 7.7875 -> wtitle 13.7875).
 */
export function getWTitle(measurer: StringMeasurer, theme: Theme, label: string, width: number): number {
  const dim = measurer.measure(label, titleFont(theme));
  if (dim.width === 0) return Math.max(30, width / 4);
  return dim.width + MARGIN_TITLE_X1 + MARGIN_TITLE_X2;
}

/**
 * The title text's baseline Y offset from the namespace box's own top edge
 * -- `USymbolFolder#asBig` draws the title at local `(4, 2)`
 * (`title.drawU(ug.apply(new UTranslate(4, 2)))`); the SAME ascent-from-
 * line-top convention every other class text row uses
 * (`class-layout-helpers.ts`'s `baselineOffset`) resolves the glyph
 * baseline within that translated line. Computed at LAYOUT time (like
 * `getWTitle`/`getHTitle`) so the render phase never needs a
 * `StringMeasurer` of its own -- jar-verified against `finono-05-cuvu171`
 * (`y="18.8889"` = box-top 6 + 2 + 10.8889).
 */
export function getTitleBaselineOffset(measurer: StringMeasurer, theme: Theme, label: string): number {
  return 2 + theme.fontSize - measurer.getDescent(titleFont(theme), label);
}

/**
 * Extra vertical gap ABOVE the tab reserved between the folder-tab's own
 * `htitle` and the first classifier row inside the package — jar-verified
 * as a CONSTANT +13 independent of `htitle` itself: default 14pt font
 * (htitle=20) gives a 33px cluster-top-to-classifier-top gap
 * (`finono-05-cuvu171`/`jinibe-02-tebi269`/6 more corpus samples, `plans/
 * g2-class-svg/ledger.md` N17); `skinparam package { FontSize 40 }`
 * (htitle=46) gives 59px (`pixexi-81-sete111`) — both reduce to
 * `htitle + 13` exactly. Not traced to a single upstream Java constant
 * this iteration (would need the N5-style debug-jar rebuild to attribute
 * it to a specific `dotgen`/`Cluster.java` margin field) — kept as a
 * documented, dual-sample-verified empirical constant per this mission's
 * own precedent (e.g. `layout-ink-extent.ts`'s `DEGENERATE_NEAR_MARGIN`).
 * A THIRD sample (`pecabi-95-demu756`, `note top of <package>`) measures
 * 41px at htitle=20 -- NOT a third value of this constant: the note
 * attaches via an invisible DOT anchor node that is a REAL extra member of
 * the package's own dot cluster (`class-dot-graph.ts#buildDotClusters`'s
 * `anchorId` "extra direct member" comment), occupying vertical rank space
 * ABOVE the classifier -- the base gap stays 13, the extra 8px lives
 * entirely in the classifier's OWN already-shifted graphviz y-position,
 * not in this constant. Reproducing that case exactly needs the anchor's
 * own position threaded into `buildNamespaceGeos` (not attempted this
 * iteration -- `class-dot-graph.ts`'s `anchors` map isn't returned out of
 * `buildDotGraph` today; named remainder, `plans/g2-class-svg/ledger.md`
 * N17).
 */
export const NAMESPACE_TOP_EXTRA = 13;

/** Jar-observed uniform left/right/bottom padding around a package's
 *  content when the box's width is content-driven (the common case — a
 *  title narrower than `contentWidth + 2*NAMESPACE_SIDE_PADDING`), matches
 *  this port's PRE-EXISTING constant. When the title text is wide enough
 *  to dominate the box (`skinparam package { FontSize 40 }`,
 *  `pixexi-81-sete111`: 136px/137px sides), graphviz centers the sole
 *  member under the title-driven width instead — NOT reproduced by this
 *  constant; named remainder (title-driven package width floor), `plans/
 *  g2-class-svg/ledger.md` N17. */
export const NAMESPACE_SIDE_PADDING = 16;

/**
 * `USymbolFolder#drawFolder`'s `UPath` branch (`roundCorner !== 0`): the
 * SVG path `d` for the folder-tab outline, in ABSOLUTE coordinates (every
 * point offset by the namespace box's own `(ox, oy)` origin up front —
 * matches `USymbolFolder#asBig` drawing under
 * `ug.apply(this.geometry.position)` without a separate translate pass).
 * Byte-verified against `finono-05-cuvu171`'s path (origin `(6, 6)`) —
 * every `L`/`A` endpoint matches exactly.
 */
function folderPathD(
  ox: number,
  oy: number,
  wtitle: number,
  htitle: number,
  width: number,
  height: number,
  roundCorner: number,
): string {
  const half = roundCorner / 2;
  const tabRadius = half * 1.5;
  const pt = (x: number, y: number): string => `${javaRound4(ox + x)},${javaRound4(oy + y)}`;
  return (
    `M${pt(half, 0)}` +
    ` L${pt(wtitle - half, 0)}` +
    ` A${tabRadius},${tabRadius} 0 0 1 ${pt(wtitle, half)}` +
    ` L${pt(wtitle + MARGIN_TITLE_X3, htitle)}` +
    ` L${pt(width - half, htitle)}` +
    ` A${half},${half} 0 0 1 ${pt(width, htitle + half)}` +
    ` L${pt(width, height - half)}` +
    ` A${half},${half} 0 0 1 ${pt(width - half, height)}` +
    ` L${pt(half, height)}` +
    ` A${half},${half} 0 0 1 ${pt(0, height - half)}` +
    ` L${pt(0, half)}` +
    ` A${half},${half} 0 0 1 ${pt(half, 0)}`
  );
  // #lizard forgives -- flat sequence of 12 path-segment string pieces,
  // one per USymbolFolder#drawFolder's own moveTo/lineTo/arcTo call
  // (decoration/symbol/USymbolFolder.java) -- reducible only by splitting
  // one upstream shape literal across functions, which would obscure the
  // segment-by-segment jar citation in this module's own doc comment.
}

/**
 * `USymbolFolder#drawFolder`'s `UPolygon` branch (`roundCorner === 0`,
 * `skinparam style strictuml`) -- the SAME 7 corner points `folderPathD`
 * traces, but every `A` arc collapses to a single point at `roundCorner=0`
 * (`half=0`/`tabRadius=0`), so jar draws a plain sharp-cornered
 * `<polygon>` instead of a rounded-arc `<path>` -- byte-verified against
 * `jinibe-02-tebi269`'s own `points="16,6,29.7875,6,36.7875,26,64,26,64,95,
 * 16,95,16,6"` (7 unique points, closing back to the start).
 */
function folderPolygonPoints(
  ox: number,
  oy: number,
  wtitle: number,
  htitle: number,
  width: number,
  height: number,
): Array<[number, number]> {
  const pt = (x: number, y: number): [number, number] => [javaRound4(ox + x), javaRound4(oy + y)];
  return [
    pt(0, 0),
    pt(wtitle, 0),
    pt(wtitle + MARGIN_TITLE_X3, htitle),
    pt(width, htitle),
    pt(width, height),
    pt(0, height),
    pt(0, 0),
  ];
}

/** `USymbolFolder#drawFolder`'s `UPolygon` draw call under `strictuml`,
 *  matching `SvgGraphics`'s own `<polygon>` serialization for a klimt
 *  `UPolygon` (`svg-graphics-elements.ts:170-174`, comma-only point list,
 *  a `style="stroke:...;stroke-width:...;"` PLUS the fixed
 *  `stroke-linejoin:miter;stroke-miterlimit:10;` suffix every klimt
 *  polygon carries) -- class draws plain SVG strings (never through
 *  `UGraphic`, see this module's own header doc comment), so this mirrors
 *  `class-visibility-icon.ts#polygonTag`'s identical established
 *  hand-built-markup precedent rather than routing through `core/svg.ts
 *  #polygon()` (whose discrete `stroke`/`stroke-width` attributes, while
 *  semantically equivalent post-normalization, would still need
 *  `stroke-linejoin`/`stroke-miterlimit` support added for a single
 *  caller). */
function renderFolderPolygon(
  points: ReadonlyArray<[number, number]>,
  stroke: string,
  strokeWidth: number,
  fill: string,
): string {
  const pts = points.map(([x, y]) => `${x},${y}`).join(',');
  return (
    `<polygon points="${pts}" fill="${fill}" ` +
    `style="stroke:${stroke};stroke-width:${strokeWidth};stroke-linejoin:miter;stroke-miterlimit:10;"/>`
  );
}

/**
 * Renders one namespace/package's folder-tab outline + title, matching
 * `USymbolFolder#asBig`'s draw order: outline path, then the hline under
 * the tab (`ug.apply(UTranslate.dy(htitle)).draw(ULine.hline(...))`), then
 * the bold title text at local `(4, 2)` (baseline resolved the SAME
 * ascent-from-line-top way every other class text row is, `class-layout-
 * helpers.ts`'s `baselineOffset` convention) — jar-verified byte-exact
 * against `finono-05-cuvu171`'s `<path>`/`<line>`/`<text>` triple.
 */
export function renderNamespaceFolder(geo: NamespaceGeo, theme: Theme): string {
  // G2 N18: `packageBorderThickness`/`packageFontSize`/`packageFontColor`
  // override the folder-specific defaults (`theme.ts`'s own doc comments) --
  // `fontSize` here previously read the DIAGRAM-WIDE `theme.fontSize`
  // unconditionally, a latent bug moot until this iteration threaded a
  // package-specific override (must match `titleFont`'s own resolution, or
  // `getHTitle`/`getWTitle`'s pre-computed `htitle`/`wtitle` would silently
  // disagree with the glyphs actually drawn here).
  const strokeWidth = theme.colors.graph.packageBorderThickness ?? PACKAGE_STROKE_WIDTH;
  const fontSize = theme.colors.elements?.package?.fontSize ?? theme.fontSize;
  const fontColor = titleFontColor(theme);
  // G2 N18: `skinparam style strictuml` selects the sharp-corner `UPolygon`
  // branch (`roundCorner=0`) instead of the default rounded-arc `UPath` --
  // `folderPolygonPoints`/`renderFolderPolygon`'s own doc comments.
  const outline = theme.strictUml === true
    ? renderFolderPolygon(
        folderPolygonPoints(geo.x, geo.y, geo.wtitle, geo.htitle, geo.width, geo.height),
        theme.colors.graph.packageBorder,
        strokeWidth,
        theme.colors.graph.packageBackground,
      )
    : path(
        folderPathD(geo.x, geo.y, geo.wtitle, geo.htitle, geo.width, geo.height, PACKAGE_ROUND_CORNER),
        { stroke: theme.colors.graph.packageBorder, strokeWidth, fill: theme.colors.graph.packageBackground },
      );
  const hline = line(
    javaRound4(geo.x),
    javaRound4(geo.y + geo.htitle),
    javaRound4(geo.x + geo.wtitle + MARGIN_TITLE_X3),
    javaRound4(geo.y + geo.htitle),
    { stroke: theme.colors.graph.packageBorder, strokeWidth },
  );
  // G2 N18: jar's deterministic-text mode always emits `textLength`/
  // `lengthAdjust` on this title (matches every OTHER class text row,
  // `renderer-classifier-box.ts`'s identical convention) plus the RAW
  // numeric `font-weight="700"` (never the CSS keyword) -- pure arithmetic
  // from `wtitle` (no measurer needed at render time, matching this
  // module's "measure once, at layout time" architecture): `wtitle` is
  // ALWAYS `rawTextWidth + MARGIN_TITLE_X1 + MARGIN_TITLE_X2` for a
  // non-empty label (`getWTitle`'s own doc comment); the empty-label
  // fallback branch (`max(30, width/4)`) has no real text to stretch, so
  // textLength is omitted then, matching every other row's `row.width ===
  // undefined` skip convention.
  const titleTextLength = geo.label.length > 0 ? javaRound4(geo.wtitle - MARGIN_TITLE_X1 - MARGIN_TITLE_X2) : undefined;
  const label = text(javaRound4(geo.x + 4), javaRound4(geo.y + geo.baselineOffset), geo.label, {
    fontFamily: theme.fontFamily,
    fontSize,
    fontWeight: '700',
    fill: fontColor,
    ...(titleTextLength !== undefined ? { lengthAdjust: 'spacing' as const, textLength: titleTextLength } : {}),
  });
  return outline + hline + label;
}

/**
 * `EntityImageEmptyPackage#drawU`: draws the SAME `USymbolFolder#asBig`
 * folder-tab shape `renderNamespaceFolder` draws for a non-empty package's
 * cluster wrapper -- but resolved through a DIFFERENT style chain
 * (`EntityImageEmptyPackage#getStyleSignature`'s own `...package_,title`
 * selector, NOT the package/cluster border-color skinparam surface
 * `renderNamespaceFolder` itself reads) -- jar-verified this reduces to the
 * SAME defaults every OTHER classifier box uses (`theme.colors.border`,
 * stroke-width 0.5, `theme.colors.graph.classBackground`), NOT the
 * (thicker, `packageBorderColor`-overridable) real package-cluster
 * defaults (`cocube-46-tusu692`'s own `skinparam packageBorderColor blue`
 * does NOT recolor its empty-package leaf, confirming these are genuinely
 * separate style chains, not a shared cascade). `skinparam
 * packageBorderThickness`/`packageBorder*` overrides are NOT modeled here
 * (unconfirmed whether they apply at all -- no corpus sample carries both;
 * named remainder if a future sample contradicts this).
 */
export function renderEmptyPackageIcon(geo: NamespaceGeo, theme: Theme): string {
  const strokeWidth = 0.5;
  const border = theme.colors.border;
  const fill = theme.colors.graph.classBackground;
  const fontSize = theme.colors.elements?.package?.fontSize ?? theme.fontSize;
  const fontColor = titleFontColor(theme);
  const outline = theme.strictUml === true
    ? renderFolderPolygon(
        folderPolygonPoints(geo.x, geo.y, geo.wtitle, geo.htitle, geo.width, geo.height),
        border, strokeWidth, fill,
      )
    : path(
        folderPathD(geo.x, geo.y, geo.wtitle, geo.htitle, geo.width, geo.height, PACKAGE_ROUND_CORNER),
        { stroke: border, strokeWidth, fill },
      );
  const hline = line(
    javaRound4(geo.x), javaRound4(geo.y + geo.htitle),
    javaRound4(geo.x + geo.wtitle + MARGIN_TITLE_X3), javaRound4(geo.y + geo.htitle),
    { stroke: border, strokeWidth },
  );
  const titleTextLength = geo.label.length > 0 ? javaRound4(geo.wtitle - MARGIN_TITLE_X1 - MARGIN_TITLE_X2) : undefined;
  const label = text(javaRound4(geo.x + 4), javaRound4(geo.y + geo.baselineOffset), geo.label, {
    fontFamily: theme.fontFamily, fontSize, fontWeight: '700', fill: fontColor,
    ...(titleTextLength !== undefined ? { lengthAdjust: 'spacing' as const, textLength: titleTextLength } : {}),
  });
  return outline + hline + label;
}

/** `EntityImageEmptyPackage#calculateDimensionSlow`'s own MARGIN constant
 *  (distinct from `class-badge.ts`'s badge margin of the same name) --
 *  applied twice (both axes), see {@link measureEmptyPackageLeafDim}. */
const EMPTY_PACKAGE_MARGIN = 10;

/** Box + folder-tab geometry for a collapsed-empty `package`/`namespace`
 *  leaf (G2 N33 -- `class-magma.ts#isCollapsedGroup`'s own doc comment for
 *  which classifiers this applies to). */
export interface EmptyPackageLeafDim {
  width: number;
  height: number;
  wtitle: number;
  htitle: number;
  baselineOffset: number;
}

/**
 * `EntityImageEmptyPackage#calculateDimensionSlow`: an empty package/
 * namespace draws its OWN small folder-tab icon (via `ClusterDecoration`'s
 * SAME `USymbolFolder#asBig` shape every non-empty package's cluster
 * wrapper uses -- `renderNamespaceFolder`'s own module doc comment), sized
 * by a DIFFERENT, MUCH smaller formula than that cluster's own
 * content-driven `width`/`height`: `dim = merge(desc, stereoBlock)
 * .atLeast(0, 2*dimDesc.height).delta(2*MARGIN, 2*MARGIN)` -- with no
 * stereotype (every G2 N33 sample), `dim` before the margin delta is just
 * `desc`'s own raw dimension, and `2*dimDesc.height` always dominates
 * `dimDesc.height` itself, so this reduces to `width = rawTextWidth + 20`,
 * `height = 2*rawTextHeight + 20` -- jar-verified exact against
 * `gatula-10-bifu561` ("foo": rawWidth 19.425 -> 39.425; rawHeight 14 (the
 * `StringMeasurer` convention every OTHER class row already relies on,
 * `getHTitle`'s own doc comment) -> 48).
 * @see ~/git/plantuml/.../svek/image/EntityImageEmptyPackage.java:139-145
 */
export function measureEmptyPackageLeafDim(
  measurer: StringMeasurer,
  theme: Theme,
  label: string,
): EmptyPackageLeafDim {
  const dim = measurer.measure(label, titleFont(theme));
  return {
    width: dim.width + EMPTY_PACKAGE_MARGIN * 2,
    height: dim.height * 2 + EMPTY_PACKAGE_MARGIN * 2,
    wtitle: getWTitle(measurer, theme, label, 0),
    htitle: getHTitle(measurer, theme, label),
    baselineOffset: getTitleBaselineOffset(measurer, theme, label),
  };
}

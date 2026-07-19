/**
 * renderer-classifier-box.ts — the generic name+members/rows classifier box
 * (every classifier kind not handled by `renderer.ts#tryRenderUSymbol`).
 * Split out of `renderer.ts` (G2 N16 -- that file is already over the
 * project's 500-line cap, "new code in new modules" per CLAUDE.md's own
 * engineering-constraints note) — mirrors the existing `renderer-
 * arrowhead.ts`/`renderer-group.ts`/`renderer-note.ts`/`renderer-url.ts`
 * split precedent for a renderer sub-concern; pure move for the
 * pre-existing pieces (`classifierFill`/`renderRow`/`renderBadge`/
 * `renderMapColumnDividers`), no behavior change.
 */
import type { ClassifierGeo } from './layout.js';
import { ROW_TEXT_LEFT_MARGIN } from './layout.js';
import type { Theme } from '../../core/theme.js';
import { rect, text, line, ellipse, image } from '../../core/svg.js';
import { resolveColorToSvgHex } from '../../core/klimt/color/HColorSet.js';
import { resolveBareOrBackColor } from './class-color-override.js';
import { MAP_CELL_MARGIN_X } from './class-map-sizing.js';
import {
  hasBadge,
  resolveBadgeFill,
  resolveBadgeBorder,
  resolveBadgeGlyphColor,
  spotSnameForKind,
  badgeGlyphPath,
  resolveBadgeRadius,
  BADGE_LEFT_MARGIN,
} from './class-badge.js';
import {
  renderVisibilityIcon,
  renderVisibilityUrlBackground,
  visibilityIconOriginY,
} from './class-visibility-icon.js';
import { wrapClassifierBody, type UrlTaggedPrimitive } from './renderer-url.js';
import { linkWrap } from '../../core/svg.js';
import { FontStyle } from '../../core/klimt/shape/UText.js';
import type { MemberRenderAtom } from './class-member-creole.js';
import { javaRound4 } from '../../core/number-format.js';
import { resolveClassTagCascadeEntry } from '../../core/style-cascade-class.js';
import { renderOpenIconicAtom } from './renderer-openiconic.js';
import { renderEnhancedBody } from './renderer-body-enhanced.js';

// ---------------------------------------------------------------------------
// Classifier kind → fill color
// ---------------------------------------------------------------------------

/** `theme.colors.graph.classCascadeBackground ?? classBackground` -- the
 *  terminal class-family default every kind falls back to when no
 *  higher-priority override applies (shared because object/map/json
 *  coincidentally default to the SAME jar hex, `#F1F1F1`, as class --
 *  see `classifierFill`'s own doc comment for why this is NOT the same as
 *  object/map/json sharing class's CASCADE). */
function classDefaultBackground(theme: Theme): string {
  return theme.colors.graph.classCascadeBackground ?? theme.colors.graph.classBackground;
}

/** G3/O1: `theme.colors.elements[sname].background` -- resolves the SAME
 *  raw-`parseColor` value the generic `ELEMENT_BUCKET_SNAMES` bucket
 *  populates for every other element kind (`note`, `spot<Kind>`). A plain
 *  color NAME still needs HColorSet resolution (`resolveColorToSvgHex`,
 *  mirroring `renderer-note.ts#resolveNoteBackground`'s identical branch).
 *  Gradient `Paint`s are NOT supported here (unlike that note precedent) --
 *  `classifierFill`'s return type is `string`, shared with two other
 *  callers (`renderEnhancedBody`/`renderVisibilityUrlBackground`) that
 *  don't accept a `Paint`; widening all three for a feature no fixture in
 *  the corpus exercises is out of this iteration's scope -- falls through
 *  to the class default in that (currently unencountered) case, same as
 *  "unset". */
function resolveElementBackground(theme: Theme, sname: string): string | undefined {
  const bucket = theme.colors.elements?.[sname]?.background;
  if (typeof bucket === 'string') return resolveColorToSvgHex(bucket);
  return undefined;
}

function classifierFill(geo: ClassifierGeo, theme: Theme): string {
  // Upstream has no `enum`/`interface` StyleSignature for the box fill --
  // `EntityImageClassHeader#getStyleSignature` (and the lollipop-interface
  // eye's own `ColorParam.classBackground` read) both key on `SName.class_`
  // UNCONDITIONALLY for every leaf kind; only the small spot-badge circle
  // varies per-LeafType (`spotClass`/`spotEnum`/`spotInterface`, already
  // ported separately in class-badge.ts#badgeFill). `theme.colors.graph.
  // enumBackground`/`interfaceBackground` are readable-but-dead skinparam/
  // `<style>` slots this port invented with no upstream target -- jar-
  // verified (`pijoji-10-tazo455`: `skinparam enum { BackgroundColor blue }`
  // + `skinparam class { BackgroundColor LightBlue }`, the enum's own box
  // fill is LightBlue, the CLASS color, not blue). G2 N12.
  // G2 N31: `geo.color` is the RAW space-joined `COLOR [LINECOLOR]` capture
  // from `class-declaration-parser.ts#extractDecorations`; `resolveBareOr
  // BackColor` reads only the COLOR half's background component (G2 N34:
  // moved to `class-color-override.ts` so `renderer-note.ts` can reuse the
  // SAME grammar for a note's own `#color` override -- see that module's
  // doc comment for the full extraction rule).
  const override = resolveBareOrBackColor(geo.color);
  if (override !== undefined) return resolveColorToSvgHex(override);
  // G3/O1: `object`/`map`/`json` each carry their OWN StyleSignature
  // upstream (`SName.object`/`map`/`json` under `SName.objectDiagram`),
  // independent of class's `SName.class_` (`EntityImageObject`/`Map`/
  // `Json#getStyleSignature`) -- so they read their OWN `skinparam
  // {object,map,json}BackgroundColor` bucket instead of the class
  // `.tagname`/ancestor cascade below, which is genuinely class-only
  // upstream (jar-verified: `skinparam objectBackgroundColor` never tints a
  // PLAIN `class`, and vice versa -- majake-62-pero492). Falls through to
  // the SAME terminal class default ONLY because object/map/json have no
  // distinct default color of their own upstream (all three coincidentally
  // default to jar's shared `#F1F1F1`), not because they share class's
  // cascade -- `<<tag>>`-scoped `objectBackgroundColor<<X>>` is a SEPARATE,
  // larger, deferred mechanism (`skinparam.ts#ELEMENT_BUCKET_SNAMES`'s own
  // doc comment on the `object`/`map`/`json` entries).
  if (geo.kind === 'object' || geo.kind === 'map' || geo.kind === 'json') {
    return resolveElementBackground(theme, geo.kind) ?? classDefaultBackground(theme);
  }
  // G2 N37: the `.tagname` sub-selector cascade (`class { .mystyle {
  // BackgroundColor cyan } } }`) wins over the plain ancestor cascade below
  // when the classifier carries a matching stereotype -- see
  // `style-cascade-class.ts#resolveClassTagCascadeEntry`'s own doc comment.
  const tagBackground = resolveClassTagCascadeEntry(theme, geo.stereotypeLabels, geo.styleGeneration)?.background;
  if (tagBackground !== undefined) return tagBackground;
  // G2 N36: `classCascadeBackground` is a STRICT SUPERSET of what the
  // pre-existing bare `class {}` bucket (`classBackground`, `style-map-
  // theme.ts`) could ever populate from the SAME StyleMap -- it additionally
  // covers the `classDiagram`/`root` ancestor layer and nested `classDiagram
  // .class {}` -- see `theme.ts`'s own field doc comment.
  return classDefaultBackground(theme);
}

/**
 * G2 N36: box/divider/map-divider stroke color -- the SAME `classDiagram
 * {}`/`root {}`/nested `classDiagram { class {...} } }` LineColor ancestor
 * cascade `classifierFill` reads for BackGroundColor above
 * (`EntityImageClass.java`'s single `getStyle().value(PName.LineColor)`
 * call feeds BOTH the box rect's stroke AND -- via the shared `ug.apply
 * (borderColor)` drawing-context color -- every divider line jar draws
 * inside it, jar-verified `bikuka-40-pezi068`/`tolavi-09-jovu646`). No
 * PER-CLASSIFIER inline `##linecolor` override is threaded here (unlike
 * `classifierFill`'s `resolveBareOrBackColor` -- `Classifier.color`'s own
 * line-color half is a SEPARATE, unsurveyed mechanism, out of this
 * iteration's scope).
 */
function classBorder(geo: ClassifierGeo, theme: Theme): string {
  // G2 N37: the `.tagname` sub-selector cascade wins over the plain
  // ancestor cascade -- see `classifierFill`'s identical precedent above.
  const tagBorder = resolveClassTagCascadeEntry(theme, geo.stereotypeLabels, geo.styleGeneration)?.border;
  // G2 N51: `skinparam classBorderColor #X` -- the bare (non-`<style>`,
  // non-tag) fallback tier, mirroring `classifierFill`'s identical
  // `classCascadeBackground ?? classBackground` two-tier precedent -- see
  // `theme.ts#classBorder`'s own doc comment.
  return tagBorder ?? theme.colors.graph.classCascadeBorder ?? theme.colors.graph.classBorder ?? theme.colors.border;
}

/**
 * G2 N51: box/divider stroke WIDTH -- the classifier box outline's and
 * every divider line's own `stroke-width`, jar default `0.5`
 * (`EntityImageClass.java`'s `getStyle().value(PName.LineThickness)`, the
 * SAME `element.class_` StyleSignature `classBorder` above reads for
 * LineColor). Per-stereotype `classBorderThickness<<X>>` wins over the
 * plain `classBorderThickness` skinparam, which wins over the `0.5`
 * default -- see `theme.ts#classBorderThicknessByStereo`'s own doc
 * comment for why this is a DIRECT skinparam-value lookup, not a
 * `<style>`/`.tagname` cascade (so it does NOT consult
 * `resolveClassTagCascadeEntry`, unlike `classBorder`/`classifierFill`
 * above).
 */
const CLASS_BORDER_STROKE_WIDTH_DEFAULT = 0.5;
function classBorderStrokeWidth(geo: ClassifierGeo, theme: Theme): number {
  const byStereo = theme.colors.graph.classBorderThicknessByStereo;
  if (byStereo !== undefined && geo.stereotypeLabels !== undefined) {
    for (const label of geo.stereotypeLabels) {
      const hit = byStereo[label.toLowerCase()];
      if (hit !== undefined) return hit;
    }
  }
  return theme.colors.graph.classBorderThickness ?? CLASS_BORDER_STROKE_WIDTH_DEFAULT;
}

/**
 * Every classifier row (header AND member) shares ONE plain-baseline
 * left-anchored `<text>` shape -- G2 N4, replacing the previous header-only
 * `text-anchor="middle"`/`dominant-baseline="middle"` centering: jar draws
 * every classifier `<text>` with NEITHER attribute (a plain SVG baseline
 * position, `x` = the text's own LEFT edge, `y` = the baseline) -- verified
 * across every sampled fixture in `plans/g2-class-svg/ledger.md` N4.
 * `row.indent` already carries this row's real left-edge offset from
 * `geo.x` (header centering + member icon-zone reservation both baked in
 * at layout time -- `class-layout-helpers.ts#buildHeaderRow`/
 * `buildSectionRows`), so this function no longer branches on
 * `indent > 0` at all. `row.width` (when present -- always, from
 * `layoutClass`; absent only in hand-built unit-test geometries) feeds
 * `textLength`/`lengthAdjust`, matching jar's own deterministic-text-mode
 * `<text textLength="..." lengthAdjust="spacing">` emission byte-for-byte
 * rather than leaving inter-glyph spacing to the SVG viewer's own font.
 *
 * Fill is a HARDCODED `#000000`, NOT `theme.colors.text` (`#181818` by
 * default, the general canvas-text color used elsewhere in this file for
 * notes/edges): `EntityImageClassHeader`'s own style-signature FontColor
 * resolves to black by default, independent of the general theme text
 * color (jar-verified: every non-monochrome-theme fixture's header/member
 * `<text>` carries `fill="#000000"` even when `theme.colors.text` differs).
 * `skinparam monochrome reverse` flips this to white -- a separate,
 * smaller, pre-existing, unfixed divergence (matches `renderBadge`'s own
 * glyph-fill precedent, same doc-comment caveat).
 */
/**
 * G2 N67 (near-zero harvest, xabije-20-xusi569): the member row's OWN
 * resolved font size for visibility-icon Y-centering -- mirrors
 * `class-layout-helpers.ts#measureGenericClassifier`'s `attributeFont.size`
 * formula (`theme.colors.graph.classAttributeFontSize ?? theme.fontSize`,
 * `skinparam class { AttributeFontSize N }`) EXACTLY, so the icon centers
 * against the SAME font size the row's own text already measures/draws
 * against. Both `visibilityIconOriginY` call sites below previously passed
 * the diagram-global `theme.fontSize` unconditionally -- correct only when
 * no `AttributeFontSize` override is set (the overwhelming majority of
 * fixtures, hence this bug's 1/718 corpus reach going undetected until this
 * iteration's near-zero triage), byte-exact wrong otherwise (jar-verified:
 * the icon's own `descent` term differed by `(18-14)/4.5 == 1.1111` against
 * `xabije-20-xusi569`'s `AttributeFontSize 18`).
 */
function attributeFontSize(theme: Theme): number {
  return theme.colors.graph.classAttributeFontSize ?? theme.fontSize;
}

export function renderRow(geo: ClassifierGeo, row: ClassifierGeo['rows'][number], theme: Theme): string {
  const icon =
    row.visibilityIcon !== undefined
      ? renderVisibilityIcon(
          row.visibilityIcon,
          row.visibilityIsField === true,
          geo.x + ROW_TEXT_LEFT_MARGIN,
          visibilityIconOriginY(geo.y + row.y, attributeFontSize(theme)),
          undefined,
          theme,
        )
      : '';
  return icon + renderRowText(geo, row, theme);
}

/**
 * The row's TEXT ONLY (no visibility icon) -- split out of {@link renderRow}
 * (G2 N21) so `buildBodyPrimitives` can emit an icon-bearing row as TWO
 * separately url-tagged primitives (icon, text) instead of one bundled
 * string; see `renderer-url.ts`'s "icon `<g>` forces a link-flush boundary"
 * doc comment for why they need independent `<a>` runs.
 */
export function renderRowText(
  geo: ClassifierGeo,
  row: ClassifierGeo['rows'][number],
  theme: Theme,
  // G2 N36: true for the header/name row(s) only (`buildHeaderPrimitive`'s
  // own call) -- selects the WIDER `classCascadeHeaderFontColor` signature
  // (which additionally allows a nested `... { header { FontColor } } }`
  // override to win, `EntityImageClassHeader.getStyleSignature()`) instead
  // of the box-level `classCascadeFontColor` every member row uses.
  isHeader = false,
  // G2 N37: true ONLY for a stacked `<<stereotype>>` LABEL row (never the
  // name row itself, never a member row) -- the `.tagname` cascade's
  // FontColor does NOT tint this row: jar-verified `dozude-05-jeve029`'s
  // `AliceMyStyleStereo` draws `«mystyle»` in the hardcoded default
  // `#000000`, while the SAME entity's name text AND member rows adopt the
  // tag's `FontColor red` -- `buildHeaderPrimitive`'s own call passes this
  // `true` only for `rows[0..headerRowCount-2]` (see that function's own
  // loop).
  isStereoLabelRow = false,
): string {
  // G2 N37: the `.tagname` sub-selector cascade wins over the plain
  // ancestor cascade for BOTH the name row AND member rows uniformly (jar-
  // verified `dozude-05-jeve029`: the tag's `FontColor red` applies to the
  // header name AND a member row alike) -- but NEVER a stereotype label row
  // (`isStereoLabelRow`'s own doc comment above). See `style-cascade-class
  // .ts#resolveClassTagCascadeEntry`'s own doc comment.
  const tagFontColor = isStereoLabelRow
    ? undefined
    : resolveClassTagCascadeEntry(theme, geo.stereotypeLabels, geo.styleGeneration)?.fontColor;
  const fontColor =
    tagFontColor ??
    ((isHeader ? theme.colors.graph.classCascadeHeaderFontColor ?? theme.colors.graph.classCascadeFontColor
      : theme.colors.graph.classCascadeFontColor) ?? '#000000');
  if (row.atoms !== undefined) {
    return renderRowAtoms(row.atoms, geo.x + row.indent, geo.y + row.y, theme, fontColor);
  }
  return text(geo.x + row.indent, geo.y + row.y, row.text, {
    // G2 N23: `row.fontFamily`/`row.fontSize` (set only on the header row
    // when `skinparam class { AttributeFontSize/AttributeFontName }` is in
    // effect) override the theme default -- see `layout.ts`'s `rows[]`
    // field doc comment.
    fontFamily: row.fontFamily ?? theme.fontFamily,
    fontSize: row.fontSize ?? theme.fontSize,
    // G2 N4/N36: hardcoded `#000000` by default (`EntityImageClassHeader`'s
    // own style-signature FontColor resolves to black independent of the
    // general theme text color, jar-verified) -- `classCascade(Header)
    // FontColor` overrides it when a `<style>` block's `root`/`classDiagram`/
    // nested selector actually sets FontColor (`resolveStyleCascade`'s doc
    // comment); `skinparam monochrome reverse`'s white flip is a separate,
    // smaller, pre-existing, unfixed divergence (matches `renderBadge`'s own
    // glyph-fill precedent, same doc-comment caveat).
    fill: fontColor,
    // G2 N4: `text-anchor` OMITTED, not set to 'start' -- 'start' IS the
    // SVG default, and jar never emits the attribute at all for its
    // plain-baseline classifier text (verified: zero `text-anchor`
    // occurrences on any sampled fixture's header/member `<text>`).
    // `core/svg.ts#text()` already drops any `undefined` style field, so
    // simply not passing `textAnchor` reproduces jar's own omission byte-
    // for-byte, rather than emitting a semantically-equal-but-textually-
    // different `text-anchor="start"` that a raw-string comparator (this
    // attribute is not on `compareSvg`'s numeric-tolerance allowlist)
    // would flag as a spurious diff.
    ...(row.width !== undefined ? { lengthAdjust: 'spacing' as const, textLength: row.width } : {}),
    ...(row.italic === true ? { fontStyle: 'italic' as const } : {}),
    // G2 N32: `skinparam classFontStyle bold` -- header-only, mirrors the
    // creole atom engine's identical `FontStyle.BOLD` -> `font-weight="700"`
    // convention (`renderRowAtoms` below).
    ...(row.bold === true ? { fontWeight: '700' as const } : {}),
  });
}

/** `FontStyle` set -> the SVG `text-decoration` attribute value -- mirrors
 *  `core/klimt/drawing/svg/driver-text-svg.ts#textDecorationOf` exactly
 *  (same three flags, same CSS keywords, same join order); duplicated
 *  rather than imported because that function is `DriverTextSvg`'s own
 *  private helper and class's renderer has no `UDriver`/`UGraphic` seam to
 *  hang a shared import off of (this file's own module doc comment). */
function memberAtomDecoration(styles: ReadonlySet<FontStyle>): string | undefined {
  const parts: string[] = [];
  if (styles.has(FontStyle.UNDERLINE)) parts.push('underline');
  if (styles.has(FontStyle.STRIKE)) parts.push('line-through');
  if (styles.has(FontStyle.WAVE)) parts.push('wavy underline');
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * G2 N22: draws a member row's per-atom creole content -- one `<text>` per
 * styled text run, one `<image>` per resolved img/sprite atom, left to
 * right, x-advancing by each atom's OWN measured width. Mirrors
 * `core/svek/image/EntityImageDescriptionSupport.ts#drawAtoms`'s identical
 * reconstruction for description (same "drawing and measuring agree by
 * construction" invariant -- `buildMemberRow`'s summed `MemberRowBuild
 * .width` is exactly the sum of these per-atom widths).
 *
 * `textLength` is `javaRound4`'d per atom (NOT reused from the row's own
 * already-rounded `row.width`, which is a rounded SUM across every atom in
 * a multi-atom row and only equals a single atom's own rounded width in the
 * common single-atom case) -- matches jar's real per-`<text>`-element
 * `SvgGraphics#format` rounding (`core/klimt/drawing/svg/svg-graphics-
 * elements.ts` applies this uniformly to EVERY klimt-emitted numeric
 * attribute; class's pure-string `core/svg.ts` builders round only where a
 * caller explicitly does, per this file's own `renderRowText` precedent for
 * the single-`<text>` legacy path). `x`/`y`/image width/height stay
 * UNROUNDED, matching this file's existing convention for every OTHER
 * coordinate (`geo.x`, `row.y`, `rect`'s own `geo.width`/`geo.height`) --
 * `textLength` is the one attribute `compareSvg` requires an EXACT string
 * match on (N4's own doc comment); coordinates are on its numeric-tolerance
 * allowlist.
 */
function renderRowAtoms(
  atoms: readonly MemberRenderAtom[],
  startX: number,
  y: number,
  theme: Theme,
  // G2 N36: the SAME `classCascade(Header)FontColor ?? '#000000'` fallback
  // `renderRowText` computes for its plain-text path -- an atom's OWN
  // creole-resolved color (`atom.font.color`, a `<color>text</color>` run
  // or similar) still wins when set; this only replaces the innermost
  // hardcoded default.
  fallbackFontColor = '#000000',
): string {
  // #lizard forgives -- ALREADY over the NLOC cap pre-N41 (31 NLOC at
  // G2 N40's HEAD, one `for` loop over 3 atom kinds each with their own
  // small render recipe); G2 N41 adds one more branch (5 NLOC, delegated to
  // `renderer-openiconic.ts` to keep the addition itself small) rather than
  // attempting a full split of this pre-existing, already-jar-verified
  // function under this iteration's time budget.
  let x = startX;
  let out = '';
  for (const atom of atoms) {
    if (atom.kind === 'text') {
      const decoration = memberAtomDecoration(atom.font.styles);
      // G2 N57 item 38: `atom.renderText`/`renderWidth` are set ONLY for a
      // whitespace-only run (`DriverTextSvg.java`'s NBSP-substitution
      // branch, `class-member-creole.ts#MemberRenderAtom`'s own doc
      // comment) -- the DRAWN text/textLength use them when present, but
      // x-advance below stays on `atom.width` (the LAYOUT value) always.
      const rendered = text(x, y, atom.renderText ?? atom.text, {
        fontFamily: atom.font.family,
        fontSize: atom.font.size,
        fill: atom.font.color ?? fallbackFontColor,
        lengthAdjust: 'spacing',
        textLength: javaRound4(atom.renderWidth ?? atom.width),
        ...(atom.font.styles.has(FontStyle.BOLD) ? { fontWeight: '700' as const } : {}),
        ...(atom.font.styles.has(FontStyle.ITALIC) ? { fontStyle: 'italic' as const } : {}),
        ...(decoration !== undefined ? { textDecoration: decoration } : {}),
      });
      // G2 N40: a `[[url]]` creole command's captured-label run wraps in
      // its OWN `<a href>` -- `class-member-creole.ts#MemberRenderAtom`'s
      // `url` field doc comment.
      out += atom.url !== undefined ? linkWrap(rendered, atom.url) : rendered;
      x += atom.width;
      continue;
    }
    if (atom.kind === 'vector') {
      // G2 N41: an OpenIconic `<&glyph>` atom -- render logic lives in
      // `renderer-openiconic.ts` (kept out of this already-500-line-capped
      // file, see that module's own doc comment).
      out += renderOpenIconicAtom(atom, x, y, theme);
      x += atom.width;
      continue;
    }
    // 'image': jar's `AtomImg`/`AtomSprite` sit at the line's TOP (altitude
    // 0), not the text baseline -- mirrors `EntityImageDescriptionSupport
    // .ts#drawAtoms`'s identical `origin.y` (no `baselineDy`) placement for
    // an inline atom. `theme.fontSize/4.5` is this codebase's own
    // content-independent descent formula (`measurer.ts`'s every
    // `getDescent` implementation, `class-layout-helpers.ts#
    // measureGenericClassifier`'s `baselineOffset` derivation) -- reused
    // here without a `StringMeasurer` (the renderer has none) since it
    // depends only on `theme.fontSize`, matching that shared precedent.
    const lineTopY = y - (theme.fontSize - theme.fontSize / 4.5);
    out += image(x, lineTopY, atom.width, atom.height, atom.href);
    x += atom.width;
  }
  return out;
}

/**
 * The kind badge in the header: a filled `<ellipse>` (radius {@link
 * BADGE_RADIUS}, upstream `SkinParam#getCircledCharacterRadius()` default)
 * plus the kind letter drawn as a real vector glyph outline (`<path>`),
 * matching `klimt/shape/CircledCharacter.java` -- never `<circle>`+`<text>`.
 *
 * Position (G2 N23, replacing N4's indent-reversal trick): `cx` reads the
 * NAME row's own `badgeIndent` directly -- `class-stereotype.ts#
 * buildHeaderRow`'s own `h1 + BADGE_LEFT_MARGIN + BADGE_RADIUS` term. N4's
 * "reverse the text row's own indent" shortcut is NO LONGER valid post-N23:
 * the header TEXT row's `indent` bakes in `h1 + h2` (an asymmetric
 * wider-box-centering split, see that function's doc comment), while the
 * badge only moves by `h1` alone -- the two diverge by `h2/2` whenever
 * `h2 > 0`, so they need their OWN stored field rather than one shared
 * offset. `cy = geo.y + headerHeight / 2`, unchanged. G2 N24: the NAME row
 * is `rows[headerRowCount - 1]`, not always `rows[0]` -- a stacked
 * `<<stereotype>>` pushes N stereo rows in FRONT of it (`badgeIndent` is
 * only ever set on the name row, never a stereo row).
 *
 * G2 N24 (pre-existing bug, unmasked while jar-verifying the "fully
 * suppressed" height fix on `xibibe-37-regi626`): `dividerYs[0]` is only
 * absent when BOTH compartments are suppressed (`hide members`/`hide empty
 * members` on a member-less classifier) -- `measureGenericClassifier`'s own
 * early-return branch, which now sets `geo.height === headerRowHeight`
 * EXACTLY in that case (no other content). The old fallback (a flat,
 * unverified `28`) was simply wrong whenever the real `headerRowHeight`
 * differed (badge-dominant `32`, or higher still with a stereotype row) --
 * `geo.height` is the correct value in every case that reaches this
 * fallback, not a new formula.
 */
function renderBadge(geo: ClassifierGeo, theme: Theme): string {
  const headerH = geo.dividerYs[0] ?? geo.height;
  const nameRowIndex = (geo.headerRowCount ?? 1) - 1;
  // G2 N38: resolved from theme (formula or explicit override) -- see
  // `class-badge.ts#resolveBadgeRadius`'s own doc comment. Falls back to
  // the SAME value `buildHeaderRow` used to compute `badgeIndent`
  // whenever that field is present (the common case); only reached for
  // hand-built test geometries that bypass the real layout pipeline.
  const badgeRadius = resolveBadgeRadius(
    theme.colors.graph.circledCharacterFontSize,
    theme.colors.graph.circledCharacterRadius,
  );
  const badgeIndent = geo.rows[nameRowIndex]?.badgeIndent ?? BADGE_LEFT_MARGIN + badgeRadius;
  const badgeX = geo.x + badgeIndent;
  const badgeY = geo.y + headerH / 2;
  // G2 N32: `skinparam stereotype<X>BackgroundColor/BorderColor` / `<style>
  // spot<Kind> { BackgroundColor; LineColor; FontColor }` -- the badge's
  // own theme-level spot-color override bucket, see `class-badge.ts
  // #spotSnameForKind`'s doc comment. `undefined` for any kind with no
  // bucket (every non-badge-bearing kind, plus unsurveyed badge kinds).
  const spotSname = spotSnameForKind(geo.kind);
  const spot = spotSname !== undefined ? theme.colors.elements?.[spotSname] : undefined;
  return (
    ellipse(badgeX, badgeY, badgeRadius, badgeRadius, {
      // G2 N4: `strokeWidth` (camelCase) is not a valid SVG attribute name --
      // was silently emitting a bogus `strokeWidth="1"` attribute (invisible
      // to any real SVG renderer) instead of the intended `stroke-width="1"`,
      // a pre-existing bug from N3 diagnosed this iteration (blocked EVERY
      // badge-bearing fixture's `ellipse/@stroke-width` from matching jar).
      // G2 N26: `resolveBadgeFill` -- the badge-customization COLOR half
      // of `class Foo << (F,orange) >>` (`geo.badgeColor`) wins over the
      // kind default when present; see that function's own doc comment.
      // G2 N36: `theme.colors.graph.spotCascade*` -- the bare `<style>
      // root { BackGroundColor/LineColor/FontColor } }` ancestor-cascade
      // fallback, see `resolveBadgeFill`/`resolveBadgeBorder`/
      // `resolveBadgeGlyphColor`'s own `rootFallback` doc comments.
      fill: resolveBadgeFill(geo.kind, geo.badgeColor, spot?.background, theme.colors.graph.spotCascadeBackground),
      stroke: resolveBadgeBorder(theme.colors.border, spot?.border, theme.colors.graph.spotCascadeBorder),
      'stroke-width': 1,
    }) +
    // `style.value(PName.FontColor)` on the spot style signature -- black in
    // every non-monochrome theme sampled (`plans/g2-class-svg/ledger.md`
    // N3); monochrome-reverse flips this to white, a separate, smaller,
    // unfixed divergence (that theme already diverges more broadly). G2 N32:
    // `spot.font` (`<style> spot<Kind> { FontColor }`) overrides the
    // hardcoded default -- jar-verified `gekofe-43-lufa479`.
    // G2 N26: `geo.badgeChar` -- the CHAR half of the same decoration,
    // see `badgeGlyphPath`/`resolveBadgeLetter`'s own doc comment for the
    // 5-known-letters limitation.
    `<path d="${badgeGlyphPath(
      geo.kind, badgeX, badgeY, geo.badgeChar, theme.colors.graph.circledCharacterFontSize,
      theme.colors.graph.circledCharacterFontFamily, theme.colors.graph.circledCharacterFontBold,
      theme.colors.graph.circledCharacterFontItalic,
    )}" ` +
    `fill="${resolveBadgeGlyphColor(spot?.font, theme.colors.graph.spotCascadeFont)}"/>`
  );
}

/**
 * Map-only: the column-B vertical divider per non-linked data row
 * (TextBlockMap#drawU's per-row `ULine.vline`). Row/column geometry is
 * reconstructed from rows[]/dividerYs alone (no ClassifierGeo schema change
 * — see class-object-map-sizing.ts#buildMapRowGeo for why): every data row
 * contributes exactly two rows[] entries (key, value) after the header
 * entries (those with y below dividerYs[0]); a linked row's value entry has
 * empty text and is skipped (upstream never draws that cell either).
 *
 * NOT used for `json` — a json entries area can nest arbitrarily deep, so it
 * does not fit the "exactly two rows[] entries per data row" invariant this
 * relies on; see class-json-sizing.ts's file doc for the documented
 * rendering simplification (row/column TEXT is exact at every depth, only
 * the vertical divider lines are omitted).
 */
function renderMapColumnDividers(geo: ClassifierGeo, theme: Theme): string {
  if (geo.kind !== 'map' || geo.dividerYs.length === 0) return '';
  const dataRows = geo.rows.filter((r) => r.y >= geo.dividerYs[0]!);
  const parts: string[] = [];
  for (let i = 0; i < geo.dividerYs.length; i++) {
    const value = dataRows[2 * i + 1];
    if (value === undefined || value.text === '') continue; // linked/point row
    const top = geo.dividerYs[i]!;
    const bottom = geo.dividerYs[i + 1] ?? geo.height;
    const dividerX = geo.x + value.indent - MAP_CELL_MARGIN_X;
    parts.push(line(dividerX, geo.y + top, dividerX, geo.y + bottom, { stroke: classBorder(geo, theme) }));
  }
  return parts.join('');
}

/**
 * Builds the header bundle (rect + badge + stacked stereotype row(s) +
 * header name, ALWAYS drawn together as one unit -- see
 * `renderClassifierBox`'s draw-order doc comment) as a single url-tagged
 * primitive. The header never carries its OWN url (only member rows can,
 * via `[[[url]]]`) -- its effective url is always the classifier's own
 * fallback (`geo.url`, possibly `undefined`).
 *
 * `geo.headerRowCount` (G2 N24, default 1) is the number of LEADING
 * `rows[]` entries that belong to this bundle -- normally just the name
 * row, but `1 + N` when the classifier has N stacked `<<stereotype>>`
 * lines (`class-stereotype.ts`'s own doc comment for the jar derivation).
 * Every header row draws via `renderRowText` (never `renderRow` -- a
 * header row can never carry a visibility icon).
 */
function buildHeaderPrimitive(geo: ClassifierGeo, theme: Theme): UrlTaggedPrimitive {
  // G2 N37: `RoundCorner` -- tag cascade wins over the ancestor cascade,
  // which wins over the pre-existing hardcoded jar-default 5 (`rx`/`ry` =
  // roundCorner / 2, `URectangle.ts#build().rounded()`'s halving
  // convention) -- see `theme.ts#classCascadeRoundCorner`'s own doc
  // comment. Zero behavior change for every classifier with no `<style>`
  // RoundCorner declaration.
  const roundCorner =
    resolveClassTagCascadeEntry(theme, geo.stereotypeLabels, geo.styleGeneration)?.roundCorner
    ?? theme.colors.graph.classCascadeRoundCorner
    ?? 5;
  let body = rect(geo.x, geo.y, geo.width, geo.height, {
    fill: classifierFill(geo, theme), stroke: classBorder(geo, theme), strokeWidth: classBorderStrokeWidth(geo, theme),
    rx: roundCorner / 2, ry: roundCorner / 2,
  });
  // G2 N58 item 40: `skinparam style strictuml` unconditionally suppresses
  // the circled-character badge (`CucaDiagram#showPortion`'s own doc comment
  // on the measurement side, class-layout-helpers.ts#measureGenericClassifier).
  if (geo.hideCircle !== true && hasBadge(geo.kind) && theme.strictUml !== true) body += renderBadge(geo, theme);
  const headerRowCount = geo.headerRowCount ?? 1;
  // G2 N64 item 45: `nameRowCount` (new field, default 1) generalizes the
  // pre-existing "exactly one trailing name row" assumption to N trailing
  // NAME-LINE rows (a multi-line `\n`/`\l`/`\r`-split display name) --
  // only rows BEFORE `firstNameRowIndex` are genuine `<<stereotype>>` label
  // rows (`isStereoLabelRow`); every name-line row (including line 2+)
  // gets the SAME treatment line 1 always had. Reduces to the OLD
  // `nameRowIndex = headerRowCount - 1` single-row check exactly when
  // `nameRowCount` is absent (default 1).
  const firstNameRowIndex = headerRowCount - (geo.nameRowCount ?? 1);
  geo.rows.slice(0, headerRowCount).forEach((row, i) => {
    if (row.text !== '') body += renderRowText(geo, row, theme, true, i < firstNameRowIndex);
  });
  if (geo.genericTag !== undefined) body += renderGenericTag(geo, geo.genericTag, theme);
  return { url: geo.url, body };
}

/**
 * G2 N32: `class Foo<T>`'s generic type-parameter tag box -- a dashed
 * `<rect>` + italic `<text>`, drawn OUTSIDE/above the classifier box (see
 * `class-stereotype.ts#buildGenericTagGeo`'s doc comment for the position
 * derivation) as the LAST header-bundle primitive (jar's own draw order:
 * box, badge, name, THEN the generic tag -- `EntityImageClassHeader
 * .java:163`'s `HeaderLayout` ctor argument order, `circledCharacter, stereo,
 * name, genericBlock`, matches `HeaderLayout#drawU`'s own sequential draw
 * calls). Fill is a FIXED white default (`GENERIC_TAG_BACKGROUND`), NOT
 * `theme.colors.background` (the ROOT canvas background) -- G2 N49
 * jar-verified `remulu-24-zadi546` (`skinparam backgroundcolor transparent`
 * still draws the tag `fill="#FFFFFF"`, proving the two are independent):
 * the tag's fill is `element.classDiagram.class.generic`'s OWN style-cascade
 * default (`EntityImageClassHeader.java:149`, `styleGeneric.value(BackGround
 * Color)`), a DIFFERENT selector from both `class_`'s own fill AND the
 * document/root background -- the earlier `caboco-62-jula911` citation
 * (default theme, non-transparent) couldn't distinguish the two since
 * `theme.colors.background` ALSO defaults to `#FFFFFF`. A `<style> class {
 * generic { BackgroundColor ... } } }` override (jar-verified honored,
 * `camuna-58-veca254`) is NOT yet wired here -- no corpus fixture reaches
 * zero-diff on that path alone (that fixture has unrelated, larger diffs);
 * ledgered as a follow-up, not attempted this iteration. Text fill
 * is the SAME hardcoded `#000000` every other classifier text row uses
 * (`renderRowText`'s own doc comment); `font-style="italic"` always
 * (`FontParam.CLASS_STEREOTYPE`'s own default face, `FontParam.java:59`).
 */
const GENERIC_TAG_BACKGROUND = '#FFFFFF';
function renderGenericTag(geo: ClassifierGeo, tag: NonNullable<ClassifierGeo['genericTag']>, theme: Theme): string {
  return (
    rect(geo.x + tag.rectX, geo.y + tag.rectY, tag.rectWidth, tag.rectHeight, {
      fill: GENERIC_TAG_BACKGROUND, stroke: theme.colors.border, strokeWidth: 1, strokeDasharray: '2,2',
    }) +
    text(geo.x + tag.textX, geo.y + tag.textY, tag.text, {
      fontFamily: tag.fontFamily, fontSize: tag.fontSize, fill: '#000000',
      // G2 N39: `skinparam classStereotypeFontStyle` override -- see
      // `GenericTagGeo`'s own doc comment.
      ...(tag.italic ? { fontStyle: 'italic' as const } : {}),
      ...(tag.bold === true ? { fontWeight: '700' as const } : {}),
      lengthAdjust: 'spacing', textLength: tag.textWidth,
    })
  );
}

/**
 * Builds the divider/member-row primitives in jar's real interleaved
 * top-to-bottom draw order (see `renderClassifierBox`'s own doc comment for
 * why a plain Y-sort reproduces it). Each divider's effective url is always
 * the classifier's own fallback (dividers never have an "own" url); each
 * member row's effective url is its OWN `[[[url]]]` when set, else the
 * SAME classifier fallback (G2 N16, generalizing N15's whole-box-only rule
 * -- `renderer-url.ts`'s own module doc comment).
 */
function buildBodyPrimitives(geo: ClassifierGeo, theme: Theme): UrlTaggedPrimitive[] {
  // G2 N42: an enhanced body (`--`/`==`/`..`/`__` block separator or a
  // `|_` tree-list line) draws its OWN part list, in EXACT jar draw order
  // (never the Y-sort merge below -- `renderer-body-enhanced.ts`'s own
  // module doc comment for why the two orderings genuinely differ).
  if (geo.enhancedBody !== undefined) {
    return [{
      url: geo.url,
      body: renderEnhancedBody(geo, geo.enhancedBody, theme, classifierFill(geo, theme), classBorder(geo, theme)),
    }];
  }
  const memberRows = geo.rows.slice(geo.headerRowCount ?? 1);
  const interleaved: Array<{ y: number; item: UrlTaggedPrimitive }> = geo.dividerYs.map((divY) => ({
    y: divY,
    item: {
      url: geo.url,
      body: line(geo.x + 1, geo.y + divY, geo.x + geo.width - 1, geo.y + divY, {
        stroke: classBorder(geo, theme), strokeWidth: classBorderStrokeWidth(geo, theme),
      }),
    },
  }));
  // A map's linked-row value entry carries empty text (see
  // renderMapColumnDividers doc) — upstream never draws that cell.
  for (const row of memberRows) {
    if (row.text === '') continue;
    const effectiveUrl = row.url ?? geo.url;
    if (row.visibilityIcon === undefined) {
      interleaved.push({ y: row.y, item: { url: effectiveUrl, body: renderRow(geo, row, theme) } });
      continue;
    }
    // G2 N21: an icon-bearing row draws as TWO primitives (icon, text), not
    // one -- the icon's OWN `<g data-visibility-modifier>` wrapper forces a
    // link-flush boundary in `SvgGraphics`, so it needs its own independent
    // `<a>` run (`class-visibility-icon.ts#renderVisibilityIcon` builds that
    // run internally, `preWrapped` tells `wrapClassifierBody` not to wrap it
    // again) while the row's text remains free to merge with the divider
    // that follows, exactly like a non-icon row.
    // G2 N40: when the ROW'S OWN url is set (not just the classifier
    // fallback -- `row.url`, matching `Member#getUrl()`), jar draws a THIRD
    // primitive first: an icon-column background rect, its own independent
    // `<a>` run, positioned at the SAME icon origin
    // (`class-visibility-icon.ts#renderVisibilityUrlBackground`'s own doc
    // comment -- `dasagu-52-vani172`/`fijali-69-pina030`).
    const iconOriginX = geo.x + ROW_TEXT_LEFT_MARGIN;
    const iconOriginY = visibilityIconOriginY(geo.y + row.y, attributeFontSize(theme));
    if (row.url !== undefined) {
      interleaved.push({
        y: row.y,
        item: {
          url: effectiveUrl,
          preWrapped: true,
          body: renderVisibilityUrlBackground(iconOriginX, iconOriginY, classifierFill(geo, theme), row.url),
        },
      });
    }
    interleaved.push({
      y: row.y,
      item: {
        url: effectiveUrl,
        preWrapped: true,
        body: renderVisibilityIcon(
          row.visibilityIcon,
          row.visibilityIsField === true,
          iconOriginX,
          iconOriginY,
          effectiveUrl,
          theme,
        ),
      },
    });
    interleaved.push({ y: row.y, item: { url: effectiveUrl, body: renderRowText(geo, row, theme) } });
  }
  interleaved.sort((a, b) => a.y - b.y);
  return interleaved.map((entry) => entry.item);
}

/** The plain name+members/rows box (every classifier kind not handled by
 *  `renderer.ts#tryRenderUSymbol`).
 *
 * Draw order matters (positional comparator): jar draws rect, THEN the
 * badge (if any), THEN the header name, THEN EVERY divider/member-row
 * INTERLEAVED in top-to-bottom visual (Y) order -- NOT all dividers as
 * one batch followed by all rows (`EntityImageClass#drawInternal` draws
 * the rect+badge via `header.drawU`, then `body.drawU` draws the fields
 * divider, fields rows, methods divider, methods rows IN THAT SEQUENCE;
 * G2 N4, jar-verified: a single-field/no-methods classifier draws
 * divider(32), row("Bar", local y 46.89), divider(54) -- the SECOND
 * divider comes AFTER the field row, not immediately after the first
 * divider -- `jobuco-44-zife032`). A plain ascending sort by each
 * element's own local Y position reproduces this generically: every
 * divider's Y is its section's TOP, every row's Y is its OWN baseline
 * (always inside its own section's [top, next-divider) range), so
 * sorting the merged (divider, row) sequence by Y alone yields the exact
 * interleaved order jar draws, without this port needing to track a
 * separate fields/methods row-count split on `ClassifierGeo`.
 *
 * G2 N16 (generalizing N15's README item #7 whole-box wrap): the header
 * bundle, every divider, and every member row are each tagged with their
 * OWN effective url and merged into `<a>` runs by `renderer-url.ts
 * #wrapClassifierBody` -- see that module's own doc comment for the full
 * mechanism.
 */
export function renderClassifierBox(geo: ClassifierGeo, theme: Theme): string {
  const mapDividers = renderMapColumnDividers(geo, theme);
  const primitives: UrlTaggedPrimitive[] = [
    buildHeaderPrimitive(geo, theme),
    ...buildBodyPrimitives(geo, theme),
    ...(mapDividers !== '' ? [{ url: geo.url, body: mapDividers }] : []),
  ];
  return wrapClassifierBody(geo, primitives);
}

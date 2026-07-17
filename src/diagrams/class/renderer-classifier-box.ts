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
import { MAP_CELL_MARGIN_X } from './class-object-map-sizing.js';
import {
  hasBadge,
  resolveBadgeFill,
  badgeGlyphPath,
  BADGE_RADIUS,
  BADGE_LEFT_MARGIN,
} from './class-badge.js';
import { renderVisibilityIcon, visibilityIconOriginY } from './class-visibility-icon.js';
import { wrapClassifierBody, type UrlTaggedPrimitive } from './renderer-url.js';
import { FontStyle } from '../../core/klimt/shape/UText.js';
import type { MemberRenderAtom } from './class-member-creole.js';
import { javaRound4 } from '../../core/number-format.js';

// ---------------------------------------------------------------------------
// Classifier kind → fill color
// ---------------------------------------------------------------------------

function classifierFill(_geo: ClassifierGeo, theme: Theme): string {
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
  return theme.colors.graph.classBackground;
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
export function renderRow(geo: ClassifierGeo, row: ClassifierGeo['rows'][number], theme: Theme): string {
  const icon =
    row.visibilityIcon !== undefined
      ? renderVisibilityIcon(
          row.visibilityIcon,
          row.visibilityIsField === true,
          geo.x + ROW_TEXT_LEFT_MARGIN,
          visibilityIconOriginY(geo.y + row.y, theme.fontSize),
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
export function renderRowText(geo: ClassifierGeo, row: ClassifierGeo['rows'][number], theme: Theme): string {
  if (row.atoms !== undefined) return renderRowAtoms(row.atoms, geo.x + row.indent, geo.y + row.y, theme);
  return text(geo.x + row.indent, geo.y + row.y, row.text, {
    // G2 N23: `row.fontFamily`/`row.fontSize` (set only on the header row
    // when `skinparam class { AttributeFontSize/AttributeFontName }` is in
    // effect) override the theme default -- see `layout.ts`'s `rows[]`
    // field doc comment.
    fontFamily: row.fontFamily ?? theme.fontFamily,
    fontSize: row.fontSize ?? theme.fontSize,
    fill: '#000000',
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
): string {
  let x = startX;
  let out = '';
  for (const atom of atoms) {
    if (atom.kind === 'text') {
      const decoration = memberAtomDecoration(atom.font.styles);
      out += text(x, y, atom.text, {
        fontFamily: atom.font.family,
        fontSize: atom.font.size,
        fill: atom.font.color ?? '#000000',
        lengthAdjust: 'spacing',
        textLength: javaRound4(atom.width),
        ...(atom.font.styles.has(FontStyle.BOLD) ? { fontWeight: '700' as const } : {}),
        ...(atom.font.styles.has(FontStyle.ITALIC) ? { fontStyle: 'italic' as const } : {}),
        ...(decoration !== undefined ? { textDecoration: decoration } : {}),
      });
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
  const badgeIndent = geo.rows[nameRowIndex]?.badgeIndent ?? BADGE_LEFT_MARGIN + BADGE_RADIUS;
  const badgeX = geo.x + badgeIndent;
  const badgeY = geo.y + headerH / 2;
  return (
    ellipse(badgeX, badgeY, BADGE_RADIUS, BADGE_RADIUS, {
      // G2 N4: `strokeWidth` (camelCase) is not a valid SVG attribute name --
      // was silently emitting a bogus `strokeWidth="1"` attribute (invisible
      // to any real SVG renderer) instead of the intended `stroke-width="1"`,
      // a pre-existing bug from N3 diagnosed this iteration (blocked EVERY
      // badge-bearing fixture's `ellipse/@stroke-width` from matching jar).
      // G2 N26: `resolveBadgeFill` -- the badge-customization COLOR half
      // of `class Foo << (F,orange) >>` (`geo.badgeColor`) wins over the
      // kind default when present; see that function's own doc comment.
      fill: resolveBadgeFill(geo.kind, geo.badgeColor), stroke: theme.colors.border, 'stroke-width': 1,
    }) +
    // `style.value(PName.FontColor)` on the spot style signature -- black in
    // every non-monochrome theme sampled (`plans/g2-class-svg/ledger.md`
    // N3); monochrome-reverse flips this to white, a separate, smaller,
    // unfixed divergence (that theme already diverges more broadly).
    // G2 N26: `geo.badgeChar` -- the CHAR half of the same decoration,
    // see `badgeGlyphPath`/`resolveBadgeLetter`'s own doc comment for the
    // 5-known-letters limitation.
    `<path d="${badgeGlyphPath(geo.kind, badgeX, badgeY, geo.badgeChar)}" fill="#000000"/>`
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
    parts.push(line(dividerX, geo.y + top, dividerX, geo.y + bottom, { stroke: theme.colors.border }));
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
  let body = rect(geo.x, geo.y, geo.width, geo.height, {
    fill: classifierFill(geo, theme), stroke: theme.colors.border, strokeWidth: 0.5,
    rx: 2.5, ry: 2.5,
  });
  if (geo.hideCircle !== true && hasBadge(geo.kind)) body += renderBadge(geo, theme);
  const headerRowCount = geo.headerRowCount ?? 1;
  for (const row of geo.rows.slice(0, headerRowCount)) {
    if (row.text !== '') body += renderRowText(geo, row, theme);
  }
  return { url: geo.url, body };
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
  const memberRows = geo.rows.slice(geo.headerRowCount ?? 1);
  const interleaved: Array<{ y: number; item: UrlTaggedPrimitive }> = geo.dividerYs.map((divY) => ({
    y: divY,
    item: {
      url: geo.url,
      body: line(geo.x + 1, geo.y + divY, geo.x + geo.width - 1, geo.y + divY, {
        stroke: theme.colors.border, strokeWidth: 0.5,
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
    interleaved.push({
      y: row.y,
      item: {
        url: effectiveUrl,
        preWrapped: true,
        body: renderVisibilityIcon(
          row.visibilityIcon,
          row.visibilityIsField === true,
          geo.x + ROW_TEXT_LEFT_MARGIN,
          visibilityIconOriginY(geo.y + row.y, theme.fontSize),
          effectiveUrl,
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

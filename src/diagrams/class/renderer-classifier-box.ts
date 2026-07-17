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
import { rect, text, line, ellipse } from '../../core/svg.js';
import { MAP_CELL_MARGIN_X } from './class-object-map-sizing.js';
import {
  hasBadge,
  badgeFill,
  badgeGlyphPath,
  BADGE_RADIUS,
  NAME_LEFT_MARGIN,
} from './class-badge.js';
import { renderVisibilityIcon, visibilityIconOriginY } from './class-visibility-icon.js';
import { wrapClassifierBody, type UrlTaggedPrimitive } from './renderer-url.js';

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
  return (
    icon +
    text(geo.x + row.indent, geo.y + row.y, row.text, {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
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
    })
  );
}

/**
 * The kind badge in the header: a filled `<ellipse>` (radius {@link
 * BADGE_RADIUS}, upstream `SkinParam#getCircledCharacterRadius()` default)
 * plus the kind letter drawn as a real vector glyph outline (`<path>`),
 * matching `klimt/shape/CircledCharacter.java` -- never `<circle>`+`<text>`.
 *
 * Position (G2 N4, replacing the old fixed `BADGE_CENTER_X_OFFSET`):
 * `cx` is derived from `geo.rows[0]` (the header row, ALWAYS present),
 * whose own `indent` already bakes in `class-layout-helpers.ts#
 * buildHeaderRow`'s header-centering term (0 in the common,
 * header-dominated case -- reduces to the old fixed offset exactly --
 * nonzero when member content is wider than the header). Reversing that
 * row's own `indent = centerOffset + BADGE_BOX_WIDTH + NAME_LEFT_MARGIN`
 * formula for the badge's own `BADGE_LEFT_MARGIN + BADGE_RADIUS` term
 * simplifies to `indent - BADGE_RADIUS - NAME_LEFT_MARGIN` (`BADGE_BOX_WIDTH
 * - BADGE_LEFT_MARGIN - BADGE_RADIUS === BADGE_RADIUS` by construction --
 * `class-badge.ts`'s own `BADGE_BOX_WIDTH` doc comment). `cy = geo.y +
 * headerHeight / 2`, unchanged.
 */
function renderBadge(geo: ClassifierGeo, theme: Theme): string {
  const headerH = geo.dividerYs[0] ?? 28;
  const headerIndent = geo.rows[0]?.indent ?? 0;
  const badgeX = geo.x + headerIndent - BADGE_RADIUS - NAME_LEFT_MARGIN;
  const badgeY = geo.y + headerH / 2;
  return (
    ellipse(badgeX, badgeY, BADGE_RADIUS, BADGE_RADIUS, {
      // G2 N4: `strokeWidth` (camelCase) is not a valid SVG attribute name --
      // was silently emitting a bogus `strokeWidth="1"` attribute (invisible
      // to any real SVG renderer) instead of the intended `stroke-width="1"`,
      // a pre-existing bug from N3 diagnosed this iteration (blocked EVERY
      // badge-bearing fixture's `ellipse/@stroke-width` from matching jar).
      fill: badgeFill(geo.kind), stroke: theme.colors.border, 'stroke-width': 1,
    }) +
    // `style.value(PName.FontColor)` on the spot style signature -- black in
    // every non-monochrome theme sampled (`plans/g2-class-svg/ledger.md`
    // N3); monochrome-reverse flips this to white, a separate, smaller,
    // unfixed divergence (that theme already diverges more broadly).
    `<path d="${badgeGlyphPath(geo.kind, badgeX, badgeY)}" fill="#000000"/>`
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
 * Builds the header bundle (rect + badge + header name, ALWAYS drawn
 * together as one unit -- see `renderClassifierBox`'s draw-order doc
 * comment) as a single url-tagged primitive. The header never carries its
 * OWN url (only member rows can, via `[[[url]]]`) -- its effective url is
 * always the classifier's own fallback (`geo.url`, possibly `undefined`).
 */
function buildHeaderPrimitive(geo: ClassifierGeo, theme: Theme): UrlTaggedPrimitive {
  let body = rect(geo.x, geo.y, geo.width, geo.height, {
    fill: classifierFill(geo, theme), stroke: theme.colors.border, strokeWidth: 0.5,
    rx: 2.5, ry: 2.5,
  });
  if (geo.hideCircle !== true && hasBadge(geo.kind)) body += renderBadge(geo, theme);
  const [headerRow] = geo.rows;
  if (headerRow !== undefined && headerRow.text !== '') body += renderRow(geo, headerRow, theme);
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
  const [, ...memberRows] = geo.rows;
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
    if (row.text !== '') {
      interleaved.push({ y: row.y, item: { url: row.url ?? geo.url, body: renderRow(geo, row, theme) } });
    }
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

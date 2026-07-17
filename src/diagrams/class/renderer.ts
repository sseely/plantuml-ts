/**
 * Class diagram SVG renderer.
 *
 * Pure function: ClassGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type { ClassGeometry, ClassifierGeo, EdgeGeo, NamespaceGeo } from './layout.js';
import { ROW_TEXT_LEFT_MARGIN } from './layout.js';
import { renderNote, renderTipNote, renderOpaleNote } from './renderer-note.js';
import type { Theme } from '../../core/theme.js';
import type { RenderFragment } from '../../core/dispatcher.js';
import {
  rect,
  text,
  line,
  path,
  ellipse,
} from '../../core/svg.js';
import { renderUSymbolIcon } from '../../core/usymbol-shapes.js';
import { resolveColorToSvgHex } from '../../core/klimt/color/HColorSet.js';
import { MAP_CELL_MARGIN_X } from './class-object-map-sizing.js';
import { buildEdgeArrowheads, decorName } from './renderer-arrowhead.js';
import {
  looksLikeRevertedForSvg,
  looksLikeNoDecorAtAllSvg,
} from '../../core/svek/extremity/link-decor.js';
import { buildClassUidPlan } from './renderer-uid.js';
import { wrapCluster, wrapEntity, wrapLink, leafPortion } from './renderer-group.js';
import {
  hasBadge,
  badgeFill,
  badgeGlyphPath,
  BADGE_RADIUS,
  NAME_LEFT_MARGIN,
} from './class-badge.js';
import { renderVisibilityIcon, visibilityIconOriginY } from './class-visibility-icon.js';
import { ASSOC_POINT_SIZE } from './class-lollipop.js';

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

// ---------------------------------------------------------------------------
// Association-class-couple "point" entity (`(A,B) .. C`)
// ---------------------------------------------------------------------------

/**
 * `(A,B) .. C`'s tiny circle connector — G2 N8, `EntityImageAssociationPoint
 * .java#drawU`: a bare `<ellipse>` (radius {@link ASSOC_POINT_SIZE}`/2`),
 * fill AND stroke both the SAME `LineColor` value (`CopyForegroundColorTo
 * BackgroundColor`, upstream's own instruction to duplicate the foreground
 * color into the background/fill slot) — never wrapped in a `<g class=
 * "entity">`, never assigned an `id`, never preceded by a `<!--class ...-->`
 * comment (`GeneralImageBuilder`'s dispatch draws this leaf kind directly,
 * bypassing the normal per-entity wrapping every other classifier kind gets
 * — see `renderClass`'s own classifier loop, which special-cases
 * `kind === 'assoc-circle'` to call this instead of {@link wrapEntity}).
 */
function renderAssocPoint(geo: ClassifierGeo, theme: Theme): string {
  const r = ASSOC_POINT_SIZE / 2;
  return ellipse(geo.x + geo.width / 2, geo.y + geo.height / 2, r, r, {
    fill: theme.colors.arrow, stroke: theme.colors.arrow, 'stroke-width': 1,
  });
}

// ---------------------------------------------------------------------------
// Classifier box
// ---------------------------------------------------------------------------

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
function renderRow(geo: ClassifierGeo, row: ClassifierGeo['rows'][number], theme: Theme): string {
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

/** Descriptive elements (database/component/actor/usecase) draw their USymbol
 *  icon instead of the class box; usecase carries no usymbol (its kind is
 *  enough). Returns undefined when this classifier has no icon to draw (the
 *  normal box path below applies) or the icon renderer declines. Split out of
 *  renderClassifier purely to keep that function's own NLOC/CCN under cap. */
function tryRenderUSymbol(geo: ClassifierGeo, theme: Theme): string | undefined {
  const usymbol = geo.kind === 'usecase' ? 'usecase' : geo.usymbol;
  if (usymbol === undefined) return undefined;
  const display = geo.rows[0]?.text ?? geo.id;
  return renderUSymbolIcon(usymbol, { ...geo, display }, theme);
}

/** The plain name+members/rows box (every classifier kind not handled by
 *  {@link tryRenderUSymbol}). Split out of renderClassifier for the same
 *  NLOC/CCN reason. */
function renderClassifierBox(geo: ClassifierGeo, theme: Theme): string {
  const parts: string[] = [
    // `URectangle.build(...).rounded(roundCorner)` -- `PName.RoundCorner`
    // default 2.5 (`EntityImageClass.java`'s own `roundCorner` field);
    // border stroke-width 0.5, not 1 (`getStyle().getStroke(...)`,
    // jar-verified across 3+ fixtures — `plans/g2-class-svg/ledger.md` N3).
    rect(geo.x, geo.y, geo.width, geo.height, {
      fill: classifierFill(geo, theme), stroke: theme.colors.border, strokeWidth: 0.5,
      rx: 2.5, ry: 2.5,
    }),
  ];
  // Draw order matters (positional comparator): jar draws rect, THEN the
  // badge (if any), THEN the header name, THEN EVERY divider/member-row
  // INTERLEAVED in top-to-bottom visual (Y) order -- NOT all dividers as
  // one batch followed by all rows (`EntityImageClass#drawInternal` draws
  // the rect+badge via `header.drawU`, then `body.drawU` draws the fields
  // divider, fields rows, methods divider, methods rows IN THAT SEQUENCE;
  // G2 N4, jar-verified: a single-field/no-methods classifier draws
  // divider(32), row("Bar", local y 46.89), divider(54) -- the SECOND
  // divider comes AFTER the field row, not immediately after the first
  // divider -- `jobuco-44-zife032`). A plain ascending sort by each
  // element's own local Y position reproduces this generically: every
  // divider's Y is its section's TOP, every row's Y is its OWN baseline
  // (always inside its own section's [top, next-divider) range), so
  // sorting the merged (divider, row) sequence by Y alone yields the exact
  // interleaved order jar draws, without this port needing to track a
  // separate fields/methods row-count split on `ClassifierGeo`.
  if (geo.hideCircle !== true && hasBadge(geo.kind)) parts.push(renderBadge(geo, theme));
  const [headerRow, ...memberRows] = geo.rows;
  if (headerRow !== undefined && headerRow.text !== '') parts.push(renderRow(geo, headerRow, theme));
  // Divider lines are inset 1px from the rect's left/right edges (jar:
  // `x1="8"`..`x2="98.0469"` against a `x="7"`..`width="92.0469"` rect —
  // verified on 3+ fixtures, `plans/g2-class-svg/ledger.md` N3). G2 N4:
  // `strokeWidth: 0.5` added -- was omitted entirely (SVG default `1`),
  // jar's own dividers share the box's own 0.5 border stroke-width
  // (`getStyle().getStroke(...)`, same value N3 already applied to the
  // rect but never threaded to these lines -- universal, every
  // classifier's divider, `svg/g/g/line/@stroke-width` was 387/718 reach).
  const interleaved: Array<{ y: number; body: string }> = geo.dividerYs.map((divY) => ({
    y: divY,
    body: line(geo.x + 1, geo.y + divY, geo.x + geo.width - 1, geo.y + divY, {
      stroke: theme.colors.border, strokeWidth: 0.5,
    }),
  }));
  // A map's linked-row value entry carries empty text (see
  // renderMapColumnDividers doc) — upstream never draws that cell.
  for (const row of memberRows) {
    if (row.text !== '') interleaved.push({ y: row.y, body: renderRow(geo, row, theme) });
  }
  interleaved.sort((a, b) => a.y - b.y);
  for (const item of interleaved) parts.push(item.body);
  parts.push(renderMapColumnDividers(geo, theme));
  return parts.join('');
}

function renderClassifier(geo: ClassifierGeo, theme: Theme): string {
  const icon = tryRenderUSymbol(geo, theme);
  if (icon !== undefined) return icon;
  return renderClassifierBox(geo, theme);
}

// ---------------------------------------------------------------------------
// Namespace box
// ---------------------------------------------------------------------------

function renderNamespace(geo: NamespaceGeo, theme: Theme): string {
  const box = rect(geo.x, geo.y, geo.width, geo.height, {
    fill: theme.colors.graph.packageBackground,
    stroke: theme.colors.graph.packageBorder,
    strokeWidth: 1,
    strokeDasharray: '4 2',
  });
  const label = text(
    geo.x + 6,
    geo.y + theme.fontSize + 4,
    geo.label,
    {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fill: theme.colors.text,
    },
  );
  return box + label;
}

// ---------------------------------------------------------------------------
// Edge
// ---------------------------------------------------------------------------

/**
 * G2 N5: `EdgeGeo.points` is a well-formed `1 + 3*n` cubic-bezier spline
 * for every real dot-layout-driven edge (N2 ledger, verified against all
 * 718 corpus fixtures) — jar's own `DotPath` draws it as a genuine SVG
 * cubic bezier chain (`M x,y C x1,y1 x2,y2 x,y [C x1,y1 x2,y2 x,y ...]`,
 * repeating the `C` command once per 3-point group; jar-verified against
 * `ririlu-13-zipi740`/`befasi-62-vimu310`'s own multi-segment edges), NOT
 * a polyline through the control points. Falls back to straight `L`
 * segments for any point list that ISN'T `1 + 3*n` (`points.length < 4`
 * or `(points.length - 1) % 3 !== 0`) — the degenerate/hand-built 2-point
 * secant case `renderer-arrowhead.ts#segmentAngle`'s own doc comment
 * describes, which carries no bezier control-point data to draw a curve
 * from.
 */
function buildPathData(points: EdgeGeo['points']): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (first === undefined) return '';
  const start = `M${first.x},${first.y}`;

  const isBezierSpline = points.length >= 4 && (points.length - 1) % 3 === 0;
  if (isBezierSpline) {
    const segments: string[] = [];
    for (let i = 1; i < points.length; i += 3) {
      const c1 = points[i]!;
      const c2 = points[i + 1]!;
      const end = points[i + 2]!;
      segments.push(`C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`);
    }
    return [start, ...segments].join(' ');
  }

  const segments = rest.map((p) => `L${p.x},${p.y}`);
  return [start, ...segments].join(' ');
}

/**
 * G2 N1 (mechanism 2 part C): arrowheads are drawn as inline
 * polygons/paths (`renderer-arrowhead.ts#buildEdgeArrowheads`), matching
 * jar's class-diagram corpus (zero `<marker>`/`markerEnd` anywhere,
 * `plans/g2-class-svg/ledger.md` N0) -- the old `targetMarker`/
 * `sourceMarker` (`url(#...)` SVG-`<marker>`-reference) functions are
 * removed, not just unused, since `svgRoot`'s automatic `ALL_ARROW_TYPES`
 * marker-def injection no longer runs for class at all (`renderClass`
 * bypasses `svgRoot` entirely via `classShell` -- `assembleClassShell`
 * emits an empty `<defs/>`, matching jar).
 *
 * Returns `extraDefs` alongside `body` so `renderClass` can thread any
 * non-empty extremity `<defs>` payload (gradients -- see
 * `buildEdgeArrowheads`'s own doc comment) into the fragment's overall
 * `extraDefs`, the same role `svgRoot`'s `extraDefs` param used to serve.
 */
/**
 * Upstream: `Link#idCommentForSvg()` (Link.java:106-114), the `<path
 * id="...">` attribute -- a three-way branch on whether the arrowhead
 * sits at `idEntity1`'s end, `idEntity2`'s end, both, or neither. Reads
 * `EdgeGeo.idEntity1`/`.idEntity2`/`.idEntity1Decor`/`.idEntity2Decor`
 * (Java's cl1/cl2 + LinkType.decor2/decor1 -- see `ast.ts
 * #Relationship.idEntity1`'s doc comment for why these are DISTINCT from
 * `.from`/`.to`/`.sourceDecor`/`.targetDecor`, which are swapped for DOT
 * layout direction instead of `Link#getInv()`'s `-left-`/`-up-` swap).
 * Falls back to `.from`/`.to` + `.sourceDecor`/`.targetDecor` for
 * relationships built outside the arrow-token grammar (no `idEntity1`/
 * `idEntity2` -- couples/lollipop/map rows; documented best-effort, out
 * of this iteration's arrow-matrix scope). `ids` de-dupes a diagram-wide
 * collision exactly like `core/svek/SvekEdge.ts#uniq` (Link.java's own
 * `SvekEdge#uniq`, duplicated per this codebase's small-helper-per-call-
 * site convention -- see `renderer-group.ts`'s own `escAttr` precedent).
 */
// XML-attribute-value escaping for `linkIdForSvg` -- a local duplicate of
// `core/svg.ts`'s own (module-private) `escapeXml`/`renderer-group.ts`'s
// `escAttr`, per this codebase's established one-small-helper-per-call-site
// convention. `path()`'s own `attrs()` never escapes its values (every
// OTHER caller passes colors/keywords with no XML-significant chars), so a
// classifier name containing `<`/`>`/`&`/`"` (a C++ template type,
// nagega-30-poso418: `boost::function<ResultE(...)>`) needs escaping here,
// at the one call site that can carry arbitrary user text into an attribute.
// `>` deliberately NOT escaped -- jar-verified (nagega-30-poso418's own
// template-syntax id): Java's XML serializer escapes `&`/`<`/the attribute
// quote char but leaves a literal `>` in an attribute value untouched (only
// `&`/`<`/quote are STRICTLY required by the XML spec; `>` escaping is
// optional and this serializer skips it).
const ID_XML_UNSAFE_RE = new RegExp('[&<"]', 'g');
const ID_XML_REPLACEMENTS: Record<string, string> = { '&': '&amp;', '<': '&lt;', '"': '&quot;' };
function escapeIdAttr(value: string): string {
  return value.replace(ID_XML_UNSAFE_RE, (ch) => ID_XML_REPLACEMENTS[ch]!);
}

function linkIdForSvg(geo: EdgeGeo, ids: Set<string>): string {
  // G2 N9: `idEntity1`/`idEntity2` are ALREADY the nsSep-aware leaf name
  // (`class-relationship-parser.ts#idLeaf`, computed at parse time from the
  // diagram's ACTUAL `set namespaceSeparator` -- see that function's doc
  // comment for why a blind `.`-split is wrong here). The fallback
  // (`.from`/`.to`, used when no arrow-token endpoint exists -- couples/
  // lollipop/map rows) still needs `leafPortion`: those went through
  // `class-commands.ts`'s namespace-qualifying rewrite instead.
  const ent1 = escapeIdAttr(geo.idEntity1 ?? leafPortion(geo.from));
  const ent2 = escapeIdAttr(geo.idEntity2 ?? leafPortion(geo.to));
  const decorAtEnt1 = decorName(geo.idEntity1Decor ?? geo.sourceDecor);
  const decorAtEnt2 = decorName(geo.idEntity2Decor ?? geo.targetDecor);
  let base: string;
  if (looksLikeRevertedForSvg(decorAtEnt2, decorAtEnt1)) base = `${ent1}-backto-${ent2}`;
  else if (looksLikeNoDecorAtAllSvg(decorAtEnt2, decorAtEnt1)) base = `${ent1}-${ent2}`;
  else base = `${ent1}-to-${ent2}`;
  return uniqLinkId(ids, base);
}

/** Upstream: `SvekEdge#uniq` (SvekEdge.java:1093), verbatim -- same
 *  collision-suffix scheme `core/svek/SvekEdge.ts#uniq` already ports for
 *  description. */
function uniqLinkId(ids: Set<string>, base: string): string {
  if (!ids.has(base)) {
    ids.add(base);
    return base;
  }
  let i = 1;
  for (;;) {
    const candidate = `${base}-${i}`;
    if (!ids.has(candidate)) {
      ids.add(candidate);
      return candidate;
    }
    i++;
  }
}

function renderEdge(geo: EdgeGeo, theme: Theme, ids: Set<string>): { body: string; extraDefs: string } {
  const parts: string[] = [];
  const d = buildPathData(geo.points);
  if (d !== '') {
    parts.push(
      path(d, {
        // G2 N8: `strokeWidth: 1` (was `1.5`) and `strokeDasharray: '7,7'`
        // (was `'5 5'`) -- discovered while jar-verifying the `(A,B)` couple
        // fixture's own edges (bosiki-11-xaza958), then corpus-surveyed
        // (`test-results/dot-cache/class/*/in.svg`, every `<g class="link">`
        // edge's own inline `style`): 504/510 sampled edges carry
        // `stroke-width:1` (the handful of others are explicit
        // `[thickness=N]` skinparam overrides, out of scope here) and
        // 383/388 dashed edges carry `stroke-dasharray:7,7` exactly (comma,
        // no space -- `compareSvg`'s attribute comparator treats
        // `stroke-dasharray` as a plain string, not a numeric-tolerant
        // list, so the literal separator must match too). Neither value was
        // ever jar-verified before this iteration -- no ratchet-pinned
        // fixture exercises an edge at all (grepped `oracle/goldens/
        // svg-class/`).
        stroke: theme.colors.arrow, strokeWidth: 1,
        ...(geo.dashed ? { strokeDasharray: '7,7' } : {}),
        // G2 N9: `id`/`codeLine` -- see `linkIdForSvg`'s doc comment.
        id: linkIdForSvg(geo, ids),
        ...(geo.sourceLine !== undefined ? { codeLine: String(geo.sourceLine) } : {}),
      }),
    );
  }
  const arrowheads = buildEdgeArrowheads(geo, theme.colors.arrow, theme.colors.background);
  parts.push(arrowheads.tail, arrowheads.head);
  if (geo.label !== undefined) {
    parts.push(
      text(geo.label.x, geo.label.y, geo.label.text, {
        fill: theme.colors.graph.edgeLabel, fontSize: theme.fontSize - 2,
        textAnchor: 'start', dominantBaseline: 'middle',
      }),
    );
  }
  return { body: parts.join(''), extraDefs: arrowheads.extraDefs };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a class diagram geometry into an SVG string.
 *
 * G2 N1 (mechanism 2, "SVG root shell"): the background is folded into the
 * root `<svg style="...background:...;">` attribute (`renderer-
 * shell.ts#assembleClassShell`) -- `background` travels on the returned
 * fragment so the shell assembler's `style` attribute picks up the theme's
 * real color.
 *
 * G2 N4: `theme.colors.background` is the RAW skinparam value (e.g.
 * `"red"`, `resolveColor()`'s gradient-tail extraction only, never a
 * named-color-to-hex resolution -- `skinparam.ts` never runs it through
 * `HColorSet`). Every other fill/stroke in this port's SVG-emission layer
 * resolves through `klimt/color/HColorSet.ts#resolveColorToSvgHex`
 * (`paint.ts#paintToSvg`'s own doc comment: "the same table
 * `svg-graphics-core.ts` ... at `paintToSvg`") EXCEPT this one call site --
 * class draws no klimt `UGraphic` at all (pure-string renderer, see N2's
 * "class-local pure-string wrapping" design note), so nothing upstream of
 * this function ever normalizes it. Resolved once here, `canonicalBackground`
 * feeds BOTH the root style attribute AND the conditional body `<rect>`
 * below, matching `svg-graphics-core.ts#setupBackcolor`'s own single
 * resolve-once-reuse-twice shape.
 *
 * Also G2 N4: contrary to N1's own doc comment (WRONG -- diagnosed against
 * the fresh 2026-07-16 oracle re-capture, not the stale N0/N1 corpus),
 * jar's class SVGs DO draw an explicit full-canvas `<rect x="0" y="0"
 * width="W" height="H" fill="<bg>" style="stroke:none;stroke-width:1;"/>`
 * as the body `<g>`'s FIRST child -- but ONLY when the resolved background
 * is neither `#000000` nor `#FFFFFF` nor fully transparent (jar-verified
 * against 8/718 fixtures with a non-default `skinparam BackgroundColor`:
 * `bovuze-89-noja934`, `camuna-58-veca254`, `lurevi-57-reku842`,
 * `momaku-69-duxe918`, `nafiki-56-jixu680`, `nikoxo-78-dega884`,
 * `nomeza-10-laba367`, `zuramo-86-liku129` -- ALL 8 carry the rect, ALL
 * `#FFFFFF`-background fixtures in the corpus carry NONE). This is the
 * exact same exclusion list `svg-graphics-core.ts#setupBackcolor` already
 * applies for every klimt-drawn engine (`canonical !== '#00000000' &&
 * canonical !== '#000000' && canonical !== '#FFFFFF'`) -- class reproduces
 * the OBSERVABLE shape directly (pure string, no `UGraphic`/`paintBackcolor`
 * call) rather than routing through klimt, per this file's established
 * "class-local pure-string wrapping" precedent (N2).
 *
 * @param geo   - Pre-computed geometry from layoutClass().
 * @param theme - Visual theme.
 * @returns     RenderFragment carrying `classShell: true` (routes through
 *              `assembleClassShell`, never the generic `svgRoot`).
 */
export function renderClass(geo: ClassGeometry, theme: Theme): RenderFragment {
  const canonicalBackground = resolveColorToSvgHex(theme.colors.background);
  const children: string[] = [];
  let extraDefs = '';

  // G2 N4: full-canvas background rect, ONLY for a non-default (non-black,
  // non-white, non-transparent) background -- see this function's own doc
  // comment for the jar-verified exclusion list and evidence.
  if (
    canonicalBackground !== '#00000000' &&
    canonicalBackground !== '#000000' &&
    canonicalBackground !== '#FFFFFF'
  ) {
    children.push(
      // jar: `style="stroke:none;stroke-width:1;"` -- BOTH declarations
      // present even though `stroke:none` makes the width invisible
      // (G2 N4: `strokeWidth: 1` was omitted, `stroke-width` attribute
      // absent entirely -- verified against `bovuze-89-noja934`).
      rect(0, 0, geo.totalWidth, geo.totalHeight, {
        fill: canonicalBackground,
        stroke: 'none',
        strokeWidth: 1,
      }),
    );
  }
  // G2 N2 (mechanism 3): every drawn element gets an `ent%04d`/`lnk%d`
  // uid + `<g class="entity"/"cluster"/"link">` wrapper -- see
  // `renderer-uid.ts#buildClassUidPlan`/`renderer-group.ts`'s own doc
  // comments for the scheme and its exact/fallback gate.
  const uidPlan = buildClassUidPlan(geo);

  // 1. Namespace boxes (behind classifiers)
  for (const ns of geo.namespaces) {
    const uid = uidPlan.namespaceUid.get(ns.id) ?? '';
    children.push(wrapCluster(ns.label, uid, ns.id, renderNamespace(ns, theme)));
  }

  // 2. Classifier boxes — a `hide <entity|$tag|...>` match (G2 N7,
  // `layout.ts#buildClassifierGeos`'s own doc comment on `ClassifierGeo
  // .hidden`) suppresses ALL drawn content: no `<g class="entity">` at all,
  // matching jar (`net/atmp/CucaDiagram.java#isHidden` -> `SvekResult`'s
  // `UHidden` wrap). Layout/uid numbering already ran as if it were visible,
  // so simply skipping the push here is enough — no renumbering needed.
  const hiddenClassifierIds = new Set(
    geo.classifiers.filter((c) => c.hidden === true).map((c) => c.id),
  );
  for (const classifier of geo.classifiers) {
    if (classifier.hidden === true) continue;
    // G2 N8: an association-class-couple "point" entity draws unwrapped --
    // no `<g class="entity">`, no id, no comment -- see `renderAssocPoint`'s
    // own doc comment.
    if (classifier.kind === 'assoc-circle') {
      children.push(renderAssocPoint(classifier, theme));
      continue;
    }
    const uid = uidPlan.classifierUid.get(classifier.id) ?? '';
    children.push(wrapEntity(leafPortion(classifier.id), uid, classifier.id, true, renderClassifier(classifier, theme)));
  }

  // 3. Edges — `Link#isHidden` ORs its own flag with EITHER endpoint's
  // `isHidden()` (`abel/Link.java:459`): an edge touching a hidden
  // classifier is suppressed too, even though the classifier itself may not
  // be an edge endpoint's "hide" target (jar-verified: `lafama-65-zoci799`'s
  // `Foo2 *-- Foo3` disappears entirely once `Foo3` is hidden).
  // G2 N9: shared, diagram-wide id-collision set -- `Link#idCommentForSvg`'s
  // `-1`/`-2` suffix scheme (`linkIdForSvg`/`uniqLinkId`), one Set for every
  // edge in the diagram (matches `core/svek/SvekEdge.ts#setSharedIds`'s own
  // per-diagram scope).
  const linkIds = new Set<string>();
  geo.edges.forEach((edge, i) => {
    if (hiddenClassifierIds.has(edge.from) || hiddenClassifierIds.has(edge.to)) return;
    const rendered = renderEdge(edge, theme, linkIds);
    extraDefs += rendered.extraDefs;
    children.push(
      wrapLink(
        {
          from: edge.from,
          to: edge.to,
          uid: uidPlan.edgeUid[i] ?? '',
          fromUid: uidPlan.resolveEntityUid(edge.from),
          toUid: uidPlan.resolveEntityUid(edge.to),
          decor1: decorName(edge.targetDecor),
          decor2: decorName(edge.sourceDecor),
        },
        rendered.body,
      ),
    );
  });

  // 4. Notes (folded boxes + dashed connectors), drawn on top. Upstream
  // never comments a note's group (`EntityImageNote.java` -- see
  // `renderer-group.ts#wrapEntity`'s own doc comment).
  // G2/N13: a DROPPED member-tip note (unresolved `::member`) draws
  // NOTHING at all (`EntityImageTips#drawU`'s early return); a RESOLVED
  // member-tip note draws UNWRAPPED via the Opale zigzag mechanism, no
  // `<g class="entity">` (mirrors `renderAssocPoint`'s identical unwrapped
  // precedent) -- every other note kind keeps the normal wrapped fold box.
  for (const note of geo.notes) {
    if (note.dropped === true) continue;
    if (note.tip !== undefined) {
      children.push(renderTipNote(note, theme));
      continue;
    }
    const uid = uidPlan.noteUid.get(note.id) ?? '';
    // G2/N14: a resolved general-opalisable note draws the SAME merged
    // zigzag outline as a member-tip, but WRAPPED (unlike renderTipNote) --
    // see renderer-note.ts#renderOpaleNote's own doc comment.
    const inner = note.opale !== undefined ? renderOpaleNote(note, theme) : renderNote(note, theme);
    children.push(wrapEntity(note.id, uid, note.id, false, inner));
  }

  return {
    body: children.join(''),
    width: geo.totalWidth,
    height: geo.totalHeight,
    background: canonicalBackground,
    ...(extraDefs.length > 0 ? { extraDefs } : {}),
    classShell: true,
  };
}

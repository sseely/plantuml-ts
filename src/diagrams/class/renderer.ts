/**
 * Class diagram SVG renderer.
 *
 * Pure function: ClassGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type { ClassGeometry, ClassifierGeo, EdgeGeo, NamespaceGeo } from './layout.js';
import { renderNote, renderTipNote, renderOpaleNote } from './renderer-note.js';
import type { NoteGeo } from './note-layout.js';
import type { Theme } from '../../core/theme.js';
import type { RenderFragment } from '../../core/dispatcher.js';
import {
  text,
  path,
  ellipse,
} from '../../core/svg.js';
import { renderUSymbolIcon } from '../../core/usymbol-shapes.js';
import { resolveColorToSvgHex } from '../../core/klimt/color/HColorSet.js';
import { applyMonochromeHex, applyMonochromeToFragment } from './class-monochrome.js';
import { buildEdgeArrowheads, decorName, applyDecorTrim } from './renderer-arrowhead.js';
import {
  looksLikeRevertedForSvg,
  looksLikeNoDecorAtAllSvg,
} from '../../core/svek/extremity/link-decor.js';
import { buildClassUidPlan, type ClassUidPlan } from './renderer-uid.js';
import { wrapCluster, wrapEntity, wrapLink, leafPortion } from './renderer-group.js';
import { ASSOC_POINT_SIZE, LOLLIPOP_SIZE } from './class-lollipop.js';
import { renderClassifierBox, renderRow } from './renderer-classifier-box.js';
import { renderNamespaceFolder, renderNamespaceRect, renderEmptyPackageIcon } from './class-namespace-shape.js';
import { CARDINALITY_FONT_SIZE } from './class-layout-helpers.js';

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

/**
 * `Name ()-- Existing` interface lollipop -- G2 N8 established the DOT
 * sizing (`class-dot-graph.ts#buildOneDotNode`'s fixed {@link LOLLIPOP_SIZE}
 * node); G2 N20 lands the render half (`EntityImageLollipopInterface
 * .java:94-133`). UNLIKE {@link renderAssocPoint} above, jar DOES wrap the
 * circle in a real `<g class="entity" id="ent%04d">` (no `<!--class ...-->`
 * comment though -- `drawU` never calls `ug.draw(new UComment(...))`,
 * matching `wrapEntity`'s own `withComment=false` path) -- but the
 * display-label `<text>` is drawn AFTER `closeGroup()`, entirely OUTSIDE
 * that group, as a plain sibling (see `measureLollipop`'s own doc comment
 * in `class-layout-helpers.ts` for the byte-verified position formula).
 * `renderClass`'s classifier loop pushes the two pieces as separate
 * `children[]` entries to reproduce this exact sibling (not nested)
 * structure.
 *
 * The required-interface "half circle" socket shape (`LeafType
 * .LOLLIPOP_HALF`, `classifier.lollipopKind === 'half'`) needs the
 * connecting edge's own impact angle (`EntityImageLollipopInterface
 * #addImpact`, `UEllipse(SIZE, SIZE, angle - 90, 180)` -- an open 180deg
 * arc oriented away from the edge) -- ZERO reach across the entire
 * 708-fixture class corpus (grepped every `((--`/`--((`/`))--`/`--))`
 * spelling), so this draws the SAME full ellipse for both kinds rather
 * than adding unverified arc math; named divergence,
 * `plans/g2-class-svg/ledger.md` N20.
 */
function renderLollipop(geo: ClassifierGeo, theme: Theme): { circle: string; label: string } {
  const r = LOLLIPOP_SIZE / 2;
  const circle = ellipse(geo.x + geo.width / 2, geo.y + geo.height / 2, r, r, {
    fill: theme.colors.graph.classBackground, stroke: theme.colors.border, 'stroke-width': 1.5,
  });
  const label = geo.rows[0] !== undefined ? renderRow(geo, geo.rows[0], theme) : '';
  return { circle, label };
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


function renderClassifier(geo: ClassifierGeo, theme: Theme): string {
  const icon = tryRenderUSymbol(geo, theme);
  if (icon !== undefined) return icon;
  return renderClassifierBox(geo, theme);
}

// ---------------------------------------------------------------------------
// Namespace box
// ---------------------------------------------------------------------------

/** G2 N17: the folder-tab outline (`USymbolFolder`'s tab-notch shape) --
 *  was a plain dashed rect, the single largest named G2 mechanism
 *  (104/718 fixtures). See `class-namespace-shape.ts` for the ported
 *  geometry + jar evidence. G2 N59: `skinparam packageStyle rect` selects
 *  the plain-`<rect>` `PackageStyle.RECTANGLE` variant instead -- see
 *  `renderNamespaceRect`'s own doc comment. */
function renderNamespace(geo: NamespaceGeo, theme: Theme): string {
  return theme.packageStyle === 'rect' ? renderNamespaceRect(geo, theme) : renderNamespaceFolder(geo, theme);
}

/**
 * G2 N33: a collapsed-empty `package`/`namespace` leaf (`ClassifierGeo
 * .folderTab` present, `class-magma.ts#isCollapsedGroup`'s doc comment)
 * draws its OWN small `EntityImageEmptyPackage` folder-tab icon -- the
 * SAME `renderNamespaceFolder`/`USymbolFolder#asBig` shape a non-empty
 * package's CLUSTER wrapper uses, just sized by
 * `measureEmptyPackageLeafDim`'s smaller formula instead of the cluster's
 * own content-driven dimension. Reuses `renderNamespaceFolder` by
 * constructing a `NamespaceGeo`-shaped view over the classifier's own
 * (DOT-driven) `x`/`y`/`width`/`height` plus the pre-computed `folderTab`
 * fields -- `id`/`creationIndex` are irrelevant to rendering (unused by
 * `renderNamespaceFolder`) so are filled with placeholders.
 */
function renderEmptyPackageLeaf(geo: ClassifierGeo, theme: Theme): string {
  const folderTab = geo.folderTab;
  if (folderTab === undefined) return '';
  const label = geo.rows[0]?.text ?? geo.id;
  const nsGeo: NamespaceGeo = {
    id: geo.id, x: geo.x, y: geo.y, width: geo.width, height: geo.height, label,
    wtitle: folderTab.wtitle, htitle: folderTab.htitle, baselineOffset: folderTab.baselineOffset,
  };
  return renderEmptyPackageIcon(nsGeo, theme);
}

/**
 * G2 N52: one note's own draw output -- extracted so both the interleaved
 * (hosted, step 2) and trailing (unhosted, step 4) call sites in
 * `renderClass` share IDENTICAL per-note logic; only WHERE the returned
 * array is spliced into `children` differs between the two call sites.
 * `NoteGeo`'s own doc comments (`note-layout.ts`) cover the tip/opale/
 * plain shape choice this mirrors unchanged from the pre-N52 single loop.
 */
function renderOneNote(note: NoteGeo, uidPlan: ClassUidPlan, theme: Theme): string[] {
  if (note.dropped === true) return [];
  if (note.tip !== undefined) return [renderTipNote(note, theme)];
  const uid = uidPlan.noteUid.get(note.id) ?? '';
  const inner = note.opale !== undefined ? renderOpaleNote(note, theme) : renderNote(note, theme);
  return [wrapEntity(note.id, uid, note.id, false, inner)];
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

function linkIdForSvg(geo: EdgeGeo, ids: Set<string>, syntheticNames: ReadonlyMap<string, string>): string {
  // G2 N9: `idEntity1`/`idEntity2` are ALREADY the nsSep-aware leaf name
  // (`class-relationship-parser.ts#idLeaf`, computed at parse time from the
  // diagram's ACTUAL `set namespaceSeparator` -- see that function's doc
  // comment for why a blind `.`-split is wrong here). The fallback
  // (`.from`/`.to`, used when no arrow-token endpoint exists -- couples/
  // lollipop/map rows) needs `syntheticNames` FIRST (G2 N19: the jar
  // `Entity.getName()` value for an assoc-circle/lollipop endpoint --
  // `"apointN"`/`"<existing>lolN"`, NOT the raw AST id `leafPortion` would
  // otherwise return), falling back further to `leafPortion` for every
  // other (real, user-declared) endpoint.
  const ent1 = escapeIdAttr(geo.idEntity1 ?? syntheticNames.get(geo.from) ?? leafPortion(geo.from));
  const ent2 = escapeIdAttr(geo.idEntity2 ?? syntheticNames.get(geo.to) ?? leafPortion(geo.to));
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

function renderEdge(
  geo: EdgeGeo,
  theme: Theme,
  ids: Set<string>,
  syntheticNames: ReadonlyMap<string, string>,
): { body: string; extraDefs: string } {
  const parts: string[] = [];
  // G2 N28: arrowheads must be resolved BEFORE the path is built -- the
  // connecting `<path>` is shortened by each decor's own trim delta
  // (`renderer-arrowhead.ts#applyDecorTrim`), matching `SvekEdge#drawU`'s
  // own trim-then-draw order (`dotPath.moveStartPoint`/`.moveEndPoint`
  // BEFORE `lined.draw(this.dotPath)` -- `SvekEdge.ts:178-200,279`).
  // G2 N31: the extremity's own stroke color must match the connecting
  // path's -- `geo.colorOverride` (`-[#color]->`, N26) was only ever
  // applied to the `<path>` itself; resolve it ONCE here so both the path
  // AND `buildEdgeArrowheads` (below) draw the SAME color, matching
  // `SvekEdge.ts#drawU`'s single `this.input.color` field feeding both
  // `lined.draw(this.dotPath)` and `drawExtremity`.
  // G2 N36: `theme.colors.graph.classCascadeArrowColor` -- the `<style>
  // classDiagram { LineColor }`/`root { LineColor }`/nested `classDiagram
  // { arrow { LineColor } } }` ancestor cascade (`SvekEdge.java:819`'s
  // `{root,element,classDiagram,arrow}` style signature, jar-verified
  // `bikuka-40-pezi068`/`rakici-44-tivo701`) -- sits BELOW the per-edge
  // `-[#color]->` bracket override, ABOVE the cross-diagram-type
  // `theme.colors.arrow` default (never overwritten directly -- this Theme
  // shape is shared with description/other diagram types).
  const strokeColor = geo.colorOverride !== undefined
    ? resolveColorToSvgHex(geo.colorOverride)
    : theme.colors.graph.classCascadeArrowColor ?? theme.colors.arrow;
  const arrowheads = buildEdgeArrowheads(geo, strokeColor, theme.colors.background);
  const trimmedPoints = applyDecorTrim(geo.points, arrowheads.tailTrim, arrowheads.headTrim);
  const d = buildPathData(trimmedPoints);
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
        //
        // G2 N26: `geo.strokeWidth`/`.strokeDasharray`/`.colorOverride` --
        // set ONLY when the relationship carried a `-[...]->` bracket
        // override (`class-geo-builders.ts#buildStrokeOverride`); absent
        // for every other edge, so the `?? 1`/`geo.dashed` fallbacks below
        // reproduce this comment's own jar-verified defaults unchanged.
        stroke: strokeColor,
        strokeWidth: geo.strokeWidth ?? 1,
        ...(geo.strokeDasharray !== undefined
          ? { strokeDasharray: `${geo.strokeDasharray[0]},${geo.strokeDasharray[1]}` }
          : geo.dashed ? { strokeDasharray: '7,7' } : {}),
        // G2 N9: `id`/`codeLine` -- see `linkIdForSvg`'s doc comment.
        id: linkIdForSvg(geo, ids, syntheticNames),
        ...(geo.sourceLine !== undefined ? { codeLine: String(geo.sourceLine) } : {}),
      }),
    );
  }
  parts.push(arrowheads.tail, arrowheads.head);
  // G2 item 44: the magic-arrow glyph -- a small filled triangle, jar's
  // `TextBlockArrow2#drawU` (klimt/shape/TextBlockArrow2.java:63-77).
  // `fill`/`stroke` are ALWAYS `#000000` (the cardinality/label font's own
  // color, `FontConfiguration#getColor()` -- NOT the edge's own
  // `strokeColor`, unlike the main arrowhead polygons above), jar-verified
  // against `lojepe-37-liri985`'s golden `<polygon>`. Drawn as separate
  // presentation attributes (not one `style="..."` string like jar's own
  // klimt-pipeline output) -- semantically identical post-normalization
  // (`tests/oracle/svg-conformance/normalize.ts` expands `style` into
  // individual attributes before comparing), so the format difference
  // costs nothing.
  if (geo.arrowGlyph !== undefined) {
    const [p0, p1, p2] = geo.arrowGlyph.points;
    if (p0 !== undefined && p1 !== undefined && p2 !== undefined) {
      const pts = `${p0.x},${p0.y},${p1.x},${p1.y},${p2.x},${p2.y},${p0.x},${p0.y}`;
      parts.push(
        `<polygon points="${pts}" fill="#000000" stroke="#000000" ` +
        'stroke-width="1" stroke-linejoin="miter" stroke-miterlimit="10"/>',
      );
    }
  }
  // G2/N25 (tailLabel/headLabel) + G2/N62 (label): a relationship's plain
  // text label AND its tail/head multiplicity-role labels all share ONE
  // jar-verified byte-exact attribute set (`kipure-14-suli112`/`dokego-92-
  // zilu832` `in.svg` for tail/head; `siteza-47-lixe343` for a plain
  // label -- see `class-geo-builders.ts#attachEdgeLabel`'s doc comment):
  // `fill="#000000"`, `font-size="13"`, `lengthAdjust="spacing"` +
  // `textLength`, `font-family="sans-serif"`, NO `text-anchor` (SVG default
  // "start" -- see `renderer-classifier-box.ts#renderRowText`'s identical
  // omission for the same reason). Both draw from `plantuml.skin`'s SAME
  // `arrow { FontSize 13 }` block (`GraphvizImageBuilder.java:235-238`).
  // G2 item 43: `geo.labelLines` (multi-line `label`) draws one `<text>`
  // per line with the SAME jar-verified attribute set as the single-line
  // `portLabel` loop below -- mutually exclusive with `geo.label`
  // (`class-geo-builders.ts#attachEdgeLabel` sets exactly one of the two).
  for (const line of geo.labelLines ?? []) {
    parts.push(
      text(line.x, line.y, line.text, {
        fill: '#000000', fontSize: CARDINALITY_FONT_SIZE, fontFamily: theme.fontFamily,
        lengthAdjust: 'spacing', textLength: line.width,
      }),
    );
  }
  for (const portLabel of [geo.label, geo.tailLabel, geo.headLabel]) {
    if (portLabel === undefined) continue;
    parts.push(
      text(portLabel.x, portLabel.y, portLabel.text, {
        fill: '#000000', fontSize: CARDINALITY_FONT_SIZE, fontFamily: theme.fontFamily,
        lengthAdjust: 'spacing', textLength: portLabel.width,
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
  // G2 N61: `skinparam monochrome true|reverse` applies to the document
  // background too (jar's `ColorMapper` is universal, not scoped to
  // entity/link colors) -- transformed HERE so every downstream reader of
  // `canonicalBackground` (the returned `background` field, the
  // `documentBackgroundRect` derivation below) sees the already-mapped
  // value, matching `class-monochrome.ts`'s own "single choke point"
  // design (see that file's header doc comment).
  const resolvedBackground = resolveColorToSvgHex(theme.colors.background);
  const canonicalBackground =
    theme.monochrome !== undefined
      ? applyMonochromeHex(resolvedBackground, theme.monochrome)
      : resolvedBackground;
  const children: string[] = [];
  let extraDefs = '';

  // G2 N40: `skinparam pathHoverColor <color>` -- a global CSS hover rule,
  // the SAME `<style type="text/css"><![CDATA[path:hover{...}]]></style>`
  // shape `core/klimt/drawing/svg/svg-graphics-core.ts#getPathHover`
  // already ports as shared (but unwired) machinery -- class's own
  // string-based `<defs>` assembly (this file's established "class-local
  // pure-string wrapping" precedent, N2) reproduces it directly rather
  // than routing through klimt. Jar-verified `dasagu-52-vani172`.
  if (theme.colors.graph.pathHoverColor !== undefined) {
    const resolvedHoverHex = resolveColorToSvgHex(theme.colors.graph.pathHoverColor);
    const hoverHex =
      theme.monochrome !== undefined
        ? applyMonochromeHex(resolvedHoverHex, theme.monochrome)
        : resolvedHoverHex;
    extraDefs += `<style type="text/css"><![CDATA[path:hover { stroke: ${hoverHex} !important;}]]></style>`;
  }

  // G2 N4/N48: full-canvas background rect, ONLY for a non-default
  // (non-black, non-white, non-transparent) background -- see this
  // function's own doc comment for the jar-verified exclusion list and
  // evidence. N48: NOT drawn into `children` here any more -- jar's rect
  // spans the FINAL (post-chrome, post-document-margin) canvas and is the
  // outer `<g>`'s FIRST child even when a title/header/footer/legend/
  // caption sits ABOVE the diagram body (jar-verified `xalaco-64-vuzu312`:
  // `<rect x="0" y="0" width="81" height="213".../>` precedes `<g
  // class="title">`) -- this function only knows the PRE-chrome body
  // dims, so it can no longer draw the rect itself. Threaded instead as
  // `documentBackgroundRect` on the fragment; `renderer-shell.ts
  // #assembleClassShell` (which runs AFTER chrome/margin) draws it at the
  // correct final size and position. A no-title fixture's `width`/`height`
  // already equal the final canvas at that point too (chrome is a no-op
  // there), so this is a strict behavior-preserving move for every
  // already-passing non-title fixture (jar-verified unchanged:
  // `bovuze-89-noja934`).
  const documentBackgroundRect =
    canonicalBackground !== '#00000000' &&
    canonicalBackground !== '#000000' &&
    canonicalBackground !== '#FFFFFF'
      ? canonicalBackground
      : undefined;
  // G2 N2 (mechanism 3): every drawn element gets an `ent%04d`/`lnk%d`
  // uid + `<g class="entity"/"cluster"/"link">` wrapper -- see
  // `renderer-uid.ts#buildClassUidPlan`/`renderer-group.ts`'s own doc
  // comments for the scheme and its exact/fallback gate.
  const uidPlan = buildClassUidPlan(geo);

  // G2 N52: notes hosted on a classifier (`NoteGeo.hostId`'s own doc
  // comment) draw immediately after that classifier, INTERLEAVED with the
  // classifier loop below -- not in the separate trailing notes pass (step
  // 4) that pass now only handles unhosted notes (freestanding, or an
  // unresolved `of` target). Matches jar: every classifier/note is a graph
  // NODE, drawn in real creation order, strictly BEFORE every edge; this
  // port's classifier array order already matches jar's node order (every
  // already-zero-diff multi-classifier fixture depends on that), so
  // grouping each note under its host classifier reproduces the same
  // sequence without needing a full creation-order re-sort.
  const notesByHost = new Map<string, ClassGeometry['notes']>();
  const hostedNoteIds = new Set<string>();
  for (const note of geo.notes) {
    if (note.hostId === undefined) continue;
    const bucket = notesByHost.get(note.hostId) ?? [];
    bucket.push(note);
    notesByHost.set(note.hostId, bucket);
    hostedNoteIds.add(note.id);
  }
  const renderHostedNotes = (classifierId: string): void => {
    for (const note of notesByHost.get(classifierId) ?? []) {
      children.push(...renderOneNote(note, uidPlan, theme));
    }
  };

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
      renderHostedNotes(classifier.id);
      continue;
    }
    // G2 N33: a collapsed-empty package/namespace draws its folder-tab icon
    // UNWRAPPED -- no `<g class="entity">`, no id, no `<!--class ...-->`
    // comment (jar-verified `gatula-10-bifu561`: `package foo {}`/
    // `namespace bar {}` emit bare `<path>`/`<line>`/`<text>` siblings,
    // identical to `renderAssocPoint`'s own established unwrapped
    // precedent above) -- see `renderEmptyPackageLeaf`'s doc comment.
    if (classifier.folderTab !== undefined) {
      children.push(renderEmptyPackageLeaf(classifier, theme));
      renderHostedNotes(classifier.id);
      continue;
    }
    // G2 N20: the lollipop circle DOES get a normal `<g class="entity">`
    // wrap (unlike assoc-circle above) but the label `<text>` is a plain,
    // unwrapped sibling -- see `renderLollipop`'s own doc comment.
    if (classifier.kind === 'lollipop') {
      const lollipopUid = uidPlan.classifierUid.get(classifier.id) ?? '';
      const { circle, label } = renderLollipop(classifier, theme);
      children.push(wrapEntity(leafPortion(classifier.id), lollipopUid, classifier.id, false, circle));
      if (label !== '') children.push(label);
      renderHostedNotes(classifier.id);
      continue;
    }
    const uid = uidPlan.classifierUid.get(classifier.id) ?? '';
    children.push(wrapEntity(leafPortion(classifier.id), uid, classifier.id, true, renderClassifier(classifier, theme)));
    renderHostedNotes(classifier.id);
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
  // G2 N19: `Classifier.id` (`__assocN`/`__lolN`) -> jar's real
  // `Entity.getName()` for an assoc-circle/lollipop endpoint -- see
  // `linkIdForSvg`'s doc comment.
  const syntheticNames = new Map<string, string>();
  for (const classifier of geo.classifiers) {
    if (classifier.syntheticIdName !== undefined) {
      syntheticNames.set(classifier.id, classifier.syntheticIdName);
    }
  }
  const linkIds = new Set<string>();
  geo.edges.forEach((edge, i) => {
    // G2/N16 Kind B: a freestanding note's connector, consumed by the
    // note's own Opale outline -- see `EdgeGeo.consumedByOpaleNote`'s doc
    // comment for why this edge stays IN `geo.edges` (uid numbering) but
    // must never draw its own `<g class="link">`.
    if (edge.consumedByOpaleNote === true) return;
    if (hiddenClassifierIds.has(edge.from) || hiddenClassifierIds.has(edge.to)) return;
    const rendered = renderEdge(edge, theme, linkIds, syntheticNames);
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

  // 4. Remaining notes (folded boxes + dashed connectors) -- only those
  // with NO resolved host (freestanding, or an `of` target that didn't
  // resolve to a drawn classifier): every HOSTED note already drew in step
  // 2, immediately after its host classifier (`renderHostedNotes` above --
  // see `NoteGeo.hostId`'s own doc comment for why).
  for (const note of geo.notes) {
    if (hostedNoteIds.has(note.id)) continue;
    children.push(...renderOneNote(note, uidPlan, theme));
  }

  return {
    // G2 N61: the single monochrome choke point -- see `class-monochrome.ts`'s
    // own header doc comment for why a post-processing pass over the WHOLE
    // assembled fragment (rather than threading `theme.monochrome` through
    // every individual color-resolution call site) is the correct, low-risk
    // mirror of jar's real universal `ColorMapper` semantics. No-op when
    // `theme.monochrome` is `undefined` (every fixture that doesn't set this
    // skinparam is byte-identical to pre-N61 output).
    body: applyMonochromeToFragment(children.join(''), theme.monochrome),
    width: geo.totalWidth,
    height: geo.totalHeight,
    background: canonicalBackground,
    ...(extraDefs.length > 0 ? { extraDefs } : {}),
    // G2 N46: pre-margin/pre-quirk ink dims, present only when
    // `assembleShiftedGeometry` computed them (`ClassGeometry.rawWidth`'s
    // own doc comment) -- `core/annotations/chrome.ts#applyChrome` uses
    // these (not `width`/`height` above) as the chrome-composition
    // "original" size, and `index.ts#applyAnnotationChrome`'s class branch
    // re-applies the document margin/quirk to chrome's own output.
    ...(geo.rawWidth !== undefined && geo.rawHeight !== undefined
      ? { preChromeWidth: geo.rawWidth, preChromeHeight: geo.rawHeight }
      : {}),
    // G2 N48: see this function's own doc comment above -- drawn by
    // `assembleClassShell` at the FINAL (post-chrome) canvas size, not
    // here.
    ...(documentBackgroundRect !== undefined ? { documentBackgroundRect } : {}),
    // G2 N66: `skinparam diagramBorderColor` -- resolved to an SVG-ready
    // hex HERE (mirrors `canonicalBackground`'s own resolution), drawn by
    // `assembleClassShell` (`RenderFragment.diagramBorderColor`'s own doc
    // comment for the chrome-scope guard).
    ...(theme.colors.graph.diagramBorderColor !== undefined
      ? { diagramBorderColor: resolveColorToSvgHex(theme.colors.graph.diagramBorderColor) }
      : {}),
    classShell: true,
  };
}

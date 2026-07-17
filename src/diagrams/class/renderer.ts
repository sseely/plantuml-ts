/**
 * Class diagram SVG renderer.
 *
 * Pure function: ClassGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type { ClassGeometry, ClassifierGeo, EdgeGeo, NamespaceGeo } from './layout.js';
import { renderNote, renderTipNote, renderOpaleNote } from './renderer-note.js';
import type { Theme } from '../../core/theme.js';
import type { RenderFragment } from '../../core/dispatcher.js';
import {
  rect,
  text,
  path,
  ellipse,
} from '../../core/svg.js';
import { renderUSymbolIcon } from '../../core/usymbol-shapes.js';
import { resolveColorToSvgHex } from '../../core/klimt/color/HColorSet.js';
import { buildEdgeArrowheads, decorName } from './renderer-arrowhead.js';
import {
  looksLikeRevertedForSvg,
  looksLikeNoDecorAtAllSvg,
} from '../../core/svek/extremity/link-decor.js';
import { buildClassUidPlan } from './renderer-uid.js';
import { wrapCluster, wrapEntity, wrapLink, leafPortion } from './renderer-group.js';
import { ASSOC_POINT_SIZE } from './class-lollipop.js';
import { renderClassifierBox } from './renderer-classifier-box.js';
import { renderNamespaceFolder } from './class-namespace-shape.js';

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
 *  geometry + jar evidence. */
function renderNamespace(geo: NamespaceGeo, theme: Theme): string {
  return renderNamespaceFolder(geo, theme);
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
    // G2/N16 Kind B: a freestanding note's connector, consumed by the
    // note's own Opale outline -- see `EdgeGeo.consumedByOpaleNote`'s doc
    // comment for why this edge stays IN `geo.edges` (uid numbering) but
    // must never draw its own `<g class="link">`.
    if (edge.consumedByOpaleNote === true) return;
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

/**
 * renderer.ts — T17: klimt-backed public entry point for the description
 * (component/use-case/deployment) diagram engine. Replaces the pre-T17
 * `core/svg.ts`-based renderer (which delegated node drawing to the
 * now-deleted `renderer-helpers.ts`) with a real `UGraphicSvg` document,
 * assembled from the T10-T16 klimt/svek port: `renderer-uid.ts` (uid
 * assignment), `renderer-cluster.ts` (container chrome via `Cluster`),
 * `renderer-entity.ts` (leaf chrome via `EntityImageDescription`), and
 * `renderer-edge.ts` (edges via `SvekEdge`).
 *
 * Draw order mirrors upstream `SvekResult#drawU`
 * (svek/SvekResult.java:70-107) exactly: every cluster first
 * (`Bibliotekon#allCluster()`, creation/declaration order — see
 * `renderer-uid.ts`'s doc comment for why a pre-order tree walk
 * reproduces that order), then every leaf node (`allNodes()`), then every
 * edge (`allLines()`). A cluster's own `drawU` resolves its absolute
 * position internally (`renderer-cluster.ts`); a leaf entity is drawn
 * translated to its absolute position by this module, matching
 * `SvekResult#drawU`'s own `image.drawU(ug2.apply(new UTranslate(minX,
 * minY)))` call for `SvekNode`s (`renderer-entity.ts`).
 *
 * SVG document preamble (`SvgOption`) mirrors upstream's
 * `TextBlockExporter#createUGraphicSVG` (net/sourceforge/plantuml/core/
 * TextBlockExporter.java:281-308): `minDim` = the diagram's own computed
 * image dimension — `SvekResult#calculateDimension` + the `CucaDiagram`
 * outer margin (G0/T3, `renderer-ink-extent.ts#computeDocumentDims`; NOT
 * `geo.totalWidth`/`totalHeight` as of this task — see that module's own
 * doc comment for the full recipe and the F4 defect it fixes). Upstream's
 * `SvgGraphics` derives the FINAL emitted width/height from the union of
 * every drawn shape's own extent via `ensureVisible`, not from `minDim`
 * directly; `minDim` is a floor that, for the description engine's
 * typical content, is the binding constraint (verified: real drawn ink
 * for the F4 fixtures falls well short of `minDim`, so `minDim` — not
 * per-shape `ensureVisible` growth — determines the final document size).
 * `backcolor` = the diagram's resolved background paint, and
 * `rootAttributes` carries `data-diagram-type` = `diagramType.name()`
 * (`DiagramType.DESCRIPTION` — verified against `DiagramType.java:45`;
 * matches every description-diagram jar fixture, e.g.
 * `test-results/dot-cache/component/sacuso-94-gugi476/in.svg`'s
 * `data-diagram-type="DESCRIPTION"`). `version` is `'$version$'` (D4′,
 * `svg-graphics-core.ts`'s own doc comment) — every cached jar fixture
 * carries this literal placeholder token, not a real version string.
 *
 * `driverBounderFor` (T17 write-set expansion, journaled; generalized to a
 * factory by this task's own dual-measurer mission): wires `UGraphicSvg`'s
 * `DriverTextSvg`-scoped `StringBounder` seam (`driver-text-svg.ts`,
 * width-only) to whichever `StringMeasurer` this render call was given, so
 * the `<text>` `textLength` attribute agrees with the same measurer that
 * already sized every entity/cluster during layout
 * (`src/index.ts`'s `resolveMeasurer`) — an un-wired mismatch would
 * silently desync draw-time text width from layout-time text width.
 * Local adapter, not a new shared module: every other klimt conformance
 * test (`entity-image-description.test.ts`, `symbols-component.test.ts`)
 * independently defines the identical shape for the identical reason.
 *
 * `measurer` param (this task — dual-measurer conformance/ratchet seam,
 * decision-journal 2026-07-10 "DUAL MEASURER"): defaults to `jarMeasurer`
 * so the public plugin path (`descriptionPlugin.render`,
 * `src/index.ts#renderSync`) is byte-for-byte unchanged — neither calls
 * `renderDescription` with a 3rd argument. The conformance/ratchet render
 * path (survey/census scripts) calls `renderDescription(geo, theme,
 * new DeterministicMeasurer())` directly, bypassing the public
 * `SyncPlugin#render(geo, theme)` two-arg contract (which has no measurer
 * param — same established pattern this module's own doc comment already
 * cites for `scripts/dot-sync-report.ts`'s oracle-DOT-emission measurer).
 * Threaded to EXACTLY ONE place: `UGraphicSvg.build`'s `stringBounder`
 * (draw-time `textLength`, via `driverBounderFor`) AND its 5th `measurer`
 * param (draw-time `getStringBounder()` width/height/descent — see that
 * method's own doc comment for the bug this fixes). This is deliberately
 * the ONLY injection point beyond `layoutSync`'s own pre-existing
 * `measurer` param (maintainer course-correction, 2026-07-10: no
 * prop-drilling through `drawEntity`/`EntityImageDescription`/
 * `buildTextBlock` — every draw-time text measurement reads the active
 * measurer off `ug.getStringBounder()`, which this render call already
 * populated, mirroring upstream's own pattern of threading `StringBounder`
 * via the `UGraphic` itself rather than as a separate parameter). Clusters/
 * edges do not read a measurer anywhere in this port (verified:
 * `renderer-cluster.ts`/`renderer-edge.ts`/`renderer-uid.ts` have zero
 * `jarMeasurer`/`StringMeasurer` references) — their geometry is already
 * fully fixed by the layout pass.
 */

import type { UGraphic } from '../../core/klimt/UGraphic.js';
import type { RenderFragment } from '../../core/dispatcher.js';
import type { Theme } from '../../core/theme.js';
import type { DescriptionGeometry, DescriptionNodeGeo } from './layout.js';
import { basicSvgOption } from '../../core/klimt/drawing/svg/svg-graphics.js';
import { UGraphicSvg } from '../../core/klimt/drawing/svg/u-graphic-svg.js';
import type { StringBounder as DriverStringBounder } from '../../core/klimt/drawing/svg/driver-text-svg.js';
import type { StringMeasurer } from '../../core/measurer.js';
import { jarMeasurer } from '../../core/measurer-jar.js';
import { buildUidPlan, type UidPlan } from './renderer-uid.js';
import { buildCluster } from './renderer-cluster.js';
import { drawEntity } from './renderer-entity.js';
import { drawEdge } from './renderer-edge.js';
import { computeDocumentDims } from './renderer-ink-extent.js';

/** `net.sourceforge.plantuml.core.DiagramType#DESCRIPTION` — verified
 *  against `DiagramType.java:45` and every cached jar description-diagram
 *  fixture's `data-diagram-type` attribute. */
const DIAGRAM_TYPE_ATTR = 'data-diagram-type';
const DIAGRAM_TYPE_DESCRIPTION = 'DESCRIPTION';
/** D4′ preamble conformance — see `svg-graphics-core.ts`'s doc comment
 *  and this module's own doc comment above. */
const VERSION_PLACEHOLDER = '$version$';

/** See this module's doc comment ("`driverBounderFor`"). Passes `font`
 *  straight through to `measurer.measure` rather than reconstructing a
 *  stripped `{family,size}` literal: `DriverStringBounder`'s interface
 *  only declares `family`/`size`, but a caller reaching this through
 *  `UGraphicSvg.getStringBounder()` (`buildTextBlock`,
 *  `EntityImageDescriptionSupport.ts`) passes the FULL `FontConfiguration`
 *  object (weight/style included) — reconstructing here would silently
 *  drop `jarMeasurer`'s bold-table lookup (D12/T4: bold uses a genuinely
 *  different advance table, not a scaled copy) for every bold/italic
 *  entity title/stereotype. Passing `font` through preserves those extra
 *  fields at runtime; `FontSpec`'s `weight?`/`style?` are optional, so a
 *  bare `{family,size}` caller (e.g. `DriverTextSvg`'s own textLength
 *  computation, which already reconstructs the same stripped shape) still
 *  works unchanged. */
function driverBounderFor(measurer: StringMeasurer): DriverStringBounder {
  return {
    calculateDimension(font, text) {
      return { width: measurer.measure(text, font).width };
    },
  };
}

/**
 * One pre-order walk of `geo.nodes`, splitting into two flat lists in
 * traversal order: every container node (`children.length > 0`) and
 * every leaf node (`children.length === 0`), at every depth. Mirrors
 * `Bibliotekon#allCluster()`/`#allNodes()` (populated at creation time,
 * outer-before-inner — see `renderer-uid.ts`'s doc comment for the same
 * approximation applied to uid assignment).
 */
function collectByKind(nodes: readonly DescriptionNodeGeo[]): {
  containers: DescriptionNodeGeo[];
  leaves: DescriptionNodeGeo[];
} {
  const containers: DescriptionNodeGeo[] = [];
  const leaves: DescriptionNodeGeo[] = [];
  function visit(list: readonly DescriptionNodeGeo[]): void {
    for (const node of list) {
      if (node.children.length > 0) {
        containers.push(node);
        visit(node.children);
      } else {
        leaves.push(node);
      }
    }
  }
  visit(nodes);
  return { containers, leaves };
}

/** `SvekResult#drawU`'s first loop — every cluster, absolute position
 *  resolved internally by `Cluster#drawU` (see `renderer-cluster.ts`). */
function drawClusters(ug: UGraphic, containers: readonly DescriptionNodeGeo[], theme: Theme, plan: UidPlan): void {
  for (const node of containers) {
    buildCluster(node, theme, plan.nodeUid.get(node.id)!).drawU(ug);
  }
}

/** `SvekResult#drawU`'s second loop — every leaf entity, translated to
 *  its absolute layout position by `renderer-entity.ts#drawEntity`. Text
 *  measurement is NOT threaded here — `ug` already carries the active
 *  measurer via `getStringBounder()` (see this module's doc comment). */
function drawEntities(
  ug: UGraphic,
  leaves: readonly DescriptionNodeGeo[],
  theme: Theme,
  plan: UidPlan,
  sprites: DescriptionGeometry['sprites'],
): void {
  for (const node of leaves) {
    drawEntity(ug, node, theme, plan.nodeUid.get(node.id)!, sprites);
  }
}

/**
 * `SvekResult#drawU`'s third loop — every edge, in `geo.edges` order
 * (already source order — see `layout-geo-post.ts#buildEdgeGeos`).
 *
 * Per-edge try/catch (T17 write-set expansion, journaled — mirrors
 * `Cluster#drawU`'s own established "one broken shape never aborts the
 * whole diagram" precedent, `src/core/svek/Cluster.ts`). The original
 * driver of this catch — a cross-container endpoint clip
 * (`clipSplineStart`/`clipSplineEnd`) splicing a spline's point array
 * down to a count that is not `1 + 3n`, which `SvekEdge`'s
 * `buildDotPathFromSplinePoints` (`svek-edge-geometry.ts`, T13) rejects
 * with a hard throw — has since been fixed at its origin (follow-up F1):
 * the clip is now a faithful port of upstream `DotPath#simulateCompound`
 * (`spline-clip.ts`), which clips bezier-by-bezier and so preserves the
 * `1 + 3n` invariant, so no edge is dropped for that reason. Verified:
 * `berufi-69-dara369` (edge `__note_1 -> SRFRet`,
 * previously clipped to 3 points) and `lirebi-26-voka556` now render
 * every edge; the full description golden corpus drops zero. The catch
 * is retained as a general safety net — the same "never throws, never
 * aborts the diagram" contract the pre-T17 renderer gave via a graceful
 * polyline fallback (see `renderer.test.ts`'s "obsolete tests" note) — so
 * any residual malformed shape degrades one edge, not the whole diagram.
 */
function drawEdges(ug: UGraphic, geo: DescriptionGeometry, theme: Theme, plan: UidPlan): void {
  geo.edges.forEach((edge, i) => {
    try {
      drawEdge(ug, edge, theme, plan.edgeUid[i]!, plan.nodeUid);
    } catch (err) {
      console.error('renderDescription: edge draw failed', edge.id, err);
    }
  });
}

/**
 * `GraphvizImageBuilder.buildImage:211-222` (`DotData
 * .isDegeneratedWithFewEntities`): a diagram with zero groups, zero links,
 * and exactly one root leaf (excluding hexagons, which "take the normal
 * svek path" per that same upstream method) never reaches `SvekResult` at
 * all — it is drawn as `EntityImageDegenerated`
 * (svek/EntityImageDegenerated.java), a COMPLETELY DIFFERENT class with
 * its own, unrelated dimension formula: `orig.calculateDimension(sb)
 * .delta(14, 14)` (`delta=7` doubled, svek/EntityImageDegenerated.java:52,
 * 74) — the leaf's OWN natural size plus a flat (7,7) draw-position
 * offset on each side — THEN the same `CucaDiagram` outer margin
 * (`renderer-ink-extent.ts`'s doc comment) on top, same as every other
 * cuca-family diagram. This port's own `degenerateSingleLeaf`
 * (`layout-helpers.ts:413-455`, mirroring the SAME upstream predicate)
 * already computes `geo.totalWidth`/`totalHeight` as `dims.width +
 * LAYOUT_MARGIN_LEADING(7) + LAYOUT_MARGIN(12)` — `7+12=19` = upstream's
 * `14 + 5` (delta*2 + the CucaDiagram right/bottom margin) EXACTLY — so
 * `geo.totalWidth`/`totalHeight` is ALREADY the correct, jar-verified
 * `minDim` for this one shape of geometry (jar-verified: `buduni-98-
 * bima526`/`vacuxi-18-baxu582`/`vumija-03-xise495`/`majuma-84-loma401`/
 * `kevipe-39-gaji640`, the five `oracle/goldens/svg-description/
 * ratchet.json`-pinned fixtures, all single-leaf/no-edge diagrams). The
 * `computeDocumentDims` SvekResult recipe (this module's other doc
 * comment) must NOT run for these — it would apply the WRONG formula
 * (jar-verified: 1px too large in each dimension, since `EntityImage
 * Degenerated`'s `+14` plus a `+5` margin totals `+19`, one less than
 * SvekResult's own `+15` ink-walk delta plus `+5` margin `= +20` on an
 * ink-min that, for a lone leaf, coincides with the leaf's own box size).
 *
 * `geo` alone (no AST access, no `layout.ts` write-set expansion needed)
 * approximates upstream's predicate closely: exactly one node, no
 * children (no group), no edges, not a hexagon. The one upstream
 * refinement this can't see from `geo` — an EXPLICITLY braced empty group
 * (`component X {}`) is excluded from the degenerate path even though it
 * has zero children post-classification (`degenerateSingleLeaf`'s own
 * doc comment: "checked BEFORE empty-group demotion") — is a known,
 * narrow approximation gap (no `declaredAsGroup` flag survives onto
 * `DescriptionNodeGeo`); the census gate is the check for whether this
 * costs any net ground.
 */
function isDegenerateGeo(geo: DescriptionGeometry): boolean {
  if (geo.nodes.length !== 1 || geo.edges.length !== 0) return false;
  const only = geo.nodes[0]!;
  return only.children.length === 0 && only.symbol !== 'hexagon';
}

/**
 * Render a descriptive diagram geometry into an SVG document string.
 *
 * Accepts the output of {@link layoutDescription} and produces a complete,
 * klimt-drawn SVG document — see this module's doc comment for the
 * preamble/draw-order conformance details. Pure function (no DOM, no
 * async): every non-determinism (uid counters, gradient/shadow ids) is
 * seeded from `geo.seed` (T17 seed thread, `layout-helpers.ts`'s doc
 * comment), never real wall-clock or `Math.random()` state.
 *
 * Document dimensions (G0/T3 write-set expansion, journaled — see
 * `renderer-ink-extent.ts`'s own doc comment for the full upstream chain
 * and case analysis, and `isDegenerateGeo`'s doc comment above for why
 * degenerate geometries are excluded): `minDim` is the
 * `SvekResult#calculateDimension` recipe (`computeDocumentDims` — a
 * `LimitFinder` ink walk over the SAME `draw` callback used for the real
 * pass, plus the `CucaDiagram` outer margin) for every NORMAL geometry;
 * `geo.totalWidth`/`totalHeight` (`degenerateSingleLeaf`'s own,
 * already-correct formula — NOT `computeTotalDimensions`'s now-deprecated
 * hand-scan, `layout-geo-post.ts`) for degenerate single-leaf ones.
 */
export function renderDescription(
  geo: DescriptionGeometry,
  theme: Theme,
  measurer: StringMeasurer = jarMeasurer,
): string {
  const plan = buildUidPlan(geo);
  const { containers, leaves } = collectByKind(geo.nodes);
  const draw = (target: UGraphic): void => {
    drawClusters(target, containers, theme, plan);
    drawEntities(target, leaves, theme, plan, geo.sprites);
    drawEdges(target, geo, theme, plan);
  };

  const driverBounder = driverBounderFor(measurer);
  const { width, height } = isDegenerateGeo(geo)
    ? { width: geo.totalWidth, height: geo.totalHeight }
    : computeDocumentDims(draw, driverBounder, measurer);

  const option = basicSvgOption({
    minDim: { width, height },
    backcolor: theme.colors.background,
    rootAttributes: new Map([[DIAGRAM_TYPE_ATTR, DIAGRAM_TYPE_DESCRIPTION]]),
  });
  const ug = UGraphicSvg.build(geo.seed ?? 0n, option, VERSION_PLACEHOLDER, driverBounder, measurer);

  draw(ug);

  return ug.getSvgString();
}


// ---------------------------------------------------------------------------
// T7 -- klimt CompleteSvg -> RenderFragment unwrap (decisions.md D2 "klimt
// fragment feasibility" evidence)
// ---------------------------------------------------------------------------

/**
 * A literal double-quote, via unicode escape so this file contains zero raw
 * double-quote glyphs -- mirrors `core/annotations/commands.ts`'s DQUOTE
 * convention (project complexity-hook rule).
 */
const DQUOTE = '\x22';

/**
 * `unwrapKlimtSvg` -- T7 chrome integration evidence (`plans/g0b-annotations/
 * batch-3/T7-pipeline-integration.md`, item 2 / decisions.md D2's
 * description footnote): `SvgGraphicsCore#createXml` (`svg-graphics-core.ts`)
 * unconditionally roots a `<svg>` document via `getRootNode` -- there is no
 * "emit body without document" mode anywhere in `u-graphic-svg.ts` /
 * `svg-graphics.ts` / `svg-graphics-core.ts` to call instead (confirmed by
 * reading all three per the task's read-set). Reworking `SvgGraphicsCore` to
 * add one would touch klimt's own emission behavior, which the task's
 * quality bar explicitly flags as a stop condition ("if klimt fragment
 * extraction requires touching svg-graphics-core.ts emission behavior, STOP
 * and journal the options").
 *
 * So this is the sanctioned fallback: a narrow, string-level unwrap of the
 * complete document `renderDescription` already produces, turning it into a
 * `RenderFragment` `applyChrome` + `assembleSvg` (`src/index.ts`) can compose
 * exactly like every other engine's fragment -- decorate once via the SAME
 * chrome geometry/blocks (`src/core/annotations/`), no third implementation.
 *
 * Only ever invoked when the diagram carries annotations (T7's
 * `applyAnnotationChrome` short-circuits on `isEmpty` first) -- every
 * annotation-free description fixture, including the golden ratchet
 * (`tests/oracle/svg-conformance/description.golden.ratchet.test.ts`),
 * never reaches this function at all, so D5 byte-stability holds trivially.
 *
 * Scoped to the EXACT shape `SvgGraphicsCore#createXml`/`#getRootNode`/
 * `#finalizeRootAttributes` are known to emit (indentSpaces=0, single line,
 * no XML prolog -- `xml-writer.ts`): a `<svg ...>` root -- `viewBox="0 0 W H"`
 * always present (`finalizeRootAttributes`, unconditional) -- containing, in
 * order, an optional `<?plantuml ...?>` PI / `<title>` / `<desc>`, exactly
 * one `<defs>...</defs>` or self-closing `<defs/>` (`SvgGraphicsCore`
 * constructor always appends one, empty or not), then the content `<g>`,
 * then `</svg>`. None of `SvgGraphicsCore`'s own root/child attribute values
 * (`xmlns`, `xmlns:xlink`, `version`, `zoomAndPan`, `preserveAspectRatio`,
 * `contentStyleType`, `style`, `width`/`height`, `data-diagram-type`)
 * contain a literal `>` character, so the first `>` in the (defs-stripped)
 * string is reliably the open tag's own close -- this is NOT a general SVG
 * parser and must not be reused outside this exact producer.
 *
 * @see u-graphic-svg.ts#getSvgString @see svg-graphics-core.ts#createXml
 */
function extractViewBoxDims(svg: string): { width: number; height: number } {
  const marker = 'viewBox=' + DQUOTE + '0 0 ';
  const start = svg.indexOf(marker);
  if (start === -1) {
    throw new Error('unwrapKlimtSvg: klimt SVG output has no viewBox attribute');
  }
  const afterMarker = start + marker.length;
  const end = svg.indexOf(DQUOTE, afterMarker);
  if (end === -1) {
    throw new Error('unwrapKlimtSvg: malformed viewBox attribute');
  }
  const [widthStr, heightStr] = svg.slice(afterMarker, end).split(' ');
  const width = Number(widthStr);
  const height = Number(heightStr);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error('unwrapKlimtSvg: malformed viewBox dimensions');
  }
  return { width, height };
}

/** Strips the single `<defs>...</defs>` (or self-closing `<defs/>`)
 *  `SvgGraphicsCore`'s constructor always appends, hoisting its inner
 *  markup so the caller can splice it into `svgRoot`'s OWN defs block
 *  (`RenderFragment.extraDefs`) instead of nesting a second `<defs>`. */
function extractDefs(svg: string): { withoutDefs: string; extraDefs: string } {
  const openTag = '<defs>';
  const closeTag = '</defs>';
  const selfClose = '<defs/>';

  const openIdx = svg.indexOf(openTag);
  if (openIdx !== -1) {
    const closeIdx = svg.indexOf(closeTag, openIdx);
    if (closeIdx === -1) throw new Error('unwrapKlimtSvg: unterminated <defs> element');
    const extraDefs = svg.slice(openIdx + openTag.length, closeIdx);
    const withoutDefs = svg.slice(0, openIdx) + svg.slice(closeIdx + closeTag.length);
    return { withoutDefs, extraDefs };
  }

  const selfIdx = svg.indexOf(selfClose);
  if (selfIdx !== -1) {
    const withoutDefs = svg.slice(0, selfIdx) + svg.slice(selfIdx + selfClose.length);
    return { withoutDefs, extraDefs: '' };
  }

  return { withoutDefs: svg, extraDefs: '' };
}

/** Everything between the root `<svg ...>` open tag's own `>` and the final
 *  `</svg>` -- see {@link unwrapKlimtSvg}'s doc comment for why the FIRST
 *  `>` in a defs-stripped klimt document is always that boundary. */
function extractBody(svgWithoutDefs: string): string {
  const openTagEnd = svgWithoutDefs.indexOf('>');
  const closeTagStart = svgWithoutDefs.lastIndexOf('</svg>');
  if (openTagEnd === -1 || closeTagStart === -1 || closeTagStart < openTagEnd) {
    throw new Error('unwrapKlimtSvg: malformed klimt SVG output (missing <svg>/</svg> boundary)');
  }
  return svgWithoutDefs.slice(openTagEnd + 1, closeTagStart);
}

/**
 * Turns a complete klimt (description-engine) SVG document into a
 * `RenderFragment` -- see the block comment above this function's helpers
 * for the full rationale and the exact producer shape this is scoped to.
 * `background` is threaded through explicitly (mirrors every other engine's
 * `RenderFragment.background = theme.colors.background`, e.g.
 * `class/renderer.ts`) rather than left unset: klimt's own background rect
 * is already embedded IN `body` (sized to the ORIGINAL canvas, via
 * `SvgGraphicsCore#paintBackcolor`), so `svgRoot`'s own bg rect -- drawn
 * first, full new-canvas-sized -- is what actually covers the area chrome
 * adds (title/legend/caption/header/footer bands); leaving it unset would
 * fall through to `svgRoot`'s hardcoded `#FFFFFF` default regardless of
 * theme.
 */
export function unwrapKlimtSvg(svg: string, background: string): RenderFragment {
  const { width, height } = extractViewBoxDims(svg);
  const { withoutDefs, extraDefs } = extractDefs(svg);
  const body = extractBody(withoutDefs);
  return extraDefs.length > 0
    ? { body, width, height, background, extraDefs }
    : { body, width, height, background };
}

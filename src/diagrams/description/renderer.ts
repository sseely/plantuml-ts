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
 * image dimension (`geo.totalWidth`/`totalHeight` here, `dim` there —
 * upstream's `SvgGraphics` derives the FINAL emitted width/height from
 * the union of every drawn shape's own extent via `ensureVisible`, not
 * from `minDim` directly; `minDim` is only a floor for otherwise-empty
 * canvases), `backcolor` = the diagram's resolved background paint, and
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
function drawEntities(ug: UGraphic, leaves: readonly DescriptionNodeGeo[], theme: Theme, plan: UidPlan): void {
  for (const node of leaves) {
    drawEntity(ug, node, theme, plan.nodeUid.get(node.id)!);
  }
}

/**
 * `SvekResult#drawU`'s third loop — every edge, in `geo.edges` order
 * (already source order — see `layout-geo-post.ts#buildEdgeGeos`).
 *
 * Per-edge try/catch (T17 write-set expansion, journaled — mirrors
 * `Cluster#drawU`'s own established "one broken shape never aborts the
 * whole diagram" precedent, `src/core/svek/Cluster.ts`). Root cause
 * (diagnosed, NOT fixed here — lives in two files outside this task's
 * declared write-set): a cross-container endpoint clip
 * (`layout-helpers.ts#clipSplineStart`/`clipSplineEnd`) can splice a
 * spline's point array down to a count that is not `1 + 3n`, which
 * `SvekEdge`'s `buildDotPathFromSplinePoints` (`svek-edge-geometry.ts`,
 * T13) rejects with a hard throw — verified against a real fixture
 * (`oracle/goldens/description/berufi-69-dara369`, edge `__note_1 ->
 * SRFRet`, clipped down to exactly 3 points). The pre-T17 renderer
 * tolerated any point count via a graceful polyline fallback (see
 * `renderer.test.ts`'s "obsolete tests" note); this catch preserves that
 * same "never throws, never aborts the diagram" contract at the
 * orchestration layer while the real fix (either loosening
 * `buildDotPathFromSplinePoints` or preserving the bezier-triple
 * invariant through clipping) is decided by a follow-up task — see the
 * T17 mission report.
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
 * Render a descriptive diagram geometry into an SVG document string.
 *
 * Accepts the output of {@link layoutDescription} and produces a complete,
 * klimt-drawn SVG document — see this module's doc comment for the
 * preamble/draw-order conformance details. Pure function (no DOM, no
 * async): every non-determinism (uid counters, gradient/shadow ids) is
 * seeded from `geo.seed` (T17 seed thread, `layout-helpers.ts`'s doc
 * comment), never real wall-clock or `Math.random()` state.
 */
export function renderDescription(
  geo: DescriptionGeometry,
  theme: Theme,
  measurer: StringMeasurer = jarMeasurer,
): string {
  const plan = buildUidPlan(geo);
  const option = basicSvgOption({
    minDim: { width: geo.totalWidth, height: geo.totalHeight },
    backcolor: theme.colors.background,
    rootAttributes: new Map([[DIAGRAM_TYPE_ATTR, DIAGRAM_TYPE_DESCRIPTION]]),
  });
  const driverBounder = driverBounderFor(measurer);
  const ug = UGraphicSvg.build(geo.seed ?? 0n, option, VERSION_PLACEHOLDER, driverBounder, measurer);

  const { containers, leaves } = collectByKind(geo.nodes);
  drawClusters(ug, containers, theme, plan);
  drawEntities(ug, leaves, theme, plan);
  drawEdges(ug, geo, theme, plan);

  return ug.getSvgString();
}

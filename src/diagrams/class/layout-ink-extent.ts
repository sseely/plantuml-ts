/**
 * layout-ink-extent.ts — G2/N5: the `SvekResult`/`TextBlockExporter`
 * document-dimension recipe (svek/SvekResult.java:126-133,
 * core/TextBlockExporter.java:200-202,751-753), ported for CLASS's own
 * pure-string layout (no klimt `UGraphic`, so `renderer-ink-extent.ts`'s
 * `LimitFinder`-over-`UGraphic` approach cannot be reused directly — this
 * module reproduces the SAME per-shape ink rules as plain-geometry math over
 * `ClassifierGeo`/`NamespaceGeo`/`EdgeGeo`/`NoteGeo`).
 *
 * Root-caused: N4 left class's non-degenerate (DOT-driven) path returning
 * `layoutGraph()`'s own raw `result.width`/`result.height` as the document
 * canvas size — dot's own layout-margin convention, unrelated to jar's real
 * SVG dimension formula. Jar-verified (debug instrumentation of a local
 * oracle build, `SvekResult#calculateDimension`/`TextBlockExporter
 * #calculateFinalDimension`/`SvgGraphics#ensureVisible` traced directly, see
 * `plans/g2-class-svg/ledger.md` N5): the REAL chain is
 *
 *  1. `SvekResult#calculateDimension` — a `LimitFinder` ink walk over the
 *     SAME clusters/nodes/edges the real draw pass draws, `.delta(15, 15)`.
 *     Per-shape ink rules (upstream `LimitFinder.java`, ported 1:1 in
 *     `core/klimt/drawing/LimitFinder.ts`):
 *       - Classifier/note box: the visible bordered `URectangle` itself
 *         gets the classic `-1`-inset corners, but `EntityImageClass`'s
 *         header/body composition ALSO draws an invisible full-box
 *         `UEmpty` reservation sized `(widthTotal, heightTotal)`
 *         (`LimitFinder#drawEmpty` — plain bbox, no inset) that strictly
 *         dominates the rect's own max corner by 1px. See `addRectInk`'s
 *         own doc comment below for the jar-verified net rule.
 *       - `UPath` (namespace cluster's rounded-corner outline; edge
 *         splines): plain bounding box, no inset.
 *       - `UPolygon` (edge arrowhead extremities; note fold shape): `x`
 *         padded by `HACK_X_FOR_POLYGON = 10` on both sides, `y` unpadded.
 *  2. `TextBlockExporter#calculateFinalDimension` adds the diagram's outer
 *     margin: `CucaDiagram#getDefaultMargins()` = `topRightBottomLeft(0, 5,
 *     5, 0)` (top=0, right=5, bottom=5, left=0) — same recipe already
 *     verified for description (`renderer-ink-extent.ts`, shared upstream
 *     base class), unconditionally +5 width +5 height for the whole cuca
 *     family (component/usecase/class/object/state all share
 *     `CucaDiagram`).
 *  3. `SvgGraphics#ensureVisible` — the REAL draw pass's own bounds tracker
 *     — is seeded with this `minDim` (`ensureVisible(minDim.width,
 *     minDim.height)`) and the SVG root's `width`/`height` are written from
 *     its own `maxX`/`maxY`, each computed as `(int)(v + 1)` — a
 *     truncating "+1" on top of the already-margined dimension. For
 *     positive values this is `Math.floor(v + 1)`, NOT a plain pass-through
 *     of `minDim` — every prior N-iteration's "ink extent + 20" hypothesis
 *     was short by exactly this `+1` (jar-verified: `bipudo-23-xavu432`'s
 *     debug trace gave `minDim = (154.15, 177.0)`, final SVG
 *     `width="155px" height="178px"` = `floor(154.15+1)` / `floor(177+1)`).
 *
 * NOT modeled (documented simplification, not silently dropped): edge
 * arrowhead extremities' own `UPolygon` ink contribution beyond the raw
 * spline endpoint, edge-label/row `UText` ink (baseline-shifted per-glyph
 * box), and the SAME `UEmpty`-reservation quirk `addRectInk` found for
 * classifiers has NOT been independently jar-verified for notes (treated
 * with the classic rect-ink rule as an approximation — notes are a small
 * corpus fraction). These are usually dominated by the classifier boxes'
 * own ink reach (arrowheads sit at box boundaries, labels sit between
 * boxes, notes are typically not the outermost element) — named
 * remainder for a future iteration, not chased further this iteration.
 *
 * NOT for degenerate single-leaf geometries — `EntityImageDegenerated` is a
 * different upstream class with its own dimension formula (see
 * `layout.ts#degenerateSingleClassifier`'s own doc comment).
 */
import type { ClassifierGeo, EdgeGeo, NamespaceGeo } from './layout.js';
import type { NoteGeo } from './note-layout.js';

/** `CucaDiagram#getDefaultMargins()` (net/atmp/CucaDiagram.java:719-722) —
 *  "Strange numbers here for backwards compatibility": top=0, right=5,
 *  bottom=5, left=0. Same constants as `renderer-ink-extent.ts` (shared
 *  upstream base class); duplicated here rather than imported since class
 *  has no klimt dependency and this module must stay klimt-free. */
const DOCUMENT_MARGIN_TOP = 0;
const DOCUMENT_MARGIN_RIGHT = 5;
const DOCUMENT_MARGIN_BOTTOM = 5;
const DOCUMENT_MARGIN_LEFT = 0;

/** `SvekResult#calculateDimension`'s `.delta(15, 15)` padding. */
const INK_DELTA = 15;

/** `LimitFinder#HACK_X_FOR_POLYGON` — x-only polygon ink padding. */
const HACK_X_FOR_POLYGON = 10;

interface InkBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function newInkBox(): InkBox {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function addPoint(box: InkBox, x: number, y: number): void {
  if (x < box.minX) box.minX = x;
  if (y < box.minY) box.minY = y;
  if (x > box.maxX) box.maxX = x;
  if (y > box.maxY) box.maxY = y;
}

/** `LimitFinder#drawRectangle`'s own `-1`-inset corners are NOT the true
 *  boundary here — `EntityImageClass`'s header/body `TextBlockUtils
 *  .withMargin` composition also draws an invisible full-box `UEmpty`
 *  reservation over the SAME `(widthTotal, heightTotal)` the visible
 *  bordered rect uses. `LimitFinder#drawEmpty` has NO `-1` inset
 *  (`addPoint(x,y)`, `addPoint(x+w,y+h)` — plain bbox), and since its
 *  max corner is exactly 1px past the bordered rect's own `-1`-inset max
 *  corner, it strictly dominates on the max side while the rect's `-1`
 *  inset still dominates on the min side. Net effect, jar-verified with
 *  zero residual against 6+ edge-free multi-classifier fixtures
 *  (`jalexi-21-xoje231`, `vaxaza-84-gune985`, `mexaka-52-gati860`,
 *  `bipudo-23-xavu432`; debug-instrumented local oracle build tracing
 *  `SvekResult#calculateDimension`'s raw `LimitFinder` walk directly —
 *  see `plans/g2-class-svg/ledger.md` N5): ink box = `[x-1, x+w] ×
 *  [y-1, y+h]` — nominal box size plus exactly 1px on the min side only,
 *  not the classic symmetric `-1`-inset URectangle rule. */
function addRectInk(box: InkBox, x: number, y: number, w: number, h: number): void {
  addPoint(box, x - 1, y - 1);
  addPoint(box, x + w, y + h);
}

/** `LimitFinder#drawUPath` — plain bounding box, no inset. Used for
 *  namespace cluster outlines (rounded-corner `UPath`, not a `URectangle`
 *  upstream — `Cluster.java`/`svek/GroupPngMakerActivity`-family draw). */
function addPlainInk(box: InkBox, x: number, y: number, w: number, h: number): void {
  addPoint(box, x, y);
  addPoint(box, x + w, y + h);
}

/** `LimitFinder#drawUPolygon` — x padded by `HACK_X_FOR_POLYGON`, y not.
 *  Used for note fold shapes (`EntityImageNote`'s `UPolygon` body). */
function addPolygonInk(box: InkBox, minX: number, minY: number, maxX: number, maxY: number): void {
  addPoint(box, minX - HACK_X_FOR_POLYGON, minY);
  addPoint(box, maxX + HACK_X_FOR_POLYGON, maxY);
}

export interface ClassDocumentDims {
  readonly width: number;
  readonly height: number;
}

/**
 * The `SvekResult`/`TextBlockExporter`/`SvgGraphics` recipe (see this
 * module's own doc comment), applied to class's own plain-geometry
 * `ClassifierGeo`/`NamespaceGeo`/`EdgeGeo`/`NoteGeo` arrays instead of a
 * klimt `UGraphic` draw pass. Returns `{width: 0, height: 0}` for an empty
 * diagram (no ink at all) rather than `NaN` from an unbounded `Infinity`
 * box.
 */
export function computeClassDocumentDims(
  classifiers: readonly ClassifierGeo[],
  namespaces: readonly NamespaceGeo[],
  edges: readonly EdgeGeo[],
  notes: readonly NoteGeo[],
): ClassDocumentDims {
  const box = newInkBox();
  for (const c of classifiers) addRectInk(box, c.x, c.y, c.width, c.height);
  for (const n of namespaces) addPlainInk(box, n.x, n.y, n.width, n.height);
  for (const nt of notes) addPolygonInk(box, nt.x, nt.y, nt.x + nt.width, nt.y + nt.height);
  for (const e of edges) {
    for (const p of e.points) addPoint(box, p.x, p.y);
    if (e.label !== undefined) addPoint(box, e.label.x, e.label.y);
  }
  if (!Number.isFinite(box.minX)) return { width: 0, height: 0 };

  const calcWidth = box.maxX - box.minX + INK_DELTA;
  const calcHeight = box.maxY - box.minY + INK_DELTA;
  const finalWidth = calcWidth + DOCUMENT_MARGIN_LEFT + DOCUMENT_MARGIN_RIGHT;
  const finalHeight = calcHeight + DOCUMENT_MARGIN_TOP + DOCUMENT_MARGIN_BOTTOM;

  // `SvgGraphics#ensureVisible`: `(int)(v + 1)` — a truncating cast, which
  // for non-negative `v` is `Math.floor`.
  return {
    width: Math.floor(finalWidth + 1),
    height: Math.floor(finalHeight + 1),
  };
}

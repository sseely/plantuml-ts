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
 *       - `UPolygon` (edge arrowhead extremities ONLY -- NOT note shapes,
 *         see G2/N14 correction below): `x` padded by `HACK_X_FOR_POLYGON =
 *         10` on both sides, `y` unpadded. Currently unmodeled (no
 *         `UPolygon`-shaped ink source is walked by this module -- named
 *         remainder, see "NOT modeled" below).
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
 * spline endpoint, and the SAME `UEmpty`-reservation quirk `addRectInk`
 * found for classifiers has NOT been independently jar-verified for notes
 * (treated with the classic rect-ink rule as an approximation — notes are a
 * small corpus fraction). These are usually dominated by the classifier
 * boxes' own ink reach (arrowheads sit at box boundaries, notes are
 * typically not the outermost element) — named remainder for a future
 * iteration, not chased further this iteration. Edge-label/row `UText` ink
 * WAS in this "usually dominated" bucket until G2 N35 found the exception:
 * see `lollipopRowInk` below.
 *
 * NOT for degenerate single-leaf geometries — `EntityImageDegenerated` is a
 * different upstream class with its own dimension formula (see
 * `layout.ts#degenerateSingleClassifier`'s own doc comment).
 *
 * G2/N11: `SvekResult#calculateDimension`'s FIRST step (svek/
 * SvekResult.java:130-134) is NOT just the ink walk above — it ALSO calls
 * `clusterManager.moveDelta(6 - minMax.getMinX(), 6 - minMax.getMinY())`
 * (`DotStringFactory#moveDelta`, svek/DotStringFactory.java:653-661), a
 * uniform translate applied ONCE to every already-laid-out node/cluster/edge
 * position so the diagram's own ink extent's top-left corner lands at
 * `(6, 6)` (the SAME `JAR_INK_MARGIN` constant description's own
 * `layout-ink-shift.ts#computeInkShift` already jar-verified, G1b/J1 — this
 * IS the identical upstream mechanism, `SvekResult` is shared base-class
 * machinery for every `CucaDiagram` subtype). `computeClassDocumentDims`
 * above only ever modeled the RETURNED dimension (`minMax.getDimension()
 * .delta(15,15)`, translation-invariant, so the dims-only fix already
 * landed correctly N4→N5) — it never modeled the SIDE EFFECT that shifts
 * every drawn position. `layout.ts#layoutSinglePage` fed `layoutGraph()`'s
 * raw graphviz-normalized positions straight through with NO equivalent
 * shift, leaving every classifier/namespace/edge/note off by a constant
 * per-fixture `(dx, dy)` — jar-verified against `jalexi-21-xoje231` (two
 * bare classifiers, no edges): our raw `rect x="0" y="0"`/`x="94" y="0"`
 * vs jar's `x="7" y="7"`/`x="101" y="7"` — EXACTLY `(+7,+7)` on BOTH boxes
 * (uniform, not per-element), matching `6 - (-1) = 7` (a rect's own ink-min
 * corner is `x-1`, per `addRectInk` above, so an unshifted box sitting at
 * the graph's raw origin `x=0` has ink-min-x `-1`). Confirmed via N10's own
 * `ducoka-05-cuce457` sample (`rect y="0"` vs jar's `y="7"`, same `+7`
 * delta) — this is the SAME already-named "~7-8px multi-component/box
 * position/margin residual" (N7/N10), not a graphviz-ts coordinate issue:
 * the shift is a PURE post-layout translation this port never applied,
 * independent of dot's own routing accuracy.
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

/** `SvekResult#calculateDimension`'s own `moveDelta(6 - minMax.getMinX(),
 *  6 - minMax.getMinY())` constant (svek/SvekResult.java:133) — the SAME
 *  value as description's `layout-ink-shift.ts#JAR_INK_MARGIN` (G1b/J1,
 *  shared upstream `SvekResult` machinery). Duplicated here rather than
 *  imported per this module's own klimt-free-module convention (see file
 *  doc comment). */
const JAR_INK_MARGIN = 6;

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

/**
 * G2 N32: the "classic `-1`-inset `URectangle`" rule this module's own file
 * doc comment names (top, `addRectInk`'s doc comment) but never implements
 * standalone -- `addRectInk` is the classifier-specific NET rule (classic
 * min-inset, but the max corner cancels against the entity's own extra
 * `UEmpty` reservation, see that function's doc comment), which only holds
 * for an ACTUAL classifier box. A plain stroked `URectangle` with no such
 * reservation (`class Foo<T>`'s generic-tag box, `TextBlockGeneric.java
 * #drawU`'s bare `ug.draw(URectangle.build(w, h))`) gets the FULL symmetric
 * `-1`/`+1` inset on BOTH corners -- jar-verified `caboco-62-jula911`:
 * using `addRectInk`'s asymmetric rule for the tag undershoots the real
 * canvas width by exactly 1px (233 vs jar's 234); this rule matches exactly.
 */
function addClassicRectInk(box: InkBox, x: number, y: number, w: number, h: number): void {
  addPoint(box, x - 1, y - 1);
  addPoint(box, x + w + 1, y + h + 1);
}

/**
 * G2 N35: the lollipop's OWN display-label row
 * (`EntityImageLollipopInterface#drawU`'s `desc.drawU(...)`, G2 N20) is
 * horizontally CENTERED under the tiny fixed-size circle
 * (`class-layout-helpers.ts#measureLollipop`'s `indent: LOLLIPOP_SIZE/2 -
 * textWidth/2`) and overhangs it on both sides whenever the label is wider
 * than `LOLLIPOP_SIZE` (10px) — routinely true, since a real interface name
 * is rarely that short. This module's own file doc comment previously
 * named "edge-label/row `UText` ink" a documented simplification, "usually
 * dominated by the classifier boxes' own ink reach" — the lollipop is the
 * counter-example: its own box is the smallest fixed size in the corpus
 * and its label is routinely the diagram's own outermost ink on that side.
 * Jar-verified (`makoko-44-mapu988`: our canvas width undershoots jar's by
 * exactly the missing label's own half-overhang, `svg/@width` 246 vs 266;
 * `paluca-39-desa696` same shape). Plain-bbox rule (no `-1`/`+1` inset),
 * matching N14's own note-text precedent — text ink is never inset; `y`
 * bounds stay pinned to the circle's own `[c.y, c.y+c.height]` span
 * deliberately (the row's OWN vertical descent below the circle is a
 * SEPARATE, not-yet-jar-verified contribution — no fixture in this
 * iteration's corpus isolates it from other dominating ink, so it is left
 * unmodeled rather than guessed).
 */
function addLollipopRowInk(box: InkBox, c: ClassifierGeo): void {
  const row = c.rows[0];
  if (row === undefined) return;
  addPlainInk(box, c.x + row.indent, c.y, row.width ?? 0, c.height);
}

/** One classifier's own ink contribution — split out of `buildInkBox` (G2
 *  N35) to keep that function's own complexity under the repo's CCN cap. */
function addClassifierInk(box: InkBox, c: ClassifierGeo): void {
  // G2 N33: a collapsed-empty package/namespace leaf draws the SAME
  // `USymbolFolder` `UPath` outline a namespace CLUSTER draws (`addPlainInk`
  // below), never `EntityImageClass`'s own rect+`UEmpty` composition -- the
  // asymmetric `addRectInk` rule below does not apply to it (jar-verified
  // `gatula-10-bifu561`: using `addRectInk` here shifts the WHOLE diagram
  // by a uniform (1,1) versus jar, since a `UPath`'s ink-min corner is its
  // own unshifted `x`/`y`, not `x-1`/`y-1`).
  if (c.folderTab !== undefined) {
    addPlainInk(box, c.x, c.y, c.width, c.height);
    return;
  }
  addRectInk(box, c.x, c.y, c.width, c.height);
  if (c.kind === 'lollipop') addLollipopRowInk(box, c);
  // G2 N32: `class Foo<T>`'s generic type-parameter tag box is drawn
  // OUTSIDE the classifier's own rect (above-right, `class-stereotype.ts
  // #buildGenericTagGeo`'s doc comment) via a plain stroked `URectangle`
  // (`TextBlockGeneric.java#drawU`) -- the SAME ink rule as the
  // classifier's own box, contributing its OWN min/max corner
  // independently. Jar-verified `caboco-62-jula911`: the tag's 3px
  // top/right overhang is exactly what shifts the whole diagram's ink
  // origin (`computeClassInkShift`) and widens the canvas
  // (`computeClassDocumentDims`) by 3px each.
  if (c.genericTag !== undefined) {
    const tag = c.genericTag;
    addClassicRectInk(box, c.x + tag.rectX, c.y + tag.rectY, tag.rectWidth, tag.rectHeight);
  }
}

/**
 * The shared ink-point accumulation walk both `computeClassDocumentDims`
 * (dimension) and `computeClassInkShift` (N11, position) consume — one
 * `LimitFinder`-shaped pass over clusters/nodes/edges (`SvekResult#drawU`'s
 * own draw sequence: clusters, then nodes, then edges — order doesn't
 * matter for a min/max accumulator, only membership does).
 */
function buildInkBox(
  classifiers: readonly ClassifierGeo[],
  namespaces: readonly NamespaceGeo[],
  edges: readonly EdgeGeo[],
  notes: readonly NoteGeo[],
): InkBox {
  const box = newInkBox();
  for (const c of classifiers) addClassifierInk(box, c);
  for (const n of namespaces) addPlainInk(box, n.x, n.y, n.width, n.height);
  // G2/N13: a dropped member-tip note (unresolved `::member`) draws
  // NOTHING at all -- jar's own ink extent excludes it (`fupope-12-zoku847`'s
  // canvas dims match a plain single-classifier render with no note space
  // reserved at all).
  // G2/N14 CORRECTION: notes use the PLAIN (no x-hack) ink rule, not the
  // polygon rule -- `Opale.java#drawU` draws its outline via `ug.draw
  // (polygon)` where `polygon` is a `UPath` (built through `UPath.none()` +
  // `moveTo`/`lineTo`/`arcTo`, EVERY branch: `getPolygonNormal`/`Left`/
  // `Right`/`Up`/`Down` all return `UPath`, never `UPolygon`) -- so
  // `LimitFinder` dispatches to `drawUPath` (plain bbox), not `drawUPolygon`
  // (`HACK_X_FOR_POLYGON`-padded). The PREVIOUS `addPolygonInk` choice here
  // was an unverified guess from before ANY note fixture had been jar-
  // checked (this module's own file-header doc comment already flagged it
  // as unverified) -- jar-verified wrong by exactly `HACK_X_FOR_POLYGON`
  // (10px) against `fezugi-39-fujo327` (canvas width 174 vs jar's real 164).
  for (const nt of notes) {
    if (nt.dropped === true) continue;
    addPlainInk(box, nt.x, nt.y, nt.width, nt.height);
  }
  for (const e of edges) {
    // G2/N16 Kind B: a consumed (never-drawn) freestanding-note connector
    // contributes no ink of its own -- `EdgeGeo.consumedByOpaleNote`'s doc
    // comment; the note's own box already covers its Opale outline.
    if (e.consumedByOpaleNote === true) continue;
    for (const p of e.points) addPoint(box, p.x, p.y);
    if (e.label !== undefined) addPoint(box, e.label.x, e.label.y);
  }
  return box;
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
  const box = buildInkBox(classifiers, namespaces, edges, notes);
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

export interface InkShift {
  readonly dx: number;
  readonly dy: number;
}

/**
 * G2/N11: `SvekResult#calculateDimension`'s `moveDelta(6 - minMax.getMinX(),
 * 6 - minMax.getMinY())` (svek/SvekResult.java:133) — the uniform translate
 * that must be applied to EVERY classifier/namespace/edge/note position
 * (post-dot-layout, pre-render) so the diagram's own ink extent's top-left
 * corner lands at `(JAR_INK_MARGIN, JAR_INK_MARGIN)`. Mirrors description's
 * `layout-ink-shift.ts#computeInkShift` (G1b/J1, same upstream `SvekResult`
 * mechanism) — reimplemented against class's plain-geometry ink walk
 * (`buildInkBox`, shared with `computeClassDocumentDims`) rather than a
 * klimt `UGraphic` draw pass, since class renders pure-string (no klimt
 * dependency, per this module's own doc comment).
 *
 * Returns `{dx: 0, dy: 0}` for an empty diagram (no ink at all) — mirrors
 * `computeClassDocumentDims`'s own `{width: 0, height: 0}` empty-diagram
 * case, and is a correct no-op shift regardless (nothing to translate).
 */
export function computeClassInkShift(
  classifiers: readonly ClassifierGeo[],
  namespaces: readonly NamespaceGeo[],
  edges: readonly EdgeGeo[],
  notes: readonly NoteGeo[],
): InkShift {
  const box = buildInkBox(classifiers, namespaces, edges, notes);
  if (!Number.isFinite(box.minX)) return { dx: 0, dy: 0 };
  return {
    dx: JAR_INK_MARGIN - box.minX,
    dy: JAR_INK_MARGIN - box.minY,
  };
}

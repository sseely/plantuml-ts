/**
 * layout-ink-extent.ts — mission G4 S1, mechanism 4 ("document-margin /
 * ink-extent computation gap"): the `SvekResult`/`TextBlockExporter`
 * document-dimension recipe (svek/SvekResult.java:126-133, core/
 * TextBlockExporter.java:200-202,751-753), ported for STATE's own
 * pure-string layout — mirrors `class/layout-ink-extent.ts` (G2 N5's own
 * identical mechanism, shared `CucaDiagram`/`SvekResult` base-class recipe)
 * but with STATE's own per-shape ink rules (state draws entirely different
 * shapes than class's classifier boxes).
 *
 * Margin constants (`CucaDiagram#getDefaultMargins()`, `.delta(15,15)`,
 * `JAR_INK_MARGIN=6`, `SvgGraphics#ensureVisible`'s truncating `+1`) are
 * IDENTICAL to class's own — `net/atmp/CucaDiagram.java` is shared base
 * machinery for the whole `CucaDiagram` family (component/usecase/class/
 * object/state), grep-verified no `StateDiagram`-local override exists
 * (`~/git/plantuml/.../statediagram/*.java`).
 *
 * STATE-SPECIFIC ink rule (jar-verified via 3 independent zero-transition,
 * zero-composite samples — `jocela-05-niba392`, `votoki-67-gufa610`,
 * `gupeto-19-mesa256`, all `svg/@width`+`svg/@height` byte-exact once
 * applied): a `normal`/`json` leaf state's rendered box (rounded rect +
 * horizontal divider line + name text, `renderer.ts#renderNormal`) does
 * NOT follow class's own `addRectInk` rule (`[x-1,x+w] × [y-1,y+h]`) —
 * instead the ink box is `[x-1, x+w] × [y-1, y+h-1]`: the divider `<line>`
 * (upstream `ULine`, `LimitFinder#drawULine` — plain, UNINSET ink) spans
 * the box's FULL uninset width (`x1=x` to `x2=x+w`, confirmed against
 * `jocela-05-niba392`'s own `<line x1="7" y1="31" x2="65.0625" y2="31"/>`
 * where `x2` equals the rect's own `x+width` exactly, not `x+width-1`) and
 * so DOMINATES the rect's own `-1`-inset right edge on the WIDTH axis —
 * but the line's `y` coordinate sits well INSIDE the box's own vertical
 * span, so it never reaches (let alone dominates) the rect's own `y+h-1`
 * bottom edge on the HEIGHT axis. Net: max-X uninset (`x+w`), max-Y
 * classic-inset (`y+h-1`) — an asymmetric-per-AXIS rule, not class's own
 * asymmetric-per-CORNER rule. Verified robust across a plain, a multi-line
 * (`\n`-body), and a `<math>`(KaTeX)-body fixture — the divider-line
 * mechanism holds regardless of body content complexity.
 *
 * NOT jar-verified this iteration (documented simplification, not silently
 * dropped — see individual ink-rule functions below for the specific
 * upstream `LimitFinder` dispatch each one reproduces):
 *   - `composite` states (dashed outer box, NO divider line —
 *     `renderer.ts#renderComposite`): reuses the SAME leaf-box rule as a
 *     best-effort default (composite states share the classifier-family
 *     `EntityImageState`-ish box+text ink shape in spirit), NOT
 *     independently confirmed against a jar sample this iteration (every
 *     sampled composite fixture also carries children/edges whose own ink
 *     dominates the canvas, masking any 1px composite-box-specific
 *     residual — see S1 ledger for the specific fixtures checked).
 *   - `fork`/`join`/`syncBar` (plain bar `URectangle`, no divider line):
 *     the classic symmetric `LimitFinder#drawRectangle` rule (`[x-1,x+w-1]
 *     × [y-1,y+h-1]`) — the REAL upstream rule for a bare `URectangle` with
 *     no additional `UEmpty`/`ULine` ink contribution, ported directly from
 *     `core/klimt/drawing/LimitFinder.ts#drawRectangle`, not guessed.
 *   - `initial`/`final`/`history`/`deepHistory` (ellipse-based): the REAL
 *     `LimitFinder#drawEllipse` rule (`[x,y] × [x+w-1,y+h-1]`, NO `-1` on
 *     the min corner — ported directly from `LimitFinder.ts#drawEllipse`).
 *     History/deepHistory's own "H"/"H*" label text ink is NOT modeled
 *     (small, centered inside the ellipse — same "usually dominated by the
 *     shape's own ink reach" simplification `class/layout-ink-extent.ts`'s
 *     own file doc comment documents for edge-label/row text in general).
 *   - `choice` (diamond `UPolygon`): the REAL `LimitFinder#drawUPolygon`
 *     rule (`HACK_X_FOR_POLYGON=10`-padded x, unpadded y — ported directly
 *     from `LimitFinder.ts#drawUPolygon`, the SAME constant class's own
 *     `addFolderPolygonInk`/`renderer-arrowhead.ts#edgeExtremityInk` reuse).
 *
 * @see plans/g4-state-svg/ledger.md (S1, mechanism 4)
 * @see class/layout-ink-extent.ts (the class-engine precedent this mirrors)
 */
import type { StateNodeGeo, TransitionGeo } from './state-geo-types.js';
import { transitionArrowheadInk } from './renderer-arrowhead.js';

/** `CucaDiagram#getDefaultMargins()` (net/atmp/CucaDiagram.java:719-722) —
 *  shared across the whole `CucaDiagram` family, see module doc comment. */
const DOCUMENT_MARGIN_TOP = 0;
const DOCUMENT_MARGIN_RIGHT = 5;
const DOCUMENT_MARGIN_BOTTOM = 5;
const DOCUMENT_MARGIN_LEFT = 0;

/** `SvekResult#calculateDimension`'s own `.delta(15, 15)` padding. */
const INK_DELTA = 15;

/** `SvekResult#calculateDimension`'s own `moveDelta(6 - minMax.getMinX(),
 *  6 - minMax.getMinY())` constant — the SAME value description's
 *  `layout-ink-shift.ts#JAR_INK_MARGIN` and class's own `layout-ink-
 *  extent.ts#JAR_INK_MARGIN` already jar-verified (shared `SvekResult`
 *  machinery). */
const JAR_INK_MARGIN = 6;

/** `LimitFinder#drawUPolygon`'s own `x`-only padding quirk
 *  (`HACK_X_FOR_POLYGON = 10` upstream) — duplicated here rather than
 *  imported, per `class/layout-ink-extent.ts`'s own established
 *  klimt-free-module convention. */
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

/** Leaf `normal`/`json` state box + composite (best-effort) — see module
 *  doc comment for the jar-verified asymmetric-per-axis mechanism. */
function addStateBoxInk(box: InkBox, x: number, y: number, w: number, h: number): void {
  addPoint(box, x - 1, y - 1);
  addPoint(box, x + w, y + h - 1);
}

/** `fork`/`join`/`syncBar` bar — `LimitFinder#drawRectangle`'s real rule,
 *  no additional divider-line/UEmpty ink contribution. */
function addBarInk(box: InkBox, x: number, y: number, w: number, h: number): void {
  addPoint(box, x - 1, y - 1);
  addPoint(box, x + w - 1, y + h - 1);
}

/** `initial`/`final`/`history`/`deepHistory` ellipse (`cx,cy,r,r` render
 *  call shape) — `LimitFinder#drawEllipse`'s real rule (NO `-1` on the min
 *  corner). */
function addEllipseInk(box: InkBox, cx: number, cy: number, r: number): void {
  const x = cx - r;
  const y = cy - r;
  const w = 2 * r;
  const h = 2 * r;
  addPoint(box, x, y);
  addPoint(box, x + w - 1, y + h - 1);
}

/** `choice` diamond (`core/svg.ts#diamond`'s own 4-point layout) —
 *  `LimitFinder#drawUPolygon`'s real rule (x padded by `HACK_X_FOR_POLYGON`
 *  on both sides, y unpadded). */
function addDiamondInk(box: InkBox, cx: number, cy: number, size: number): void {
  addPoint(box, cx - size - HACK_X_FOR_POLYGON, cy - size);
  addPoint(box, cx + size + HACK_X_FOR_POLYGON, cy + size);
}

/** One node's own ink contribution (recurses into composite children —
 *  `state-composite-geo.ts` already positions children in the SAME
 *  absolute coordinate space `StateGeometry.states` uses, no re-basing
 *  needed here). */
function addNodeInk(box: InkBox, node: StateNodeGeo): void {
  if (node.children.length > 0) {
    addStateBoxInk(box, node.x, node.y, node.width, node.height);
    for (const child of node.children) addNodeInk(box, child);
    return;
  }
  switch (node.kind) {
    case 'initial':
    case 'final':
    case 'history':
    case 'deepHistory': {
      const r = node.width / 2;
      addEllipseInk(box, node.x + r, node.y + r, r);
      return;
    }
    case 'fork':
    case 'join':
    case 'syncBar':
      addBarInk(box, node.x, node.y, node.width, node.height);
      return;
    case 'choice': {
      const size = node.width / 2;
      addDiamondInk(box, node.x + size, node.y + size, size);
      return;
    }
    case 'normal':
    case 'json':
      addStateBoxInk(box, node.x, node.y, node.width, node.height);
      return;
    // #lizard forgives -- faithful one-branch-per-StateKind dispatch,
    // mirroring renderer.ts#renderNode's own shape switch.
  }
}

/** One transition's own ink contribution — plain points/label anchors
 *  (`LimitFinder#drawDotPath`-equivalent: no inset) plus the head-side
 *  arrowhead's own ink (`renderer-arrowhead.ts#transitionArrowheadInk`,
 *  already `HACK_X_FOR_POLYGON`-padded internally via a real `LimitFinder`
 *  walk over the placed `ExtremityArrow`). */
function addTransitionInk(box: InkBox, transition: TransitionGeo): void {
  for (const p of transition.points) addPoint(box, p.x, p.y);
  if (transition.label !== undefined) addPoint(box, transition.label.x, transition.label.y);
  const arrowInk = transitionArrowheadInk(transition);
  if (arrowInk !== undefined) {
    addPoint(box, arrowInk.minX, arrowInk.minY);
    addPoint(box, arrowInk.maxX, arrowInk.maxY);
  }
}

/** The shared ink-point accumulation walk both {@link computeStateDocumentDims}
 *  and {@link computeStateInkShift} consume. */
function buildInkBox(states: readonly StateNodeGeo[], transitions: readonly TransitionGeo[]): InkBox {
  const box = newInkBox();
  for (const n of states) addNodeInk(box, n);
  for (const t of transitions) addTransitionInk(box, t);
  return box;
}

export interface StateDocumentDims {
  readonly width: number;
  readonly height: number;
}

/**
 * The `SvekResult`/`TextBlockExporter`/`SvgGraphics` recipe (see module doc
 * comment), applied to state's own plain-geometry `StateNodeGeo`/
 * `TransitionGeo` arrays instead of a klimt `UGraphic` draw pass. Returns
 * `{width: 0, height: 0}` for an empty diagram (no ink at all) rather than
 * `NaN` from an unbounded `Infinity` box.
 */
export function computeStateDocumentDims(
  states: readonly StateNodeGeo[],
  transitions: readonly TransitionGeo[],
): StateDocumentDims {
  const box = buildInkBox(states, transitions);
  if (!Number.isFinite(box.minX)) return { width: 0, height: 0 };

  const rawWidth = box.maxX - box.minX + INK_DELTA;
  const rawHeight = box.maxY - box.minY + INK_DELTA;
  const finalWidth = rawWidth + DOCUMENT_MARGIN_LEFT + DOCUMENT_MARGIN_RIGHT;
  const finalHeight = rawHeight + DOCUMENT_MARGIN_TOP + DOCUMENT_MARGIN_BOTTOM;

  // `SvgGraphics#ensureVisible`: `(int)(v + 1)` — a truncating cast, which
  // for non-negative `v` is `Math.floor`.
  return {
    width: Math.floor(finalWidth + 1),
    height: Math.floor(finalHeight + 1),
  };
}

export interface StateInkShift {
  readonly dx: number;
  readonly dy: number;
}

/**
 * `SvekResult#calculateDimension`'s `moveDelta(6 - minMax.getMinX(), 6 -
 * minMax.getMinY())` — the uniform translate applied to every state/
 * transition position (post-layout, pre-render) so the diagram's own ink
 * extent's top-left corner lands at `(JAR_INK_MARGIN, JAR_INK_MARGIN)`.
 * Mirrors `class/layout-ink-extent.ts#computeClassInkShift`'s identical
 * mechanism. Returns `{dx: 0, dy: 0}` for an empty diagram.
 */
export function computeStateInkShift(
  states: readonly StateNodeGeo[],
  transitions: readonly TransitionGeo[],
): StateInkShift {
  const box = buildInkBox(states, transitions);
  if (!Number.isFinite(box.minX)) return { dx: 0, dy: 0 };
  return {
    dx: JAR_INK_MARGIN - box.minX,
    dy: JAR_INK_MARGIN - box.minY,
  };
}

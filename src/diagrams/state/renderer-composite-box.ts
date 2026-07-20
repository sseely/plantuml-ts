/**
 * Composite-state (`children.length > 0`) box renderer — mission G4 S3,
 * mechanism 6. Split out of renderer.ts to keep that file under the
 * project's 500-line cap, mirroring renderer-box.ts's own precedent for the
 * leaf-box shape (mission G4 S2).
 *
 * Jar-verified byte-for-byte against `bajelo-54-dixe684`'s `Track_FSM`
 * (autonom, `class="entity"`, NO body/action lines — a single header
 * divider only) and `Track_FSM.Run.Do_Sector` (autonom, WITH 2 entry/exit
 * action lines — a SECOND divider + a dedicated action-zone background
 * rect). Both are `EntityImagePseudoState`/`EntityImageState`-adjacent but
 * a DISTINCT upstream shape, `InnerStateAutonom.drawU` — NOT the same
 * anatomy `renderer-box.ts#renderNormal` draws for a leaf box (see the
 * per-layer breakdown below).
 *
 * Box anatomy (`InnerStateAutonom.java`, MARGIN=MARGIN_LINE=5 — SAME
 * constants `state-composite-sizing.ts#measureAutonomWrapper` already
 * dimensions the wrapper with). DRAW ORDER (jar-verified, `Do_Sector`):
 * header path, action-zone bg (if any), outline, divider 1, divider 2 (if
 * any), title text, action text (if any):
 *   1. HEADER background — a half-rounded-top `<path>` (`URectangle
 *      .halfRounded(25)`'s own arc+line sequence, r=12.5 — the SAME math
 *      class's own `renderer-classifier-box.ts#headerBackgroundPath`
 *      already ports, reproduced locally here per this codebase's
 *      established klimt-free-module convention, `layout-ink-extent.ts`'s
 *      own doc comment), spanning the box's own top edge down to
 *      `headerHeight` (= `MARGIN + headerLines.length*fontSize +
 *      MARGIN_LINE`, the SAME divider-offset formula `renderer-box.ts`
 *      uses for a leaf box's OWN header/body divider) — filled via
 *      `resolveStateFill`, NO stroke attribute at all (jar-verified: the
 *      header `<path>` carries only `fill`, unlike class's own
 *      `headerBackgroundPath`, which also strokes it).
 *   2. ACTION-ZONE background — ONLY drawn when `bodyLines.length > 0`
 *      (jar's entry/exit action text): a plain, UNROUNDED `<rect
 *      fill="..." stroke="..." stroke-width="1">` (fill AND stroke are the
 *      SAME resolved color, unlike every other box's border) spanning the
 *      box's full width, from `headerBottom` to `headerBottom +
 *      bodyLines.length*fontSize + MARGIN` — this is what visually reads
 *      as "the action text sits on a continuation of the header's own
 *      background", while the (unfilled) area further down where CHILDREN
 *      are drawn stays transparent so nested boxes show through against the
 *      white canvas.
 *   3. OUTLINE — a full, SOLID (never dashed) `<rect fill="none" stroke=
 *      "#181818" stroke-width="0.5" rx="12.5" ry="12.5">` spanning the
 *      composite's whole bounding box — replaces the pre-mechanism-6
 *      `stroke-dasharray` single-rect approximation entirely.
 *   4. DIVIDER(S) — a full-width `<line>` at `headerBottom` (ALWAYS drawn,
 *      matching the leaf box's own unconditional-divider convention, mission
 *      G4 S2), plus a SECOND `<line>` at the action zone's own bottom edge
 *      (ONLY when `bodyLines.length > 0`).
 *   5. TITLE text — the composite's own display name, CENTERED via
 *      `textLength` (SAME convention as the leaf box's own header text,
 *      `renderer-box.ts`), first baseline at `y0 + MARGIN + ascent`.
 *   6. ACTION text — LEFT-aligned at `x0 + MARGIN`, first baseline at
 *      `headerBottom + ascent` — jar-verified to differ from the leaf box's
 *      OWN body-text offset (`renderer-box.ts`'s `dividerY + MARGIN_LINE +
 *      ascent`) by exactly `MARGIN_LINE`: `InnerStateAutonom`'s own
 *      description-block layout has no equivalent leading gap (algebraically
 *      confirmed against `Do_Sector`: divider at y=339, first action-text
 *      baseline at y=349.8889 = 339 + textAscent(14) exactly, NOT
 *      339 + MARGIN_LINE + textAscent(14)).
 *
 * `node.headerLines === undefined` (a hand-built test geometry, OR a
 * concurrent-region LEAF spec — see `GeoSpec`'s `'autonom'` variant doc
 * comment, state-composite-pass.ts) falls back to the PRE-mechanism-6 shape
 * (dashed outer rect + a single centered, unmeasured label) verbatim —
 * mirrors `renderer-box.ts#renderUnmeasuredFallback`'s identical precedent
 * for the leaf box. A non-autonom `cluster` composite (DOT-native cluster
 * label sizing, a genuinely different upstream code path — `bajelo-54-
 * dixe684`'s own `Track_FSM.Run`, header height 19 vs this shape's own
 * MARGIN-formula 24) is NOT threaded with `headerLines` this iteration
 * (`state-composite-cluster.ts` unchanged), so it also takes this SAME
 * fallback — a deliberate, named, non-regressing deferral, not a silent gap
 * (`plans/g4-state-svg/ledger.md` S3, mechanism 6's own "entity-vs-cluster"
 * remainder).
 *
 * @see ~/git/plantuml/.../svek/InnerStateAutonom.java
 */
import type { StateNodeGeo, StateTextLine } from './state-geo-types.js';
import type { Theme } from '../../core/theme.js';
import { rect, line, text, path } from '../../core/svg.js';
import { STATE_DEFAULT_BACKGROUND, STATE_BORDER_STROKE_WIDTH, resolveStateFill, resolveStateBorder, textAscent } from './state-render-colors.js';
import { javaRound4 } from '../../core/number-format.js';

/** `URectangle.halfRounded`'s own `roundCorner/2` — SAME `rx`/`ry` value as
 *  a leaf box's own outline (`renderer-box.ts#STATE_BOX_RX`), duplicated
 *  per this codebase's established per-module constant convention
 *  (`state-sizing.ts`'s own "D1, duplicate consciously" doc comment). */
const STATE_BOX_RX = 12.5;
const MARGIN = 5;
const MARGIN_LINE = 5;

/** `URectangle.halfRounded(roundCorner=25)`'s own arc+line sequence
 *  (r=`STATE_BOX_RX`), reproduced as a local string-builder — the SAME math
 *  `renderer-classifier-box.ts#headerBackgroundPath` already ports for
 *  class, but WITHOUT a stroke attribute (jar-verified: the composite
 *  header `<path>` carries only `fill`, never `stroke`/`stroke-width`). */
function compositeHeaderPath(x0: number, y0: number, width: number, headerHeight: number, fill: string): string {
  const r = STATE_BOX_RX;
  const x1 = x0 + width;
  const y1 = y0 + headerHeight;
  const d =
    `M${x0 + r},${y0} L${x1 - r},${y0} A${r},${r} 0 0 1 ${x1},${y0 + r} ` +
    `L${x1},${y1} L${x0},${y1} L${x0},${y0 + r} A${r},${r} 0 0 1 ${x0 + r},${y0}`;
  return path(d, { fill });
}

function renderCompositeTextLines(
  lines: readonly StateTextLine[],
  xForLine: (ln: StateTextLine) => number,
  startY: number,
  theme: Theme,
): string {
  let out = '';
  lines.forEach((ln, i) => {
    out += text(xForLine(ln), startY + i * theme.fontSize, ln.text, {
      fill: '#000000',
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      lengthAdjust: 'spacing',
      textLength: javaRound4(ln.width),
    });
  });
  return out;
}

/** Pre-mechanism-6 shape — dashed outer rect + a single centered,
 *  unmeasured label. See this module's own top doc comment for when this
 *  fires (`node.headerLines === undefined`). */
function renderCompositeFallback(node: StateNodeGeo, theme: Theme): string {
  const outerBox = rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
    strokeWidth: 1,
    strokeDasharray: '6,3',
    rx: 8,
  });
  const label = text(node.x + node.width / 2, node.y + theme.fontSize + 4, node.display, {
    textAnchor: 'middle',
    fill: theme.colors.text,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
  });
  return outerBox + label;
}

/** Layers 1/3/4a/5 (header path, outline, header/body divider, title) —
 *  ALWAYS drawn regardless of whether an action zone is present. Split out
 *  of {@link renderCompositeMeasured} to stay under this project's
 *  per-function token-length cap. Returns the four markup strings plus the
 *  shared values {@link buildActionZone} needs (`dividerY1`/`ascent`/`fill`)
 *  so the two halves never independently re-derive the same numbers. */
function buildCoreLayers(node: StateNodeGeo, theme: Theme): {
  header: string; outline: string; divider1: string; title: string; dividerY1: number; ascent: number; fill: string;
} {
  const headerLines = node.headerLines!;
  const fill = resolveStateFill(node, STATE_DEFAULT_BACKGROUND);
  // G4 S9: `StateBorderColor<<X>>` cascade -- see `resolveStateBorder`'s own
  // doc comment. Jar-verified `semala-31-joji042`'s own composite `a`.
  const border = resolveStateBorder(node, theme);
  const ascent = textAscent(theme.fontSize);
  const headerHeight = MARGIN + headerLines.length * theme.fontSize + MARGIN_LINE;
  const dividerY1 = node.y + headerHeight;

  const header = compositeHeaderPath(node.x, node.y, node.width, headerHeight, fill);
  const outline = rect(node.x, node.y, node.width, node.height, {
    fill: 'none', stroke: border, strokeWidth: STATE_BORDER_STROKE_WIDTH, rx: STATE_BOX_RX, ry: STATE_BOX_RX,
  });
  const divider1 = line(node.x, dividerY1, node.x + node.width, dividerY1, { stroke: border, strokeWidth: STATE_BORDER_STROKE_WIDTH });
  const title = renderCompositeTextLines(headerLines, (ln) => node.x + node.width / 2 - ln.width / 2, node.y + MARGIN + ascent, theme);

  return { header, outline, divider1, title, dividerY1, ascent, fill };
}

interface ActionZone {
  bg: string;
  divider2: string;
  text: string;
}

const EMPTY_ACTION_ZONE: ActionZone = { bg: '', divider2: '', text: '' };

/** Layers 2/4b/6 (action-zone background, second divider, action text) —
 *  ONLY drawn when `bodyLines.length > 0`. Returned as three SEPARATE
 *  strings (not one concatenated blob) because layers 2/4b/6 interleave
 *  with the core layers' own 3/4a/5 in the jar's real draw order — see this
 *  module's top doc comment (layer 6 for the jar-verified `dividerY1 +
 *  ascent` offset). */
function buildActionZone(
  node: StateNodeGeo,
  theme: Theme,
  dividerY1: number,
  ascent: number,
  fill: string,
): ActionZone {
  const bodyLines = node.bodyLines ?? [];
  if (bodyLines.length === 0) return EMPTY_ACTION_ZONE;
  const border = resolveStateBorder(node, theme);
  const actionZoneHeight = bodyLines.length * theme.fontSize + MARGIN;
  const dividerY2 = dividerY1 + actionZoneHeight;
  const bg = rect(node.x, dividerY1, node.width, actionZoneHeight, { fill, stroke: fill, strokeWidth: 1 });
  const divider2 = line(node.x, dividerY2, node.x + node.width, dividerY2, { stroke: border, strokeWidth: STATE_BORDER_STROKE_WIDTH });
  const text_ = renderCompositeTextLines(bodyLines, () => node.x + MARGIN, dividerY1 + ascent, theme);
  return { bg, divider2, text: text_ };
}

function renderCompositeMeasured(node: StateNodeGeo, theme: Theme): string {
  const core = buildCoreLayers(node, theme);
  const action = buildActionZone(node, theme, core.dividerY1, core.ascent, core.fill);
  return core.header + action.bg + core.outline + core.divider1 + action.divider2 + core.title + action.text;
}

export function renderComposite(node: StateNodeGeo, theme: Theme): string {
  if (node.headerLines === undefined) return renderCompositeFallback(node, theme);
  return renderCompositeMeasured(node, theme);
}

/**
 * Simple-state (`kind:'normal'`) leaf box renderer — mission G4 S2,
 * mechanism 5. Split out of renderer.ts to keep that file under the
 * project's 500-line cap. Jar-verified byte-for-byte against 3 fixtures:
 * jocela-05-niba392 (title-only, `#red` inline override, no body lines —
 * the divider STILL draws, see below), votoki-67-gufa610 (2-line body,
 * name CENTERED against a body-dominated wider box), gefefe-91-xoge233
 * (1-line body, a single literal space " " — `IDLE :` with no real text).
 *
 * Box anatomy (`EntityImageState.java`, MARGIN=MARGIN_LINE=5 —
 * `state-sizing.ts`'s `STATE_MARGIN_DELTA` doc comment):
 *   - rounded rect, rx=ry=12.5, fill/border via `resolveStateFill`/
 *     `theme.colors.border`, stroke-width 0.5
 *   - a FULL-WIDTH (no 1px inset, unlike class's own divider) horizontal
 *     `<line>` divider at `y = MARGIN + headerHeight + MARGIN_LINE` —
 *     ALWAYS drawn for this render path (jar-verified: jocela-05-niba392
 *     has ZERO body lines yet still draws the divider — `EntityImageState`
 *     draws it unconditionally; only the SEPARATE `EntityImageState
 *     EmptyDescription` shape, gated on `hide empty description` AND no
 *     body — state-sizing.ts's `measureEmptyDescription` — omits it. That
 *     boolean is not threaded onto `StateNodeGeo` this iteration — a named,
 *     deferred remainder, `plans/g4-state-svg/ledger.md` S2)
 *   - header (display/name) line(s) CENTERED (`x = box mid -
 *     textLength/2`), first baseline at `MARGIN + ascent`, subsequent
 *     lines step by `theme.fontSize`
 *   - body (description) line(s) LEFT-aligned at `box.x + MARGIN`, first
 *     baseline at `dividerY + MARGIN_LINE + ascent`
 * Text fill is a HARDCODED `#000000` in the measured path (not
 * `theme.colors.text`) — matches class's own `EntityImageClassHeader`
 * precedent (`renderer-classifier-box.ts#renderRowText`'s identical doc
 * comment); the UNMEASURED fallback path below (json) keeps its
 * PRE-EXISTING `theme.colors.text` behavior unchanged.
 * @see ~/git/plantuml/.../svek/image/EntityImageState.java
 * @see ~/git/plantuml/.../svek/image/EntityImageStateCommon.java (MARGIN/MARGIN_LINE=5)
 */
import type { StateNodeGeo, StateTextLine } from './state-geo-types.js';
import type { Theme } from '../../core/theme.js';
import { rect, line, text, path } from '../../core/svg.js';
import { STATE_DEFAULT_BACKGROUND, STATE_BORDER_STROKE_WIDTH, resolveStateFillBucketed, resolveStateBorder, resolveStateFontColor, resolveStateFontSize, textAscent } from './state-render-colors.js';
import { javaRound4 } from '../../core/number-format.js';

const STATE_BOX_RX = 12.5;
const MARGIN = 5;
const MARGIN_LINE = 5;
/** `USymbolFrame#getMargin`/`BodyEnhanced1#getMarginX` -- duplicated from
 *  `state-sizing.ts`'s own `SDL_MARGIN`/`BODY_MARGIN_X` (this codebase's
 *  established per-module constant convention, `STATE_BOX_RX`'s own
 *  precedent above/`renderer-composite-box.ts`'s identical duplication). */
const SDL_MARGIN = { x1: 15, x2: 25, y1: 20, y2: 10 };
const BODY_MARGIN_X = 6;

function renderTextLines(
  lines: readonly StateTextLine[],
  xForLine: (ln: StateTextLine) => number,
  startY: number,
  theme: Theme,
  // mission G4 S15: `skinparam stateFontColor<<X>>` -- see
  // `state-render-colors.ts#resolveStateFontColor`'s own doc comment.
  // Defaults to jar's own hardcoded `#000000` label-text default (every
  // pre-S15 call site's unchanged behavior).
  fill: string = '#000000',
  // mission G4 S16: `skinparam stateFontSize<<X>>` -- see
  // `state-render-colors.ts#resolveStateFontSize`'s own doc comment.
  // Defaults to `theme.fontSize` (every pre-S16 call site's unchanged
  // behavior).
  fontSize: number = theme.fontSize,
): string {
  let out = '';
  lines.forEach((ln, i) => {
    out += text(xForLine(ln), startY + i * fontSize, ln.text, {
      fill,
      fontFamily: theme.fontFamily,
      fontSize,
      lengthAdjust: 'spacing',
      textLength: javaRound4(ln.width),
    });
  });
  return out;
}

/**
 * `kind:'json'` (mission A4 Phase L iter 20) and any other pre-measurement
 * caller reuse this UNCHANGED fallback (`node.headerLines === undefined`):
 * a single centered, unmeasured `<text>`, matching the pre-S2 behavior
 * exactly — faithful `shape=plaintext` TABLE content for json is deferred
 * (renderer.ts's own `renderJson` doc comment), not attempted here.
 */
function renderUnmeasuredFallback(node: StateNodeGeo, theme: Theme, box: string): string {
  return (
    box +
    text(node.x + node.width / 2, node.y + node.height / 2 + theme.fontSize / 2, node.display, {
      textAnchor: 'middle',
      fill: theme.colors.text,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
    })
  );
}

/**
 * mission G4 S5: `EntityImageStateEmptyDescription.drawU` -- rect ONLY (no
 * divider, no body), label CENTERED both horizontally AND vertically
 * (`xDesc = (dimTotal.width - dimHeader.width) / 2`, `yDesc = (dimTotal
 * .height - dimHeader.height) / 2` in upstream's own coordinates; `
 * dimHeader.height` is `headerLines.length * fontSize`, matching every
 * other box's own `MEASURE_LINES`-derived text-block-height convention).
 * jar-verified `gopumi-11-pise779`'s `S1` (single line, MIN 50x40 box):
 * box x=25.86 y=86 w=50 h=40, text x=42.285 y=109.8889 -- `yDesc = (40 -
 * 14)/2 = 13`, baseline = `node.y + 13 + textAscent(14) = 86 + 23.8889 =
 * 109.8889`, EXACT match.
 * @see ~/git/plantuml/.../svek/image/EntityImageStateEmptyDescription.java
 */
function renderEmptyDescription(node: StateNodeGeo, theme: Theme, box: string): string {
  const headerLines = node.headerLines!;
  // mission G4 S16: `skinparam stateFontSize<<X>>` -- see
  // `state-render-colors.ts#resolveStateFontSize`'s own doc comment.
  const fontSize = resolveStateFontSize(node, theme, theme.fontSize);
  const ascent = textAscent(fontSize);
  const textBlockHeight = headerLines.length * fontSize;
  const yDesc = (node.height - textBlockHeight) / 2;
  const headerMarkup = renderTextLines(
    headerLines,
    (ln) => node.x + node.width / 2 - ln.width / 2,
    node.y + yDesc + ascent,
    theme,
    '#000000',
    fontSize,
  );
  return box + headerMarkup;
}

/**
 * mission G4 S14: `EntityImageState2`/`USymbolFrame#drawFrame` -- a
 * `<<sdlreceive>>` leaf box draws UNWRAPPED (no `<g>`, `wrapClassFor`'s own
 * doc comment), a plain (non-rounded-header, still `rx/ry=12.5`) box, a
 * fold-notch `<path>` (`textWidth = width/3`, `cornersize = 7`,
 * `textHeight = 12` -- `USymbolFrame#drawFrame`'s own `dimTitle.getWidth()
 * === 0` branch, since `asSmall` always passes an empty `dimTitle`), and a
 * single TOP-LEFT-ANCHORED (not centered) label at `x = node.x +
 * SDL_MARGIN.x1 + BODY_MARGIN_X`, `y = node.y + SDL_MARGIN.y1 + ascent`
 * (`USymbolFrame#asSmall`'s own `UTranslate(margin.getX1(), margin.getY1())`
 * placement of the merged stereotype+label block -- the stereotype
 * TextBlock is always empty for state's own `asSmall` call, so only the
 * label's own baseline offset (`ascent`) is added). NO divider line (only
 * `EntityImageState`'s own box draws one). jar-verified byte-exact against
 * `cekolo-21-gini183`'s own sdlreceive node (rect 407.46,7 115.0875x44;
 * path `M445.8225,7 L445.8225,12 L438.8225,19 L407.46,19`; text
 * 428.46,37.8889).
 * @see ~/git/plantuml/.../svek/image/EntityImageState2.java
 * @see ~/git/plantuml/.../decoration/symbol/USymbolFrame.java#drawFrame
 * @see state-sizing.ts's `SDL_MARGIN`/`BODY_MARGIN_X` doc comment
 * @see plans/g4-state-svg/ledger.md (S14)
 */
export function renderSdlReceive(node: StateNodeGeo, theme: Theme): string {
  const fill = resolveStateFillBucketed(node, theme, STATE_DEFAULT_BACKGROUND);
  const border = resolveStateBorder(node, theme);
  const box = rect(node.x, node.y, node.width, node.height, {
    fill,
    stroke: border,
    strokeWidth: STATE_BORDER_STROKE_WIDTH,
    rx: STATE_BOX_RX,
    ry: STATE_BOX_RX,
  });

  const textWidth = node.width / 3;
  const cornerSize = 7;
  const textHeight = 12;
  const x0 = node.x;
  const y0 = node.y;
  const d =
    `M${x0 + textWidth},${y0} L${x0 + textWidth},${y0 + textHeight - cornerSize} ` +
    `L${x0 + textWidth - cornerSize},${y0 + textHeight} L${x0},${y0 + textHeight}`;
  const notch = path(d, { stroke: border, strokeWidth: STATE_BORDER_STROKE_WIDTH });

  // mission G4 S16: `skinparam stateFontSize<<X>>` -- see
  // `state-render-colors.ts#resolveStateFontSize`'s own doc comment.
  const fontSize = resolveStateFontSize(node, theme, theme.fontSize);
  const ascent = textAscent(fontSize);
  const label = text(
    node.x + SDL_MARGIN.x1 + BODY_MARGIN_X,
    node.y + SDL_MARGIN.y1 + ascent,
    node.display,
    {
      fill: '#000000',
      fontFamily: theme.fontFamily,
      fontSize,
      lengthAdjust: 'spacing',
      textLength: javaRound4(node.headerLines?.[0]?.width ?? 0),
    },
  );

  return box + notch + label;
}

export function renderNormal(node: StateNodeGeo, theme: Theme): string {
  // mission G4 S10: `state`-element bucket tier -- see `resolveStateFillBucketed`'s own doc comment.
  const fill = resolveStateFillBucketed(node, theme, STATE_DEFAULT_BACKGROUND);
  // G4 S9: `StateBorderColor<<X>>` cascade -- see `resolveStateBorder`'s own
  // doc comment.
  const border = resolveStateBorder(node, theme);
  const box = rect(node.x, node.y, node.width, node.height, {
    fill,
    stroke: border,
    strokeWidth: STATE_BORDER_STROKE_WIDTH,
    rx: STATE_BOX_RX,
    ry: STATE_BOX_RX,
  });

  if (node.headerLines === undefined) {
    return renderUnmeasuredFallback(node, theme, box);
  }

  if (node.emptyDescription === true) {
    return renderEmptyDescription(node, theme, box);
  }

  // mission G4 S16: `skinparam stateFontSize<<X>>` -- see
  // `state-render-colors.ts#resolveStateFontSize`'s own doc comment; jar-
  // verified `laferu-31-tice836` (font-size 30, box widened to match the
  // `state-sizing.ts` measurement this SAME resolution feeds at layout
  // time).
  const fontSize = resolveStateFontSize(node, theme, theme.fontSize);
  const ascent = textAscent(fontSize);
  // mission G4 S15: `StateFontColor<<X>>` cascade -- see
  // `resolveStateFontColor`'s own doc comment.
  const fontColor = resolveStateFontColor(node, theme, '#000000');
  const headerMarkup = renderTextLines(
    node.headerLines,
    (ln) => node.x + node.width / 2 - ln.width / 2,
    node.y + MARGIN + ascent,
    theme,
    fontColor,
    fontSize,
  );

  const dividerY = node.y + MARGIN + node.headerLines.length * fontSize + MARGIN_LINE;
  const divider = line(node.x, dividerY, node.x + node.width, dividerY, {
    stroke: border,
    strokeWidth: STATE_BORDER_STROKE_WIDTH,
  });

  const bodyLines = node.bodyLines ?? [];
  const bodyMarkup = renderTextLines(bodyLines, () => node.x + MARGIN, dividerY + MARGIN_LINE + ascent, theme, fontColor, fontSize);

  return box + divider + headerMarkup + bodyMarkup;
}

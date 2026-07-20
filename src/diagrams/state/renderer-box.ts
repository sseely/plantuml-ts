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
import { rect, line, text } from '../../core/svg.js';
import { STATE_DEFAULT_BACKGROUND, STATE_BORDER_STROKE_WIDTH, resolveStateFill, resolveStateBorder, textAscent } from './state-render-colors.js';
import { javaRound4 } from '../../core/number-format.js';

const STATE_BOX_RX = 12.5;
const MARGIN = 5;
const MARGIN_LINE = 5;

function renderTextLines(
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
  const ascent = textAscent(theme.fontSize);
  const textBlockHeight = headerLines.length * theme.fontSize;
  const yDesc = (node.height - textBlockHeight) / 2;
  const headerMarkup = renderTextLines(
    headerLines,
    (ln) => node.x + node.width / 2 - ln.width / 2,
    node.y + yDesc + ascent,
    theme,
  );
  return box + headerMarkup;
}

export function renderNormal(node: StateNodeGeo, theme: Theme): string {
  const fill = resolveStateFill(node, STATE_DEFAULT_BACKGROUND);
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

  const ascent = textAscent(theme.fontSize);
  const headerMarkup = renderTextLines(
    node.headerLines,
    (ln) => node.x + node.width / 2 - ln.width / 2,
    node.y + MARGIN + ascent,
    theme,
  );

  const dividerY = node.y + MARGIN + node.headerLines.length * theme.fontSize + MARGIN_LINE;
  const divider = line(node.x, dividerY, node.x + node.width, dividerY, {
    stroke: border,
    strokeWidth: STATE_BORDER_STROKE_WIDTH,
  });

  const bodyLines = node.bodyLines ?? [];
  const bodyMarkup = renderTextLines(bodyLines, () => node.x + MARGIN, dividerY + MARGIN_LINE + ascent, theme);

  return box + divider + headerMarkup + bodyMarkup;
}

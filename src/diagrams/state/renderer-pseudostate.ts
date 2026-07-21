/**
 * Pseudostate shape renderers (initial/final/fork/join/syncBar/choice/
 * history/deepHistory) — mission G4 S2, mechanism 5. Split out of
 * renderer.ts to keep that file under the project's 500-line cap.
 * Jar-verified byte-for-byte against gefefe-91-xoge233 (initial),
 * bajelo-54-dixe684 (final), and cekolo-21-gini183 (choice, fork/join
 * bars, history, deepHistory — every pseudostate stereotype in one
 * fixture).
 *
 * @see ~/git/plantuml/.../svek/image/CircleStart.java (initial, SIZE=20)
 * @see ~/git/plantuml/.../svek/image/CircleEnd.java (final, SIZE=22, inner delta=5)
 * @see ~/git/plantuml/.../svek/image/EntityImageSynchroBar.java (fork/join/syncBar)
 * @see ~/git/plantuml/.../svek/image/EntityImageBranch.java (choice, SIZE*2=24)
 * @see ~/git/plantuml/.../svek/image/EntityImagePseudoState.java (history/deepHistory)
 */
import type { StateNodeGeo } from './state-geo-types.js';
import type { Theme } from '../../core/theme.js';
import { ellipse, rect, diamond, text } from '../../core/svg.js';
import {
  STATE_DEFAULT_BACKGROUND,
  STATE_BORDER_STROKE_WIDTH,
  resolveStateFill,
  textAscent,
  textDescent,
} from './state-render-colors.js';
import { javaRound4 } from '../../core/number-format.js';
import { historyLabelText } from './state-sizing.js';

/** `CircleStart`/`CircleEnd`'s own default fill+stroke — distinct from the
 *  general state-box default (`STATE_DEFAULT_BACKGROUND`), jar-verified
 *  gefefe-91-xoge233 (start), bajelo-54-dixe684 (end). Both fill AND stroke
 *  resolve to this SAME hex (not fill=this/stroke=theme.colors.border). */
const PSEUDO_ANCHOR_COLOR = '#222222';
/** `EntityImageSynchroBar`'s own default fill (fork/join/syncBar bars) —
 *  jar-verified cekolo-21-gini183: `stroke="none"`, `stroke-width="1"`. */
const SYNCHRO_BAR_COLOR = '#555555';

function pseudoCenter(node: StateNodeGeo): { cx: number; cy: number } {
  return { cx: node.x + node.width / 2, cy: node.y + node.height / 2 };
}

/** `CircleStart.java` (SIZE=20): one filled `<ellipse>`. Fill defaults to
 *  `#222222` (or the node's own `#color` override); stroke is ALWAYS the
 *  literal `#222222` default -- mission G4 S11, jar-verified
 *  `ceruzi-77-give569`: `state start1 <<start>> #Red` renders
 *  `fill="#FF0000"` but `stroke:#222222` UNCHANGED (`Colors#getColor
 *  (BackGroundColor)` only ever feeds `CircleStart`'s FILL parameter --
 *  the stroke color is never threaded from the override at all). Was
 *  `stroke: fill` before this fix, which colored the stroke too whenever an
 *  override was present -- correct only in the (much more common,
 *  already-pinned) no-override case, where fill and stroke coincidentally
 *  share the SAME `#222222` default value. */
export function renderInitial(node: StateNodeGeo): string {
  const { cx, cy } = pseudoCenter(node);
  const r = node.width / 2;
  const fill = resolveStateFill(node, PSEUDO_ANCHOR_COLOR);
  return ellipse(cx, cy, r, r, { fill, stroke: PSEUDO_ANCHOR_COLOR, 'stroke-width': 1 });
}

/** `CircleEnd.java` (SIZE=22, inner `delta=5` inset): an unfilled outer ring
 *  plus a filled inner dot, SAME center. Stroke on BOTH ellipses is ALWAYS
 *  the literal `#222222` default, same `#color`-override scoping as
 *  {@link renderInitial}'s own doc comment (jar-verified `ceruzi`'s `state
 *  end2 <<end>> #Green`: inner dot `fill="#008000"`, both `stroke:#222222`
 *  unchanged). */
export function renderFinal(node: StateNodeGeo): string {
  const { cx, cy } = pseudoCenter(node);
  const outerR = node.width / 2;
  const innerR = outerR - 5;
  const fill = resolveStateFill(node, PSEUDO_ANCHOR_COLOR);
  return (
    ellipse(cx, cy, outerR, outerR, { fill: 'none', stroke: PSEUDO_ANCHOR_COLOR, 'stroke-width': 1 }) +
    ellipse(cx, cy, innerR, innerR, { fill, stroke: PSEUDO_ANCHOR_COLOR, 'stroke-width': 1 })
  );
}

/** `EntityImageSynchroBar.java`: a plain filled bar, NO stroke (`stroke:
 *  none`), NOT wrapped in a `<g>` (mission G4 S1's own `wrapClassFor`
 *  dispatch already omits the wrap for this kind). */
export function renderForkJoin(node: StateNodeGeo): string {
  const fill = resolveStateFill(node, SYNCHRO_BAR_COLOR);
  return rect(node.x, node.y, node.width, node.height, { fill, stroke: 'none', strokeWidth: 1 });
}

/** `EntityImageBranch.java` (SIZE*2=24 diamond): jar draws the extra
 *  `stroke-linejoin:miter;stroke-miterlimit:10` pair on every sampled
 *  choice diamond — `compareSvg`'s attribute comparator treats a missing
 *  attr as a real diff (union of both sides' attr names), so these are
 *  REQUIRED, not decorative. Shares the plain leaf box's own default fill/
 *  border/stroke-width (`state-render-colors.ts`'s own module doc comment
 *  explains why `EntityImageBranch` shares `EntityImageStateCommon.STYLE`). */
export function renderChoiceJunction(node: StateNodeGeo, theme: Theme): string {
  const { cx, cy } = pseudoCenter(node);
  const size = node.width / 2;
  const fill = resolveStateFill(node, STATE_DEFAULT_BACKGROUND);
  const markup = diamond(cx, cy, size, {
    fill,
    stroke: theme.colors.border,
    'stroke-width': STATE_BORDER_STROKE_WIDTH,
    'stroke-linejoin': 'miter',
    'stroke-miterlimit': 10,
  });
  return closeDiamondPoints(markup);
}

/**
 * mission G4 S8 (kilato-12-laso661): jar's `EntityImageBranch` closes the
 * diamond `<polygon>` by repeating its first point at the end (5 coordinate
 * pairs for a 4-sided diamond) -- `core/svg.ts#diamond` (shared with
 * activity/chronology, out of this mission's write-set) does not, so the
 * closing repeat is appended here, state-locally, via a targeted
 * `points="..."` patch rather than touching the shared helper.
 */
function closeDiamondPoints(markup: string): string {
  const m = /points="([^"]*)"/.exec(markup);
  if (m === null) return markup;
  const pts = m[1]!;
  const first = pts.trim().split(/[\s,]+/).slice(0, 2).join(',');
  return markup.replace(`points="${pts}"`, `points="${pts} ${first}"`);
}

/** `EntityImagePseudoState.java`/`EntityImageDeepHistory.java` (SIZE=22):
 *  an unfilled-vs-box-default-filled `<ellipse>` (jar-verified: SAME
 *  fill/border/stroke-width as a plain leaf box, NOT `PSEUDO_ANCHOR_COLOR`)
 *  plus a centered "H"/"H*" label using the SAME `textLength`-based
 *  centering convention as {@link renderNormal} in renderer-box.ts.
 *  `node.headerLines[0]` carries the pre-measured label
 *  (`state-sizing.ts#historyLabelText`/`measureTextLines`, threaded by the
 *  layout builders); a missing entry (hand-built test geometries that
 *  bypass `layoutState`'s own measurement pass — never a real diagram)
 *  falls back to a plain centered, unmeasured "H"/"H*" label, mirroring
 *  `renderer-box.ts#renderNormal`'s identical pre-measurement fallback
 *  convention. */
export function renderHistory(node: StateNodeGeo, theme: Theme): string {
  const { cx, cy } = pseudoCenter(node);
  const r = node.width / 2;
  const fill = resolveStateFill(node, STATE_DEFAULT_BACKGROUND);
  const shape = ellipse(cx, cy, r, r, { fill, stroke: theme.colors.border, 'stroke-width': STATE_BORDER_STROKE_WIDTH });
  const label = node.headerLines?.[0];
  if (label === undefined) {
    const fallbackText = historyLabelText(node.kind);
    return (
      shape +
      text(cx, cy + theme.fontSize / 3, fallbackText, {
        textAnchor: 'middle',
        fill: '#000000',
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize,
      })
    );
  }
  const yOffset = (textAscent(theme.fontSize) - textDescent(theme.fontSize)) / 2;
  const labelMarkup = text(cx - label.width / 2, cy + yOffset, label.text, {
    fill: '#000000',
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    lengthAdjust: 'spacing',
    textLength: javaRound4(label.width),
  });
  return shape + labelMarkup;
}

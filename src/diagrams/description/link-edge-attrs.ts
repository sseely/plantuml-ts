/**
 * Link-derived DOT edge attributes + graph spacing for the description engine.
 *
 * Split out of layout-helpers.ts (500-line cap). Faithful ports:
 * - DotStringFactory.createDotString nodesep/ranksep (dzeta/10 with 35/60
 *   floors); SvekEdge.getHorizontalDzeta/getVerticalDzeta (ArithmeticStrategySum
 *   over main label + tail/head qualifiers + decor margins).
 * - SvekEdge minlen/style=invis/label emission inputs.
 */

import type { DescriptiveLink } from './ast.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import type { DotInputEdge } from '../../core/graph-layout.js';

// ---------------------------------------------------------------------------
// Graph spacing (nodesep / ranksep) — DotStringFactory.createDotString +
// SvekEdge.getHorizontalDzeta/getVerticalDzeta
// ---------------------------------------------------------------------------

/** Svek getMinNodeSep() (non-activity diagrams). */
const MIN_NODESEP = 35;
/** Svek getMinRankSep() (non-activity diagrams). */
const MIN_RANKSEP = 60;
/** DotStringFactory.getMinRankSep():247-249 — `!pragma kermor on` floors
 *  ranksep at 40px instead of 60px; getMinNodeSep() never checks kermor. */
const MIN_RANKSEP_KERMOR = 40;
/** DotStringFactory.getVerticalDzeta():111-114 — under kermor, ranksep
 *  divides the max vertical dzeta by 100 instead of 10 (nodesep's
 *  horizontal-dzeta divisor is unaffected — getHorizontalDzeta never
 *  checks kermor). */
const VERTICAL_DIVISOR_KERMOR = 100;
const VERTICAL_DIVISOR = 10;
/** LinkDecor.java margins: NONE=2, ARROW/ARROW_TRIANGLE=10. */
const DECOR_MARGIN_NONE = 2;
const DECOR_MARGIN_ARROW = 10;

/** Head-decor margin for a link's arrowHead (tail decor is always NONE — we
 *  do not parse tail arrowheads today). */
function headDecorMargin(arrowHead: DescriptiveLink['arrowHead']): number {
  if (arrowHead === 'open' || arrowHead === 'filled') return DECOR_MARGIN_ARROW;
  return DECOR_MARGIN_NONE;
}

interface LinkDzeta {
  horizontal: number;
  vertical: number;
}

/**
 * SvekEdge.getHorizontalDzeta / getVerticalDzeta, in pixels.
 *
 * - Self-loop (from === to): both dzetas equal decorDzeta (label ignored).
 * - length === 1 (SvekEdge.isHorizontal()): horizontal = labelWidth + decor;
 *   vertical = 0.
 * - length > 1: vertical = labelHeight + decor; horizontal = 0.
 *
 * We have no tail/head qualifiers today, so only the label contributes
 * beyond decorDzeta.
 */
/** The three text blocks SvekEdge feeds its ArithmeticStrategySum: the main
 *  label (stereotype included) and the tail/head qualifier labels. */
function dzetaTexts(link: DescriptiveLink): string[] {
  const texts: string[] = [];
  const main = mainLabelText(link);
  if (main !== undefined) texts.push(main);
  if (link.firstLabel !== undefined) texts.push(link.firstLabel);
  if (link.secondLabel !== undefined) texts.push(link.secondLabel);
  return texts;
}

function computeLinkDzeta(
  link: DescriptiveLink,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): LinkDzeta {
  const decorDzeta = DECOR_MARGIN_NONE + headDecorMargin(link.arrowHead);

  if (link.from === link.to) {
    return { horizontal: decorDzeta, vertical: decorDzeta };
  }

  const texts = dzetaTexts(link);
  if (link.length === 1) {
    const widthSum = texts.reduce((s, t) => s + measurer.measure(t, fontSpec).width, 0);
    return { horizontal: widthSum + decorDzeta, vertical: 0 };
  }

  const heightSum = texts.reduce((s, t) => s + measurer.measure(t, fontSpec).height, 0);
  return { horizontal: 0, vertical: heightSum + decorDzeta };
}

/**
 * DotStringFactory.createDotString nodesep/ranksep:
 *   nodesep = max(maxOverEdges(horizontalDzeta) / 10, 35)
 *   ranksep = max(maxOverEdges(verticalDzeta) / D, F)
 * where D=10/F=60 normally, D=100/F=40 under `!pragma kermor on`
 * (DotStringFactory.getVerticalDzeta():111-114, getMinRankSep():247-249 —
 * nodesep's horizontal-dzeta divisor/floor never check kermor).
 *
 * (The skinparam nodesep/ranksep override is deferred — Theme has no such
 * fields yet.)
 */
export function computeGraphSpacing(
  links: readonly DescriptiveLink[],
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  kermor = false,
): { nodeSep: number; rankSep: number } {
  let maxHorizontal = 0;
  let maxVertical = 0;
  for (const link of links) {
    const dzeta = computeLinkDzeta(link, fontSpec, measurer);
    if (dzeta.horizontal > maxHorizontal) maxHorizontal = dzeta.horizontal;
    if (dzeta.vertical > maxVertical) maxVertical = dzeta.vertical;
  }
  const verticalDivisor = kermor ? VERTICAL_DIVISOR_KERMOR : VERTICAL_DIVISOR;
  const rankFloor = kermor ? MIN_RANKSEP_KERMOR : MIN_RANKSEP;
  return {
    nodeSep: Math.max(maxHorizontal / 10, MIN_NODESEP),
    rankSep: Math.max(maxVertical / verticalDivisor, rankFloor),
  };
}

/**
 * DotInputEdge attributes contributed by a link: minLen (SvekEdge.java:417-427;
 * useRankSame() is hardwired false, so minlen = length - 1), hidden→invis
 * (SvekEdge still emits the edge — a hidden link counts structurally), and
 * tail/head qualifier-label dimensions (CommandLinkElement FIRST_LABEL/
 * SECOND_LABEL) for svek-dot-emit.ts oracle-DOT parity. tailLabelWidth/Height
 * and headLabelWidth/Height are emitter-only — the real layout engine ignores
 * them (see graph-layout.types.ts).
 */
/** Rendered main-label text: upstream keeps a post-colon `<<stereotype>>`
 *  inside the label (drawn as guillemets above the text) — Labels.java does
 *  not strip it, so a stereotype-only link still HAS a label in svek DOT. */
function mainLabelText(link: DescriptiveLink): string | undefined {
  const parts: string[] = [];
  if (link.stereotype !== undefined) parts.push(`«${link.stereotype}»`);
  if (link.label !== undefined) parts.push(link.label);
  return parts.length > 0 ? parts.join('\n') : undefined;
}

export function buildLinkEdgeAttributes(
  link: DescriptiveLink,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  linetype?: 'ortho' | 'polyline',
): NonNullable<DotInputEdge['attributes']> {
  const attrs: NonNullable<DotInputEdge['attributes']> = { minLen: link.length - 1 };
  if (link.hidden === true) attrs.invis = true;
  const labelText = mainLabelText(link);
  if (labelText !== undefined) {
    const m = measurer.measure(labelText, fontSpec);
    // Under `skinparam linetype ortho`, svek emits the label as xlabel
    // (SvekEdge.java:434-441: dotSplines == ORTHO branch).
    if (linetype === 'ortho') {
      attrs.xlabel = labelText;
      attrs.xlabelWidth = m.width;
      attrs.xlabelHeight = m.height;
    } else {
      attrs.label = labelText;
      attrs.labelWidth = m.width;
      attrs.labelHeight = m.height;
    }
  }
  if (link.firstLabel !== undefined) {
    const m = measurer.measure(link.firstLabel, fontSpec);
    attrs.tailLabelWidth = m.width;
    attrs.tailLabelHeight = m.height;
  }
  if (link.secondLabel !== undefined) {
    const m = measurer.measure(link.secondLabel, fontSpec);
    attrs.headLabelWidth = m.width;
    attrs.headLabelHeight = m.height;
  }
  return attrs;
}

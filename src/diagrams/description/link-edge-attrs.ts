/**
 * Link-derived DOT edge attributes + graph spacing for the description engine.
 *
 * Split out of layout-helpers.ts (500-line cap). Faithful ports:
 * - DotStringFactory.createDotString nodesep/ranksep (dzeta/10 with 35/60
 *   floors); SvekEdge.getHorizontalDzeta/getVerticalDzeta (ArithmeticStrategySum
 *   over main label + tail/head qualifiers + decor margins).
 * - SvekEdge minlen/style=invis/label emission inputs.
 *
 * D9 (plans/si5b-stdlib/decisions.md): a link/edge label carrying a Creole
 * `<img>`/`<$sprite>` atom contributes the atom's scaled pixel dims to
 * these same measurements -- routed through `../../core/creole-atoms.js`,
 * same precedent as `resolveInlineLinks`/I5 for `[[url label]]`.
 */

import type { DescriptiveLink } from './ast.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import type { DotInputEdge } from '../../core/graph-layout.js';
import { resolveInlineLinks } from './parse-helpers.js';
import { measureLineWithAtoms, type SpriteDimsLookup } from '../../core/creole-atoms.js';

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

/** Bundles the text-measurement inputs shared by every label site below, so
 *  individual helper functions stay under the 5-parameter guideline instead
 *  of threading `fontSpec`/`measurer`/`sprites` through each one separately. */
interface MeasureCtx {
  fontSpec: FontSpec;
  measurer: StringMeasurer;
  sprites: SpriteDimsLookup | undefined;
}

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
  if (main !== undefined) texts.push(resolveInlineLinks(main));
  if (link.firstLabel !== undefined) texts.push(resolveInlineLinks(link.firstLabel));
  if (link.secondLabel !== undefined) texts.push(resolveInlineLinks(link.secondLabel));
  return texts;
}

function computeLinkDzeta(link: DescriptiveLink, ctx: MeasureCtx): LinkDzeta {
  const decorDzeta = DECOR_MARGIN_NONE + headDecorMargin(link.arrowHead);

  if (link.from === link.to) {
    return { horizontal: decorDzeta, vertical: decorDzeta };
  }

  const texts = dzetaTexts(link);
  if (link.length === 1) {
    const widthSum = texts.reduce(
      (s, t) => s + measureLineWithAtoms(t, ctx.fontSpec, ctx.measurer, ctx.sprites).width,
      0,
    );
    return { horizontal: widthSum + decorDzeta, vertical: 0 };
  }

  const heightSum = texts.reduce(
    (s, t) => s + measureLineWithAtoms(t, ctx.fontSpec, ctx.measurer, ctx.sprites).height,
    0,
  );
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
  sprites?: SpriteDimsLookup,
): { nodeSep: number; rankSep: number } {
  const ctx: MeasureCtx = { fontSpec, measurer, sprites };
  let maxHorizontal = 0;
  let maxVertical = 0;
  for (const link of links) {
    const dzeta = computeLinkDzeta(link, ctx);
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

/** Applies the main label (`label`/`labelWidth`/`labelHeight`, or the
 *  `xlabel*` triple under `skinparam linetype ortho` — SvekEdge.java:434-441)
 *  to `attrs`, resolving `[[url]]` markup (I5) and img/sprite atoms (D9)
 *  before measuring. No-op when the link has no stereotype/label. */
function applyMainLabel(
  attrs: NonNullable<DotInputEdge['attributes']>,
  link: DescriptiveLink,
  ctx: MeasureCtx,
  linetype: 'ortho' | 'polyline' | undefined,
): void {
  const labelText = mainLabelText(link);
  if (labelText === undefined) return;
  const resolvedLabelText = resolveInlineLinks(labelText);
  const m = measureLineWithAtoms(resolvedLabelText, ctx.fontSpec, ctx.measurer, ctx.sprites);
  if (linetype === 'ortho') {
    attrs.xlabel = resolvedLabelText;
    attrs.xlabelWidth = m.width;
    attrs.xlabelHeight = m.height;
  } else {
    attrs.label = resolvedLabelText;
    attrs.labelWidth = m.width;
    attrs.labelHeight = m.height;
  }
}

/** Applies the tail/head qualifier-label dims (CommandLinkElement
 *  FIRST_LABEL/SECOND_LABEL) to `attrs`, same [[url]]/atom resolution as
 *  the main label. */
function applyQualifierLabels(
  attrs: NonNullable<DotInputEdge['attributes']>,
  link: DescriptiveLink,
  ctx: MeasureCtx,
): void {
  if (link.firstLabel !== undefined) {
    const m = measureLineWithAtoms(resolveInlineLinks(link.firstLabel), ctx.fontSpec, ctx.measurer, ctx.sprites);
    attrs.tailLabelWidth = m.width;
    attrs.tailLabelHeight = m.height;
  }
  if (link.secondLabel !== undefined) {
    const m = measureLineWithAtoms(resolveInlineLinks(link.secondLabel), ctx.fontSpec, ctx.measurer, ctx.sprites);
    attrs.headLabelWidth = m.width;
    attrs.headLabelHeight = m.height;
  }
}

export function buildLinkEdgeAttributes(
  link: DescriptiveLink,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  linetype?: 'ortho' | 'polyline',
  sprites?: SpriteDimsLookup,
): NonNullable<DotInputEdge['attributes']> {
  const ctx: MeasureCtx = { fontSpec, measurer, sprites };
  const attrs: NonNullable<DotInputEdge['attributes']> = { minLen: link.length - 1 };
  if (link.hidden === true) attrs.invis = true;
  applyMainLabel(attrs, link, ctx, linetype);
  applyQualifierLabels(attrs, link, ctx);
  return attrs;
}

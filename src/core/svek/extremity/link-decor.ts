import type { Paint } from '../../paint.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import { ExtremityFactoryTriangle } from './ExtremityTriangle.js';
import { ExtremityFactoryArrow } from './ExtremityArrow.js';
import { ExtremityFactoryDiamond } from './ExtremityDiamond.js';
import { ExtremityFactoryCircle } from './ExtremityCircle.js';
import { ExtremityFactorySquare } from './ExtremitySquare.js';
import { ExtremityFactoryCrowfoot } from './ExtremityCrowfoot.js';
import { ExtremityFactoryCircleCrowfoot } from './ExtremityCircleCrowfoot.js';
import { ExtremityFactoryLineCrowfoot } from './ExtremityLineCrowfoot.js';
import { ExtremityFactoryCircleLine } from './ExtremityCircleLine.js';
import { ExtremityFactoryDoubleLine } from './ExtremityDoubleLine.js';
import { ExtremityFactoryNotNavigable } from './ExtremityNotNavigable.js';
import { ExtremityFactoryParenthesis } from './ExtremityParenthesis.js';
import { ExtremityFactoryCircleConnect } from './ExtremityCircleConnect.js';
import { ExtremityFactoryPlus } from './ExtremityPlus.js';
import { ExtremityFactoryExtendsLike } from './ExtremityExtendsLike.js';
import { ExtremityFactoryHalfArrow } from './ExtremityHalfArrow.js';

/**
 * link-decor.ts — the reachable subset of `LinkDecor`
 * (decoration/LinkDecor.java) this port's description-diagram parser
 * (`src/diagrams/description/link-grammar.ts`) can actually produce,
 * plus the machinery to turn a raw decor token (`DescriptiveLink
 * .tailDecor`/`.headDecor` — the literal matched substring, e.g. `'<|'`,
 * `'o'`, `'>>'`) into an `ExtremityFactory`.
 *
 * Reachability (T13 report — see the decor mapping table there):
 * `link-grammar.ts`'s `DECORS1_TOKENS`/`DECORS2_TOKENS` are a 1:1 copy
 * of `LinkDecor.java`'s own `decors1(...)`/`decors2(...)` calls across
 * all 20 non-`NONE` enum entries EXCEPT three whose `decors1`/`decors2`
 * are BOTH `null` upstream (no text token can ever select them):
 * `ARROW_AND_CIRCLE`, `CIRCLE_CROSS`, and `SQUARE_toberemoved` (dead/
 * deprecated upstream itself, per its own name). Every other LinkDecor
 * is reachable and mapped below.
 *
 * `EXTENDS` always resolves via `LinkDecor.getExtremityFactoryComplete`
 * (`ExtremityFactoryTriangle(null, 18, 6, 18)`), not
 * `getExtremityFactoryLegacy` (which returns `null` for `EXTENDS`) —
 * see `SvekEdge.ts`'s own doc comment on why only the
 * `LinkStrategy.SIMPLEST` / "complete" factory path is reachable in
 * this port (`Link.getLinkStrategy()` is hardwired to `SIMPLEST`
 * upstream). Every other decor's `getExtremityFactoryComplete` defers
 * to `getExtremityFactoryLegacy`, so this table's SINGLE mapping per
 * name covers both upstream methods for every OTHER reachable decor.
 */
export type LinkDecorName =
  | 'EXTENDS'
  | 'COMPOSITION'
  | 'AGGREGATION'
  | 'NOT_NAVIGABLE'
  | 'REDEFINES'
  | 'DEFINEDBY'
  | 'CROWFOOT'
  | 'CIRCLE_CROWFOOT'
  | 'CIRCLE_LINE'
  | 'DOUBLE_LINE'
  | 'LINE_CROWFOOT'
  | 'ARROW'
  | 'ARROW_TRIANGLE'
  | 'CIRCLE'
  | 'CIRCLE_FILL'
  | 'CIRCLE_CONNECT'
  | 'PARENTHESIS'
  | 'SQUARE'
  | 'PLUS'
  | 'HALF_ARROW_UP'
  | 'HALF_ARROW_DOWN';

/** `LinkDecor#isFill()` for each reachable entry — read by
 *  `SvekEdge.ts`'s `drawRainbow`-equivalent to decide `Back(color)` vs
 *  `Back('none')` before calling the extremity's own `drawU`. */
const IS_FILL: Record<LinkDecorName, boolean> = {
  EXTENDS: false,
  COMPOSITION: true,
  AGGREGATION: false,
  NOT_NAVIGABLE: false,
  REDEFINES: false,
  DEFINEDBY: false,
  CROWFOOT: true,
  CIRCLE_CROWFOOT: false,
  CIRCLE_LINE: false,
  DOUBLE_LINE: false,
  LINE_CROWFOOT: false,
  ARROW: true,
  ARROW_TRIANGLE: true,
  CIRCLE: false,
  CIRCLE_FILL: false,
  CIRCLE_CONNECT: false,
  PARENTHESIS: false,
  SQUARE: false,
  PLUS: false,
  HALF_ARROW_UP: false,
  HALF_ARROW_DOWN: false,
};

/** `LinkDecor.lookupDecors1` — `DECORS1.getOrDefault(token, NONE)`,
 *  ported as a plain lookup table (upstream's `decors1(...)` calls,
 *  every reachable entry). */
const DECORS1: Record<string, LinkDecorName> = {
  '<|': 'EXTENDS',
  '^': 'EXTENDS',
  '*': 'COMPOSITION',
  o: 'AGGREGATION',
  x: 'NOT_NAVIGABLE',
  '<||': 'REDEFINES',
  '<|:': 'DEFINEDBY',
  '}': 'CROWFOOT',
  '}o': 'CIRCLE_CROWFOOT',
  '|o': 'CIRCLE_LINE',
  '||': 'DOUBLE_LINE',
  '}|': 'LINE_CROWFOOT',
  '<': 'ARROW',
  '<_': 'ARROW',
  '<<': 'ARROW_TRIANGLE',
  '0': 'CIRCLE',
  '@': 'CIRCLE_FILL',
  '0)': 'CIRCLE_CONNECT',
  ')': 'PARENTHESIS',
  '#': 'SQUARE',
  '+': 'PLUS',
};

/** `LinkDecor.lookupDecors2` — mirror of {@link DECORS1} for the
 *  head-side (near entity 2) token set, plus the two decors2-only
 *  entries (`HALF_ARROW_UP`/`HALF_ARROW_DOWN`, which have no
 *  `decors1`). */
const DECORS2: Record<string, LinkDecorName> = {
  '|>': 'EXTENDS',
  '^': 'EXTENDS',
  '*': 'COMPOSITION',
  o: 'AGGREGATION',
  x: 'NOT_NAVIGABLE',
  '||>': 'REDEFINES',
  ':|>': 'DEFINEDBY',
  '{': 'CROWFOOT',
  'o{': 'CIRCLE_CROWFOOT',
  'o|': 'CIRCLE_LINE',
  '||': 'DOUBLE_LINE',
  '|{': 'LINE_CROWFOOT',
  '>': 'ARROW',
  '_>': 'ARROW',
  '>>': 'ARROW_TRIANGLE',
  '0': 'CIRCLE',
  '@': 'CIRCLE_FILL',
  '(0': 'CIRCLE_CONNECT',
  '(': 'PARENTHESIS',
  '#': 'SQUARE',
  '+': 'PLUS',
  '\\\\': 'HALF_ARROW_UP',
  '//': 'HALF_ARROW_DOWN',
};

/** `LinkDecor.lookupDecors1(s)` — `StringUtils.trin(s)` (trim) then
 *  table lookup, `NONE` (`undefined` here) on no match or an
 *  empty/absent token. */
export function lookupDecors1(token: string | undefined): LinkDecorName | undefined {
  if (token === undefined) return undefined;
  return DECORS1[token.trim()];
}

/** `LinkDecor.lookupDecors2(s)` — see {@link lookupDecors1}. */
export function lookupDecors2(token: string | undefined): LinkDecorName | undefined {
  if (token === undefined) return undefined;
  return DECORS2[token.trim()];
}

export function isFillDecor(name: LinkDecorName): boolean {
  return IS_FILL[name];
}

/**
 * buildExtremityFactory — `LinkDecor#getExtremityFactoryComplete`
 * (EXTENDS) / `#getExtremityFactoryLegacy` (every other reachable
 * decor), ported as one dispatch table keyed by {@link LinkDecorName}.
 * `backgroundColor` is upstream's `skinParam.getBackgroundColor()` —
 * this port's `theme.colors.background` (see `SvekEdge.ts`).
 *
 * Table-of-builders (not a `switch`): a 21-arm `switch` here trips this
 * project's cyclomatic-complexity budget (`check-complexity.py`, CCN
 * cap). Each builder is a tiny closure over `backgroundColor` so the
 * dispatch itself stays a single map lookup (CCN 1).
 */
const BUILDERS: Record<LinkDecorName, (backgroundColor: Paint) => ExtremityFactory> = {
  EXTENDS: () =>
    new ExtremityFactoryTriangle({ backgroundColor: null, xWing: 18, yAperture: 6, decorationLength: 18 }),
  ARROW_TRIANGLE: () =>
    new ExtremityFactoryTriangle({ backgroundColor: null, xWing: 8, yAperture: 3, decorationLength: 8 }),
  ARROW: () => new ExtremityFactoryArrow(),
  AGGREGATION: () => new ExtremityFactoryDiamond(false),
  COMPOSITION: () => new ExtremityFactoryDiamond(true),
  NOT_NAVIGABLE: () => new ExtremityFactoryNotNavigable(),
  REDEFINES: (bg) => new ExtremityFactoryExtendsLike(bg, false),
  DEFINEDBY: (bg) => new ExtremityFactoryExtendsLike(bg, true),
  CROWFOOT: () => new ExtremityFactoryCrowfoot(),
  CIRCLE_CROWFOOT: () => new ExtremityFactoryCircleCrowfoot(),
  LINE_CROWFOOT: () => new ExtremityFactoryLineCrowfoot(),
  CIRCLE_LINE: () => new ExtremityFactoryCircleLine(),
  DOUBLE_LINE: () => new ExtremityFactoryDoubleLine(),
  CIRCLE: (bg) => new ExtremityFactoryCircle(false, bg),
  CIRCLE_FILL: (bg) => new ExtremityFactoryCircle(true, bg),
  CIRCLE_CONNECT: (bg) => new ExtremityFactoryCircleConnect(bg),
  PARENTHESIS: () => new ExtremityFactoryParenthesis(),
  SQUARE: (bg) => new ExtremityFactorySquare(bg),
  PLUS: (bg) => new ExtremityFactoryPlus(bg),
  HALF_ARROW_UP: () => new ExtremityFactoryHalfArrow(1),
  HALF_ARROW_DOWN: () => new ExtremityFactoryHalfArrow(-1),
};

export function buildExtremityFactory(name: LinkDecorName, backgroundColor: Paint): ExtremityFactory {
  return BUILDERS[name](backgroundColor);
}

/*
 * The three `LinkType` members below (decoration/LinkType.java) are the
 * only ones `SvekEdge`'s drawing half consumes. This port has no
 * `LinkType` class (its decor pair travels as raw tokens on
 * `SvekEdgeInput`), so they are ported as free functions over the
 * RESOLVED decor pair. Parameter names preserve upstream's field names:
 * `decor1` is the HEAD-side decor (near entity 2) and `decor2` the
 * TAIL-side (near entity 1) — `CommandLinkElement.java:140` builds
 * `new LinkType(d2, d1)` from `d1 = lookupDecors1(head1)`,
 * `d2 = lookupDecors2(head2)`, swapping the numbering. `undefined`
 * plays upstream's `LinkDecor.NONE`.
 */

/** `LinkType#looksLikeRevertedForSvg()` — decor only on the tail side. */
export function looksLikeRevertedForSvg(
  decor1: LinkDecorName | undefined,
  decor2: LinkDecorName | undefined,
): boolean {
  return decor1 === undefined && decor2 !== undefined;
}

/** `LinkType#looksLikeNoDecorAtAllSvg()` — none, or both. */
export function looksLikeNoDecorAtAllSvg(
  decor1: LinkDecorName | undefined,
  decor2: LinkDecorName | undefined,
): boolean {
  if (decor1 === undefined && decor2 === undefined) return true;
  return decor1 !== undefined && decor2 !== undefined;
}

/** `LinkType#getLinkTypeName()`'s priority-ordered `has`/`hasAny`
 *  if-chain, ported as an ordered rule table (same
 *  table-instead-of-branches CCN pattern as {@link buildExtremityFactory}
 *  above). Row order IS the upstream check order — do not sort. */
const LINK_TYPE_NAME_RULES: ReadonlyArray<readonly [ReadonlyArray<LinkDecorName>, string]> = [
  [['COMPOSITION'], 'composition'],
  [['AGGREGATION'], 'aggregation'],
  [['EXTENDS'], 'extension'],
  [['REDEFINES'], 'redefines'],
  [['DEFINEDBY'], 'definedby'],
  [['ARROW', 'ARROW_TRIANGLE'], 'dependency'],
  [['NOT_NAVIGABLE'], 'not_navigable'],
  [['CROWFOOT', 'CIRCLE_CROWFOOT', 'LINE_CROWFOOT'], 'crowfoot'],
  [['CIRCLE_LINE', 'DOUBLE_LINE'], 'association'],
  [['PLUS'], 'nested'],
];

/**
 * `LinkType#getLinkTypeName()` — the `data-link-type` attribute value,
 * or `undefined` (upstream `null` — attribute omitted).
 *
 * Upstream evaluates `bothNone()` inline at the "association" row; it
 * is hoisted to the top here because when both decors are NONE every
 * earlier `has(...)` check is vacuously false, so the first row that
 * can fire IS the association row — behavior-identical, and it keeps
 * the loop below a single `some(has)` shape.
 */
export function getLinkTypeName(
  decor1: LinkDecorName | undefined,
  decor2: LinkDecorName | undefined,
): string | undefined {
  if (decor1 === undefined && decor2 === undefined) return 'association'; // bothNone()
  const has = (d: LinkDecorName): boolean => decor1 === d || decor2 === d;
  for (const [decors, name] of LINK_TYPE_NAME_RULES) if (decors.some(has)) return name;
  return undefined;
}

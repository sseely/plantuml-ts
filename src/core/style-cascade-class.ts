/**
 * Class-diagram `<style>` ancestor cascade (G2 N36) -- computes every
 * `theme.colors.graph.classCascade*`/`spotCascade*` field from a raw
 * StyleMap, pre-resolved to SVG-ready hex via {@link resolveColorToSvgHex}
 * (matching the existing inline-`#color`-override precedent, `class-color-
 * override.ts`). Split into its own module rather than growing
 * `style-map-theme.ts` (already at the project's 500-line cap) -- "new code
 * in new modules" per this mission's own established precedent (`renderer-
 * classifier-box.ts`'s doc comment).
 *
 * See `theme.ts`'s own field doc comments for the full upstream style-
 * signature derivation (`EntityImageClass.getStyleSignature()`, `SvekEdge
 * .java:819`, `EntityImageClassHeader.java#spotStyleSignature`) and
 * `style-map-element.ts#resolveStyleCascade`'s doc comment for the subset-
 * match algorithm this is built on.
 */
import type { Theme } from './theme.js';
import type { StyleMap } from './skinparam.js';
import { resolveStyleCascade } from './style-map-element.js';
import { resolveColorToSvgHex, parseSimpleColor } from './klimt/color/HColorSet.js';

/** `EntityImageClass.getStyleSignature()`: `{root,element,classDiagram,class_}`. */
const CLASS_SNAMES = ['root', 'element', 'classdiagram', 'class'] as const;
/** `EntityImageClassHeader.getStyleSignature()`: the same set plus `header`. */
const HEADER_SNAMES = [...CLASS_SNAMES, 'header'] as const;
/** `SvekEdge.java:819`: `{root,element,classDiagram,arrow}`. */
const ARROW_SNAMES = ['root', 'element', 'classdiagram', 'arrow'] as const;
/** `EntityImageClassHeader#spotStyleSignature`: `{root,element,spot,spot
 *  <Kind>}` -- generalized across every badge kind (only `root` can ever
 *  match this set in practice, since none of the four tokens includes
 *  `classDiagram`; kept general rather than hardcoding "root only" so a
 *  future bare `spot {}`/`spotClass {}` cascade slots in for free). */
const SPOT_SNAMES = ['root', 'element', 'spot', 'spotclass'] as const;

type GraphCascadeOverride = Pick<
  Theme['colors']['graph'],
  | 'classCascadeBackground'
  | 'classCascadeBorder'
  | 'classCascadeFontColor'
  | 'classCascadeHeaderFontColor'
  | 'classCascadeArrowColor'
  | 'spotCascadeBackground'
  | 'spotCascadeBorder'
  | 'spotCascadeFont'
>;

/**
 * Resolve one cascade lookup to an SVG-ready hex string, or `undefined`
 * when no matching declaration exists OR the matched value is not a
 * resolvable color token at all -- e.g. jar's `#?black:white[:blue]`
 * "automatic" conditional-color ternary (`HColorAutomagic`, `xalaco-64-
 * vuzu312`/`dipune-93-sare489` shape), an entirely separate, unbuilt color
 * grammar this iteration does not attempt (`HColorSet.ts`'s own module doc
 * comment already lists it as out of scope). `resolveColorToSvgHex` returns
 * an UNRESOLVABLE token UNCHANGED (by design, its own doc comment) rather
 * than erroring -- passing that raw `"#?black:white"` string straight
 * through as an SVG `fill` would be WORSE than leaving the field unset
 * (every caller's own hardcoded `'#000000'` default already happens to
 * match jar's resolved value for every conditional-color fixture sampled,
 * a coincidence this guard preserves rather than clobbers -- regression
 * caught and fixed within this iteration, `plans/g2-class-svg/ledger.md`
 * N36).
 */
function cascadeHex(
  styleMap: StyleMap,
  snames: readonly string[],
  property: string,
): string | undefined {
  const raw = resolveStyleCascade(styleMap, snames, property);
  if (raw === undefined) return undefined;
  const lower = raw.toLowerCase();
  if (lower !== 'transparent' && lower !== 'background' && parseSimpleColor(raw) === undefined) {
    return undefined;
  }
  return resolveColorToSvgHex(raw);
}

/**
 * Compute every class-cascade Theme field from a raw StyleMap. Returns an
 * object with only the DEFINED fields set (spread directly into
 * `applyStyleMap`'s `graphOverride`) -- a fixture with no `<style>` block
 * (or one that sets none of these properties) contributes nothing.
 */
export function computeClassStyleCascadeOverrides(
  styleMap: StyleMap,
): Partial<GraphCascadeOverride> {
  const override: Partial<GraphCascadeOverride> = {};
  const background = cascadeHex(styleMap, CLASS_SNAMES, 'backgroundcolor');
  if (background !== undefined) override.classCascadeBackground = background;
  const border = cascadeHex(styleMap, CLASS_SNAMES, 'linecolor');
  if (border !== undefined) override.classCascadeBorder = border;
  const fontColor = cascadeHex(styleMap, CLASS_SNAMES, 'fontcolor');
  if (fontColor !== undefined) override.classCascadeFontColor = fontColor;
  const headerFontColor = cascadeHex(styleMap, HEADER_SNAMES, 'fontcolor');
  if (headerFontColor !== undefined) override.classCascadeHeaderFontColor = headerFontColor;
  const arrowColor = cascadeHex(styleMap, ARROW_SNAMES, 'linecolor');
  if (arrowColor !== undefined) override.classCascadeArrowColor = arrowColor;
  const spotBackground = cascadeHex(styleMap, SPOT_SNAMES, 'backgroundcolor');
  if (spotBackground !== undefined) override.spotCascadeBackground = spotBackground;
  const spotBorder = cascadeHex(styleMap, SPOT_SNAMES, 'linecolor');
  if (spotBorder !== undefined) override.spotCascadeBorder = spotBorder;
  const spotFont = cascadeHex(styleMap, SPOT_SNAMES, 'fontcolor');
  if (spotFont !== undefined) override.spotCascadeFont = spotFont;
  return override;
}

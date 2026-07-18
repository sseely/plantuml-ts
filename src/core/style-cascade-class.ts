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
import { parseStyleBlock } from './skinparam.js';
import { resolveStyleCascade, collectStyleTagNames, cleanStereotypeToken } from './style-map-element.js';
import { resolveColorToSvgHex, parseSimpleColor, resolveConditionalColor } from './klimt/color/HColorSet.js';

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
  | 'classCascadeRoundCorner'
  | 'classCascadeMaximumWidth'
  | 'classCascadeHeaderMaximumWidth'
  | 'classTagCascade'
>;

/**
 * Resolve one cascade lookup to an SVG-ready hex string, or `undefined`
 * when no matching declaration exists OR the matched value is not a
 * resolvable color token at all. `resolveColorToSvgHex` returns an
 * UNRESOLVABLE token UNCHANGED (by design, its own doc comment) rather than
 * erroring -- passing an unresolvable raw string straight through as an SVG
 * `fill` would be WORSE than leaving the field unset (every caller's own
 * hardcoded `'#000000'` default already happens to match jar's resolved
 * value for every conditional-color fixture sampled, a coincidence this
 * guard preserves rather than clobbers -- regression caught and fixed
 * within N36). G2 N48: `#?light:dark[:transparent]` (`HColorScheme`,
 * `xalaco-64-vuzu312`/`dipune-93-sare489` shape) is a FontColor-only
 * grammar upstream (`FromSkinparamToStyle.java` never registers it for
 * BackgroundColor/LineColor) -- handled by the sibling
 * {@link cascadeFontColorHex} below, NOT here; this function stays the
 * plain-color path for every other property.
 */
function cascadeHex(
  styleMap: StyleMap,
  snames: readonly string[],
  property: string,
  stereotypeTags: readonly string[] = [],
): string | undefined {
  const raw = resolveStyleCascade(styleMap, snames, property, stereotypeTags);
  if (raw === undefined) return undefined;
  const lower = raw.toLowerCase();
  if (lower !== 'transparent' && lower !== 'background' && parseSimpleColor(raw) === undefined) {
    return undefined;
  }
  return resolveColorToSvgHex(raw);
}

/**
 * Upstream Style-system default classifier fill (`theme.ts`'s own
 * `classBackground` default, `theme.ts:528`) -- duplicated here as the
 * FALLBACK local-paint-background for `#?` FontColor resolution (item 29)
 * since this module only ever receives a raw `StyleMap`, not the full
 * merged `Theme` (`computeClassStyleCascadeOverrides`'s own signature).
 * Used ONLY when no `<style>` `BackgroundColor` override resolved for the
 * SAME cascade lookup -- an explicit override (computed just above each
 * call site below) always wins.
 */
const DEFAULT_CLASS_BACKGROUND = '#F1F1F1';

/**
 * G2 N48 (item 29): {@link cascadeHex}'s FontColor-specific sibling --
 * additionally resolves `#?light:dark[:transparent]` (`HColorScheme`)
 * against `localBackgroundHex` (the SAME classifier/header background this
 * font color paints onto -- `resolveConditionalColor`'s own doc comment for
 * the jar-verified transparent/dark/light branch semantics) before falling
 * back to {@link cascadeHex}'s plain-color path.
 */
function cascadeFontColorHex(
  styleMap: StyleMap,
  snames: readonly string[],
  localBackgroundHex: string,
  stereotypeTags: readonly string[] = [],
): string | undefined {
  const raw = resolveStyleCascade(styleMap, snames, 'fontcolor', stereotypeTags);
  if (raw === undefined) return undefined;
  const conditional = resolveConditionalColor(raw, localBackgroundHex);
  if (conditional !== undefined) return conditional;
  const lower = raw.toLowerCase();
  if (lower !== 'transparent' && lower !== 'background' && parseSimpleColor(raw) === undefined) {
    return undefined;
  }
  return resolveColorToSvgHex(raw);
}

/**
 * G2 N37: `.tagname` sub-selector properties this port threads for the
 * classifier tag cascade -- a subset of the ancestor cascade's own
 * property list (no separate header-vs-member FontColor split for tags;
 * no sampled corpus fixture exercises that divergence at the tag level,
 * see this module's own file doc comment).
 */
function classTagCascadeEntry(
  styleMap: StyleMap,
  tag: string,
): NonNullable<Theme['colors']['graph']['classTagCascade']>[string] | undefined {
  const entry: NonNullable<Theme['colors']['graph']['classTagCascade']>[string] = {};
  const background = cascadeHex(styleMap, CLASS_SNAMES, 'backgroundcolor', [tag]);
  if (background !== undefined) entry.background = background;
  const border = cascadeHex(styleMap, CLASS_SNAMES, 'linecolor', [tag]);
  if (border !== undefined) entry.border = border;
  const fontColor = cascadeHex(styleMap, CLASS_SNAMES, 'fontcolor', [tag]);
  if (fontColor !== undefined) entry.fontColor = fontColor;
  const roundCornerRaw = resolveStyleCascade(styleMap, CLASS_SNAMES, 'roundcorner', [tag]);
  if (roundCornerRaw !== undefined) {
    const n = Number(roundCornerRaw);
    if (Number.isFinite(n)) entry.roundCorner = n;
  }
  const fontStyleRaw = resolveStyleCascade(styleMap, CLASS_SNAMES, 'fontstyle', [tag]);
  if (fontStyleRaw !== undefined) {
    const lower = fontStyleRaw.toLowerCase();
    entry.fontBold = lower.includes('bold');
    entry.fontItalic = lower.includes('italic');
  }
  return Object.keys(entry).length > 0 ? entry : undefined;
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
  // G2 N48 (item 29): local paint background for a `#?` FontColor is the
  // classifier's OWN resolved fill -- the explicit override just computed
  // above, else the Style-system default (`DEFAULT_CLASS_BACKGROUND`).
  const localBg = background ?? DEFAULT_CLASS_BACKGROUND;
  const fontColor = cascadeFontColorHex(styleMap, CLASS_SNAMES, localBg);
  if (fontColor !== undefined) override.classCascadeFontColor = fontColor;
  const headerFontColor = cascadeFontColorHex(styleMap, HEADER_SNAMES, localBg);
  if (headerFontColor !== undefined) override.classCascadeHeaderFontColor = headerFontColor;
  const arrowColor = cascadeHex(styleMap, ARROW_SNAMES, 'linecolor');
  if (arrowColor !== undefined) override.classCascadeArrowColor = arrowColor;
  const spotBackground = cascadeHex(styleMap, SPOT_SNAMES, 'backgroundcolor');
  if (spotBackground !== undefined) override.spotCascadeBackground = spotBackground;
  const spotBorder = cascadeHex(styleMap, SPOT_SNAMES, 'linecolor');
  if (spotBorder !== undefined) override.spotCascadeBorder = spotBorder;
  const spotFont = cascadeHex(styleMap, SPOT_SNAMES, 'fontcolor');
  if (spotFont !== undefined) override.spotCascadeFont = spotFont;
  // G2 N37: ancestor-only (non-tag) RoundCorner -- see `theme.ts
  // #classCascadeRoundCorner`'s own doc comment.
  const roundCornerRaw = resolveStyleCascade(styleMap, CLASS_SNAMES, 'roundcorner');
  if (roundCornerRaw !== undefined) {
    const n = Number(roundCornerRaw);
    if (Number.isFinite(n)) override.classCascadeRoundCorner = n;
  }
  // G2 N65 item 35: ancestor-only (non-tag) MaximumWidth word-wrap cascade
  // -- see `theme.ts#classCascadeMaximumWidth`'s own doc comment for the
  // CLASS_SNAMES-vs-HEADER_SNAMES split.
  const maxWidthRaw = resolveStyleCascade(styleMap, CLASS_SNAMES, 'maximumwidth');
  if (maxWidthRaw !== undefined) {
    const n = Number(maxWidthRaw);
    if (Number.isFinite(n)) override.classCascadeMaximumWidth = n;
  }
  const headerMaxWidthRaw = resolveStyleCascade(styleMap, HEADER_SNAMES, 'maximumwidth');
  if (headerMaxWidthRaw !== undefined) {
    const n = Number(headerMaxWidthRaw);
    if (Number.isFinite(n)) override.classCascadeHeaderMaximumWidth = n;
  }
  // G2 N37: per-tag `.tagname` cascade -- see `theme.ts#classTagCascade`'s
  // own doc comment.
  const tagCascade: Record<string, NonNullable<GraphCascadeOverride['classTagCascade']>[string]> = {};
  for (const tag of collectStyleTagNames(styleMap)) {
    const entry = classTagCascadeEntry(styleMap, tag);
    if (entry !== undefined) tagCascade[cleanStereotypeToken(tag)] = entry;
  }
  if (Object.keys(tagCascade).length > 0) override.classTagCascade = tagCascade;
  return override;
}

/**
 * Look up the FIRST of `stereotypeLabels` (in the classifier's OWN
 * declaration order) that has an entry in `theme.colors.graph.
 * classTagCascade` -- G2 N37. No sampled corpus fixture combines multiple
 * simultaneously-tagged, differently-overridden labels on one classifier
 * (`theme.ts#classTagCascade`'s own doc comment), so "first match wins" is
 * a scoped simplification, not a jar-verified cross-tag precedence rule.
 * Shared by `class-layout-helpers.ts` (bold/italic font-spec merge, which
 * does NOT affect measured width -- `FontSpec` has no `bold`/`italic`
 * field, only `weight`, so this mirrors the PRE-EXISTING `classFontBold`
 * ancestor mechanism's own render-only reach) and `renderer-classifier-
 * box.ts` (background/border/fontColor/roundCorner).
 */
export function resolveClassTagCascadeEntry(
  theme: Theme,
  stereotypeLabels: readonly string[] | undefined,
  // G2 N39: a classifier's own `Classifier.styleGeneration` (`ast.ts`'s doc
  // comment) -- selects the position-scoped snapshot from
  // `classTagCascadeGenerations` when the source carries multiple `<style>`
  // blocks. `undefined` (the overwhelming majority of classifiers, and
  // every call site that pre-dates this mechanism) falls back to the plain
  // `classTagCascade` field unconditionally -- zero behavior change.
  styleGeneration?: number,
): NonNullable<Theme['colors']['graph']['classTagCascade']>[string] | undefined {
  const generations = theme.colors.graph.classTagCascadeGenerations;
  const cascade =
    generations !== undefined && styleGeneration !== undefined
      ? (generations[styleGeneration] ?? theme.colors.graph.classTagCascade)
      : theme.colors.graph.classTagCascade;
  if (cascade === undefined || stereotypeLabels === undefined) return undefined;
  for (const label of stereotypeLabels) {
    const entry = cascade[cleanStereotypeToken(label)];
    if (entry !== undefined) return entry;
  }
  return undefined;
}

/**
 * G2 N39: `classTagCascade`, snapshotted at every `<style>`-block boundary
 * -- see `theme.ts#classTagCascadeGenerations`'s own doc comment for the
 * upstream mechanism this reconstructs. Returns `undefined` when `rawStyles`
 * carries 0 or 1 blocks (nothing to disambiguate; the caller keeps using
 * the single `classTagCascade` field) -- `buildTheme`'s own gate, kept here
 * too so any OTHER caller of this pure function gets the same cheap no-op
 * for the common case rather than re-deriving a length check itself.
 */
export function computeClassTagCascadeGenerations(
  rawStyles: readonly string[],
): (Readonly<Record<string, NonNullable<GraphCascadeOverride['classTagCascade']>[string]>> | undefined)[] | undefined {
  if (rawStyles.length <= 1) return undefined;
  const prefixes: StyleMap[] = [new Map<string, Map<string, string>>()];
  let acc: StyleMap = new Map<string, Map<string, string>>();
  for (const raw of rawStyles) {
    const parsed = parseStyleBlock(raw);
    const next: StyleMap = new Map();
    acc.forEach((props, selector) => next.set(selector, new Map(props)));
    parsed.forEach((props, selector) => {
      const existing = next.get(selector) ?? new Map<string, string>();
      props.forEach((v, k) => existing.set(k, v));
      next.set(selector, existing);
    });
    acc = next;
    prefixes.push(acc);
  }
  return prefixes.map((prefix) => computeClassStyleCascadeOverrides(prefix).classTagCascade);
}

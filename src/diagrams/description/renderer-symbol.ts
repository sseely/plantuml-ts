/**
 * renderer-symbol.ts — shared symbol/style/font resolution for the
 * klimt-backed description renderer (T17). Both `renderer-entity.ts` (leaf
 * entities) and `renderer-cluster.ts` (containers) resolve their `USymbol`
 * and text paint through these same helpers — upstream's `Entity#getUSymbol`
 * and font-color defaults are shared across both draw paths too (a group
 * entity and a leaf entity are both `Entity` objects upstream).
 */
import type { Theme } from '../../core/theme.js';
import { resolveElementFontSize } from '../../core/theme.js';
import { isTransparentColor } from '../../core/paint.js';
import type { FontConfiguration, FontStyle } from '../../core/klimt/shape/UText.js';
import { ActorStyle } from '../../core/skin/ActorStyle.js';
import { ComponentStyle } from '../../core/decoration/symbol/USymbols.js';
import { resolveDescriptionUSymbol } from '../../core/svek/image/EntityImageDescription.js';
import type { USymbol as UpstreamUSymbol } from '../../core/decoration/symbol/USymbol.js';
import type { USymbol } from '../../core/descriptive-keywords.js';

/**
 * Upstream `ActorStyle` default (`SkinParam.actorStyle()`'s own default,
 * `STICKMAN` — T9 finding: no accessor exists for the `HOLLOW`/`AWESOME`
 * skinparam value anywhere in this codebase yet, so this is the only
 * reachable value). No `Theme.actorStyle` field exists (grep-verified) —
 * a documented gap, not fixed here (out of write-set: `theme.ts`).
 */
const DEFAULT_ACTOR_STYLE = ActorStyle.STICKMAN;

/** Jar default entity/cluster text-fill (`HtmlColorUtils.BLACK`,
 *  `SkinParameter`'s `FontColor` default) — distinct from `theme.colors
 *  .text` (`#181818`, this codebase's generic default used elsewhere for
 *  border/line color roles; see `theme.ts`'s own `resolveElementPaint`
 *  doc comment). Verified against `test-results/dot-cache/component/
 *  sacuso-94-gugi476/in.svg`'s `<text fill="#000000">`. Exported (G1 I2):
 *  `renderer-edge.ts`'s link-label font reuses the SAME jar default rather
 *  than duplicating the literal (`klimt/font/FontParam.java`'s
 *  `FontParamConstant.COLOR = "black"`, the fallback every `FontParam`
 *  entry without its own override color resolves to — `ARROW` included). */
export const JAR_DEFAULT_TEXT_COLOR = '#000000';

/** No style flags — the shared default for `textFont`'s `styles` param
 *  (avoids allocating a fresh empty `Set` on every plain title/body call). */
const EMPTY_STYLES: ReadonlySet<FontStyle> = new Set();

/**
 * `DescriptionNodeGeo.symbol` (this port's own simplified keyword union,
 * `core/descriptive-keywords.ts`) → the upstream keyword string
 * `resolveDescriptionUSymbol` expects. Identity for every symbol except
 * the two business variants, which upstream spells with a trailing slash
 * (`actor/`, `usecase/` — `descdiagram/command/CommandCreateElementFull
 * .java`'s own keyword spelling).
 */
export function upstreamKeyword(symbol: USymbol): string {
  if (symbol === 'actor-business') return 'actor/';
  if (symbol === 'usecase-business') return 'usecase/';
  return symbol;
}

/** `Theme.componentStyle` (lowercase union, this codebase's existing
 *  skinparam-facing shape) → `USymbols.ts`'s `ComponentStyle` as-const
 *  (upstream-named, uppercase). Two distinct types for the same concept
 *  already existed pre-T17 (`leaf-sizing.ts` vs `USymbols.ts`); this is
 *  the adapter between them, not a new divergence. */
export function mapComponentStyle(style: Theme['componentStyle']): ComponentStyle {
  if (style === 'uml1') return ComponentStyle.UML1;
  if (style === 'rectangle') return ComponentStyle.RECTANGLE;
  return ComponentStyle.UML2;
}

/** Resolves the `USymbol` for a description-diagram node/container symbol,
 *  reusing `EntityImageDescription`'s own `resolveDescriptionUSymbol` seam
 *  (T14) — the same function upstream's `Entity#getUSymbol` fallback chain
 *  exercises for both leaf entities and group entities. Returns `null` only
 *  for `port`/`portin`/`portout` (upstream never resolves a `USymbol` for
 *  ports either — `EntityImagePort` draws them, out of this port's scope;
 *  see `renderer-entity.ts`'s fallback path) and `note` (not in upstream's
 *  `ALL_TYPES` keyword table at all — `EntityImageNote` is a separate,
 *  unported draw class; same fallback path). */
export function resolveSymbol(symbol: USymbol, theme: Theme): UpstreamUSymbol | null {
  if (symbol === 'port' || symbol === 'note') return null;
  return resolveDescriptionUSymbol(upstreamKeyword(symbol), DEFAULT_ACTOR_STYLE, mapComponentStyle(theme.componentStyle));
}

/** Title/body text color: an explicit per-element skinparam/style override
 *  (`theme.colors.elements[sname].font`, decision D4) wins ONLY when it is
 *  a plain solid color — `FontConfiguration.color` is `string | null`
 *  (klimt's text driver has no gradient-fill text path), so a `Gradient`
 *  override falls back to the jar default rather than producing an
 *  unrenderable value. Otherwise the jar's true default (`#000000`), NOT
 *  `theme.colors.text` (see this module's `JAR_DEFAULT_TEXT_COLOR` doc
 *  comment — `theme.colors.text` is a pre-existing generic default this
 *  port's other renderers already use for a different role, out of this
 *  task's write-set to change). */
export function textFontColor(theme: Theme, symbol: string): string | null {
  const override = theme.colors.elements?.[symbol]?.font;
  if (typeof override !== 'string') return JAR_DEFAULT_TEXT_COLOR;
  // G1 I5d: `DriverTextSvg#draw` returns before emitting ANY `<text>` when
  // `fontConfiguration.getColor().isTransparent()` (klimt/drawing/svg/
  // DriverTextSvg.java:92-94) -- a `FontColor transparent`/`#00000000`
  // override elides the text entirely, it does not merely paint it
  // invisibly. `FontConfiguration.color` is already `string | null` for
  // exactly this case (see `driver-text-svg.ts`'s own `font.color === null`
  // guard); this was the one caller that never produced `null`.
  return isTransparentColor(override) ? null : override;
}

/**
 * Builds a `FontConfiguration` for entity/cluster body or stereotype text.
 *
 * `sizeDelta` (default 0): every `FontParam` this port's reachable
 * description keywords resolve to (`COMPONENT`/`NODE`/`ACTOR`/`ARTIFACT`/
 * `USECASE`/… — `klimt/font/FontParam.java:60-90`) is size 14, and EVERY
 * matching `*_STEREOTYPE` variant is ALSO size 14 (only the italic face
 * differs) — so callers building stereotype text pass `sizeDelta: 0`
 * (the default) rather than a smaller size (G1 I2 finding: a prior
 * `theme.fontSize - 2` convention here was NOT faithful to the jar, which
 * draws stereotype text at the SAME size as its host entity's title, just
 * italic — see `renderer-entity.ts`/`renderer-cluster.ts`'s stereotype
 * font construction).
 *
 * `styles` (default none): callers pass `FontStyle.ITALIC` for stereotype
 * text (`FontParam.*_STEREOTYPE`'s `UFontFace.italic()`) or
 * `FontStyle.BOLD` for a cluster/group title (`FontParam.PACKAGE`'s
 * `getDefaultFontFace`, `inPackageTitle=true` — see
 * `renderer-cluster.ts#buildHeader`'s own doc comment).
 *
 * `role` (default 'title'): selects which per-element size override
 * `resolveElementFontSize` (`theme.ts`, G1 I4b) consults —
 * `<sname>FontSize`/`<style> <sname> { FontSize N }` for `'title'`,
 * `<sname>StereotypeFontSize`/`<style> <sname> { stereotype { FontSize N }
 * } }` for `'stereotype'` (falling back to the plain `FontSize` override,
 * then to `theme.fontSize + sizeDelta`). Callers building stereotype text
 * pass `role: 'stereotype'` alongside `FontStyle.ITALIC`.
 */
export function textFont(
  theme: Theme,
  symbol: string,
  sizeDelta = 0,
  styles: ReadonlySet<FontStyle> = EMPTY_STYLES,
  role: 'title' | 'stereotype' = 'title',
): FontConfiguration {
  const sizeOverride = resolveElementFontSize(theme, symbol, role);
  return {
    family: theme.fontFamily,
    size: sizeOverride ?? theme.fontSize + sizeDelta,
    color: textFontColor(theme, symbol),
    styles,
  };
}

/**
 * class-monochrome.ts -- `skinparam monochrome true|reverse` (G2 N61).
 *
 * Jar's `TitledDiagram.java#muteColorMapper` swaps in `ColorMapper.MONOCHROME`/
 * `MONOCHROME_REVERSE` (`klimt/color/ColorMapper.java:80-91`) for the ENTIRE
 * diagram's `UGraphic`, so EVERY drawn color -- resolved-hex, raw literal
 * (`badgeFill`'s hardcoded `spot<Kind>` table), stroke, fill, gradient stop --
 * passes through `ColorUtils#getGrayScaleColor`/`getGrayScaleColorReverse`
 * (`klimt/color/ColorUtils.java:67-74`) as the LAST step before a shape is
 * drawn, uniformly, regardless of where the color's own value came from.
 *
 * Class has no such single terminal draw call (`renderer.ts`'s own "class
 * draws plain SVG strings, never `UGraphic`" precedent) -- every renderer
 * file (`class-badge.ts`, `class-namespace-shape.ts`, `renderer-classifier-
 * box.ts`, `renderer-note.ts`, `class-member-creole.ts`, `renderer.ts`
 * itself) independently interpolates its own already-computed color into a
 * template string, and (jar-verified, `pofabe-33-kizo628`'s badge ellipse)
 * some of those colors are raw hex LITERALS that never touch `klimt/color/
 * HColorSet.ts#resolveColorToSvgHex` at all (`class-badge.ts#badgeFill`'s
 * `spot<Kind>` table returns `'#ADD1B2'` etc. directly) -- so threading a
 * `monochrome` parameter through `resolveColorToSvgHex`'s ~16 call sites
 * would MISS those literal-return paths and produce an incorrect, partial
 * feature.
 *
 * Mirrors jar's real "one universal last-step transform" semantics instead
 * of jar's specific mechanism (a per-call `ColorMapper`): a single
 * post-processing pass over the FULLY ASSEMBLED SVG fragment string, run
 * exactly once at `renderClass`'s own single return point (`children.join('')`
 * plus the separately-threaded `canonicalBackground`/hover-CSS strings) --
 * the class-render equivalent of "every color, at the last possible moment,
 * uniformly." No-op (`svg` returned unchanged) when `mode` is `undefined`
 * (the default -- zero risk to every fixture that doesn't set this
 * skinparam).
 */

export type MonochromeMode = 'true' | 'reverse';

/**
 * `ColorUtils.java#getGrayScaleInternal`: `R*299 + G*587 + B*114`, then
 * `getGrayScaleInternalFromRGB`'s own `/ 1000` (Java `int/int` truncating
 * division == `Math.floor` for the non-negative operands every RGB channel
 * always is). `getGrayScaleColorReverse`: `255 - gray`.
 */
function grayscaleChannel(r: number, g: number, b: number, mode: MonochromeMode): number {
  const gray = Math.floor((r * 299 + g * 587 + b * 114) / 1000);
  return mode === 'reverse' ? 255 - gray : gray;
}

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})?$/;

/** Fully-transparent alpha (`resolveColorToSvgHex`'s own `#00000000`
 *  "no paint" convention, `HColorSet.ts`) -- left unchanged in both modes: an
 *  invisible color has no drawn RGB for jar's real `ColorMapper` to ever see
 *  (upstream's "no paint" sentinel bypasses `HColor#getColor(colorMapper)`
 *  entirely, never reaching `ColorUtils`), so grayscaling its incidental
 *  `000000` RGB payload -- which `reverse` mode would otherwise flip to
 *  `FFFFFF`, still invisible but a spurious literal-text mismatch against a
 *  byte-comparing oracle -- would be a self-inflicted, purely-textual diff. */
const FULLY_TRANSPARENT_ALPHA = '00';

/**
 * Convert one `#RRGGBB`/`#RRGGBBAA` (jar's + `toSvgHex`'s own uppercase
 * convention) hex color through the grayscale transform. Any other shape
 * (`"none"`, a bare token that never resolved) passes through unchanged --
 * mirrors `resolveColorToSvgHex`'s own "not recognized -> unchanged" contract.
 */
export function applyMonochromeHex(hex: string, mode: MonochromeMode): string {
  const m = HEX_COLOR_RE.exec(hex);
  if (m === null) return hex;
  const [, rHex, gHex, bHex, alphaHex] = m as unknown as [string, string, string, string, string | undefined];
  if (alphaHex === FULLY_TRANSPARENT_ALPHA) return hex;
  const r = Number.parseInt(rHex, 16);
  const g = Number.parseInt(gHex, 16);
  const b = Number.parseInt(bHex, 16);
  const gray = grayscaleChannel(r, g, b, mode);
  const grayHex = gray.toString(16).padStart(2, '0').toUpperCase();
  return `#${grayHex}${grayHex}${grayHex}${alphaHex ?? ''}`;
}

/** Matches every `fill`/`stroke`/`stop-color` color VALUE this port's class
 *  renderer ever emits, in both syntaxes it uses: the bare SVG attribute
 *  form (`fill="#RRGGBB"`) and the inline `style="..."` CSS-property form
 *  (`style="stroke:#RRGGBB;..."`, `stroke: #RRGGBB !important` in the
 *  `pathHoverColor` `<style>` block, `class-monochrome.test.ts`'s own
 *  "space after colon" case) -- captures the property-name-plus-delimiter
 *  prefix in group 1 (echoed back verbatim) so only the hex VALUE is
 *  rewritten. Scoped to these three property names specifically (not a bare
 *  `#[0-9A-Fa-f]{6,8}` scan) so it can never touch a non-color hex-shaped
 *  substring incidentally present elsewhere in the markup (this port's own
 *  id/class-name conventions -- `ent0001`, `lnk3`, arrow marker ids -- never
 *  collide with this pattern, but scoping to known color properties is the
 *  defensive choice regardless). */
const COLOR_PROPERTY_RE = /((?:fill|stroke|stop-color)(?:="|:\s*))#([0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?)/g;

/**
 * The single post-processing choke point: run once, over the WHOLE assembled
 * class-diagram SVG fragment, right before `renderClass` returns it. `mode
 * === undefined` (no `skinparam monochrome` set) is a strict no-op -- zero
 * risk to any fixture that doesn't opt in.
 */
export function applyMonochromeToFragment(svg: string, mode: MonochromeMode | undefined): string {
  if (mode === undefined) return svg;
  return svg.replace(COLOR_PROPERTY_RE, (_full, prefix: string, hex: string) => {
    return `${prefix}${applyMonochromeHex(`#${hex}`, mode)}`;
  });
}

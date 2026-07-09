/**
 * driver-text-svg.ts — the `UText` → SVG `<text>` driver.
 *
 * Upstream: klimt/drawing/svg/DriverTextSvg.java (~185 ln). Ported: the
 * leading-space-to-x-offset shift, whitespace-only → NBSP substitution,
 * final `StringUtils.trin` trim, the BOLD/ITALIC → `font-weight`/
 * `font-style` mapping, the UNDERLINE/STRIKE/WAVE → `text-decoration`
 * accumulation, and the `<text>` emission call itself.
 *
 * `StringBounder` seam (this task's own finding, reported): upstream's
 * constructor takes a real `StringBounder` (AWT-backed text-measurement
 * engine) — a whole subsystem, not part of any batch-1/2/3 write-set
 * (see `UText.ts`'s own deferred-methods note: "measurement is a
 * separate subsystem from shape data, not ported here"). Rather than
 * inventing a font-metrics table (which would silently diverge from the
 * jar's real glyph widths), this driver keeps upstream's own
 * constructor-injection shape: a minimal local `StringBounder` interface
 * (the single method this driver actually calls,
 * `calculateDimension(font, text)`) that callers must supply a real
 * implementation of. Tests inject a stub returning the exact widths
 * recorded in the cached jar fixtures, which validates this driver's
 * attribute-emission logic against real jar values without this task
 * inventing font metrics.
 *
 * FontConfiguration gaps bridged/deferred (this task's own finding,
 * reported — `UText.ts`'s `FontConfiguration` carries only `family`,
 * `size`, `color`, `styles`; upstream's driver additionally reads
 * `getUnderlineStroke().getThickness()`, `getExtendedColor()`, and
 * `getFontFace().getCssWeight()`/`isItalic()`, none of which exist on
 * this port's `FontConfiguration`):
 * - `font-weight`: bridged using ONLY the `BOLD` style flag → `"700"`.
 *   Upstream's face-weight refinement (honour an existing face weight
 *   >= 700, or a non-BOLD face weight != 400) is deferred — no
 *   `UFontFace` on this port's `FontConfiguration`.
 * - `font-style`: bridged using ONLY the `ITALIC` style flag →
 *   `"italic"`. Upstream's `face.isItalic()` override is deferred, same
 *   reason.
 * - `text-decoration` (UNDERLINE/STRIKE): bridged by treating the style
 *   flag alone as sufficient (upstream additionally gates UNDERLINE on
 *   `underlineStroke.getThickness() > 0`, unavailable here — assumed
 *   true whenever the flag is present). The `extendedColor`-driven
 *   *custom-color* decoration-line path (`ExtraLines`, drawn as separate
 *   `<line>` elements via `svg.svgLine`) is deferred entirely — no
 *   `extendedColor` on this port's `FontConfiguration`; the plain
 *   CSS `text-decoration` branch is always taken instead.
 * - `WAVE`: ported in full — needs only the style flag.
 * - `BACKCOLOR`: deferred entirely (not emitted) — upstream's
 *   `getExtendedColor()` (solid or `HColorGradient`) is the sole source
 *   of the fill color for the background `<rect>`/gradient def, and this
 *   port's `FontConfiguration` carries no such field.
 * - `fontConfiguration.getAttributes()` (extra literal SVG attributes):
 *   deferred — no such field on this port's `FontConfiguration`; an
 *   empty `Map` is passed to `text()`'s `attributes` param instead.
 * - `font.getFamily(text, UFontContext.SVG)` (content-aware family
 *   resolution, e.g. CJK fallback fonts): deferred — this port's
 *   `FontConfiguration.family` is used as-is, with no `UFontContext`
 *   equivalent.
 *
 * `UClip`/`ClipContainer` — not ported (same as `DriverRectangleSvg`);
 * this driver's constructor takes no `clipContainer` param and never
 * early-returns for an off-clip text origin.
 */

import type { UDriver } from '../../AbstractCommonUGraphic.js';
import type { UParam } from '../../UParam.js';
import { FontStyle } from '../../shape/UText.js';
import type { UText, FontConfiguration } from '../../shape/UText.js';
import type { SvgGraphics } from './svg-graphics.js';

/** See the module doc comment above for why this is a local, injected
 * seam rather than a real font-metrics implementation. Upstream:
 * `klimt.font.StringBounder#calculateDimension(UFont, String)`. */
export interface StringBounder {
  calculateDimension(font: { readonly family: string; readonly size: number }, text: string): { readonly width: number };
}

// Upstream: `text.replace(' ', (char) 160)` — regular space -> NBSP.
const NBSP = '\u00A0';

// Upstream: `StringUtils.trin(String)` — trims only characters whose code
// point is <= U+0020 (space), from both ends. Deliberately NOT JS's
// `.trim()`: JS's `.trim()` also strips U+00A0 (NBSP) per the ECMAScript
// WhiteSpace production, but upstream's `<= ' '` check does NOT (0xA0 >
// 0x20) — using `.trim()` here would silently swallow the very NBSP
// glyphs the whitespace-only substitution above just inserted. Ported
// faithfully rather than approximated, per this task's own finding.
function trin(text: string): string {
  let start = 0;
  let end = text.length - 1;
  while (start <= end && text.charCodeAt(start) <= 0x20) start++;
  while (end >= start && text.charCodeAt(end) <= 0x20) end--;
  return text.slice(start, end + 1);
}

// See the module doc comment above for the FontFace-refinement deferral.
function fontWeightOf(styles: ReadonlySet<FontStyle>): string | null {
  return styles.has(FontStyle.BOLD) ? '700' : null;
}

function fontStyleOf(styles: ReadonlySet<FontStyle>): string | null {
  return styles.has(FontStyle.ITALIC) ? 'italic' : null;
}

// See the module doc comment above for the extendedColor-path deferral.
function textDecorationOf(styles: ReadonlySet<FontStyle>): string | null {
  const parts: string[] = [];
  if (styles.has(FontStyle.UNDERLINE)) parts.push('underline');
  if (styles.has(FontStyle.STRIKE)) parts.push('line-through');
  if (styles.has(FontStyle.WAVE)) parts.push('wavy underline');
  return parts.length > 0 ? parts.join(' ') : null;
}

/** Upstream: `DriverTextSvg`. Ported: the members listed in the module
 * doc comment above. */
export class DriverTextSvg implements UDriver<UText> {
  constructor(
    private readonly svg: SvgGraphics,
    private readonly stringBounder: StringBounder,
  ) {}

  draw(shape: UText, param: UParam): void {
    const font = shape.getFontConfiguration();
    if (font.color === null) return; // Upstream: fontConfiguration.getColor().isTransparent().

    const y = param.getTranslate().getDy();
    const { text, x } = this.leadingSpaceAdjust(shape.getText(), param.getTranslate().getDx(), font);
    const trimmed = trin(text); // Upstream: StringUtils.trin(text).
    const dim = this.stringBounder.calculateDimension({ family: font.family, size: font.size }, trimmed);

    this.svg.setFillColor(font.color);
    this.svg.text(trimmed, x, y, {
      fontFamily: font.family,
      fontSize: font.size,
      fontWeight: fontWeightOf(font.styles),
      fontStyle: fontStyleOf(font.styles),
      textDecoration: textDecorationOf(font.styles),
      textLength: dim.width,
      attributes: new Map(),
      textBackColor: null,
      orientation: shape.getOrientation(),
    });
  }

  // Upstream: the whitespace-only NBSP substitution + leading-space →
  // x-offset loop at the top of `draw`. Factored out to keep `draw`
  // under this port's per-function NLOC budget.
  private leadingSpaceAdjust(
    rawText: string,
    x0: number,
    font: FontConfiguration,
  ): { readonly text: string; readonly x: number } {
    let text = /^\s*$/.test(rawText) ? rawText.split(' ').join(NBSP) : rawText;
    let x = x0;
    if (text.startsWith(' ')) {
      const space = this.stringBounder.calculateDimension({ family: font.family, size: font.size }, ' ').width;
      while (text.startsWith(' ')) {
        x += space;
        text = text.slice(1);
      }
    }
    return { text, x };
  }
}

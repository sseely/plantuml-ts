/**
 * Jar-faithful string measurer (architecture decision D12).
 *
 * Backed by `measurer-jar.data.ts`, a per-point AWT advance-width table
 * extracted from the same openjdk 21.0.1 JVM that produces the upstream
 * jar's SVG golden fixtures (see `scripts/extract-jar-font-metrics/README.md`
 * for full extraction provenance). Reproduces
 * `net.sourceforge.plantuml.FileFormat.getJavaDimension(UFont, String)`:
 *
 *   width  = Σ getStringBounds-per-glyph-advance(cp) × fontSize
 *   height = (ascent + descent) × fontSize   (constant per style/size —
 *            verified empirically that `Rectangle2D.getHeight()` from
 *            `FontMetrics.getStringBounds` does not vary with text content
 *            for this font: leading is 0)
 *
 * `getDescent` mirrors `StringBounderSvg.getDescent`:
 *   `font.getUnderlayingFont(text).getLineMetrics(text, frc).getDescent()`
 *   — also constant per style/size for this font.
 *
 * Style handling (see `klimt/font/UFontFace.java` and the "Style handling"
 * section of the extraction README): upstream derives styled AWT fonts
 * from the PLAIN base via `Font.deriveFont(Map<TextAttribute,Object>)`,
 * using `TextAttribute.WEIGHT` for bold and `TextAttribute.POSTURE`
 * (`POSTURE_OBLIQUE`) for italic. Empirically verified on the extraction
 * JVM (`verification.styleEquivalence` in the extractor's JSON output):
 *
 *  - Bold changes per-glyph advances, non-uniformly per glyph (not a fixed
 *    scale factor) — this measurer uses a SEPARATE bold advance table
 *    (`JAR_SANS_SERIF_BOLD_METRICS`), NOT a scaled/widened copy of the
 *    plain table. This is the key divergence from `FormulaMeasurer` in
 *    `measurer.ts`, which uses the same advances for bold as for regular
 *    (a documented approximation `measurer.ts` accepts; this measurer does
 *    not, since D12's whole purpose is jar-pixel fidelity).
 *  - Italic does NOT change advances, ascent, or descent at all versus
 *    plain for this font — oblique is a render-time shear, not an advance
 *    change. So italic reuses the plain/regular table; no separate italic
 *    table exists or is needed.
 *  - Bold+italic combined measures identically to bold alone (verified:
 *    `TextAttribute.WEIGHT_BOLD` plus `POSTURE_OBLIQUE` together produces
 *    the same advances as `WEIGHT_BOLD` alone).
 *
 * Covers codepoints 32-591 (Basic Latin + Latin-1 Supplement + Latin
 * Extended-A). Codepoints outside that range fall back to
 * `metrics.fallbackAdvance` (the arithmetic mean of every measured advance
 * in the selected style's table) times font size.
 */

import type { FontSpec, StringMeasurer } from './measurer.js';
import {
  JAR_SANS_SERIF_METRICS,
  JAR_SANS_SERIF_BOLD_METRICS,
  type JarFontMetrics,
} from './measurer-jar.data.js';

/**
 * Selects the jar-measured metrics table for a font style.
 *
 * Bold (`font.weight === 'bold'`) selects the dedicated bold table,
 * regardless of italic — bold+italic measures identically to bold alone
 * (see file header). Every other combination (regular, italic-only)
 * selects the plain table, since italic does not alter advances, ascent,
 * or descent for this font (see file header).
 */
function metricsFor(font: FontSpec): JarFontMetrics {
  return font.weight === 'bold' ? JAR_SANS_SERIF_BOLD_METRICS : JAR_SANS_SERIF_METRICS;
}

/** Per-point advance for one codepoint, falling back to the table's mean
 *  advance for codepoints outside the extracted range. */
function advanceFor(metrics: JarFontMetrics, codePoint: number): number {
  return metrics.advances[codePoint] ?? metrics.fallbackAdvance;
}

/**
 * Jar-faithful `StringMeasurer` implementation (architecture decision D12).
 *
 * See the file header for the full measurement model and style-handling
 * rationale. Safe in every environment (Node, jsdom, browser) — the
 * backing table is static data, no DOM or JVM access at runtime.
 */
export class JarMeasurer implements StringMeasurer {
  measure(text: string, font: FontSpec): { width: number; height: number } {
    const metrics = metricsFor(font);
    let widthPerPoint = 0;
    for (const ch of text) {
      widthPerPoint += advanceFor(metrics, ch.codePointAt(0)!);
    }
    return {
      width: widthPerPoint * font.size,
      height: (metrics.ascent + metrics.descent) * font.size,
    };
  }

  getDescent(font: FontSpec, _text: string): number {
    return metricsFor(font).descent * font.size;
  }
}

/** Shared jar-faithful measurer instance — stateless, safe to reuse. */
export const jarMeasurer: StringMeasurer = new JarMeasurer();

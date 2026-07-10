import type { XDimension2D } from '../geom/XDimension2D.js';

/**
 * StringBounder — the text-measurement seam every `TextBlock#
 * calculateDimension` call receives, so a `TextBlock` can size its own
 * internal text runs without owning a font-metrics engine itself.
 *
 * Upstream: klimt/font/StringBounder.java — `calculateDimension(UFont,
 * String): XDimension2D`, plus default methods `matchesProperty(String):
 * boolean` and `getDescent(UFont, String): double`, and
 * `getFileFormat(): FileFormat`.
 *
 * Scope reduction (T3 mission brief — "minimal TextBlock seam ... port
 * ONLY the minimal interface the symbols and EntityImageDescription
 * actually exercise"): only `calculateDimension` is ported.
 * `matchesProperty`/`getFileFormat` have no caller anywhere in
 * `USymbol`/`SymbolContext`/`EntityImageDescription`. The `UFont` param is
 * narrowed to the two fields every upstream caller of this method actually
 * reads off it (`getFamily()`/`getSize2D()`) — porting the full `UFont`
 * class (bold/italic/monospaced/serif flags, AWT `Font` construction) is
 * out of scope; see `driver-text-svg.ts`'s own narrower, differently-scoped
 * local `StringBounder` (a pre-existing, unrelated seam from an earlier
 * task — NOT reused here, since its `calculateDimension` returns a bare
 * `{ width }`, not this port's `XDimension2D`; noted in the T3 report
 * for a possible future consolidation).
 *
 * `getDescent` (dual-measurer conformance/ratchet mission, 2026-07-10 —
 * write-set expansion, journaled): re-added as OPTIONAL (upstream's own
 * default method), since `EntityImageDescriptionSupport.ts`'s
 * `buildTextBlock` needs a real per-line descent for baseline positioning,
 * and T3's original "no override needed" premise no longer holds now that
 * `UGraphicSvg.getStringBounder()` (the render-phase seam) can supply a
 * real one. Optional, not required: every pre-existing implementer of this
 * interface (test doubles, other callers) still satisfies it unchanged.
 *
 * This is a leaf module: it depends only on `XDimension2D` (this task).
 */
export interface StringBounder {
  calculateDimension(font: { readonly family: string; readonly size: number }, text: string): XDimension2D;
  getDescent?(font: { readonly family: string; readonly size: number }, text: string): number;
}

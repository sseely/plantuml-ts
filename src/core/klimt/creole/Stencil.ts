import type { StringBounder } from '../font/StringBounder.js';

/**
 * Stencil — the horizontal-clearance query a `UHorizontalLine` (and its
 * clipping wrapper, `UGraphicStencil`) uses to find how far left/right a
 * horizontal rule may extend at a given `y`: `getStartingX`/`getEndingX`.
 *
 * Upstream: klimt/creole/Stencil.java — a two-method functional
 * interface. Ported in full.
 */
export interface Stencil {
  getStartingX(stringBounder: StringBounder, y: number): number;
  getEndingX(stringBounder: StringBounder, y: number): number;
}

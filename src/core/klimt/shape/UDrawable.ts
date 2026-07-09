import type { UGraphic } from '../UGraphic.js';

/**
 * UDrawable — anything that can render itself into a `UGraphic`.
 * `TextBlock` (this task) extends it for its `drawU` member.
 *
 * Upstream: klimt/shape/UDrawable.java — `void drawU(UGraphic ug)`.
 * Ported in full (one method).
 */
export interface UDrawable {
  drawU(ug: UGraphic): void;
}

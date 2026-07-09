import type { UChange } from './UChange.js';
import type { Paint } from '../paint.js';

/**
 * UBackground — a `UChange` that carries a new fill/background paint.
 * `AbstractCommonUGraphic#apply` reads `getBackColor()` to replace the
 * graphic's current background paint.
 *
 * Upstream: klimt/UBackground.java — `public interface UBackground
 * extends UChange { HColor getBackColor(); }`.
 *
 * Adaptation seam (pre-decided, see T2 mission brief): upstream's
 * `getBackColor()` returns `HColor`. The `HColor` system is not ported;
 * this port carries `Paint` (`src/core/paint.ts`) at every seam where
 * upstream carries `HColor`.
 */
export interface UBackground extends UChange {
  getBackColor(): Paint;
}

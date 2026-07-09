import type { UChange } from './UChange.js';

/**
 * CopyForegroundColorToBackgroundColor — a `UChange` marker with no
 * payload: applying one tells `AbstractCommonUGraphic#apply` to copy
 * the graphic's *current* foreground paint into its background paint.
 *
 * Upstream: klimt/CopyForegroundColorToBackgroundColor.java — `public
 * class CopyForegroundColorToBackgroundColor implements UChange {}`.
 */
export class CopyForegroundColorToBackgroundColor implements UChange {}

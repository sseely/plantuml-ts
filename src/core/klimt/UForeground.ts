import type { UChange } from './UChange.js';
import type { Paint } from '../paint.js';

/**
 * UForeground — a `UChange` that carries a new stroke/foreground paint.
 * `AbstractCommonUGraphic#apply` reads `getColor()` to replace the
 * graphic's current foreground paint.
 *
 * NAMING JUDGMENT CALL (no upstream analog — see T2 mission brief and
 * final summary): upstream has no `UForeground` interface. Upstream's
 * abstract `HColor` class implements `UChange` directly (`klimt/color/
 * HColor.java: public abstract class HColor implements UChange`), so an
 * `HColor` instance *is* the foreground-color change; there is a
 * parallel, real `UBackground` interface + `Back` wrapper for the
 * background case only, because background needs an extra `bg()`
 * wrapping step to stay distinguishable from a plain color via
 * `instanceof`. Since this port replaces `HColor` with the plain
 * `Paint` union type (not a class), `instanceof Paint` is impossible,
 * so foreground changes need their own wrapper too. `UForeground`/
 * `Fore` are modeled on the real upstream `UBackground`/`Back` pair for
 * symmetry, not copied from an upstream name.
 */
export interface UForeground extends UChange {
  getColor(): Paint;
}

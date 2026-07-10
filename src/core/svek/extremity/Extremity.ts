import type { UGraphic } from '../../klimt/UGraphic.js';
import type { UDrawable } from '../../klimt/shape/UDrawable.js';

/**
 * Extremity — shared base for every svek link-end decoration drawable.
 *
 * Upstream: svek/extremity/Extremity.java. Ported: `manageround`
 * (snaps an angle to the nearest cardinal direction — 0/90/180/270/360deg
 * — within a 0.05deg tolerance, else returns it unchanged) and the
 * `getDecorationLength()` default (8 — matching upstream's
 * un-overridden default; most concrete subclasses below override it).
 *
 * NOT ported (reachable-set cut — see T13 report):
 * - `somePoint()` (abstract) / the commented-out
 *   `isTooSmallSoGiveThePointCloserToThisOne` — both exist upstream only
 *   to serve `SvekEdge#solveLine`'s `LinkStrategy.LEGACY_toberemoved`
 *   branch. `Link.getLinkStrategy()` always returns `SIMPLEST`
 *   (`abel/Link.java:103` — the `LEGACY_toberemoved` return is a
 *   commented-out dead line), so that branch never executes in the
 *   current upstream jar. Concrete subclasses below keep whatever
 *   internal "contact"/"dest" field they need for their OWN drawing
 *   math; they just don't expose it via a `somePoint()` getter nobody
 *   calls.
 * - `getDeltaForKal()` — serves `Kal` (state-diagram cross-hatch
 *   collision avoidance), a subsystem this port does not have. Every
 *   `getExtremitySimplier` call site in `SvekEdge.ts` passes `kal=null`
 *   unconditionally (description/component-diagram links don't use
 *   Kal), so `getDeltaForKal()` is never read.
 */
export abstract class Extremity implements UDrawable {
  protected manageround(angle: number): number {
    const deg = (angle * 180.0) / Math.PI;
    if (this.isCloseTo(0, deg)) return 0;
    if (this.isCloseTo(90, deg)) return (90.0 * Math.PI) / 180.0;
    if (this.isCloseTo(180, deg)) return (180.0 * Math.PI) / 180.0;
    if (this.isCloseTo(270, deg)) return (270.0 * Math.PI) / 180.0;
    if (this.isCloseTo(360, deg)) return 0;
    return angle;
  }

  private isCloseTo(value: number, variable: number): boolean {
    return Math.abs(value - variable) < 0.05;
  }

  getDecorationLength(): number {
    return 8;
  }

  abstract drawU(ug: UGraphic): void;
}

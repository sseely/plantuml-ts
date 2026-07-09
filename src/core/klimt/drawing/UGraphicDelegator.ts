import type { UChange } from '../UChange.js';
import type { UShape } from '../UShape.js';
import type { UGraphic } from '../UGraphic.js';
import type { UParam } from '../UParam.js';
import type { UTranslate } from '../UTranslate.js';
import type { StringBounder } from '../font/StringBounder.js';

/**
 * UGraphicDelegator — a `UGraphic` that forwards every read-only member
 * to a wrapped `ug`, leaving `apply` abstract for a subclass to
 * intercept (`AbstractUGraphicHorizontalLine` is the one concrete
 * subclass this port needs).
 *
 * Upstream: klimt/drawing/UGraphicDelegator.java — delegates
 * `matchesProperty`, `getStringBounder`, `getParam`, `draw`,
 * `getColorMapper`, `startUrl`/`closeUrl`, `startGroup`/`closeGroup`,
 * `flushUg`, `getDefaultBackground`, `writeToStream`; `apply` is NOT
 * implemented (inherited abstract from the `UGraphic` interface).
 *
 * Scope reduction (this task — matches T2's own `UGraphic` interface
 * scope, `UGraphic.ts`): this port's `UGraphic` has only 5 members
 * (`apply`, `draw`, `getParam`, `getTranslate`, `getStringBounder`).
 * Delegated here: `getStringBounder`, `getParam`, `draw`, `getTranslate`
 * (T2's own addition, delegated the same way). `matchesProperty`/
 * `getColorMapper`/`startUrl`/`closeUrl`/`startGroup`/`closeGroup`/
 * `flushUg`/`getDefaultBackground`/`writeToStream` are dropped — none is
 * part of this port's `UGraphic` surface, matching every prior scope
 * reduction in this file family.
 */
export abstract class UGraphicDelegator implements UGraphic {
  private readonly ug: UGraphic;

  constructor(ug: UGraphic) {
    this.ug = ug;
  }

  abstract apply(change: UChange): UGraphic;

  getStringBounder(): StringBounder {
    return this.ug.getStringBounder();
  }

  getParam(): UParam {
    return this.ug.getParam();
  }

  draw(shape: UShape): void {
    this.ug.draw(shape);
  }

  getTranslate(): UTranslate {
    return this.ug.getTranslate();
  }

  protected getUg(): UGraphic {
    return this.ug;
  }
}

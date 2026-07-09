import type { UGraphic } from '../../klimt/UGraphic.js';
import { UStroke } from '../../klimt/UStroke.js';
import { Fore } from '../../klimt/Fore.js';
import { Back } from '../../klimt/Back.js';
import type { Paint } from '../../paint.js';

/**
 * SymbolContext — stroke + fore/back paint + shadow/corner styling for a
 * `USymbol`'s draw call. Passed into `USymbol#asSmall`/`asBig`
 * (decoration/symbol/USymbol.java) and applied inside the returned
 * `TextBlock#drawU` (e.g. `USymbolRectangle#asSmall`: `symbolContext
 * .apply(ug)` then `drawRect(ug, ..., symbolContext.getDeltaShadow(), ...)`).
 *
 * Naming note (D9, journaled per T3 mission brief): the class named
 * `SymbolContext` in this port corresponds to upstream's CURRENT
 * `net.sourceforge.plantuml.klimt.Fashion` — field-for-field,
 * method-for-method identical to a class that WAS named
 * `net.sourceforge.plantuml.graphic.SymbolContext` (verified via `git
 * show` on the plantuml history, commit range ending
 * `75835ce2a0d0…`/`4888ac976d4…`, "Start major packages refactoring")
 * before an upstream rename. `USymbol#asSmall`/`asBig`'s parameter is
 * still named `symbolContext` today even though its declared type is
 * `Fashion` — this port's class name preserves that still-current
 * naming intent rather than the post-rename type name, per the mission
 * brief's explicit instruction to name this file `SymbolContext.ts`.
 *
 * Paint seam (D9): upstream's `backColor`/`foreColor` fields are
 * `HColor` (nullable). This port carries `Paint | null` at the same
 * field positions — the identical `Paint`-for-`HColor` substitution
 * `UParam`/`UBackground`/`UForeground` already use (see `UParam.ts`:
 * `getColor(): Paint; getBackcolor(): Paint;`). Field map:
 *   - `backColor: HColor` → `backColor: Paint | null`
 *   - `foreColor: HColor` → `foreColor: Paint | null`
 *   - `stroke: UStroke` → `stroke: UStroke` (already ported, T2)
 *   - `deltaShadow/roundCorner/diagonalCorner: double` → `number`
 * A `null` color applies the SVG `'none'` paint keyword via `Fore`/
 * `Back`, mirroring `HColors.none()`/`HColors.none().bg()` — the same
 * `NONE_PAINT = 'none'` convention `AbstractCommonUGraphic.ts` documents
 * (T2), reused here rather than re-invented.
 *
 * Constructor mechanics (TS-idiom deviation, reported): upstream has TWO
 * constructors — a private 6-arg one and a public 2-arg
 * `(backColor, foreColor)` convenience that delegates to it with
 * `UStroke.simple()`/`0`/`0`/`0` defaults. TS constructors cannot be
 * overloaded with different bodies the way Java's can; this is
 * collapsed into ONE constructor with optional trailing params carrying
 * the same defaults, preserving both upstream call shapes
 * (`new SymbolContext(back, fore)` and the full 6-arg form used by
 * `with*` copies below).
 *
 * Ported: `apply`, `applyColors`, `applyStroke`, both constructors (see
 * above), `withShadow`/`withDeltaShadow` (both — upstream has two
 * identically-implemented methods; preserved verbatim per porting
 * discipline, not deduplicated), `withStroke`, `withBackColor`,
 * `withForeColor`, `withCorner`, all getters, `isShadowing`, `toString`.
 */
export class SymbolContext {
  private readonly backColor: Paint | null;
  private readonly foreColor: Paint | null;
  private readonly stroke: UStroke;
  private readonly deltaShadow: number;
  private readonly roundCorner: number;
  private readonly diagonalCorner: number;

  constructor(
    backColor: Paint | null,
    foreColor: Paint | null,
    stroke: UStroke = UStroke.simple(),
    deltaShadow = 0,
    roundCorner = 0,
    diagonalCorner = 0,
  ) {
    this.backColor = backColor;
    this.foreColor = foreColor;
    this.stroke = stroke;
    this.deltaShadow = deltaShadow;
    this.roundCorner = roundCorner;
    this.diagonalCorner = diagonalCorner;
  }

  toString(): string {
    return `SymbolContext backColor=${SymbolContext.paintToString(this.backColor)}` +
      ` foreColor=${SymbolContext.paintToString(this.foreColor)}`;
  }

  /** `Paint | null` has no upstream `HColor#toString()` analog to defer
   * to (this port's `Paint` is a plain union, not a class) — formats a
   * solid color as-is and a gradient/`null` without risking the default
   * `[object Object]` stringification `@typescript-eslint/no-base-to-
   * string` flags. */
  private static paintToString(paint: Paint | null): string {
    if (paint === null) return 'null';
    if (typeof paint === 'string') return paint;
    return `${paint.color1}${paint.policy}${paint.color2}`;
  }

  apply(ug: UGraphic): UGraphic {
    ug = this.applyColors(ug);
    ug = this.applyStroke(ug);
    return ug;
  }

  applyColors(ug: UGraphic): UGraphic {
    ug = ug.apply(new Fore(this.foreColor ?? 'none'));
    ug = ug.apply(new Back(this.backColor ?? 'none'));
    return ug;
  }

  applyStroke(ug: UGraphic): UGraphic {
    return ug.apply(this.stroke);
  }

  withShadow(deltaShadow2: number): SymbolContext {
    return new SymbolContext(this.backColor, this.foreColor, this.stroke, deltaShadow2, this.roundCorner, this.diagonalCorner);
  }

  withDeltaShadow(deltaShadow2: number): SymbolContext {
    return new SymbolContext(this.backColor, this.foreColor, this.stroke, deltaShadow2, this.roundCorner, this.diagonalCorner);
  }

  withStroke(newStroke: UStroke): SymbolContext {
    return new SymbolContext(this.backColor, this.foreColor, newStroke, this.deltaShadow, this.roundCorner, this.diagonalCorner);
  }

  withBackColor(backColor: Paint | null): SymbolContext {
    return new SymbolContext(backColor, this.foreColor, this.stroke, this.deltaShadow, this.roundCorner, this.diagonalCorner);
  }

  withForeColor(foreColor: Paint | null): SymbolContext {
    return new SymbolContext(this.backColor, foreColor, this.stroke, this.deltaShadow, this.roundCorner, this.diagonalCorner);
  }

  withCorner(roundCorner: number, diagonalCorner: number): SymbolContext {
    return new SymbolContext(this.backColor, this.foreColor, this.stroke, this.deltaShadow, roundCorner, diagonalCorner);
  }

  getBackColor(): Paint | null {
    return this.backColor;
  }

  getForeColor(): Paint | null {
    return this.foreColor;
  }

  getStroke(): UStroke {
    return this.stroke;
  }

  isShadowing(): boolean {
    return this.deltaShadow > 0;
  }

  getDeltaShadow(): number {
    return this.deltaShadow;
  }

  getRoundCorner(): number {
    return this.roundCorner;
  }

  getDiagonalCorner(): number {
    return this.diagonalCorner;
  }
}

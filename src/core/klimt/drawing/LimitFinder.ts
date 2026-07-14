import type { UChange } from '../UChange.js';
import type { UGraphic } from '../UGraphic.js';
import type { UShape } from '../UShape.js';
import type { StringBounder } from '../font/StringBounder.js';
import type { TextBlock } from '../shape/TextBlock.js';
import { UGraphicNo } from './UGraphicNo.js';
import { UTranslate } from '../UTranslate.js';
import { UStroke } from '../UStroke.js';
import { Back } from '../Back.js';
import { Fore } from '../Fore.js';
import { CopyForegroundColorToBackgroundColor } from '../CopyForegroundColorToBackgroundColor.js';
import { MinMax } from '../geom/MinMax.js';
import { MinMaxMutable } from '../geom/MinMaxMutable.js';
import { DotPath } from '../shape/DotPath.js';
import { UComment } from '../shape/UComment.js';
import { UEllipse } from '../shape/UEllipse.js';
import { UEmpty } from '../shape/UEmpty.js';
import { ULine } from '../shape/ULine.js';
import { UPath } from '../shape/UPath.js';
import { UPolygon } from '../shape/UPolygon.js';
import { URectangle } from '../shape/URectangle.js';
import { UText } from '../shape/UText.js';
import { UImage } from '../shape/UImage.js';

/** upstream: `LimitFinder#HACK_X_FOR_POLYGON` — polygon x-extent padding quirk, preserved verbatim. */
const HACK_X_FOR_POLYGON = 10;

/**
 * Structural `TextBlock` test (mirrors `TextBlockUtils.ts`'s local
 * `isTextBlock` type guard): TS interfaces have no runtime tag, so the
 * `shape instanceof TextBlock` upstream dispatch branch is reproduced via
 * duck-typing on the two members OUR `TextBlock` interface requires.
 */
function isTextBlockShape(shape: UShape): shape is TextBlock {
  const candidate = shape as Partial<TextBlock>;
  return typeof candidate.drawU === 'function' && typeof candidate.calculateDimension === 'function';
}

/**
 * LimitFinder — a no-op, measurement-only `UGraphic`: walking a shape
 * tree through it (`tb.drawU(limitFinder)`) accumulates the ink extent
 * of every drawn shape into a `MinMax`, without ever touching a real
 * rendering backend. `TextBlockUtils.getMinMax` is the sole public entry
 * point.
 *
 * Upstream: klimt/drawing/LimitFinder.java, `extends UGraphicNo`. Ported:
 * `create(stringBounder, initToZero)`, `apply(UChange)` (translate
 * composition + change-type whitelist), `draw(shape)`'s per-shape
 * dispatch and EXACT extent math for every shape kind this port has
 * (see the per-branch doc comments below for the preserved quirks: the
 * `-1` corner insets, `HACK_X_FOR_POLYGON = 10`, the UText `-1.5`
 * baseline shift), the private `addPoint` accumulator, `getMaxX/Y`/
 * `getMinX/Y`, `getMinMax()` (infinity -> `MinMax.getEmpty(true)`).
 *
 * Clip-aware `addPoint` — OMITTED (reported, per D1/mission task 3):
 * upstream's `addPoint` only records a point `if (clip == null ||
 * clip.isInside(x, y))`, and `apply(UClip)` seeds/translates `this.clip`.
 * No `UClip.ts` exists anywhere in this port (see
 * `AbstractCommonUGraphic.ts`'s own identical omission note) — there is
 * no `UChange` subtype this port can construct that would ever set a
 * clip, so `addPoint` here always records unconditionally. This is
 * behavior-preserving for every caller that exists today (none can
 * construct a clip either) and reproduces upstream's own fallthrough
 * behavior for an unrecognized `UChange` for free, once `UClip` lands.
 *
 * `apply()` whitelist — narrowed to the change types OUR klimt actually
 * has (mission task 3, explicit): upstream's whitelist is
 * `UAntiAliasing | UBackground | UClip | HColor | UHidden | UStroke |
 * UTranslate | CopyForegroundColorToBackgroundColor`. This port has no
 * `UAntiAliasing.ts`, `UClip.ts`, or `UHidden.ts`, and represents
 * upstream's `HColor implements UChange` (the foreground-color change)
 * as the separate `Fore`/`UForeground` pair (see `UForeground.ts`'s
 * naming-judgment-call note) — the background counterpart is `Back`/
 * `UBackground`. So the whitelist here is `UStroke | UTranslate | Back |
 * Fore | CopyForegroundColorToBackgroundColor`.
 *
 * `draw(shape)` dispatch — shape kinds with NO counterpart in this port
 * are simply absent from the `if`/`else if` chain (omitted, reported):
 * `UImage`/`UImageSvg`/`UImageTikz` (no `UImage*.ts` exists — image
 * embedding is not ported), `UPixel` (not ported; upstream's branch is
 * `addPoint(x, y)`), `UCenteredCharacter` (not ported; upstream's own
 * branch is "// To be done" — empty), `CenteredText`/`SpecialText` (both
 * belong to unported subsystems — activitydiagram3/ftile and net.atmp
 * respectively; upstream's branches are empty "// Ignored"). The
 * `CopyForegroundColorToBackgroundColor` branch IS kept for 1:1
 * dispatch-order parity even though it is dead code in both upstream and
 * here: that class implements `UChange`, not `UShape`, in both codebases,
 * so the `instanceof` check can never actually match at runtime — TS's
 * structural `UShape` (an empty marker interface) permits the check to
 * compile exactly as Java's does.
 *
 * `matchesProperty`/`getColorMapper()` — NOT ported (same reasoning as
 * `UGraphicNo.ts`'s identical omissions: no `StringBounder#
 * matchesProperty` or `ColorMapper` exist in this port).
 */
export class LimitFinder extends UGraphicNo {
  private readonly minmax: MinMaxMutable;

  static create(stringBounder: StringBounder, initToZero: boolean): LimitFinder {
    return new LimitFinder(stringBounder, UTranslate.none(), MinMaxMutable.getEmpty(initToZero));
  }

  private constructor(stringBounder: StringBounder, translate: UTranslate, minmax: MinMaxMutable) {
    super(stringBounder, translate);
    this.minmax = minmax;
  }

  apply(change: UChange): UGraphic {
    const supported =
      change instanceof UStroke ||
      change instanceof UTranslate ||
      change instanceof Back ||
      change instanceof Fore ||
      change instanceof CopyForegroundColorToBackgroundColor;
    if (!supported) {
      throw new Error(`LimitFinder.apply: unsupported UChange ${change.constructor.name}`);
    }
    const tmp = change instanceof UTranslate ? this.getTranslate().compose(change) : this.getTranslate();
    return new LimitFinder(this.getStringBounder(), tmp, this.minmax);
  }

  draw(shape: UShape): void {
    const x = this.getTranslate().getDx();
    const y = this.getTranslate().getDy();
    if (shape instanceof UText) {
      this.drawText(x, y, shape);
    } else if (shape instanceof ULine) {
      this.drawULine(x, y, shape);
    } else if (shape instanceof UEllipse) {
      this.drawEllipse(x, y, shape);
    } else if (shape instanceof UPolygon) {
      this.drawUPolygon(x, y, shape);
    } else if (shape instanceof UPath) {
      this.drawUPath(x, y, shape);
    } else if (shape instanceof URectangle) {
      this.drawRectangle(x, y, shape);
    } else if (shape instanceof DotPath) {
      this.drawDotPath(x, y, shape);
    } else if (shape instanceof UImage) {
      this.drawImage(x, y, shape);
    } else if (shape instanceof UComment) {
      // Ignored — matches upstream's empty `else if (shape instanceof UComment) {}` branch.
    } else if (shape instanceof UEmpty) {
      this.drawEmpty(x, y, shape);
    } else if (isTextBlockShape(shape)) {
      shape.drawU(this);
    } else if (shape instanceof CopyForegroundColorToBackgroundColor) {
      // Ignored — matches upstream's own dead branch (see class doc comment: this class
      // implements UChange, not UShape, in both codebases, so this never matches at runtime).
    } else {
      throw new Error(`LimitFinder.draw: unsupported shape ${shape.constructor.name}`);
    }
    // Faithful 1:1 port of upstream's flat if/else shape dispatch (LimitFinder.java:108-151).
    // #lizard forgives
  }

  private addPoint(x: number, y: number): void {
    // No UClip exists in this port — always records (see class doc comment).
    this.minmax.addPoint(x, y);
  }

  private drawEmpty(x: number, y: number, shape: UEmpty): void {
    this.addPoint(x, y);
    this.addPoint(x + shape.getWidth(), y + shape.getHeight());
  }

  private drawUPath(x: number, y: number, shape: UPath): void {
    this.addPoint(x + shape.getMinX(), y + shape.getMinY());
    this.addPoint(x + shape.getMaxX(), y + shape.getMaxY());
  }

  private drawUPolygon(x: number, y: number, shape: UPolygon): void {
    if (shape.getPoints().length === 0) return;
    this.addPoint(x + shape.getMinX() - HACK_X_FOR_POLYGON, y + shape.getMinY());
    this.addPoint(x + shape.getMaxX() + HACK_X_FOR_POLYGON, y + shape.getMaxY());
  }

  private drawULine(x: number, y: number, shape: ULine): void {
    this.addPoint(x, y);
    this.addPoint(x + shape.getDX(), y + shape.getDY());
  }

  /** The `-1` min-corner inset + `deltaShadow * 2` max-corner growth — upstream quirks, preserved. */
  private drawRectangle(x: number, y: number, shape: URectangle): void {
    this.addPoint(x - 1, y - 1);
    this.addPoint(x + shape.getWidth() - 1 + shape.getDeltaShadow() * 2, y + shape.getHeight() - 1 + shape.getDeltaShadow() * 2);
  }

  private drawDotPath(x: number, y: number, shape: DotPath): void {
    const shapeMinMax = shape.getMinMax();
    this.addPoint(x + shapeMinMax.getMinX(), y + shapeMinMax.getMinY());
    this.addPoint(x + shapeMinMax.getMaxX(), y + shapeMinMax.getMaxY());
  }

  /** @see LimitFinder.java#drawImage (SI5b+E2r T7 write-set expansion,
   *  journaled: `UImage` now exists in this port, D7 -- see `shape/
   *  UImage.ts`'s doc comment). */
  private drawImage(x: number, y: number, shape: UImage): void {
    this.addPoint(x, y);
    this.addPoint(x + shape.getWidth() - 1, y + shape.getHeight() - 1);
  }

  private drawEllipse(x: number, y: number, shape: UEllipse): void {
    this.addPoint(x, y);
    this.addPoint(x + shape.getWidth() - 1 + shape.getDeltaShadow() * 2, y + shape.getHeight() - 1 + shape.getDeltaShadow() * 2);
  }

  /** The `dim.height - 1.5` baseline shift before the four-corner add — upstream quirk, preserved. */
  private drawText(x: number, y: number, text: UText): void {
    const dim = this.getStringBounder().calculateDimension(text.getFontConfiguration(), text.getText());
    const yy = y - (dim.getHeight() - 1.5);
    this.addPoint(x, yy);
    this.addPoint(x, yy + dim.getHeight());
    this.addPoint(x + dim.getWidth(), yy);
    this.addPoint(x + dim.getWidth(), yy + dim.getHeight());
  }

  getMaxX(): number {
    return this.minmax.getMaxX();
  }

  getMaxY(): number {
    return this.minmax.getMaxY();
  }

  getMinX(): number {
    return this.minmax.getMinX();
  }

  getMinY(): number {
    return this.minmax.getMinY();
  }

  getMinMax(): MinMax {
    if (this.minmax.isInfinity()) return MinMax.getEmpty(true);
    return MinMax.fromMutable(this.minmax);
  }
}

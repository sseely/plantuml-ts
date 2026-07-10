import type { UChange } from './UChange.js';
import type { UShape } from './UShape.js';
import type { UGraphic } from './UGraphic.js';
import type { UParam } from './UParam.js';
import { UTranslate } from './UTranslate.js';
import { UStroke } from './UStroke.js';
import { Back } from './Back.js';
import { Fore } from './Fore.js';
import { CopyForegroundColorToBackgroundColor } from './CopyForegroundColorToBackgroundColor.js';
import type { Paint } from '../paint.js';
import type { StringBounder } from './font/StringBounder.js';

/**
 * A shape's runtime constructor, used as the driver-registry key —
 * TypeScript's structural equivalent of Java's `shape.getClass()`.
 */
export type ShapeConstructor<S extends UShape> = (abstract new (
  ...args: never[]
) => S) & { readonly name: string };

/**
 * UDriver — the contract a per-shape renderer implements. `UGraphic
 * #draw` looks one up by the shape's constructor and hands it
 * `(shape, param)`.
 *
 * Upstream: klimt/drawing/UDriver.java — `draw(SHAPE shape, double x,
 * double y, ColorMapper mapper, UParam param, O object)`.
 *
 * Scope reduction (T2 mission brief, explicit — acceptance criterion 3
 * requires only "the registered driver ... receives (shape, param)"):
 * `x`/`y` are dropped because `UParam.getTranslate()` now carries them
 * (see `UParam.ts`); `mapper`/`object` (the backend's native graphics
 * object, e.g. `SvgGraphics`) do not exist yet — they arrive with the
 * concrete backend port in a later task. This interface lives here,
 * not in its own `UDriver.ts` file, because it is not in T2's
 * write-set; promote it once a real backend needs to import it
 * independently of `AbstractCommonUGraphic`.
 */
export interface UDriver<S extends UShape = UShape> {
  draw(shape: S, param: UParam): void;
}

/**
 * Adaptation seam (pre-decided): stand-in for upstream's
 * `HColors.none()` default. `Paint` (`src/core/paint.ts`) has no
 * explicit "unset" variant, so the SVG paint keyword `'none'` is used
 * as the default foreground/background paint — matching the *rendered*
 * meaning of `HColors.none()` (nothing painted) without inventing a new
 * sentinel type.
 */
const NONE_PAINT: Paint = 'none';

/**
 * AbstractCommonUGraphic — the copy-on-apply state chain shared by
 * every concrete `UGraphic` backend. `apply` never mutates `this`; it
 * clones via the subclass-supplied `copyUGraphic()` and mutates only
 * the clone, so an already-handed-out `UGraphic` is unaffected by
 * later `apply()` calls on its descendants.
 *
 * Upstream: klimt/drawing/AbstractCommonUGraphic.java. Ported: the
 * `stroke`/`color`/`backColor`/`translate` fields and their defaults,
 * `basicCopy(other)`, `apply(UChange)`'s translate/stroke/color
 * branches, `getParam()`, `getTranslate()`/`getTranslateX()`/
 * `getTranslateY()`.
 *
 * Folded in from `AbstractUGraphic.java` (T2 mission brief, explicit —
 * acceptance criterion 3 needs working `draw()` dispatch before any
 * concrete shape or backend exists): the driver registry
 * (`registerDriver`/`drivers` map) and `draw(shape)`'s class-keyed
 * lookup. Upstream keeps these on a separate `AbstractUGraphic<O>`
 * layer between this class and concrete backends (`UGraphicSvg`, ...);
 * T2 has no `O` (backend graphics object) yet, so that split has
 * nothing to attach to. A later task should split them back out into
 * `AbstractUGraphic.ts` once a concrete backend exists, restoring
 * upstream's layering.
 *
 * NOT ported / stubbed by omission (report per T2 mission brief):
 * - `UClip`/clip support: no `UClip.ts` exists in this port (not in
 *   T2's write-set; depends on unported geometry). There is no clip
 *   branch in `apply()` at all, and no `getClip()`/`enlargeClip()`
 *   accessor — a `UClip` change is simply a change this port cannot
 *   yet construct, so `apply()`'s upstream fallthrough-on-unrecognized
 *   -type behavior applies to it for free once it exists.
 * - `UPattern`/`UHidden`: same reasoning — not in the write-set, so
 *   `isHidden()`/`getPattern()` are absent from `UParam` too (see
 *   `UParam.ts`).
 * - `basicCopy(HColor defaultBackground, ColorMapper colorMapper)`:
 *   the overload that seeds a fresh root instance. Dropped along with
 *   `getDefaultBackground()`/`getColorMapper()` (see `UGraphic.ts`
 *   scope note) — nothing in T2 constructs a root instance that needs
 *   them.
 * - `StringBounder`: dropped constructor dependency; `getStringBounder
 *   ()` is not part of T2's `UGraphic` (see `UGraphic.ts`).
 * - the driver map is NOT part of `basicCopy` state, matching
 *   upstream: concrete `copyUGraphic()` implementations (e.g.
 *   `UGraphicSvg`) construct a brand-new instance and re-register
 *   drivers in the constructor rather than copying the map, so
 *   `basicCopy` never touches it either (see `UGraphicSvg.java:73-86`,
 *   `register()`).
 */
export abstract class AbstractCommonUGraphic implements UGraphic {
  private stroke: UStroke = UStroke.simple();
  private color: Paint = NONE_PAINT;
  private backColor: Paint = NONE_PAINT;
  private translate: UTranslate = UTranslate.none();

  private readonly drivers = new Map<
    ShapeConstructor<UShape>,
    UDriver<UShape>
  >();

  protected abstract copyUGraphic(): AbstractCommonUGraphic;

  protected basicCopy(other: AbstractCommonUGraphic): void {
    this.translate = other.translate;
    this.stroke = other.stroke;
    this.color = other.color;
    this.backColor = other.backColor;
  }

  protected registerDriver<S extends UShape>(
    ctor: ShapeConstructor<S>,
    driver: UDriver<S>,
  ): void {
    this.drivers.set(ctor, driver);
  }

  apply(change: UChange): UGraphic {
    const copy = this.copyUGraphic();
    if (change instanceof UTranslate) {
      copy.translate = change.compose(copy.translate);
    } else if (change instanceof UStroke) {
      copy.stroke = change;
    } else if (change instanceof Back) {
      copy.backColor = change.getBackColor();
    } else if (change instanceof Fore) {
      copy.color = change.getColor();
    } else if (change instanceof CopyForegroundColorToBackgroundColor) {
      copy.backColor = this.color;
    }
    return copy;
  }

  draw(shape: UShape): void {
    const ctor = shape.constructor as ShapeConstructor<UShape>;
    const driver = this.drivers.get(ctor);
    if (driver === undefined) {
      throw new Error(`No driver registered for shape ${ctor.name}`);
    }
    driver.draw(shape, this.getParam());
  }

  getParam(): UParam {
    return {
      getStroke: () => this.stroke,
      getColor: () => this.color,
      getBackcolor: () => this.backColor,
      getTranslate: () => this.translate,
    };
  }

  getTranslate(): UTranslate {
    return this.translate;
  }

  /**
   * Default implementation of `UGraphic#getStringBounder()` (write-set
   * expansion, T6 -- see `UGraphic.ts`'s doc comment on this method for
   * why it was added). Upstream's `AbstractCommonUGraphic` has no such
   * default -- every concrete backend upstream is constructed with a
   * real `StringBounder`. This port's `AbstractCommonUGraphic` carries
   * no `StringBounder` field at all (T2 dropped it), so subclasses that
   * need real text measurement (e.g. `UGraphicSvg`) override this
   * method themselves; this base throws for any backend that does not
   * (matching this project's error-handling convention: throw for a
   * genuinely unimplemented capability rather than silently returning
   * wrong data). This keeps `tests/unit/core/klimt/model.test.ts`'s
   * pre-existing `TestUGraphic` -- which never calls this method --
   * compiling and passing unchanged.
   */
  getStringBounder(): StringBounder {
    throw new Error('getStringBounder: not supported by this UGraphic backend');
  }

  protected getTranslateX(): number {
    return this.translate.getDx();
  }

  protected getTranslateY(): number {
    return this.translate.getDy();
  }
}

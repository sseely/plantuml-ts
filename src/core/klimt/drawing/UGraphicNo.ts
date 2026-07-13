import type { UChange } from '../UChange.js';
import type { UGraphic } from '../UGraphic.js';
import type { UShape } from '../UShape.js';
import type { UParam } from '../UParam.js';
import { UStroke } from '../UStroke.js';
import { UTranslate } from '../UTranslate.js';
import type { StringBounder } from '../font/StringBounder.js';

/**
 * UGraphicNo — abstract no-op `UGraphic` base: everything a
 * measurement-only subclass (this port's sole subclass, `LimitFinder`)
 * does NOT need to override. Concrete subclasses supply `apply`/`draw`.
 *
 * Upstream: klimt/drawing/UGraphicNo.java, `implements UGraphic`. Ported
 * (matching OUR narrower `UGraphic` interface surface — see the scope
 * note on `UGraphic.ts`): the `stringBounder`/`translate` fields +
 * constructor, `getStringBounder()`, `getTranslate()` (upstream declares
 * this `protected final`; kept public here because OUR `UGraphic`
 * interface — unlike upstream's — declares `getTranslate()` as a public
 * interface member directly, not only on `AbstractCommonUGraphic`), and
 * `getParam()` (upstream returns `new UParamNull()`; this port has no
 * `UParamNull.ts`, so the same all-black/simple-stroke/zero-translate
 * defaults are inlined here as a plain object literal, mirroring how
 * `AbstractCommonUGraphic#getParam` already builds its `UParam` inline).
 *
 * NOT ported (upstream `UGraphic` members with no counterpart on OUR
 * narrower `UGraphic` interface — omitted per this task's explicit scope
 * note, "where upstream methods don't exist in our interface, omit and
 * document"):
 * - `startUrl`/`closeUrl` — need `Url`, not ported.
 * - `startGroup`/`closeGroup` — need `UGroup`'s drawing role (a
 *   `UGroup.ts` exists in this port but only as a data shape, not wired
 *   through `UGraphic`).
 * - `getColorMapper()` — needs `ColorMapper`, not ported.
 * - `getDefaultBackground()` — needs `HColor`/`HColors`, not ported.
 * - `flushUg()` — no counterpart; this port's renderers have no
 *   flush-buffering concept.
 * - `matchesProperty(String)` — needs `StringBounder#matchesProperty`,
 *   which this port's narrower `StringBounder` interface (see
 *   `StringBounder.ts`) does not carry.
 * - `writeToStream(OutputStream, ...)` — N/A for a browser-safe,
 *   SVG-string-returning renderer (no Node `OutputStream` equivalent).
 */
export abstract class UGraphicNo implements UGraphic {
  private readonly stringBounder: StringBounder;
  private readonly translate: UTranslate;

  protected constructor(stringBounder: StringBounder, translate: UTranslate) {
    this.stringBounder = stringBounder;
    this.translate = translate;
  }

  abstract apply(change: UChange): UGraphic;
  abstract draw(shape: UShape): void;

  getParam(): UParam {
    return {
      getStroke: () => UStroke.simple(),
      getColor: () => 'black',
      getBackcolor: () => 'black',
      getTranslate: () => UTranslate.none(),
    };
  }

  getStringBounder(): StringBounder {
    return this.stringBounder;
  }

  getTranslate(): UTranslate {
    return this.translate;
  }
}

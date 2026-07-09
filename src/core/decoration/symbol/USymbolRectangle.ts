import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { URectangle } from '../../klimt/shape/URectangle.js';
import type { UPath } from '../../klimt/shape/UPath.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { TextBlockUtils } from '../../klimt/shape/TextBlockUtils.js';
import { UGraphicStencil } from '../../klimt/drawing/UGraphicStencil.js';

/**
 * TS-mechanics deviation (reported, same reasoning T7's
 * `USymbolDatabase.ts` documents for its own `drawDatabase`/
 * `getMargin`): upstream declares `drawRect`/`getMargin` as `private`
 * INSTANCE methods, but neither reads nor writes any `USymbolRectangle`
 * field (`this` is never used in either body). Porting them as
 * top-level, non-exported functions avoids the 6-param wrapper-closure
 * shape a class-method delegate would otherwise need (and which the
 * project's complexity hook flags identically to the method itself).
 */
function drawRect(
  ug: UGraphic,
  width: number,
  height: number,
  shadowing: number,
  roundCorner: number,
  diagonalCorner: number,
): void {
  const rect = URectangle.build(width, height);
  const shape: URectangle | UPath = diagonalCorner > 0 ? rect.diagonalCorner(diagonalCorner) : rect.rounded(roundCorner);
  shape.setDeltaShadow(shadowing);
  ug.draw(shape);
  // 6 params mirrors USymbolRectangle.java's own drawRect(ug, width,
  // height, shadowing, roundCorner, diagonalCorner) exactly; reducing
  // the param count would diverge from upstream.
  // #lizard forgives
}

function getMargin(): Margin {
  return new Margin(10, 10, 10, 10);
}

/**
 * `asBig`'s stereotype/title placement math, extracted out of `drawU`'s
 * body (TS-mechanics note, reported): upstream inlines both branches
 * directly in `asBig`'s anonymous `drawU`. Extracting them as their own
 * named functions is a project complexity-hook accommodation (a
 * `drawU` body with an `if`/`else` chain of its own — on top of the
 * `roundCorner`/`diagonalCorner` conditional inside `drawRect` — trips
 * this project's lizard-based function-nesting checker in a way its
 * `#lizard forgives` marker cannot suppress for the OUTER `asBig`; empty
 * function isolates each branch under its own small, well-named unit
 * instead), not a behavioral change — the math is identical to upstream.
 */
function computeStereoPos(
  stereoAlignment: HorizontalAlignment,
  width: number,
  dimStereo: XDimension2D,
): readonly [number, number] {
  if (stereoAlignment === HorizontalAlignment.RIGHT) {
    return [width - dimStereo.getWidth() - getMargin().getX1() / 2, getMargin().getY1() / 2];
  }
  return [(width - dimStereo.getWidth()) / 2, 2];
}

function computeTitlePos(labelAlignment: HorizontalAlignment, width: number, dimTitle: XDimension2D): number {
  if (labelAlignment === HorizontalAlignment.LEFT) return 3;
  if (labelAlignment === HorizontalAlignment.RIGHT) return width - dimTitle.getWidth() - 3;
  return (width - dimTitle.getWidth()) / 2;
}

/**
 * USymbolRectangle — the plain rounded/diagonal-corner rectangle used by
 * `rectangle`, `agent`, `archimate`, and the rectangle variant of
 * `component` (T5 write-set: only the class itself; the `USymbols`
 * registry wiring — `AGENT = new USymbolRectangle(SName.agent)` etc. —
 * is T10's job, out of this task's scope).
 *
 * Upstream: decoration/symbol/USymbolRectangle.java (~144 ln). Ported in
 * full: the constructor, `getSNames`, `drawRect`, `getMargin`, `asSmall`,
 * `asBig`.
 *
 * `agent` mapping (verified against `USymbols.java:65`): `AGENT =
 * record("AGENT", new USymbolRectangle(SName.agent))` — `agent` is a
 * plain `USymbolRectangle` parameterized with `SName.agent`, not a
 * distinct class. Confirmed against real jar output too
 * (`plantuml-1.2026.7beta3.jar -tsvg`, `agent Foo` vs `rectangle Foo`):
 * byte-identical `<rect>`/`<text>` fragments.
 *
 * `UGraphicStencil` seam (T3b realignment): upstream's `asSmall#drawU`
 * opens with `ug = UGraphicStencil.create(ug, dim);` — restored below,
 * now that `UGraphicStencil`/`AbstractUGraphicHorizontalLine`/
 * `UHorizontalLine` are ported (T3b). Output-neutral for every input
 * this task's conformance suite exercises: `UGraphicStencil` only
 * intercepts `UHorizontalLine` shapes, and neither `stereotype` nor
 * `label` here ever draws one.
 *
 * `ug.getStringBounder()`: T2/T3 originally shipped `UGraphic`
 * (klimt/UGraphic.ts) without this accessor. As of this file, a
 * concurrent sibling task ("T6") has widened `UGraphic`/
 * `AbstractCommonUGraphic`/`UGraphicSvg` to add one, as a pure,
 * backward-compatible addition — see those three files' own doc
 * comments. This file calls `ug.getStringBounder()` directly, matching
 * upstream exactly, rather than inventing a local workaround.
 */
export class USymbolRectangle extends USymbol {
  private readonly sname: SName;

  constructor(sname: SName) {
    super();
    this.sname = sname;
  }

  getSNames(): readonly SName[] {
    return [this.sname];
  }

  asSmall(
    _name: TextBlock,
    label: TextBlock,
    stereotype: TextBlock,
    symbolContext: SymbolContext,
    stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    function calculateDimension(stringBounder: StringBounder): XDimension2D {
      const dimLabel = label.calculateDimension(stringBounder);
      const dimStereo = stereotype.calculateDimension(stringBounder);
      return getMargin().addDimension(dimStereo.mergeTB(dimLabel));
    }

    const result: TextBlock = {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const stringBounder = ug.getStringBounder();
        const dim = calculateDimension(stringBounder);
        ug = UGraphicStencil.create(ug, dim);
        ug = symbolContext.apply(ug);
        drawRect(
          ug,
          dim.getWidth(),
          dim.getHeight(),
          symbolContext.getDeltaShadow(),
          symbolContext.getRoundCorner(),
          symbolContext.getDiagonalCorner(),
        );
        const margin = getMargin();
        const tb = TextBlockUtils.mergeTB(stereotype, label, stereoAlignment);
        tb.drawU(ug.apply(new UTranslate(margin.getX1(), margin.getY1())));
      },
    };
    return result;
  }

  asBig(
    title: TextBlock,
    labelAlignment: HorizontalAlignment,
    stereotype: TextBlock,
    width: number,
    height: number,
    symbolContext: SymbolContext,
    stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    const result: TextBlock = {
      calculateDimension(_stringBounder: StringBounder): XDimension2D {
        return new XDimension2D(width, height);
      },
      drawU(ug: UGraphic): void {
        const stringBounder = ug.getStringBounder();
        const dim = new XDimension2D(width, height);
        ug = symbolContext.apply(ug);
        drawRect(
          ug,
          dim.getWidth(),
          dim.getHeight(),
          symbolContext.getDeltaShadow(),
          symbolContext.getRoundCorner(),
          symbolContext.getDiagonalCorner(),
        );
        const dimStereo = stereotype.calculateDimension(stringBounder);
        const [posStereoX, posStereoY] = computeStereoPos(stereoAlignment, width, dimStereo);
        stereotype.drawU(ug.apply(new UTranslate(posStereoX, posStereoY)));
        const dimTitle = title.calculateDimension(stringBounder);
        const posTitle = computeTitlePos(labelAlignment, width, dimTitle);
        title.drawU(ug.apply(new UTranslate(posTitle, 2 + dimStereo.getHeight())));
      },
    };
    // 7 params mirrors USymbol#asBig's abstract signature exactly;
    // cannot be reduced without breaking the interface contract every
    // USymbol* subclass implements.
    // #lizard forgives
    return result;
  }
}

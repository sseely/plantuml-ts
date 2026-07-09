import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UGraphicStencil } from '../../klimt/drawing/UGraphicStencil.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import type { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { USymbol } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';

/**
 * USymbolSimpleAbstract — the template-method base for "icon above
 * label, stereotype above both" symbols (actor/person/boundary-family
 * shapes T5-T9 layer on top of via `getDrawing`). Was deliberately
 * deferred by T3 ("USymbol.ts"'s own doc comment) because its `asSmall`
 * needs `UGraphicStencil` — this task ports that base, so this class is
 * now portable.
 *
 * Upstream: decoration/symbol/USymbolSimpleAbstract.java. Ported:
 * `asSmall` (incl. the anonymous `TextBlock`'s `drawU`/
 * `calculateDimension`), the abstract `getDrawing` hook, `asBig`
 * (throws, matching upstream's `UnsupportedOperationException`
 * verbatim).
 *
 * `Objects.requireNonNull(stereotype)` (reported, dropped): upstream's
 * `asSmall` opens with a null-check on `stereotype`. This port's
 * `asSmall` signature (`USymbol.ts`) types `stereotype: TextBlock`
 * non-nullable — the type system already guarantees what upstream
 * checks at runtime, so the check is dead code under this port's type
 * contract (project convention: no defensive guards for states the type
 * system already rules out). Not a behavioral divergence for any
 * constructible TS caller.
 */
export abstract class USymbolSimpleAbstract extends USymbol {
  protected abstract getDrawing(symbolContext: SymbolContext): TextBlock;

  asSmall(
    _name: TextBlock,
    label: TextBlock,
    stereotype: TextBlock,
    symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    const stickman = this.getDrawing(symbolContext);

    const calculateDimension = (stringBounder: StringBounder): XDimension2D => {
      const dimLabel = label.calculateDimension(stringBounder);
      const dimStereo = stereotype.calculateDimension(stringBounder);
      const dimActor = stickman.calculateDimension(stringBounder);
      return XDimension2D.mergeLayoutT12B3(dimStereo, dimActor, dimLabel);
    };

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const stringBounder = ug.getStringBounder();
        const dimLabel = label.calculateDimension(stringBounder);
        const dimStereo = stereotype.calculateDimension(stringBounder);
        const dimStickMan = stickman.calculateDimension(stringBounder);
        const dimTotal = calculateDimension(stringBounder);
        const stickmanX = (dimTotal.getWidth() - dimStickMan.getWidth()) / 2;
        const stickmanY = dimStereo.getHeight();
        const appliedUg = symbolContext.apply(ug);
        stickman.drawU(appliedUg.apply(new UTranslate(stickmanX, stickmanY)));

        const labelX = (dimTotal.getWidth() - dimLabel.getWidth()) / 2;
        const labelY = dimStickMan.getHeight() + dimStereo.getHeight();

        // Actor bug? (upstream's own comment, preserved verbatim)
        const ug2 = UGraphicStencil.create(appliedUg, dimLabel);
        label.drawU(ug2.apply(new UTranslate(labelX, labelY)));

        const stereoX = (dimTotal.getWidth() - dimStereo.getWidth()) / 2;
        stereotype.drawU(appliedUg.apply(UTranslate.dx(stereoX)));
      },
    };
  }

  asBig(
    _title: TextBlock,
    _labelAlignment: HorizontalAlignment,
    _stereotype: TextBlock,
    _width: number,
    _height: number,
    _symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    throw new Error('USymbolSimpleAbstract.asBig: not supported (matches upstream UnsupportedOperationException)');
  }
}

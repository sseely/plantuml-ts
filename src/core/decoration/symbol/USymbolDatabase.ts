import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UPath } from '../../klimt/shape/UPath.js';
import { Back } from '../../klimt/Back.js';
import { TextBlockUtils } from '../../klimt/shape/TextBlockUtils.js';
import { AbstractUGraphicHorizontalLine } from '../../klimt/drawing/AbstractUGraphicHorizontalLine.js';
import type { UHorizontalLine } from '../../klimt/shape/UHorizontalLine.js';
import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';

/**
 * USymbolDatabase — the "database" descriptive/deployment element: a
 * cylinder body (two cubic caps, straight sides) plus a second cubic
 * "mouth" line 10px below the top cap, giving the classic database-
 * cylinder silhouette.
 *
 * Upstream: decoration/symbol/USymbolDatabase.java (176 ln). Ported:
 * `getSNames`, `drawDatabase`/`getClosingPath` (as top-level functions —
 * see the TS-mechanics deviation note below), `getMargin`, `asSmall`,
 * `asBig`, `suppHeightBecauseOfShape`.
 *
 * TS-mechanics deviation (reported, applies to every `drawXxx`/
 * `getClosingPath` function in this file and its four siblings —
 * USymbolQueue/Storage/Hexagon/Process.ts): upstream declares these as
 * `private` INSTANCE methods of the `USymbolDatabase` class, but neither
 * reads nor writes any instance field (`this` is never used in either
 * body). Porting them as top-level exported functions (not class
 * methods) makes the core, testable geometry directly callable by this
 * task's conformance tests (T7 acceptance criterion 2: "given the Brief
 * 1 database fragment's dimensions, the ported USymbolDatabase
 * reproduces those exact cubics"). `getMargin` is exported the same way,
 * for the same testability reason (the family's "asymmetric clearance
 * constants" the mission brief calls out).
 *
 * `ug.getStringBounder()` (this task's own finding at write time,
 * resolved by a concurrent sibling task): T2/T3 originally shipped
 * `UGraphic` (klimt/UGraphic.ts) without a `getStringBounder()`
 * accessor. As of this file, a concurrent task (its own doc comments
 * self-identify as "T6", working on USymbolComponent1/2/Node/Artifact/
 * File/Frame) has widened `UGraphic`/`AbstractCommonUGraphic`/
 * `UGraphicSvg` to add one, as a pure, backward-compatible addition (see
 * those three files' own doc comments). This file calls
 * `ug.getStringBounder()` directly, matching upstream exactly, rather
 * than re-inventing a local cast-based workaround — do not reintroduce
 * one if this file is revisited before T6 lands; if `UGraphic` ever
 * regresses to lacking this method, `asSmall`/`asBig`'s `drawU` will
 * fail to type-check here, which is the correct, visible failure mode
 * (not a silently-broken cast).
 *
 * Seam — `TextBlockUtils.mergeTB` (reported, same for every USymbol* in
 * this family — Database/Queue/Storage call it with `HorizontalAlignment
 * .CENTER`, Hexagon/Process with the caller-supplied `stereoAlignment`):
 * upstream's `klimt/shape/TextBlockUtils.java` is a shared static utility
 * with no port anywhere in this codebase. Porting it as its own
 * `TextBlockUtils.ts` sits outside this task's declared write-set and
 * risks collision with sibling USymbol-porting tasks that need the exact
 * same file (mirrors this port's already-flagged `USymbolSimpleAbstract`
 * collision concern, `USymbol.ts`'s own doc comment). This file — and
 * its four siblings — instead defines the ONE overload each needs
 * (`TextBlockVertical`'s 2-block, `HorizontalAlignment`-aware vertical
 * stack; klimt/shape/TextBlockVertical.java#drawU/
 * calculateDimensionSlow) as a private, non-exported `mergeTB` helper.
 * `getBackcolor`/`getPorts`/`getInnerPosition` branches are not
 * reproduced — `TextBlock` (T3) already dropped `getBackcolor`/
 * `getInnerPosition` from its own ported surface with the same "no
 * caller in scope" reasoning; `Ports`/`WithPorts` are a separate,
 * unported svek subsystem.
 *
 * Seam — `MyUGraphicDatabase` (T3b realignment): restored below, now
 * that `AbstractUGraphicHorizontalLine`/`UHorizontalLine` are ported
 * (T3b) — `asSmall`'s merged stereotype/label `TextBlock` draws through
 * it instead of the plain `ug`, matching upstream's own wrap. Output-
 * neutral for this task's conformance suite: this element's stereotype/
 * label content never draws a `UHorizontalLine` (that shape only
 * appears for member separators inside a class-style body, which this
 * element's `TextBlock`s never carry).
 *
 * Seam — `UEmpty` (reported, this class only): upstream's `drawDatabase`
 * ends with `ug.apply(new UTranslate(width, height)).draw(new
 * UEmpty(10, 10))` — a draw of an invisible 10x10 shape purely to pad the
 * overall SVG bounding box 10px right of `width`/below `height` for a
 * compositing consumer. `klimt/shape/UEmpty.java` has no port in this
 * codebase, and `UGraphicSvg.register()` registers no driver for it
 * either. Dropped — no observable effect on this file's own cylinder
 * geometry, and not exercised by this task's conformance tests.
 */

const DATABASE_SUPP_HEIGHT = 15;

/** Upstream: `USymbolDatabase#getClosingPath` — the cylinder's cap line
 * (drawn a second time, 10px below the top cap, back-colored `none`, to
 * give the illusion of a database's "lid"). */
export function getClosingPath(width: number): UPath {
  const closing = UPath.none();
  closing.moveTo(0, 10);
  closing.cubicTo(0, 20, width / 2, 20, width / 2, 20);
  closing.cubicTo(width / 2, 20, width, 20, width, 10);
  return closing;
}

/** Upstream: `USymbolDatabase#drawDatabase` — see the module doc
 * comment's `UEmpty` entry for the one dropped tail statement. */
export function drawDatabase(ug: UGraphic, width: number, height: number, shadowing: number): void {
  const shape = UPath.none();
  shape.setDeltaShadow(shadowing);

  shape.moveTo(0, 10);
  shape.cubicTo(0, 0, width / 2, 0, width / 2, 0);
  shape.cubicTo(width / 2, 0, width, 0, width, 10);
  shape.lineTo(width, height - 10);
  shape.cubicTo(width, height, width / 2, height, width / 2, height);
  shape.cubicTo(width / 2, height, 0, height, 0, height - 10);
  shape.lineTo(0, 10);

  ug.draw(shape);

  const closing = getClosingPath(width);
  ug.apply(new Back('none')).draw(closing);
}

/**
 * MyUGraphicDatabase — wraps `ug` so any `UHorizontalLine` drawn through
 * it (a Creole separator inside the merged stereotype/label content)
 * bends its endpoints to follow the cylinder's curved cap
 * (`getClosingPath`) instead of drawing a straight rule across the
 * whole symbol width.
 *
 * Upstream: `USymbolDatabase.MyUGraphicDatabase` (Java inner class).
 * Ported in full: the constructor, `copy`, `drawHline`.
 *
 * Output-neutral for this task's conformance suite (T3b realignment):
 * neither `stereotype` nor `label` here ever draws a `UHorizontalLine`,
 * so this wrap has no observable effect on any existing golden fragment
 * — restored purely for upstream structural fidelity.
 */
class MyUGraphicDatabase extends AbstractUGraphicHorizontalLine {
  private readonly endingX: number;

  constructor(ug: UGraphic, endingX: number) {
    super(ug);
    this.endingX = endingX;
  }

  protected copy(ug: UGraphic): AbstractUGraphicHorizontalLine {
    return new MyUGraphicDatabase(ug, this.endingX);
  }

  protected drawHline(ug: UGraphic, line: UHorizontalLine, translate: UTranslate): void {
    const closing = getClosingPath(this.endingX);
    const translated = ug.apply(translate);
    translated.apply(line.getStroke()).apply(new Back('none')).apply(UTranslate.dy(-15)).draw(closing);
    if (line.isDouble()) {
      translated.apply(line.getStroke()).apply(new Back('none')).apply(UTranslate.dy(-15 + 2)).draw(closing);
    }
    line.drawTitleInternal(translated, 0, this.endingX, 0, true);
  }
}

/** Upstream: `USymbolDatabase#getMargin`. */
export function getMargin(): Margin {
  return new Margin(10, 10, 24, 5);
}

export class USymbolDatabase extends USymbol {
  getSNames(): readonly SName[] {
    return ['database'];
  }

  asSmall(
    _name: TextBlock,
    label: TextBlock,
    stereotype: TextBlock,
    symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    const calculateDimension = (stringBounder: StringBounder): XDimension2D => {
      const dimLabel = label.calculateDimension(stringBounder);
      const dimStereo = stereotype.calculateDimension(stringBounder);
      return getMargin().addDimension(dimStereo.mergeTB(dimLabel));
    };

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const dim = calculateDimension(ug.getStringBounder());
        ug = symbolContext.apply(ug);
        drawDatabase(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow());
        const margin = getMargin();
        const tb = TextBlockUtils.mergeTB(stereotype, label, HorizontalAlignment.CENTER);
        const ug2 = new MyUGraphicDatabase(ug, dim.getWidth());
        tb.drawU(ug2.apply(new UTranslate(margin.getX1(), margin.getY1())));
      },
    };
  }

  asBig(
    title: TextBlock,
    _labelAlignment: HorizontalAlignment,
    stereotype: TextBlock,
    width: number,
    height: number,
    symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    const calculateDimension = (_stringBounder: StringBounder): XDimension2D => new XDimension2D(width, height);

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const stringBounder = ug.getStringBounder();
        const dim = calculateDimension(stringBounder);
        ug = symbolContext.apply(ug);
        drawDatabase(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow());

        const dimStereo = stereotype.calculateDimension(stringBounder);
        const posStereo = (width - dimStereo.getWidth()) / 2;
        stereotype.drawU(ug.apply(new UTranslate(posStereo, 2 + 20)));

        const dimTitle = title.calculateDimension(stringBounder);
        const posTitle = (width - dimTitle.getWidth()) / 2;
        title.drawU(ug.apply(new UTranslate(posTitle, 2 + 20 + dimStereo.getHeight())));
      },
    };
    // 7 params mirrors the abstract USymbol#asBig signature (T3,
    // USymbol.ts — out of this task's write-set) and upstream's own
    // USymbolDatabase#asBig(TextBlock, HorizontalAlignment, TextBlock,
    // double, double, Fashion, HorizontalAlignment); not reducible
    // without breaking the override contract.
    // #lizard forgives
  }

  suppHeightBecauseOfShape(): number {
    return DATABASE_SUPP_HEIGHT;
  }
}

import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import type { MagneticBorder } from '../../klimt/geom/MagneticBorder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { XPoint2D } from '../../klimt/geom/XPoint2D.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UPath } from '../../klimt/shape/UPath.js';
import { UPolygon } from '../../klimt/shape/UPolygon.js';
import { ULine } from '../../klimt/shape/ULine.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { TextBlockUtils } from '../../klimt/shape/TextBlockUtils.js';
import { UGraphicStencil } from '../../klimt/drawing/UGraphicStencil.js';

// marginTitleX1/X2/X3/Y0/Y1/Y2 — upstream's own field names
// (USymbolFolder.java), kept verbatim per this project's porting
// discipline. `marginTitleY0` has no reader upstream either (dead
// field, ported for name-path parity only).
const marginTitleX1 = 3;
const marginTitleX2 = 3;
const marginTitleX3 = 7;
const marginTitleY1 = 3;
const marginTitleY2 = 3;

function getWTitle(width: number, dimTitle: XDimension2D): number {
  const titleWidth = dimTitle.getWidth();
  if (titleWidth === 0) return Math.max(30, width / 4);
  return titleWidth + marginTitleX1 + marginTitleX2;
}

function getHTitle(dimTitle: XDimension2D): number {
  if (dimTitle.getWidth() === 0) return 10;
  return dimTitle.getHeight() + marginTitleY1 + marginTitleY2;
}

function getMargin(): Margin {
  return new Margin(10, 10 + 10, 10 + 3, 10);
}

function drawFolder(
  ug: UGraphic,
  width: number,
  height: number,
  dimName: XDimension2D,
  shadowing: number,
  roundCorner: number,
): void {
  const wtitle = getWTitle(width, dimName);
  const htitle = getHTitle(dimName);

  const shape = roundCorner === 0 ? folderPolygon(wtitle, htitle, width, height) : folderPath(wtitle, htitle, width, height, roundCorner);
  shape.setDeltaShadow(shadowing);

  ug.draw(shape);
  ug.apply(UTranslate.dy(htitle)).draw(ULine.hline(wtitle + marginTitleX3));
  // #lizard forgives -- 6 params mirrors USymbolFolder.java#drawFolder's
  // own signature exactly (decoration/symbol/USymbolFolder.java);
  // collapsing any of these would diverge from upstream's own parameter
  // list.
}

function folderPolygon(wtitle: number, htitle: number, width: number, height: number): UPolygon {
  const poly = new UPolygon();
  poly.addPoint(0, 0);
  poly.addPoint(wtitle, 0);
  poly.addPoint(wtitle + marginTitleX3, htitle);
  poly.addPoint(width, htitle);
  poly.addPoint(width, height);
  poly.addPoint(0, height);
  poly.addPoint(0, 0);
  return poly;
}

function folderPath(wtitle: number, htitle: number, width: number, height: number, roundCorner: number): UPath {
  const half = roundCorner / 2;
  const path = UPath.none();
  path.moveTo(half, 0);
  path.lineTo(wtitle - half, 0);
  path.arcTo(new XPoint2D(wtitle, half), half * 1.5, 0, 1);
  path.lineTo(wtitle + marginTitleX3, htitle);
  path.lineTo(width - half, htitle);
  path.arcTo(new XPoint2D(width, htitle + half), half, 0, 1);
  path.lineTo(width, height - half);
  path.arcTo(new XPoint2D(width - half, height), half, 0, 1);
  path.lineTo(half, height);
  path.arcTo(new XPoint2D(0, height - half), half, 0, 1);
  path.lineTo(0, half);
  path.arcTo(new XPoint2D(half, 0), half, 0, 1);
  path.closePath();
  return path;
}

/**
 * `USymbolFolder`'s anonymous `MagneticBorder` (asSmall/asBig each
 * construct one, byte-identical apart from which `dimTitle` source
 * they read from) — pulled out as a shared factory since both
 * anonymous-class bodies in `USymbolFolder.java` are otherwise
 * verbatim duplicates of each other (upstream itself does not share
 * them; this port shares the pure force-computation to stay under the
 * per-function complexity budget without changing either call site's
 * observable behavior).
 */
function folderMagneticBorder(getDim: (sb: StringBounder) => XDimension2D, getDimTitle: (sb: StringBounder) => XDimension2D): MagneticBorder {
  return {
    getForceAt(position: { readonly x: number; readonly y: number }, stringBounder?: StringBounder): UTranslate {
      if (stringBounder === undefined) throw new Error('USymbolFolder MagneticBorder.getForceAt: stringBounder is required');
      const dim = getDim(stringBounder);
      const dimTitle = getDimTitle(stringBounder);
      const wtitle = getWTitle(dim.getWidth(), dimTitle);
      const htitle = getHTitle(dimTitle);

      if (position.x >= wtitle && position.y >= 0 && position.y <= htitle) return new UTranslate(0, htitle);
      if (position.y <= 0 && position.x >= wtitle + marginTitleX3) return new UTranslate(0, htitle);
      if (position.y <= 0 && position.x >= wtitle - marginTitleX3) {
        const delta = position.x - (wtitle - marginTitleX3);
        const how = delta / (2 * marginTitleX3);
        return new UTranslate(0, htitle * how);
      }
      return UTranslate.none();
    },
  };
}

/**
 * USymbolFolder — a folder outline with a name-tab notch cut into the
 * top-left corner (a `UPolygon` when `roundCorner === 0`, an arced
 * `UPath` otherwise), plus a horizontal rule under the tab. Reachable
 * as both `folder` (`showTitle = false` — the tab is a fixed-size
 * placeholder, no text drawn in it) and `package` (`showTitle = true`
 * — the entity's own title is drawn INSIDE the tab) via
 * `USymbols.java`'s two registrations
 * (`new USymbolFolder(SName.folder, false)` /
 * `new USymbolFolder(SName.package_, true)`).
 *
 * Upstream: decoration/symbol/USymbolFolder.java (247 ln, public class
 * — unlike most of this family, referenced directly by name from
 * `USymbols.java`).
 */
export class USymbolFolder extends USymbol {
  private readonly sname: SName;
  private readonly showTitle: boolean;

  constructor(sname: SName, showTitle: boolean) {
    super();
    this.showTitle = showTitle;
    this.sname = sname;
  }

  override toString(): string {
    // Bug-for-bug port of USymbolFolder.java#toString, which also just
    // concatenates Object's default (debug-only, never asserted on by any
    // caller) toString with the showTitle flag.
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return `${super.toString()} ${this.showTitle}`;
  }

  getSNames(): readonly SName[] {
    return [this.sname];
  }

  asSmall(
    title: TextBlock,
    label: TextBlock,
    stereotype: TextBlock,
    symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    const showTitle = this.showTitle;

    function getDimTitle(stringBounder: StringBounder): XDimension2D {
      return showTitle ? title.calculateDimension(stringBounder) : new XDimension2D(40, 15);
    }

    function calculateDimension(stringBounder: StringBounder): XDimension2D {
      const dimName = getDimTitle(stringBounder);
      const dimLabel = label.calculateDimension(stringBounder);
      const dimStereo = stereotype.calculateDimension(stringBounder);
      return getMargin().addDimension(dimName.mergeTB(dimStereo, dimLabel));
    }

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const dim = calculateDimension(ug.getStringBounder());
        ug = UGraphicStencil.create(ug, dim);
        ug = symbolContext.apply(ug);
        const dimTitle = getDimTitle(ug.getStringBounder());
        drawFolder(ug, dim.getWidth(), dim.getHeight(), dimTitle, symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
        const margin = getMargin();
        const tb = TextBlockUtils.mergeTB(stereotype, label, HorizontalAlignment.CENTER);
        if (showTitle) title.drawU(ug.apply(new UTranslate(4, 3)));

        tb.drawU(ug.apply(new UTranslate(margin.getX1(), margin.getY1() + dimTitle.getHeight())));
      },
      getMagneticBorder(): MagneticBorder {
        return folderMagneticBorder(calculateDimension, getDimTitle);
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
    function calculateDimension(_stringBounder: StringBounder): XDimension2D {
      return new XDimension2D(width, height);
    }

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const stringBounder = ug.getStringBounder();
        const dim = calculateDimension(stringBounder);
        ug = symbolContext.apply(ug);
        const dimTitle = title.calculateDimension(stringBounder);
        drawFolder(ug, dim.getWidth(), dim.getHeight(), dimTitle, symbolContext.getDeltaShadow(), symbolContext.getRoundCorner());
        title.drawU(ug.apply(new UTranslate(4, 2)));
        const dimStereo = stereotype.calculateDimension(stringBounder);
        const dimStereoWidth = dimStereo.getWidth();
        const posStereo = (width - dimStereoWidth) / 2;

        stereotype.drawU(ug.apply(new UTranslate(4 + posStereo, 2 + getHTitle(dimTitle))));
      },
      getMagneticBorder(): MagneticBorder {
        return folderMagneticBorder(calculateDimension, (sb) => title.calculateDimension(sb));
      },
      // #lizard forgives -- 7 params mirrors USymbol#asBig's abstract
      // signature (decoration/symbol/USymbol.java) exactly; cannot be
      // reduced without breaking the interface contract every USymbol*
      // subclass implements.
    };
  }
}

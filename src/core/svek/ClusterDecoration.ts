/**
 * ClusterDecoration — resolves a Cluster's `USymbol` (an explicit one, or
 * a `PackageStyle` fallback) and draws its `asBig` chrome (body outline +
 * title + stereotype) at the cluster's own geometry.
 *
 * Upstream: svek/ClusterDecoration.java (94 ln) — ported in full, adapted
 * for the missing `Style`/`StyleBuilder`/`PName`/`SName` system (grep of
 * this codebase confirms `StyleSignatureBasic`/`PName`/`SName`-as-a-real-
 * type do not exist here — a separate, unstarted mission). `backColor`/
 * `borderColor`/`shadowing`/`roundCorner`/`diagonalCorner`/both
 * alignments arrive here already resolved by the caller, the same
 * Paint-for-HColor adaptation this codebase already uses (see
 * `SymbolContext.ts`'s D9 note) rather than re-deriving them from a
 * `Style` object with no port.
 *
 * `RectangleArea` (klimt/geom/RectangleArea.java, not yet ported —
 * nothing else in this task's write-set needs its full ~200-line API)
 * is narrowed to `ClusterGeometry`: the exact three facts
 * `ClusterDecoration` itself reads off it (`getPosition()`, `getWidth()`,
 * `getHeight()`) — mirrors this project's `Point2D`/`SName`-as-string
 * scope-reduction convention (see `UTranslate.ts`, `USymbol.ts`).
 */
import type { TextBlock } from '../klimt/shape/TextBlock.js';
import type { UGraphic } from '../klimt/UGraphic.js';
import type { UStroke } from '../klimt/UStroke.js';
import type { Paint } from '../paint.js';
import type { UTranslate } from '../klimt/UTranslate.js';
import type { HorizontalAlignment } from '../klimt/geom/HorizontalAlignment.js';
import type { USymbol } from '../decoration/symbol/USymbol.js';
import { SymbolContext } from '../decoration/symbol/SymbolContext.js';
import type { PackageStyleName } from './PackageStyle.js';
import { packageStyleToUSymbol } from './PackageStyle.js';

/**
 * Cluster's own drawing geometry — the exact `RectangleArea` surface
 * `ClusterDecoration`/`Cluster#drawU` read (see module doc comment).
 */
export interface ClusterGeometry {
  readonly position: UTranslate;
  readonly width: number;
  readonly height: number;
}

/** Upstream: `ClusterDecoration#guess(USymbol, PackageStyle)` (private
 * static). An explicit `symbol` always wins; only when it is absent does
 * a `packageStyle` fallback (or `null`, matching upstream's `null`
 * `PackageStyle` guess-source) get consulted. */
function guess(symbol: USymbol | null, packageStyle: PackageStyleName | null): USymbol | null {
  if (symbol !== null) return symbol;
  if (packageStyle === null) return null;
  return packageStyleToUSymbol(packageStyle);
}

export class ClusterDecoration {
  private readonly symbol: USymbol | null;
  private readonly title: TextBlock;
  private readonly stereo: TextBlock;
  private readonly geometry: ClusterGeometry;
  private readonly defaultStroke: UStroke;

  constructor(
    packageStyle: PackageStyleName | null,
    symbol: USymbol | null,
    title: TextBlock,
    stereo: TextBlock,
    geometry: ClusterGeometry,
    stroke: UStroke,
  ) {
    this.symbol = guess(symbol, packageStyle);
    this.title = title;
    this.stereo = stereo;
    this.geometry = geometry;
    this.defaultStroke = stroke;
    // #lizard forgives -- 6 params mirrors ClusterDecoration.java's own
    // constructor signature (svek/ClusterDecoration.java) exactly.
  }

  drawU(
    ug: UGraphic,
    backColor: Paint | null,
    borderColor: Paint | null,
    shadowing: number,
    roundCorner: number,
    titleAlignment: HorizontalAlignment,
    stereoAlignment: HorizontalAlignment,
    diagonalCorner: number,
  ): void {
    const asBig = this.getTextBlock(
      backColor,
      borderColor,
      shadowing,
      roundCorner,
      titleAlignment,
      stereoAlignment,
      diagonalCorner,
    );
    asBig.drawU(ug.apply(this.geometry.position));
    // #lizard forgives -- 8 params mirrors ClusterDecoration.java#drawU's
    // own signature (svek/ClusterDecoration.java) exactly; collapsing any
    // of these would diverge from upstream's own parameter list.
  }

  getTextBlock(
    backColor: Paint | null,
    borderColor: Paint | null,
    shadowing: number,
    roundCorner: number,
    titleAlignment: HorizontalAlignment,
    stereoAlignment: HorizontalAlignment,
    diagonalCorner: number,
  ): TextBlock {
    const symbol = this.symbol;
    if (symbol === null) throw new Error('ClusterDecoration.getTextBlock: no USymbol resolved (upstream: UnsupportedOperationException)');

    const biColor = new SymbolContext(backColor, borderColor);
    const symbolContext = biColor.withShadow(shadowing).withStroke(this.defaultStroke).withCorner(roundCorner, diagonalCorner);
    return symbol.asBig(this.title, titleAlignment, this.stereo, this.geometry.width, this.geometry.height, symbolContext, stereoAlignment);
    // #lizard forgives -- 7 params mirrors ClusterDecoration.java#getTextBlock's
    // own signature exactly.
  }
}

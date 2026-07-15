/**
 * EntityImageDescriptionDelegates — every private-instance-method body
 * `EntityImageDescription` delegates to (`buildDesc`, `buildStereo`, the
 * three link-scanning helpers, `computeShieldMargins`, `hideTextOffsets`,
 * `requireGroups`).
 *
 * Split out of `EntityImageDescriptionSupport.ts` (E2r/L1, mechanical only
 * — not an upstream divergence) purely to stay under this project's
 * 500-line complexity-hook ceiling once that file's text-construction seam
 * grew to accommodate the ported creole stripe/atom pipeline — this
 * project's established "500-line splits" workaround, same precedent as
 * the original `EntityImageDescription.ts`/`EntityImageDescriptionSupport
 * .ts` split.
 */
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import type { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import type { FontConfiguration } from '../../klimt/shape/UText.js';
import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { TextBlockUtils } from '../../klimt/shape/TextBlockUtils.js';
import type { AtomImageResolver } from '../../creole-atoms.js';
import type { USymbol } from '../../decoration/symbol/USymbol.js';
import type { UGraphicWithGroups } from '../DecorateEntityImage.js';
import { Margins, buildTextBlock } from './EntityImageDescriptionSupport.js';
import type {
  EntityImageDescriptionLabels,
  EntityImageDescriptionPaint,
  EntityImageDescriptionLinkInfo,
} from './EntityImageDescription.js';

/** Upstream: the `desc` local-variable if/else-if/else chain. */
export function buildDesc(
  symbol: USymbol,
  labels: EntityImageDescriptionLabels,
  paint: EntityImageDescriptionPaint,
  atomImageResolverFor?: (font: FontConfiguration) => AtomImageResolver,
): TextBlock {
  const isPackageLeaf = symbol.getSNames()[0] === 'package_';
  const displayEqualsCode = labels.displayText === labels.codeName;
  const isWhite = labels.displayText.trim().length === 0;
  if ((displayEqualsCode && isPackageLeaf) || isWhite) {
    return TextBlockUtils.empty(paint.minimumWidth ?? 0, 0);
  }
  const font = displayEqualsCode ? paint.fontTitle : (paint.fontBody ?? paint.fontTitle);
  return buildTextBlock(labels.displayText, font, paint.titleAlignment, atomImageResolverFor?.(font), paint.wrapWidth ?? 0);
}

/** Upstream: the `stereo` local-variable if/else-if/else chain, minus
 *  the sprite branch (EntityImageDescription.ts's doc comment). */
export function buildStereo(
  stereotypeLabels: readonly string[],
  fontStereo: FontConfiguration,
  resolveAtomImage?: AtomImageResolver,
): TextBlock {
  if (stereotypeLabels.length === 0) return TextBlockUtils.empty(0, 0);
  const text = stereotypeLabels.map((label) => `«${label}»`).join('\n');
  const block = buildTextBlock(text, fontStereo, HorizontalAlignment.CENTER, resolveAtomImage);
  return TextBlockUtils.withMargin(block, 1, 1, 0, 0);
}

/** Upstream: `EntityImageDescription#hasSomeHorizontalLinkVisible`. */
export function hasSomeHorizontalLinkVisible(links: readonly EntityImageDescriptionLinkInfo[]): boolean {
  return links.some((link) => link.length === 1 && !link.isInvis);
}

/** Upstream: `EntityImageDescription#isThereADoubleLink`. */
export function isThereADoubleLink(links: readonly EntityImageDescriptionLinkInfo[]): boolean {
  const seen = new Set<string>();
  for (const link of links) {
    if (seen.has(link.otherEntityId)) return true;
    seen.add(link.otherEntityId);
  }
  return false;
}

/** Upstream: `EntityImageDescription#hasSomeHorizontalLinkDoubleDecorated`. */
export function hasSomeHorizontalLinkDoubleDecorated(links: readonly EntityImageDescriptionLinkInfo[]): boolean {
  return links.some((link) => link.length === 1 && link.isDoubleDecorated);
}

/** Upstream: the dimension math inside `getShield` (after the four
 *  early-return guards). */
export function computeShieldMargins(stereo: TextBlock, desc: TextBlock, asSmall: TextBlock, stringBounder: StringBounder): Margins {
  const dimStereo = stereo.calculateDimension(stringBounder);
  const dimDesc = desc.calculateDimension(stringBounder);
  const dimSmall = asSmall.calculateDimension(stringBounder);
  const x = Math.max(dimStereo.getWidth(), dimDesc.getWidth());
  const dimSmallWidth = dimSmall.getWidth();
  let suppX = x - dimSmallWidth;
  if (suppX < 1) suppX = 1;
  const y = Math.max(1, dimDesc.getHeight(), dimStereo.getHeight());
  return new Margins(suppX / 2, suppX / 2, y, y);
}

/** Shared `posx1`/`posx2` (+ the three dimensions they derive from) —
 *  upstream duplicates this exact computation once in `drawU`'s
 *  `hideText` block and once in `getOverscanX`; both still read
 *  upstream's own `(dimSmall.getWidth() - dimX.getWidth()) / 2` formula
 *  unchanged. */
export function hideTextOffsets(
  asSmall: TextBlock,
  desc: TextBlock,
  stereo: TextBlock,
  stringBounder: StringBounder,
): { posx1: number; posx2: number; dimSmall: XDimension2D; dimDesc: XDimension2D; dimStereo: XDimension2D } {
  const dimSmall = asSmall.calculateDimension(stringBounder);
  const dimDesc = desc.calculateDimension(stringBounder);
  const dimStereo = stereo.calculateDimension(stringBounder);
  const dimSmallWidth = dimSmall.getWidth();
  const posx1 = (dimSmallWidth - dimDesc.getWidth()) / 2;
  const posx2 = (dimSmallWidth - dimStereo.getWidth()) / 2;
  return { posx1, posx2, dimSmall, dimDesc, dimStereo };
}

/** Narrows `ug` to `UGraphicWithGroups` — duplicated locally per
 *  `DecorateEntityImage.ts`'s/`Cluster.ts`'s own one-local-helper-
 *  per-call-site convention (that module's own `requireGroups` is not
 *  exported). */
export function requireGroups(ug: UGraphic): UGraphicWithGroups {
  const candidate = ug as Partial<UGraphicWithGroups>;
  if (typeof candidate.startGroup !== 'function' || typeof candidate.closeGroup !== 'function') {
    throw new Error('EntityImageDescription: ug does not support startGroup/closeGroup (see UGraphicSvg)');
  }
  return ug as UGraphicWithGroups;
}

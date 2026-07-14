/**
 * driver-image-svg.ts — the `UImage` → SVG `<image>` driver (SI5b+E2r T7,
 * D7). See `shape/UImage.ts`'s doc comment for why this is a scoped
 * sibling of upstream's `DriverImagePng`/`DriverImageSvgSvg` (both still
 * D3′-deferred throwing stubs, `driver-svg-stubs.ts`) rather than a port of
 * either — this driver only ever receives a pre-built href/width/height,
 * never a `PortableImage`/`UImageSvg` to encode itself.
 */

import type { UDriver } from '../../AbstractCommonUGraphic.js';
import type { UParam } from '../../UParam.js';
import type { UImage } from '../../shape/UImage.js';
import type { SvgGraphics } from './svg-graphics.js';

/** `UImage` → SVG `<image>`, via `SvgGraphics#svgImageDataUri`
 *  (`svg-graphics-elements.ts`). */
export class DriverImageSvg implements UDriver<UImage> {
  constructor(private readonly svg: SvgGraphics) {}

  draw(image: UImage, param: UParam): void {
    const x = param.getTranslate().getDx();
    const y = param.getTranslate().getDy();
    this.svg.svgImageDataUri(x, y, image.getWidth(), image.getHeight(), image.getHref());
  }
}

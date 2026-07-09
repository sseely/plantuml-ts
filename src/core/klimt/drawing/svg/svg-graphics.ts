/**
 * svg-graphics.ts — the single upstream-named `SvgGraphics` entry point.
 * Split boundary #4 of 4 for SvgGraphics.java — see
 * `svg-graphics-core.ts`'s doc comment for the full split rationale and
 * file-by-file breakdown. This file assembles the chain
 * (`SvgGraphicsCore` → `SvgGraphicsShadow` → `SvgGraphicsElements` →
 * `SvgGraphics`) and adds the group/link management, comment/metadata
 * emission, and the D3′ throwing stubs.
 *
 * D3′ stubs (interactive links, images, sprites — out of scope, throw a
 * message naming D3′): `openLink`, `closeLink`, `svgImage` (one method
 * covering both upstream overloads — `PortableImage` and `UImageSvg` —
 * plus `svgImageUnsecure`, none of which are ported; sprites route
 * through `svgImage` upstream too, so no separate sprite method exists
 * to stub). `LinkData` (upstream: a private nested class building the
 * `<a>` element's `xlink:*` attributes) is not ported either — nothing
 * can construct one once `openLink` always throws before ever pushing
 * onto `activeLinks`.
 *
 * D3′ extended (this task's own finding, not in the mission brief's D3′
 * list, applying the same throw-with-citation treatment): `getMetadataHex`
 * / `addCommentMetadata`. Upstream's `getMetadataHex` calls
 * `TranscoderUtil.getDefaultTranscoderProtected().encode(comment)` — the
 * deflate+base64 diagram-source encoder used for the `<?plantuml-src ...?>`
 * click-to-edit PI. `TranscoderUtil` is not part of this task's read-set
 * and is not ported anywhere in this codebase yet, so both throw citing
 * "D3-prime (extended)" rather than silently no-op-ing a metadata feature.
 *
 * NOT ported (out of scope, reported once for the whole class — see the
 * other three files for their own NOT-ported notes): `drawPathIterator`
 * (`svg-graphics-elements.ts`, AWT `PathIterator` dependency); the
 * multi-stop-gradient `createSvgGradient(HColorLinearGradient,
 * ColorMapper)` overload, `buildLinearGradientKey`, `formatPercent`,
 * `formatOpacity` (`svg-graphics-core.ts`, no `HColorLinearGradient`
 * representation in this klimt port's Paint-for-HColor seam).
 *
 * `activeLinks` is kept as a field (always empty, since `openLink` never
 * populates it) purely so `closeTopActiveLinkIfNeeded`/
 * `addTopOpenedLinkIfNeeded` — upstream's group/link-interleaving guards,
 * which `startGroup`/`closeGroup` call unconditionally — can be ported
 * with their exact control flow rather than special-cased away.
 */

import { SvgGraphicsElements } from './svg-graphics-elements.js';
import type { XmlNode } from './xml-writer.js';
import { UGroupType } from '../../shape/UGroup.js';

export type { SvgOption } from './svg-graphics-core.js';
// LengthAdjust/TransparentFillBehavior are as-const objects (a value AND
// a type under the same name) — re-exported as values so `LengthAdjust
// .SPACING` etc. remain usable through this single entry point, not just
// their type.
export { basicSvgOption, LengthAdjust, TransparentFillBehavior } from './svg-graphics-core.js';
export type { TextOptions, RectangleGeometry } from './svg-graphics-elements.js';

/** Upstream: `SvgGraphics.META_HEADER`. */
export const META_HEADER = '<!--SRC=[';

/**
 * Upstream: `SvgGraphics.getMetadataHex(String)`. D3′ (extended) throwing
 * stub — see the module doc comment above.
 */
export function getMetadataHex(_comment: string): string {
  throw new Error('deferred per D3-prime (extended): metadata encoding requires TranscoderUtil, not ported');
}

/**
 * SvgGraphics — see the module doc comment above.
 *
 * Upstream: `SvgGraphics.java`. Ported in full: `closeTopPendingElement`,
 * `closeTopActiveLinkIfNeeded`, `addTopOpenedLinkIfNeeded`, `closeGroup`,
 * `startGroup`, `addComment`, `addCommentMetadata` (throws — see above).
 */
export class SvgGraphics extends SvgGraphicsElements {
  // Always empty — see the module doc comment above for why this field
  // exists despite nothing ever populating it.
  private readonly activeLinks: readonly unknown[] = [];

  private closeTopPendingElement(): void {
    const element = this.pendingElements[0]!;
    this.pendingElements.shift();
    if (element.getFirstChild() !== null) this.getG().appendChild(element);
  }

  private closeTopActiveLinkIfNeeded(): void {
    /* v8 ignore start -- unreachable: `activeLinks` is always empty
     * while `openLink` is a D3' throwing stub (see the module doc
     * comment above); kept for structural fidelity. */
    if (this.activeLinks.length > 0) {
      if (this.pendingElements[0]!.getTagName() !== 'a') {
        throw new Error('Expected top pending element to be a link.');
      }
      this.closeTopPendingElement();
    }
    /* v8 ignore stop */
    for (const elt of this.pendingElements) {
      /* v8 ignore next -- unreachable for the same reason: no pending
       * element is ever tagged "a" without `openLink`. */
      if (elt.getTagName() === 'a') throw new Error('closeTopActiveLinkIfNeeded: invalid state');
    }
  }

  private addTopOpenedLinkIfNeeded(): void {
    if (this.activeLinks.length === 0) return;
    // Unreachable: `openLink` is a D3′ throwing stub, so `activeLinks`
    // can never gain an entry. Kept for structural fidelity with
    // upstream's group/link interleaving logic.
  }

  /** D3′ throwing stub — see the module doc comment above. */
  openLink(_url: string, _title: string | null, _target: string | null): void {
    throw new Error('deferred per D3-prime: interactive links (openLink/closeLink) not yet ported');
  }

  /** D3′ throwing stub — see the module doc comment above. */
  closeLink(): void {
    throw new Error('deferred per D3-prime: interactive links (openLink/closeLink) not yet ported');
  }

  /** Upstream: `closeGroup()`. */
  closeGroup(): void {
    if (this.pendingElements.length === 0) throw new Error('closeGroup: no pending element');
    this.closeTopActiveLinkIfNeeded();
    this.closeTopPendingElement();
    this.addTopOpenedLinkIfNeeded();
  }

  /** Upstream: `startGroup(Map<UGroupType, String>)`. */
  startGroup(typeIdents: ReadonlyMap<UGroupType, string>): void {
    if (typeIdents.size === 0) throw new Error('startGroup: typeIdents must not be empty');
    this.closeTopActiveLinkIfNeeded();
    this.pendingElements.unshift(this.document.createElement('g'));
    for (const [key, value] of typeIdents) {
      this.document.applyGroupAttribute(this.pendingElements[0]!, key, value);
    }
    this.addTopOpenedLinkIfNeeded();
  }

  /** Upstream: `addComment(String)`. */
  addComment(comment: string): void {
    this.getG().appendComment(comment);
  }

  /** Upstream: `addCommentMetadata(String)`. Throws via `getMetadataHex`
   * (D3′ extended) — see the module doc comment above. */
  addCommentMetadata(metadata: string): void {
    const signature = getMetadataHex(metadata);
    this.getG().appendProcessingInstruction('plantuml-src', signature);
  }

  /**
   * D3′ throwing stub covering both upstream `svgImage` overloads
   * (`PortableImage`, `UImageSvg`) and `svgImageUnsecure` — see the
   * module doc comment above.
   */
  svgImage(..._args: readonly unknown[]): void {
    throw new Error('deferred per D3-prime: image embedding (PNG/inline SVG base64) not yet ported');
  }
}

// Re-exported so callers building a `<g>` attribute map for `startGroup`
// don't need a separate import from `../../shape/UGroup.js`.
export { UGroupType };
export type { XmlNode };
